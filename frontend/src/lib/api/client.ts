/**
 * Typed API client for the hmmarr backend.
 * All requests go through the Vite proxy -> backend at :3000.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 204) return undefined as T;

  let json: unknown;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    const msg = (json as Record<string, string>)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, json);
  }

  return json as T;
}

const get  = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);

// ─── Auth ────────────────────────────────────────────────────────────

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
}

export const auth = {
  status: () => get<AuthStatus>('/api/auth/status'),
  login:  (token: string) => post<{ authenticated: boolean }>('/api/auth/login', { token }),
  logout: () => post<{ authenticated: boolean }>('/api/auth/logout')
};

// ─── Services ─────────────────────────────────────────────────────────

export type ServiceName = 'radarr' | 'sonarr' | 'bazarr' | 'prowlarr';

export interface ServiceInfo {
  name: ServiceName;
  label: string;
  apiVersion: string;
  configured: boolean;
}

export interface ServiceStatus {
  online: boolean;
  latencyMs?: number;
  version?: string;
  error?: string;
}

export const services = {
  list:   () => get<ServiceInfo[]>('/api/services'),
  status: (name: ServiceName) => get<ServiceStatus>(`/api/services/${name}/status`)
};

// ─── Proxy helpers ─────────────────────────────────────────────────────

function proxy<T>(service: ServiceName, path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`/api/proxy/${service}${path}`, location.href);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return get<T>(url.pathname + url.search);
}

// ─── Radarr ─────────────────────────────────────────────────────────────

export interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  overview: string;
  status: string;
  hasFile: boolean;
  monitored: boolean;
  qualityProfileId: number;
  runtime: number;
  ratings: { imdb?: { value: number }; tmdb?: { value: number } };
  images: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
  genres: string[];
  studio?: string;
  certification?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  inCinemas?: string;
}

export const radarr = {
  movies:     (params?: { sortKey?: string; sortDir?: string }) =>
    proxy<RadarrMovie[]>('radarr', '/api/v3/movie', params as Record<string, string>),
  movie:      (id: number) => proxy<RadarrMovie>('radarr', `/api/v3/movie/${id}`),
  queue:      () => proxy<{ records: unknown[] }>('radarr', '/api/v3/queue'),
  diskspace:  () => proxy<Array<{ path: string; freeSpace: number; totalSpace: number }>>('radarr', '/api/v3/diskspace'),
  calendar:   (start: string, end: string) => proxy<RadarrMovie[]>('radarr', '/api/v3/calendar', { start, end }),
  systemStatus: () => proxy<{ version: string; appName: string }>('radarr', '/api/v3/system/status')
};

// ─── Sonarr ─────────────────────────────────────────────────────────────

export interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  overview: string;
  status: string;
  monitored: boolean;
  seasonCount: number;
  episodeCount?: number;
  episodeFileCount?: number;
  network?: string;
  airTime?: string;
  runtime: number;
  genres: string[];
  ratings: { value: number; votes: number };
  images: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
  seasons: Array<{ seasonNumber: number; monitored: boolean; statistics?: { episodeCount: number; episodeFileCount: number } }>;
  nextAiring?: string;
  previousAiring?: string;
}

export const sonarr = {
  series:       () => proxy<SonarrSeries[]>('sonarr', '/api/v3/series'),
  show:         (id: number) => proxy<SonarrSeries>('sonarr', `/api/v3/series/${id}`),
  episodes:     (seriesId: number) => proxy<unknown[]>('sonarr', '/api/v3/episode', { seriesId }),
  queue:        () => proxy<{ records: unknown[] }>('sonarr', '/api/v3/queue'),
  calendar:     (start: string, end: string) => proxy<unknown[]>('sonarr', '/api/v3/calendar', { start, end }),
  diskspace:    () => proxy<Array<{ path: string; freeSpace: number; totalSpace: number }>>('sonarr', '/api/v3/diskspace'),
  systemStatus: () => proxy<{ version: string; appName: string }>('sonarr', '/api/v3/system/status')
};

// ─── Bazarr ─────────────────────────────────────────────────────────────

export interface BazarrSystemStatus {
  data: { bazarr_version: string; operating_system: string };
}

export const bazarr = {
  movies:       (params?: { start?: number; length?: number }) =>
    proxy<{ data: unknown[]; total: number }>('bazarr', '/api/movies', params as Record<string, number>),
  series:       (params?: { start?: number; length?: number }) =>
    proxy<{ data: unknown[]; total: number }>('bazarr', '/api/series', params as Record<string, number>),
  providers:    () => proxy<{ data: unknown[] }>('bazarr', '/api/providers'),
  history:      (params?: { start?: number; length?: number }) =>
    proxy<{ data: unknown[]; total: number }>('bazarr', '/api/history', params as Record<string, number>),
  systemStatus: () => proxy<BazarrSystemStatus>('bazarr', '/api/system/status')
};

// ─── Prowlarr ───────────────────────────────────────────────────────────

export interface ProwlarrIndexer {
  id: number;
  name: string;
  enable: boolean;
  priority: number;
  protocol: string;
  tags: number[];
  added: string;
}

export const prowlarr = {
  indexers:     () => proxy<ProwlarrIndexer[]>('prowlarr', '/api/v1/indexer'),
  history:      (params?: { page?: number; pageSize?: number }) =>
    proxy<{ records: unknown[]; totalRecords: number }>('prowlarr', '/api/v1/history', params as Record<string, number>),
  search:       (query: string, indexerIds?: number[]) =>
    proxy<unknown[]>('prowlarr', '/api/v1/search', {
      query,
      ...(indexerIds?.length ? { indexerIds: indexerIds.join(',') } : {})
    } as Record<string, string>),
  systemStatus: () => proxy<{ version: string; appName: string }>('prowlarr', '/api/v1/system/status')
};
