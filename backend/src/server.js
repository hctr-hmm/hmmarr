import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { loadConfig } from './config.js';
import { clearSessionCookie, createSessionCookie, hashPassword, isAuthenticated, verifyPassword } from './auth.js';
import { getPool, migrate, findUserByUsername, createUser, listUsers, deleteUser, userCount } from './db.js';
import { probeService, proxyRequest } from './proxy.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const STATIC_DIR = fileURLToPath(new URL('../static/', import.meta.url));
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.woff2': 'font/woff2' };

async function serveStatic(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const file = pathname === '/' ? 'index.html' : pathname === '/favicon.svg' ? 'favicon.svg' : /^\/assets\/[a-zA-Z0-9._-]+$/.test(pathname) ? pathname.slice(1) : null;
  if (!file) return false;
  const fullPath = join(STATIC_DIR, file);
  let info;
  try { info = await stat(fullPath); } catch { return false; }
  if (!info.isFile()) return false;
  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(file)] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': file === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://image.tmdb.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
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
const log = (level, event, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, event, ...fields })}\n`);

export function createAppServer(config, pool) {
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
      if (request.method === 'GET' && pathname === '/api/auth/status')
        return sendJson(response, 200, { authRequired: config.authRequired, authenticated: isAuthenticated(request, config) });

      // ── Login ─────────────────────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(request);
        const { username, password } = body;
        if (!username || !password)
          return sendJson(response, 400, { error: 'username_and_password_required', requestId });
        const user = await findUserByUsername(pool, username);
        if (!user || !(await verifyPassword(password, user.password_hash)))
          return sendJson(response, 401, { error: 'invalid_credentials', requestId });
        return sendJson(response, 200, { authenticated: true }, { 'set-cookie': createSessionCookie(config) });
      }

      // ── Logout ────────────────────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/logout')
        return sendJson(response, 200, { authenticated: false }, { 'set-cookie': clearSessionCookie(config) });

      // ── All routes below require authentication ───────────────────────────
      if (!isAuthenticated(request, config))
        return sendJson(response, 401, { error: 'authentication_required', requestId });

      // ── Services ───────────────────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/services')
        return sendJson(response, 200, Object.values(config.services).map(publicService));

      const statusMatch = pathname.match(/^\/api\/services\/(radarr|sonarr|bazarr|prowlarr)\/status$/);
      if (request.method === 'GET' && statusMatch) {
        const service = config.services[statusMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        const result = await probeService(service, config.statusTimeoutMs);
        return sendJson(response, result.online ? 200 : 502, result);
      }

      // ── Admin: user management ─────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/admin/users') {
        const users = await listUsers(pool);
        return sendJson(response, 200, users);
      }

      if (request.method === 'POST' && pathname === '/api/admin/users') {
        const body = await readJson(request);
        const { username, password } = body;
        if (!username || !password || username.length < 1 || password.length < 8)
          return sendJson(response, 400, { error: 'username required; password must be at least 8 characters', requestId });
        const hash = await hashPassword(password);
        try {
          const user = await createUser(pool, username, hash);
          return sendJson(response, 201, { id: user.id, username: user.username });
        } catch (err) {
          if (err.code === '23505') return sendJson(response, 409, { error: 'username_taken', requestId });
          throw err;
        }
      }

      const deleteUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (request.method === 'DELETE' && deleteUserMatch) {
        const deleted = await deleteUser(pool, decodeURIComponent(deleteUserMatch[1]));
        return sendJson(response, deleted ? 200 : 404, { deleted });
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
      await createUser(pool, config.bootstrapUser, hash);
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
