import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { getNowWatching, getJellyfinImage } from '../src/jellyfin.js';

let server;
let service;
const id = 'a'.repeat(32);
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

before(async () => {
  server = http.createServer((request, response) => {
    assert.equal(request.headers['x-emby-token'], 'private-jellyfin-key');
    if (request.url === '/Sessions') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([
        { UserName: 'Alice', Client: 'Jellyfin Web', DeviceName: 'Laptop', RemoteEndPoint: 'private-ip', IsActive: true, PlayState: { PositionTicks: 60_000_000, IsPaused: false, PlayMethod: 'DirectPlay' }, NowPlayingItem: { Id: id, Name: 'Episode title', Type: 'Episode', SeriesName: 'Example show', RunTimeTicks: 120_000_000, ImageTags: { Primary: 'image-tag' }, Path: '/private/path' } },
        { UserName: 'Bob', IsActive: true, NowPlayingItem: null },
      ]));
    } else if (request.url.startsWith(`/Items/${id}/Images/Primary`)) {
      const imageUrl = new URL(request.url, 'http://localhost');
      assert.equal(imageUrl.searchParams.get('fillWidth'), '1000');
      assert.equal(imageUrl.searchParams.get('fillHeight'), '1500');
      response.setHeader('content-type', 'image/jpeg');
      response.end(Buffer.from('fake-image'));
    } else { response.writeHead(404); response.end(); }
  });
  service = { url: `http://127.0.0.1:${await listen(server)}`, apiKey: 'private-jellyfin-key' };
});
after(async () => new Promise((resolve) => server.close(resolve)));

test('Jellyfin now-watching includes playback and safe display fields', async () => {
  const sessions = await getNowWatching(service, 5000);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].userName, 'Alice');
  assert.equal(sessions[0].positionSeconds, 6);
  assert.equal(sessions[0].durationSeconds, 12);
  assert.equal(sessions[0].item.imageItemId, id);
  assert.ok(!JSON.stringify(sessions).includes('private-ip'));
  assert.ok(!JSON.stringify(sessions).includes('/private/path'));
  assert.ok(!JSON.stringify(sessions).includes('private-jellyfin-key'));
});

test('Jellyfin artwork is fetched with the server-side key', async () => {
  const image = await getJellyfinImage(service, id, 5000);
  assert.equal(image.contentType, 'image/jpeg');
  assert.equal(image.data.toString(), 'fake-image');
  assert.equal(await getJellyfinImage(service, 'not-an-id', 5000), null);
});
