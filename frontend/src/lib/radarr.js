export const radarrPath = (path) => `/api/proxy/radarr${path}`;

export function posterUrl(movie) {
  const poster = movie?.images?.find((image) => image.coverType === 'poster');
  if (!poster) return null;
  if (movie.id > 0 && poster.url) {
    const version = new URL(poster.url, 'http://radarr.local').searchParams.get('lastWrite');
    return radarrPath(`/api/v3/mediacover/${movie.id}/poster-250.jpg${version ? `?lastWrite=${encodeURIComponent(version)}` : ''}`);
  }
  return poster.remoteUrl?.startsWith('https://image.tmdb.org/') ? poster.remoteUrl : null;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value >= 100 || unit < 2 ? 0 : 1)} ${units[unit]}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function errorMessage(error) {
  const details = error?.data;
  if (Array.isArray(details)) return details.map((item) => item.errorMessage || item.message).filter(Boolean).join('; ') || error.message;
  return details?.message || details?.error || error?.message || 'Request failed';
}
