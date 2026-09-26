import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { createQbittorrentClient } from '../src/qbittorrent.js';
import { loadConfig } from '../src/config.js';

let upstream;
let url;
let requests = [];
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

before(async () => {
  upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    requests.push({ url: request.url, method: request.method, headers: request.headers, body });
    if (request.url === '/api/v2/auth/login') {
      assert.equal(request.headers.origin, url);
      assert.match(body, /username=service-user/);
      response.setHeader('set-cookie', 'QBT_SID_8081=private-session; path=/; HttpOnly');
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.headers.cookie !== 'QBT_SID_8081=private-session' && request.headers.authorization !== 'Bearer qbt_test_key') {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (request.url.startsWith('/api/v2/torrents/info')) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([{ hash: 'a'.repeat(40), name: 'Example' }]));
    } else if (request.url === '/api/v2/app/version') response.end('v5.2.0');
    else response.end('Ok.');
  });
  url = `http://127.0.0.1:${await listen(upstream)}`;
});
after(async () => new Promise((resolve) => upstream.close(resolve)));

test('qBittorrent connection supports cookie login, allowlisted actions, and multipart link addition', async () => {
  const client = createQbittorrentClient({ name: 'qbittorrent', url, username: 'service-user', password: 'service-password' }, 5000);
  assert.deepEqual(await client.call('torrents/info'), [{ hash: 'a'.repeat(40), name: 'Example' }]);
  assert.equal(await client.call('app/version'), 'v5.2.0');
  assert.equal(requests.filter((entry) => entry.url === '/api/v2/auth/login').length, 1);
  assert.deepEqual(await client.call('torrents/add', 'POST', { urls: 'magnet:?xt=urn:btih:example', category: 'movies' }), { ok: true });
  const added = requests.find((entry) => entry.url === '/api/v2/torrents/add');
  assert.match(added.headers['content-type'], /multipart\/form-data/);
  assert.match(added.body, /magnet:\?xt=urn:btih:example/);
  assert.match(added.body, /movies/);
  await client.call('torrents/stop', 'POST', { hashes: 'a'.repeat(40) });
  assert.match(requests.at(-1).body, /hashes=a{40}/);
  await assert.rejects(client.call('app/preferences'), /Unknown qBittorrent action/);
  await assert.rejects(client.call('torrents/delete', 'POST', { hashes: 'all', deleteFiles: true }), /Invalid torrent hash/);
});

test('qBittorrent API key auth sends the key only to the configured upstream', async () => {
  const config = loadConfig({ DATABASE_URL: 'postgres://localhost/hmmarr', HMMARR_SESSION_SECRET: 'test-session-secret-at-least-32-characters', QBITTORRENT_URL: url, QBITTORRENT_API_KEY: 'qbt_test_key' });
  assert.equal(config.services.qbittorrent.label, 'qBittorrent');
  const beforeCount = requests.length;
  const client = createQbittorrentClient(config.services.qbittorrent, 5000);
  assert.equal(await client.call('app/version'), 'v5.2.0');
  assert.equal(requests.length, beforeCount + 1);
  assert.equal(requests.at(-1).headers.authorization, 'Bearer qbt_test_key');
  assert.equal(requests.at(-1).headers.cookie, undefined);
});
