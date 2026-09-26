import { api } from './api.js';

export const bazarr = {
  get: (path, params) => api.proxy.get('bazarr', `/api${path}`, params),
  post: (path, params) => api.proxy.post('bazarr', `/api${path}`, undefined, params),
  patch: (path, params) => api.proxy.patch('bazarr', `/api${path}`, params),
  delete: (path, params) => api.proxy.delete('bazarr', `/api${path}`, params),
  upload: (path, params, file) => api.proxy.upload('bazarr', `/api${path}`, params, file),
};

export function subtitleLabel(subtitle) {
  return `${subtitle.name || subtitle.code2 || subtitle.code3 || 'Unknown'}${subtitle.forced ? ' · Forced' : ''}${subtitle.hi ? ' · HI' : ''}`;
}

export function mediaPosterUrl(kind, item) {
  const id = kind === 'movie' ? item.radarrId : item.sonarrSeriesId;
  const service = kind === 'movie' ? 'radarr' : 'sonarr';
  const version = item.poster ? new URL(item.poster, 'http://bazarr.local').searchParams.get('lastWrite') : null;
  return id > 0 ? `/api/posters/${service}/${id}.jpg${version ? `?lastWrite=${encodeURIComponent(version)}` : ''}` : null;
}

export function subtitleParams(kind, item, subtitle) {
  return {
    ...(kind === 'movie' ? { radarrid: item.radarrId } : { seriesid: item.sonarrSeriesId, episodeid: item.sonarrEpisodeId }),
    language: subtitle.code2,
    forced: String(Boolean(subtitle.forced)),
    hi: String(Boolean(subtitle.hi)),
  };
}
