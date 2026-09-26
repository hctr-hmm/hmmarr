import sharp from 'sharp';
import { buildTarget } from './proxy.js';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;

export function createPosterHandler() {
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;

  async function loadPoster(service, movieId, timeoutMs) {
    const upstream = await fetch(buildTarget(service, `/api/v3/mediacover/${movieId}/poster.jpg`), {
      headers: { [service.keyHeader]: service.apiKey, accept: 'image/jpeg' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!upstream.ok) throw new Error(upstream.status === 404 ? 'poster_not_found' : 'upstream_unavailable');
    const length = Number(upstream.headers.get('content-length'));
    if (length > MAX_SOURCE_BYTES) throw new Error('poster_too_large');
    const source = Buffer.from(await upstream.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) throw new Error('poster_too_large');
    return sharp(source).rotate().resize(1000, 1500, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toBuffer();
  }

  return async function servePoster(response, service, movieId, version, timeoutMs) {
    const key = `${movieId}:${version}`;
    let image = cache.get(key);
    if (image) {
      cache.delete(key);
      cache.set(key, image);
    } else {
      let job = pending.get(key);
      if (!job) {
        job = loadPoster(service, movieId, timeoutMs);
        pending.set(key, job);
      }
      try { image = await job; }
      finally { pending.delete(key); }
      if (!cache.has(key)) {
        while (cacheBytes + image.length > MAX_CACHE_BYTES && cache.size) {
          const oldest = cache.keys().next().value;
          cacheBytes -= cache.get(oldest).length;
          cache.delete(oldest);
        }
        if (image.length <= MAX_CACHE_BYTES) {
          cache.set(key, image);
          cacheBytes += image.length;
        }
      }
    }
    response.writeHead(200, {
      'content-type': 'image/jpeg',
      'content-length': image.length,
      'cache-control': version ? 'private, max-age=31536000, immutable' : 'private, max-age=3600',
    });
    response.end(image);
  };
}
