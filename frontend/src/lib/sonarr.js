export function seriesPosterUrl(series) {
  const poster = series?.images?.find((image) => image.coverType === 'poster');
  if (!poster) return null;
  if (series.id > 0 && poster.url) {
    const version = new URL(poster.url, 'http://sonarr.local').searchParams.get('lastWrite');
    return `/api/posters/sonarr/${series.id}.jpg${version ? `?lastWrite=${encodeURIComponent(version)}` : ''}`;
  }
  return /^https:\/\/(artworks\.thetvdb\.com|image\.tmdb\.org)\//.test(poster.remoteUrl || '') ? poster.remoteUrl : null;
}

export function episodeCode(episode) {
  return `S${String(episode.seasonNumber ?? 0).padStart(2, '0')}E${String(episode.episodeNumber ?? 0).padStart(2, '0')}`;
}
