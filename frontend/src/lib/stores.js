import { writable, derived } from 'svelte/store';

// Authentication state
export const authStatus = writable({ checked: false, authRequired: false, authenticated: false });

// Active route: 'login' | 'dashboard' | 'movies' | 'series' | 'queue' | 'calendar' | 'prowlarr' | 'bazarr'
export const route = writable('login');

// Services list from /api/services
export const services = writable([]);

// Per-service health: { radarr: { online, version, latencyMs }, ... }
export const serviceHealth = writable({});

export const isAuthenticated = derived(
  authStatus,
  ($a) => !$a.authRequired || $a.authenticated
);

export function navigate(to) {
  route.set(to);
}
