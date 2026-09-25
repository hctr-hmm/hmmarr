import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { clearSessionCookie, createSessionCookie, isAuthenticated, verifyLoginToken } from './security.js';
import { probeService, proxyRequest } from './proxy.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
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
const publicService = (service) => ({ name: service.name, label: service.label, apiVersion: service.apiVersion, configured: true });
const log = (level, event, fields = {}) => process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, event, ...fields })}\n`);

export function createAppServer(config) {
  return http.createServer(async (request, response) => {
    const started = performance.now();
    const requestId = request.headers['x-request-id'] || randomUUID();
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    response.once('finish', () => log('info', 'request', { requestId, method: request.method, path: request.url?.split('?')[0], status: response.statusCode, durationMs: Math.round(performance.now() - started) }));
    try {
      const parsed = new URL(request.url || '/', 'http://hmmarr.local');
      if (request.method === 'GET' && parsed.pathname === '/healthz') return sendJson(response, 200, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
      if (request.method === 'GET' && parsed.pathname === '/api/auth/status') return sendJson(response, 200, { authRequired: config.authRequired, authenticated: isAuthenticated(request, config) });
      if (request.method === 'POST' && parsed.pathname === '/api/auth/login') {
        if (!config.authRequired) return sendJson(response, 204, null);
        const body = await readJson(request);
        if (!verifyLoginToken(body.token, config)) return sendJson(response, 401, { error: 'invalid_credentials', requestId });
        return sendJson(response, 200, { authenticated: true }, { 'set-cookie': createSessionCookie(config) });
      }
      if (request.method === 'POST' && parsed.pathname === '/api/auth/logout') return sendJson(response, 200, { authenticated: false }, { 'set-cookie': clearSessionCookie(config) });
      if (!isAuthenticated(request, config)) return sendJson(response, 401, { error: 'authentication_required', requestId });
      if (request.method === 'GET' && parsed.pathname === '/api/services') return sendJson(response, 200, Object.values(config.services).map(publicService));
      const statusMatch = parsed.pathname.match(/^\/api\/services\/(radarr|sonarr|bazarr|prowlarr)\/status$/);
      if (request.method === 'GET' && statusMatch) {
        const service = config.services[statusMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        const result = await probeService(service, config.statusTimeoutMs);
        return sendJson(response, result.online ? 200 : 502, result);
      }
      const rawPathname = (request.url || '/').split('?')[0];
      const proxyMatch = rawPathname.match(/^\/api\/proxy\/(radarr|sonarr|bazarr|prowlarr)(\/.*)$/);
      if (proxyMatch) {
        const service = config.services[proxyMatch[1]];
        if (!service) return sendJson(response, 404, { error: 'service_not_configured', requestId });
        return proxyRequest({ request, response, service, rawPath: proxyMatch[2], search: parsed.search, timeoutMs: config.requestTimeoutMs, requestId });
      }
      return sendJson(response, 404, { error: 'not_found', requestId });
    } catch (error) {
      const status = error.message === 'body_too_large' ? 413 : 400;
      return sendJson(response, status, { error: error.message || 'bad_request', requestId });
    }
  });
}

export async function start(config = loadConfig()) {
  const server = createAppServer(config);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
  log('info', 'server_started', { host: config.host, port: config.port, services: Object.keys(config.services), authRequired: config.authRequired });
  return server;
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) start().catch((error) => { log('error', 'startup_failed', { message: error.message }); process.exitCode = 1; });
