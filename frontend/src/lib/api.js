/**
 * Thin fetch wrapper.
 * All requests go to the backend (/api/*). The backend holds the real API keys.
 */

const BASE = '';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),

  // Auth
  authStatus: () => api.get('/api/auth/status'),
  login: (token) => api.post('/api/auth/login', { token }),
  logout: () => api.post('/api/auth/logout'),

  // Services
  services: () => api.get('/api/services'),
  serviceStatus: (name) => api.get(`/api/services/${name}/status`),

  // Proxy helpers
  proxy: {
    get: (service, path, params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/api/proxy/${service}${path}${qs}`);
    },
    post: (service, path, body) => api.post(`/api/proxy/${service}${path}`, body),
    put: (service, path, body) => api.put(`/api/proxy/${service}${path}`, body),
    delete: (service, path) => api.delete(`/api/proxy/${service}${path}`)
  }
};
