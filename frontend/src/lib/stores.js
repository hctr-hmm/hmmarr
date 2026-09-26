import { writable, derived } from 'svelte/store';

// Authentication state
export const authStatus = writable({ checked: false, authRequired: false, authenticated: false, user: null });

// Active route: 'login' | 'dashboard' | 'movies' | 'discover' | 'wanted' | 'collections' | 'series' | 'queue' | 'calendar' | 'history' | 'blocklist' | 'system' | 'users' | 'prowlarr' | 'bazarr'
export const route = writable('login');
export const navigationSection = writable(null);

// Services list from /api/services
export const services = writable([]);

// Per-service health: { radarr: { online, version, latencyMs }, ... }
export const serviceHealth = writable({});

export const isAuthenticated = derived(
  authStatus,
  ($a) => !$a.authRequired || $a.authenticated
);

export function navigate(to, section = null) {
  navigationSection.set(section);
  route.set(to);
}
