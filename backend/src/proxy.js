import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BLOCKED_REQUEST_HEADERS = new Set(['authorization','connection','cookie','host','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','x-api-key','x-hmmarr-token']);
const BLOCKED_RESPONSE_HEADERS = new Set(['connection','content-encoding','content-length','keep-alive','proxy-authenticate','set-cookie','te','trailer','transfer-encoding','upgrade']);

function safePath(rawPath) {
  if (!rawPath.startsWith('/')) return false;
  try {
    return rawPath.split('/').every((segment) => {
      const decoded = decodeURIComponent(segment);
      return decoded !== '.' && decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\') && !decoded.includes('\0');
    });
  } catch { return false; }
}

function sanitizeSearch(search) {
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (['apikey', 'api_key', 'x-api-key'].includes(key.toLowerCase())) params.delete(key);
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function buildTarget(service, rawPath, search = '') {
  if (!safePath(rawPath)) throw new Error('Invalid upstream path');
  const base = new URL(service.url);
  const basePath = base.pathname.replace(/\/$/, '');
  return new URL(`${base.origin}${basePath}${rawPath}${sanitizeSearch(search)}`);
}

function requestHeaders(request, service, requestId) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || BLOCKED_REQUEST_HEADERS.has(name.toLowerCase()) || name.toLowerCase().startsWith('x-forwarded-')) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set(service.keyHeader, service.apiKey);
  headers.set('accept-encoding', 'identity');
  headers.set('x-request-id', requestId);
  headers.set('user-agent', 'hmmarr/0.1');
  return headers;
}

function responseHeaders(upstream, service, localPrefix) {
  const headers = {};
  for (const [name, value] of upstream.headers) {
    if (!BLOCKED_RESPONSE_HEADERS.has(name.toLowerCase())) headers[name] = value;
  }
  const location = upstream.headers.get('location');
  if (location) {
    try {
      const target = new URL(location, service.url);
      const base = new URL(service.url);
      if (target.origin === base.origin) {
        const basePath = base.pathname.replace(/\/$/, '');
        const path = target.pathname.startsWith(basePath) ? target.pathname.slice(basePath.length) || '/' : target.pathname;
        headers.location = `${localPrefix}${path}${target.search}`;
      }
    } catch { delete headers.location; }
  }
  headers['cache-control'] = headers['cache-control'] || 'no-store';
  return headers;
}

export async function proxyRequest({ request, response, service, rawPath, search, timeoutMs, requestId }) {
  const target = buildTarget(service, rawPath, search);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  request.once('aborted', () => controller.abort());
  try {
    const hasBody = !['GET', 'HEAD'].includes(request.method) && (request.headers['content-length'] || request.headers['transfer-encoding']);
    const options = { method: request.method, headers: requestHeaders(request, service, requestId), redirect: 'manual', signal: controller.signal };
    if (hasBody) {
      options.body = Readable.toWeb(request);
      options.duplex = 'half';
    }
    const upstream = await fetch(target, options);
    response.writeHead(upstream.status, upstream.statusText, responseHeaders(upstream, service, `/api/proxy/${service.name}`));
    if (request.method === 'HEAD' || !upstream.body) return response.end();
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch (error) {
    if (response.headersSent) return response.destroy(error);
    const timedOut = controller.signal.aborted;
    response.writeHead(timedOut ? 504 : 502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: timedOut ? 'upstream_timeout' : 'upstream_unavailable', requestId }));
  } finally { clearTimeout(timeout); }
}

export async function probeService(service, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(buildTarget(service, service.statusPath), {
      headers: { [service.keyHeader]: service.apiKey, accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const data = body?.data ?? body;
    return { name: service.name, label: service.label, online: true, version: data?.version || data?.Version || data?.bazarr_version || null, appName: data?.appName || service.label, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { name: service.name, label: service.label, online: false, error: error?.name === 'AbortError' ? 'timeout' : 'unreachable', latencyMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timeout); }
}
