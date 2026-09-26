import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createAppServer } from '../src/server.js';
import { hashPassword } from '../src/auth.js';

const username = 'admin';
const password = 'correct-horse-battery-staple';
let upstream, app, baseUrl;
let cookie;
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

before(async () => {
  upstream = http.createServer(async (request, response) => {
    if (request.url.startsWith('/api/v3/mediacover/')) {
      response.setHeader('content-type', 'image/jpeg');
      response.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const received = { method: request.method, url: request.url, apiKey: request.headers['x-api-key'], body: Buffer.concat(chunks).toString() };
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ version: '1.2.3', received }));
  });
  const upstreamPort = await listen(upstream);
  const config = loadConfig({ DATABASE_URL: 'postgres://localhost/hmmarr', HMMARR_SESSION_SECRET: 'test-session-secret-at-least-32-characters', RADARR_URL: `http://127.0.0.1:${upstreamPort}`, RADARR_API_KEY: 'radarr-secret' });
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
});

test('login creates a usable HttpOnly session', async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  const services = await fetch(`${baseUrl}/api/services`, { headers: { cookie } });
  assert.deepEqual(await services.json(), [{ name: 'radarr', label: 'Radarr', apiVersion: 'v3', configured: true }]);
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

test('proxy streams poster images and bulk DELETE requests', async () => {
  const poster = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/mediacover/138/poster-250.jpg`, { headers: { cookie } });
  assert.equal(poster.status, 200);
  assert.match(poster.headers.get('content-type'), /image\/jpeg/);
  assert.deepEqual(Buffer.from(await poster.arrayBuffer()), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const payload = JSON.stringify({ movieIds: [138], deleteFiles: false });
  const deleted = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/movie/editor`, { method: 'DELETE', headers: { cookie, 'content-type': 'application/json' }, body: payload });
  assert.equal(deleted.status, 200);
  const result = await deleted.json();
  assert.equal(result.received.method, 'DELETE');
  assert.equal(result.received.body, payload);
});

test('built frontend is served with its assets', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/);
  assert.ok(script);
  assert.equal((await fetch(`${baseUrl}${script[1]}`)).status, 200);
});

test('configuration requires database and session secret, but permits missing optional service keys', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL.*HMMARR_SESSION_SECRET/);
  const config = loadConfig({ DATABASE_URL: 'postgres://localhost/hmmarr', HMMARR_SESSION_SECRET: 'test-session-secret-at-least-32-characters', RADARR_URL: 'http://radarr:7878' });
  assert.deepEqual(config.services, {});
});
