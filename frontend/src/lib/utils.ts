/** Format bytes to human readable string */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Format runtime minutes to h:mm */
export function formatRuntime(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Format ISO date to readable string */
export function formatDate(iso: string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, opts ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Returns TMDb or IMDb poster URL from Radarr/Sonarr images array */
export function getPoster(images: Array<{ coverType: string; remoteUrl?: string; url?: string }>): string {
  const poster = images.find(i => i.coverType === 'poster');
  return poster?.remoteUrl ?? poster?.url ?? '';
}

/** Returns fanart/banner URL */
export function getFanart(images: Array<{ coverType: string; remoteUrl?: string; url?: string }>): string {
  const fanart = images.find(i => i.coverType === 'fanart');
  return fanart?.remoteUrl ?? fanart?.url ?? '';
}

/** Clamp a number */
export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Short number: 12345 -> 12.3K */
export function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
