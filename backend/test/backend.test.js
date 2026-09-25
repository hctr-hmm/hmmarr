import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createAppServer } from '../src/server.js';

const token = 'correct-horse-battery-staple';
let upstream, app, baseUrl;
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

before(async () => {
  upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const received = { method: request.method, url: request.url, apiKey: request.headers['x-api-key'], body: Buffer.concat(chunks).toString() };
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ version: '1.2.3', received }));
  });
  const upstreamPort = await listen(upstream);
  const config = loadConfig({ HMMARR_AUTH_TOKEN: token, RADARR_URL: `http://127.0.0.1:${upstreamPort}`, RADARR_API_KEY: 'radarr-secret' });
  app = createAppServer(config);
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
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  const services = await fetch(`${baseUrl}/api/services`, { headers: { cookie } });
  assert.deepEqual(await services.json(), [{ name: 'radarr', label: 'Radarr', apiVersion: 'v3', configured: true }]);
});

test('proxy injects API key, strips supplied key, and forwards query', async () => {
  const response = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/movie?apikey=bad&page=2`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json();
  assert.equal(body.received.apiKey, 'radarr-secret');
  assert.equal(body.received.url, '/api/v3/movie?page=2');
});

test('proxy streams request bodies', async () => {
  const payload = JSON.stringify({ name: 'RescanMovie', movieIds: [1] });
  const response = await fetch(`${baseUrl}/api/proxy/radarr/api/v3/command`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: payload });
  assert.equal((await response.json()).received.body, payload);
});

test('configuration refuses accidental unauthenticated deployment', () => {
  assert.throws(() => loadConfig({}), /HMMARR_AUTH_TOKEN/);
  assert.equal(loadConfig({ HMMARR_ALLOW_INSECURE: 'true' }).authRequired, false);
});
