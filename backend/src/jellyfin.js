import { buildTarget } from './proxy.js';

const TICKS_PER_SECOND = 10_000_000;
const IMAGE_ID = /^[a-fA-F0-9-]{32,36}$/;

function compactSession(session) {
  const item = session.NowPlayingItem;
  if (!item) return null;
  const play = session.PlayState || {};
  const transcode = session.TranscodingInfo || {};
  const imageItemId = item.ImageTags?.Primary ? item.Id : item.PrimaryImageItemId || item.SeriesId || item.Id;
  return {
    userName: session.UserName || 'Unknown viewer',
    client: session.Client || 'Jellyfin',
    deviceName: session.DeviceName || '',
    lastActivityDate: session.LastActivityDate || null,
    item: {
      id: item.Id,
      name: item.Name || 'Unknown title',
      type: item.Type || '',
      seriesName: item.SeriesName || '',
      seasonName: item.SeasonName || '',
      episodeIndex: item.IndexNumber ?? null,
      parentIndex: item.ParentIndexNumber ?? null,
      imageItemId: IMAGE_ID.test(imageItemId || '') ? imageItemId : null,
    },
    paused: Boolean(play.IsPaused),
    playMethod: play.PlayMethod || null,
    positionSeconds: Math.max(0, Math.floor((play.PositionTicks || 0) / TICKS_PER_SECOND)),
    durationSeconds: Math.max(0, Math.floor((item.RunTimeTicks || 0) / TICKS_PER_SECOND)),
    transcoding: Boolean(session.TranscodingInfo),
    videoCodec: transcode.VideoCodec || null,
    bitrate: transcode.Bitrate || null,
  };
}

export async function getNowWatching(service, timeoutMs) {
  const response = await fetch(buildTarget(service, '/Sessions'), {
    headers: { 'X-Emby-Token': service.apiKey, accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'manual',
  });
  if (!response.ok) throw Object.assign(new Error('jellyfin_unavailable'), { status: response.status });
  const sessions = await response.json();
  if (!Array.isArray(sessions)) throw new Error('invalid_jellyfin_response');
  return sessions.filter((session) => session.NowPlayingItem).map(compactSession);
}

export async function getJellyfinImage(service, id, timeoutMs) {
  if (!IMAGE_ID.test(id)) return null;
  const target = buildTarget(service, `/Items/${id}/Images/Primary`);
  target.search = new URLSearchParams({ fillWidth: '1000', fillHeight: '1500', quality: '90' }).toString();
  const response = await fetch(target, { headers: { 'X-Emby-Token': service.apiKey, accept: 'image/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
  return { contentType: response.headers.get('content-type'), data: Buffer.from(await response.arrayBuffer()) };
}
