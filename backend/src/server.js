import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { loadConfig } from './config.js';
import { clearSessionCookie, createSessionCookie, hashPassword, readSessionCookie, verifyPassword } from './auth.js';
import { getPool, migrate, findUserByUsername, findUserById, createUser, listUsers, updateUserPassword, deleteUser, userCount } from './db.js';
import { probeService, proxyRequest } from './proxy.js';
import { createPosterHandler } from './posters.js';
import { createQbittorrentClient } from './qbittorrent.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const STATIC_DIR = fileURLToPath(new URL('../static/', import.meta.url));
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.woff2': 'font/woff2' };

async function serveStatic(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const file = pathname === '/' ? 'index.html' : ['/favicon.svg', '/hmmarr-logo.svg'].includes(pathname) ? pathname.slice(1) : /^\/assets\/[a-zA-Z0-9._-]+$/.test(pathname) ? pathname.slice(1) : null;
  if (!file) return false;
  const fullPath = join(STATIC_DIR, file);
  let info;
  try { info = await stat(fullPath); } catch { return false; }
  if (!info.isFile()) return false;
  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(file)] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://image.tmdb.org https://artworks.thetvdb.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(fullPath).pipe(response);
  return true;
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  response.end(body === null ? '' : JSON.stringify(body));
}

async function readJson(request, limit = 16384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new Error('invalid_json'); }
}

const publicService = (s) => ({ name: s.name, label: s.label, apiVersion: s.apiVersion, configured: true });
const publicUser = (user) => ({ id: user.id, username: user.username, isAdmin: user.is_admin });
const validUsername = (value) => typeof value === 'string' && /^[A-Za-z0-9._-]{3,32}$/.test(value);
const validPassword = (value) => typeof value === 'string' && value.length >= 12 && value.length <= 256;

async function sessionUser(request, config, pool) {
  const claims = readSessionCookie(request, config);
  if (!claims) return null;
  const user = await findUserById(pool, claims.userId);
  return user?.session_version === claims.sessionVersion ? user : null;
}
const log = (level, event, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, event, ...fields })}\n`);

export function createAppServer(config, pool) {
  const servePoster = createPosterHandler();
  const qbittorrent = config.services.qbittorrent ? createQbittorrentClient(config.services.qbittorrent, config.requestTimeoutMs) : null;
  return http.createServer(async (request, response) => {
    const started = performance.now();
    const requestId = request.headers['x-request-id'] || randomUUID();
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    response.once('finish', () =>
      log('info', 'request', { requestId, method: request.method, path: request.url?.split('?')[0], status: response.statusCode, durationMs: Math.round(performance.now() - started) })
    );

    try {
      const parsed = new URL(request.url || '/', 'http://hmmarr.local');
      const { pathname } = parsed;

      if (await serveStatic(request, response, pathname)) return;

      // ── Health ──────────────────────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/healthz')
        return sendJson(response, 200, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });

      // ── Auth status ───────────────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/auth/status') {
        const user = await sessionUser(request, config, pool);
        return sendJson(response, 200, { authRequired: true, authenticated: Boolean(user), user: user ? publicUser(user) : null });
      }

      // ── Login ─────────────────────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(request);
        const { username, password } = body;
        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
          return sendJson(response, 400, { error: 'username_and_password_required', requestId });
        const user = await findUserByUsername(pool, username.trim());
        if (!user || !(await verifyPassword(password, user.password_hash)))
          return sendJson(response, 401, { error: 'invalid_credentials', requestId });
        return sendJson(response, 200, { authenticated: true, user: publicUser(user) }, { 'set-cookie': createSessionCookie(config, user) });
      }

      // ── Logout ────────────────────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/logout')
        return sendJson(response, 200, { authenticated: false }, { 'set-cookie': clearSessionCookie() });

      // ── All routes below require a current user ──────────────────────────────
      const currentUser = await sessionUser(request, config, pool);
      if (!currentUser)
        return sendJson(response, 401, { error: 'authentication_required', requestId });

      if (request.method === 'POST' && pathname === '/api/auth/password') {
        const body = await readJson(request);
        if (typeof body.currentPassword !== 'string' || !(await verifyPassword(body.currentPassword, (await findUserByUsername(pool, currentUser.username)).password_hash)))
          return sendJson(response, 403, { error: 'incorrect_current_password', requestId });
        if (!validPassword(body.newPassword))
          return sendJson(response, 400, { error: 'password_must_be_12_to_256_characters', requestId });
        const hash = await hashPassword(body.newPassword);
        const sessionVersion = await updateUserPassword(pool, currentUser.id, hash);
        return sendJson(response, 200, { changed: true }, { 'set-cookie': createSessionCookie(config, { ...currentUser, session_version: sessionVersion }) });
      }

      const posterMatch = pathname.match(/^\/api\/posters\/(radarr|sonarr)\/([1-9]\d*)\.jpg$/);
      if (request.method === 'GET' && posterMatch) {
        const service = config.services[posterMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        const version = parsed.searchParams.get('lastWrite') || '';
        if (version.length > 64) return sendJson(response, 400, { error: 'invalid_poster_version', requestId });
        try {
          return await servePoster(response, service, posterMatch[2], version, config.requestTimeoutMs);
        } catch (error) {
          const status = error.message === 'poster_not_found' ? 404 : error.name === 'TimeoutError' ? 504 : 502;
          return sendJson(response, status, { error: status === 404 ? 'poster_not_found' : 'poster_unavailable', requestId });
        }
      }

      // ── Services ───────────────────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/services')
        return sendJson(response, 200, Object.values(config.services).map(publicService));

      const statusMatch = pathname.match(/^\/api\/services\/(radarr|sonarr|bazarr|prowlarr|qbittorrent)\/status$/);
      if (request.method === 'GET' && statusMatch) {
        const service = config.services[statusMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        if (service.name === 'qbittorrent') {
          try {
            const version = await qbittorrent.call('app/version');
            return sendJson(response, 200, { name: service.name, label: service.label, online: true, version: version.replace(/^v/, ''), appName: service.label });
          } catch (cause) {
            return sendJson(response, 502, { name: service.name, label: service.label, online: false, error: cause.code || 'unreachable' });
          }
        }
        const result = await probeService(service, config.statusTimeoutMs);
        return sendJson(response, result.online ? 200 : 502, result);
      }

      const qbMatch = pathname.match(/^\/api\/qbittorrent\/(app|transfer|torrents)\/([A-Za-z]+)$/);
      if (qbMatch) {
        if (!qbittorrent) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        try {
          const params = request.method === 'GET' ? Object.fromEntries(parsed.searchParams) : await readJson(request);
          return sendJson(response, 200, await qbittorrent.call(`${qbMatch[1]}/${qbMatch[2]}`, request.method, params));
        } catch (cause) {
          return sendJson(response, cause.status || 502, { error: cause.code || 'qbittorrent_unavailable', requestId });
        }
      }

      // ── Admin: user management ─────────────────────────────────────────────
      if (pathname.startsWith('/api/admin/') && !currentUser.is_admin)
        return sendJson(response, 403, { error: 'admin_required', requestId });

      if (request.method === 'GET' && pathname === '/api/admin/users')
        return sendJson(response, 200, await listUsers(pool));

      if (request.method === 'POST' && pathname === '/api/admin/users') {
        const body = await readJson(request);
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        if (!validUsername(username))
          return sendJson(response, 400, { error: 'username_must_be_3_to_32_letters_numbers_dots_dashes_or_underscores', requestId });
        if (!validPassword(body.password))
          return sendJson(response, 400, { error: 'password_must_be_12_to_256_characters', requestId });
        const hash = await hashPassword(body.password);
        try {
          const user = await createUser(pool, username, hash);
          return sendJson(response, 201, publicUser(user));
        } catch (err) {
          if (err.code === '23505') return sendJson(response, 409, { error: 'username_taken', requestId });
          throw err;
        }
      }

      const resetPasswordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
      if (request.method === 'PUT' && resetPasswordMatch) {
        const target = await findUserByUsername(pool, decodeURIComponent(resetPasswordMatch[1]));
        if (!target) return sendJson(response, 404, { error: 'user_not_found', requestId });
        if (target.is_admin) return sendJson(response, 403, { error: 'admin_password_self_service_only', requestId });
        const body = await readJson(request);
        if (!validPassword(body.password))
          return sendJson(response, 400, { error: 'password_must_be_12_to_256_characters', requestId });
        await updateUserPassword(pool, target.id, await hashPassword(body.password));
        return sendJson(response, 200, { changed: true });
      }

      const deleteUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (request.method === 'DELETE' && deleteUserMatch) {
        const target = await findUserByUsername(pool, decodeURIComponent(deleteUserMatch[1]));
        if (!target) return sendJson(response, 404, { error: 'user_not_found', requestId });
        if (target.is_admin) return sendJson(response, 403, { error: 'cannot_delete_admin', requestId });
        await deleteUser(pool, target.username);
        return sendJson(response, 200, { deleted: true });
      }

      // ── Proxy ─────────────────────────────────────────────────────────────────
      const rawPathname = (request.url || '/').split('?')[0];
      const proxyMatch = rawPathname.match(/^\/api\/proxy\/(radarr|sonarr|bazarr|prowlarr)(\/.*)$/);
      if (proxyMatch) {
        const service = config.services[proxyMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        return proxyRequest({ request, response, service, rawPath: proxyMatch[2], search: parsed.search, timeoutMs: config.requestTimeoutMs, requestId });
      }

      return sendJson(response, 404, { error: 'not_found', requestId });
    } catch (error) {
      log('error', 'unhandled', { message: error.message });
      const status = error.message === 'body_too_large' ? 413 : error.message === 'invalid_json' ? 400 : 500;
      return sendJson(response, status, { error: error.message || 'internal_error', requestId });
    }
  });
}

export async function start(config = loadConfig()) {
  const pool = getPool(config);

  // Run DB migration
  await migrate(pool);
  log('info', 'db_migrated');

  // Bootstrap first user if env vars are set and DB is empty
  if (config.bootstrapUser && config.bootstrapPass) {
    const count = await userCount(pool);
    if (count === 0) {
      const hash = await hashPassword(config.bootstrapPass);
      await createUser(pool, config.bootstrapUser, hash, true);
      log('info', 'bootstrap_user_created', { username: config.bootstrapUser });
    }
  }

  const server = createAppServer(config, pool);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
  log('info', 'server_started', { host: config.host, port: config.port, services: Object.keys(config.services) });
  return server;
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) start().catch((error) => { log('error', 'startup_failed', { message: error.message }); process.exitCode = 1; });
