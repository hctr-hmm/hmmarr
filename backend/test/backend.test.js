import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createAppServer } from '../src/server.js';
import { hashPassword } from '../src/auth.js';
import sharp from 'sharp';

const username = 'admin';
const password = 'correct-horse-battery-staple';
let upstream, app, baseUrl;
let cookie;
let sourcePoster;
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

before(async () => {
  sourcePoster = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: '#456789' } }).jpeg().toBuffer();
  upstream = http.createServer(async (request, response) => {
    if (request.url.startsWith('/api/v3/mediacover/')) {
      assert.ok(['radarr-secret', 'sonarr-secret'].includes(request.headers['x-api-key']));
      response.setHeader('content-type', 'image/jpeg');
      response.end(sourcePoster);
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const received = { method: request.method, url: request.url, apiKey: request.headers['x-api-key'], contentType: request.headers['content-type'], body: Buffer.concat(chunks).toString() };
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ version: '1.2.3', received }));
  });
  const upstreamPort = await listen(upstream);
  const config = loadConfig({ DATABASE_URL: 'postgres://localhost/hmmarr', HMMARR_SESSION_SECRET: 'test-session-secret-at-least-32-characters', RADARR_URL: `http://127.0.0.1:${upstreamPort}`, RADARR_API_KEY: 'radarr-secret', SONARR_URL: `http://127.0.0.1:${upstreamPort}`, SONARR_API_KEY: 'sonarr-secret', BAZARR_URL: `http://127.0.0.1:${upstreamPort}`, BAZARR_API_KEY: 'bazarr-secret', PROWLARR_URL: `http://127.0.0.1:${upstreamPort}`, PROWLARR_API_KEY: 'prowlarr-secret' });
  const user = { id: 1, username, password_hash: await hashPassword(password) };
  const pool = { query: async (sql, params) => {
    if (sql.startsWith('SELECT id, username, password_hash')) return { rows: params[0] === username ? [user] : [] };
    throw new Error(`Unexpected query: ${sql}`);
  } };
  app = createAppServer(config, pool);
  baseUrl = `http://127.0.0.1:${await listen(app)}`;
});

after(async () => Promise.all([new Promise((resolve) => app.close(resolve)), new Promise((resolve) => upstream.close(resolve))]));

test('health endpoint is public', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('protected endpoints reject unauthenticated requests', async () => {
  assert.equal((await fetch(`${baseUrl}/api/services`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/posters/radarr/138.jpg`)).status, 401);
});

test('login creates a usable HttpOnly session', async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  const services = await fetch(`${baseUrl}/api/services`, { headers: { cookie } });
  assert.deepEqual(await services.json(), [{ name: 'radarr', label: 'Radarr', apiVersion: 'v3', configured: true }, { name: 'sonarr', label: 'Sonarr', apiVersion: 'v3', configured: true }, { name: 'bazarr', label: 'Bazarr', apiVersion: 'v1', configured: true }, { name: 'prowlarr', label: 'Prowlarr', apiVersion: 'v1', configured: true }]);
});

test('proxy injects API key, strips supplied key, and forwards query', async () => {
  const response = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/movie?apikey=bad&page=2`, { headers: { cookie } });
  const body = await response.json();
  assert.equal(body.received.apiKey, 'radarr-secret');
  assert.equal(body.received.url, '/api/v3/movie?page=2');
});

test('proxy streams request bodies', async () => {
  const payload = JSON.stringify({ name: 'RescanMovie', movieIds: [1] });
  const response = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/command`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: payload });
  assert.equal((await response.json()).received.body, payload);
});

test('Bazarr proxy forwards query actions and subtitle uploads', async () => {
  const action = await fetch(`${baseUrl}/api/proxy/bazarr/api/movies?radarrid=138&action=search-missing`, { method: 'PATCH', headers: { cookie } });
  const actionResult = (await action.json()).received;
  assert.equal(actionResult.method, 'PATCH');
  assert.equal(actionResult.url, '/api/movies?radarrid=138&action=search-missing');
  assert.equal(actionResult.apiKey, 'bazarr-secret');

  const profile = await fetch(`${baseUrl}/api/proxy/bazarr/api/movies?radarrid=138&profileid=4`, { method: 'POST', headers: { cookie } });
  const profileResult = (await profile.json()).received;
  assert.equal(profileResult.method, 'POST');
  assert.equal(profileResult.url, '/api/movies?radarrid=138&profileid=4');
  assert.equal(profileResult.body, '');

  const form = new FormData();
  form.append('file', new Blob(['1\n00:00:01,000 --> 00:00:02,000\nHello'], { type: 'text/plain' }), 'subtitle.srt');
  const upload = await fetch(`${baseUrl}/api/proxy/bazarr/api/movies/subtitles?radarrid=138&language=en&forced=false&hi=false`, { method: 'POST', headers: { cookie }, body: form });
  const uploadResult = (await upload.json()).received;
  assert.equal(uploadResult.method, 'POST');
  assert.match(uploadResult.contentType, /multipart\/form-data/);
  assert.match(uploadResult.body, /subtitle\.srt/);
  assert.match(uploadResult.body, /Hello/);
});

test('Prowlarr proxy forwards searches, grabs, and indexer updates', async () => {
  const search = await fetch(`${baseUrl}/api/proxy/prowlarr/api/v1/search?query=Example&type=search&indexerIds=2`, { headers: { cookie } });
  const searchResult = (await search.json()).received;
  assert.equal(searchResult.url, '/api/v1/search?query=Example&type=search&indexerIds=2');
  assert.equal(searchResult.apiKey, 'prowlarr-secret');

  const release = { guid: 'release-guid', title: 'Example release', indexerId: 2 };
  const grab = await fetch(`${baseUrl}/api/proxy/prowlarr/api/v1/search`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(release) });
  assert.equal((await grab.json()).received.body, JSON.stringify(release));

  const indexer = { id: 2, name: 'Example', enable: false };
  const update = await fetch(`${baseUrl}/api/proxy/prowlarr/api/v1/indexer/2`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(indexer) });
  assert.equal((await update.json()).received.body, JSON.stringify(indexer));
});

test('proxy streams poster images and bulk DELETE requests', async () => {
  const poster = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/mediacover/138/poster-250.jpg`, { headers: { cookie } });
  assert.equal(poster.status, 200);
  assert.match(poster.headers.get('content-type'), /image\/jpeg/);
  assert.deepEqual(Buffer.from(await poster.arrayBuffer()), sourcePoster);

  const payload = JSON.stringify({ movieIds: [138], deleteFiles: false });
  const deleted = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/movie/editor`, { method: 'DELETE', headers: { cookie, 'content-type': 'application/json' }, body: payload });
  assert.equal(deleted.status, 200);
  const result = await deleted.json();
  assert.equal(result.received.method, 'DELETE');
  assert.equal(result.received.body, payload);
});

test('poster endpoint delivers an authenticated 1000 by 1500 JPEG', async () => {
  const poster = await fetch(`${baseUrl}/api/posters/radarr/138.jpg?lastWrite=123`, { headers: { cookie } });
  assert.equal(poster.status, 200);
  assert.equal(poster.headers.get('content-type'), 'image/jpeg');
  assert.match(poster.headers.get('cache-control'), /private/);
  const metadata = await sharp(Buffer.from(await poster.arrayBuffer())).metadata();
  assert.equal(metadata.width, 1000);
  assert.equal(metadata.height, 1500);
  const sonarr = await fetch(`${baseUrl}/api/posters/sonarr/1.jpg?lastWrite=456`, { headers: { cookie } });
  assert.equal(sonarr.status, 200);
  const seriesMetadata = await sharp(Buffer.from(await sonarr.arrayBuffer())).metadata();
  assert.equal(seriesMetadata.width, 1000);
  assert.equal(seriesMetadata.height, 1500);
});

test('built frontend is served with its assets', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/);
  assert.ok(script);
  assert.equal((await fetch(`${baseUrl}${script[1]}`)).status, 200);
  for (const asset of ['/favicon.svg', '/hmmarr-logo.svg']) {
    const response = await fetch(`${baseUrl}${asset}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/svg+xml');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.match(await response.text(), /<svg/);
  }
});

test('configuration requires database and session secret, but permits missing optional service keys', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL.*HMMARR_SESSION_SECRET/);
  const config = loadConfig({ DATABASE_URL: 'postgres://localhost/hmmarr', HMMARR_SESSION_SECRET: 'test-session-secret-at-least-32-characters', RADARR_URL: 'http://radarr:7878' });
  assert.deepEqual(config.services, {});
});
