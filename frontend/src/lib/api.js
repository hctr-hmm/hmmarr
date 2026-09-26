/**
 * Thin fetch wrapper.
 * All requests go to the backend (/api/*). The backend holds the real API keys.
 */

const BASE = '';

async function request(method, path, body) {
  /** @type {RequestInit} */
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path, body)  => request('DELETE', path, body),

  // Auth
  authStatus: ()                     => api.get('/api/auth/status'),
  login:      (username, password)   => api.post('/api/auth/login', { username, password }),
  logout:     ()                     => api.post('/api/auth/logout'),

  // Admin — user management
  admin: {
    listUsers:   ()                   => api.get('/api/admin/users'),
    createUser:  (username, password) => api.post('/api/admin/users', { username, password }),
    deleteUser:  (username)           => api.delete(`/api/admin/users/${encodeURIComponent(username)}`),
  },

  // Services
  services:      ()     => api.get('/api/services'),
  serviceStatus: (name) => api.get(`/api/services/${name}/status`),

  // Proxy helpers
  proxy: {
    get:    (service, path, params) => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return api.get(`/api/proxy/${service}${path}${qs}`); },
    post:   (service, path, body, params) => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return api.post(`/api/proxy/${service}${path}${qs}`, body); },
    put:    (service, path, body, params) => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return api.put(`/api/proxy/${service}${path}${qs}`, body); },
    patch:  (service, path, params, body) => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return api.patch(`/api/proxy/${service}${path}${qs}`, body); },
    delete: (service, path, params, body) => { const qs = params ? '?' + new URLSearchParams(params).toString() : ''; return api.delete(`/api/proxy/${service}${path}${qs}`, body); },
    upload: async (service, path, params, file) => {
      const form = new FormData();
      form.append('file', file);
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/proxy/${service}${path}?${qs}`, { method: 'POST', credentials: 'same-origin', body: form });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
      return data;
    },
  }
};
