import { buildTarget } from './proxy.js';

const READ_ROUTES = Object.freeze({
  'app/version': 'text',
  'app/webapiVersion': 'text',
  'transfer/info': 'json',
  'torrents/info': 'json',
  'torrents/categories': 'json',
  'torrents/tags': 'json',
  'torrents/properties': 'json',
  'torrents/files': 'json',
  'torrents/trackers': 'json',
});
const WRITE_ROUTES = new Set(['torrents/add', 'torrents/pause', 'torrents/resume', 'torrents/stop', 'torrents/start', 'torrents/delete', 'torrents/recheck', 'torrents/reannounce', 'torrents/setCategory', 'torrents/addTags', 'torrents/removeTags', 'torrents/filePrio']);
const HASH = /^[a-fA-F0-9]{40}(\|[a-fA-F0-9]{40})*$/;

export function createQbittorrentClient(service, timeoutMs) {
  let sid = null;
  let loginPromise = null;
  const origin = new URL(service.url).origin;

  async function login() {
    if (service.apiKey) return;
    if (sid) return;
    if (!loginPromise) loginPromise = (async () => {
      const target = buildTarget(service, '/api/v2/auth/login');
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', referer: origin, origin },
        body: new URLSearchParams({ username: service.username, password: service.password }),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'manual',
      });
      const body = await response.text();
      const cookie = response.headers.get('set-cookie')?.match(/^([^=;,\s]+)=([^;,\s]+)/);
      if (!response.ok || (body.trim() !== 'Ok.' && response.status !== 204) || !cookie) throw Object.assign(new Error('qBittorrent login failed'), { status: 502, code: 'qbittorrent_login_failed' });
      sid = `${cookie[1]}=${cookie[2]}`;
    })().finally(() => { loginPromise = null; });
    return loginPromise;
  }

  async function call(route, method = 'GET', params = {}) {
    const kind = READ_ROUTES[route];
    if (method === 'GET' ? !kind : method !== 'POST' || !WRITE_ROUTES.has(route)) throw Object.assign(new Error('Unknown qBittorrent action'), { status: 404, code: 'not_found' });
    const target = buildTarget(service, `/api/v2/${route}`);
    const fields = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) fields.set(key, String(value));
    }
    if (method === 'GET') {
      for (const [key, value] of fields) target.searchParams.set(key, value);
    }
    if (route.startsWith('torrents/') && !['torrents/info', 'torrents/categories', 'torrents/tags', 'torrents/add'].includes(route)) {
      const hashes = fields.get('hashes') || fields.get('hash');
      if (!HASH.test(hashes || '')) throw Object.assign(new Error('Invalid torrent hash'), { status: 400, code: 'invalid_hash' });
    }
    if (route === 'torrents/add' && !/^(magnet:|https?:\/\/)/i.test(fields.get('urls') || '')) throw Object.assign(new Error('Invalid torrent link'), { status: 400, code: 'invalid_torrent_link' });
    for (let attempt = 0; attempt < 2; attempt++) {
      await login();
      const headers = { accept: kind === 'json' ? 'application/json' : 'text/plain', referer: origin, origin };
      if (service.apiKey) headers.authorization = `Bearer ${service.apiKey}`;
      else headers.cookie = sid;
      let body;
      if (method === 'POST' && route === 'torrents/add') {
        body = new FormData();
        for (const [key, value] of fields) body.set(key, value);
      } else if (method === 'POST') {
        headers['content-type'] = 'application/x-www-form-urlencoded';
        body = fields;
      }
      let response;
      try {
        response = await fetch(target, { method, headers, body, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
      } catch (cause) {
        throw Object.assign(new Error(cause.name === 'TimeoutError' ? 'qBittorrent timed out' : 'qBittorrent unavailable'), { status: cause.name === 'TimeoutError' ? 504 : 502, code: cause.name === 'TimeoutError' ? 'upstream_timeout' : 'upstream_unavailable' });
      }
      if ([401, 403].includes(response.status) && !service.apiKey && attempt === 0) { sid = null; continue; }
      if (!response.ok) throw Object.assign(new Error(`qBittorrent returned ${response.status}`), { status: response.status >= 500 ? 502 : response.status, code: response.status === 401 || response.status === 403 ? 'qbittorrent_auth_failed' : 'qbittorrent_request_failed' });
      if (method === 'POST') return { ok: true };
      return kind === 'json' ? response.json() : response.text();
    }
  }

  return { call };
}
