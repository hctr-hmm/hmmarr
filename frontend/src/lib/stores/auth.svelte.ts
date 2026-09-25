import { auth, type AuthStatus } from '$api/client';

// Svelte 5 runes-based auth store
let _status = $state<AuthStatus | null>(null);
let _loading = $state(true);
let _error = $state<string | null>(null);

export const authStore = {
  get status() { return _status; },
  get loading() { return _loading; },
  get error() { return _error; },
  get authenticated() { return _status?.authenticated ?? false; },
  get authRequired() { return _status?.authRequired ?? true; },

  async check() {
    _loading = true;
    _error = null;
    try {
      _status = await auth.status();
    } catch (e) {
      _error = e instanceof Error ? e.message : 'Failed to reach backend';
    } finally {
      _loading = false;
    }
  },

  async login(token: string) {
    _loading = true;
    _error = null;
    try {
      await auth.login(token);
      _status = { authRequired: true, authenticated: true };
      return true;
    } catch (e) {
      _error = e instanceof Error ? e.message : 'Login failed';
      return false;
    } finally {
      _loading = false;
    }
  },

  async logout() {
    try {
      await auth.logout();
    } finally {
      _status = { authRequired: _status?.authRequired ?? true, authenticated: false };
    }
  }
};
