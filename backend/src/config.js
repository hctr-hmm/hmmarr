const SERVICE_DEFINITIONS = Object.freeze({
  radarr:   { label: 'Radarr',   apiVersion: 'v3', statusPath: '/api/v3/system/status', keyHeader: 'X-Api-Key' },
  sonarr:   { label: 'Sonarr',   apiVersion: 'v3', statusPath: '/api/v3/system/status', keyHeader: 'X-Api-Key' },
  bazarr:   { label: 'Bazarr',   apiVersion: 'v1', statusPath: '/api/system/status',    keyHeader: 'X-API-KEY' },
  prowlarr: { label: 'Prowlarr', apiVersion: 'v1', statusPath: '/api/v1/system/status', keyHeader: 'X-Api-Key' },
});

function parseInteger(value, fallback, name, minimum, maximum) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  return parsed;
}

function normalizeBaseUrl(value, name) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error(`${name} must use http or https`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error(`${name} cannot contain credentials, a query, or a fragment`);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const services = {};
  const errors = [];

  for (const [name, definition] of Object.entries(SERVICE_DEFINITIONS)) {
    const prefix = name.toUpperCase();
    const rawUrl = env[`${prefix}_URL`]?.trim();
    const apiKey = env[`${prefix}_API_KEY`]?.trim();
    if (!apiKey) continue;
    if (!rawUrl) {
      errors.push(`${prefix}_URL and ${prefix}_API_KEY must be set together`);
      continue;
    }
    try {
      services[name] = Object.freeze({ ...definition, name, url: normalizeBaseUrl(rawUrl, `${prefix}_URL`), apiKey });
    } catch (error) {
      errors.push(error.message);
    }
  }

  // Database
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) errors.push('DATABASE_URL is required');

  // Session secret (used to sign cookies)
  const sessionSecret = env.HMMARR_SESSION_SECRET?.trim() || '';
  if (!sessionSecret || sessionSecret.length < 32)
    errors.push('HMMARR_SESSION_SECRET must be at least 32 characters');

  // Optional: seed an admin user on first boot
  const bootstrapUser = env.HMMARR_BOOTSTRAP_USER?.trim() || '';
  const bootstrapPass = env.HMMARR_BOOTSTRAP_PASS?.trim() || '';

  if (errors.length) throw new Error(errors.join('; '));

  return Object.freeze({
    host: env.HMMARR_HOST || '0.0.0.0',
    port: parseInteger(env.HMMARR_PORT, 3000, 'HMMARR_PORT', 1, 65535),
    requestTimeoutMs:  parseInteger(env.HMMARR_REQUEST_TIMEOUT_MS,  120_000, 'HMMARR_REQUEST_TIMEOUT_MS',  1_000, 900_000),
    statusTimeoutMs:   parseInteger(env.HMMARR_STATUS_TIMEOUT_MS,    5_000, 'HMMARR_STATUS_TIMEOUT_MS',    500,   60_000),
    sessionTtlSeconds: parseInteger(env.HMMARR_SESSION_TTL_SECONDS, 604_800, 'HMMARR_SESSION_TTL_SECONDS',  300,   31_536_000),
    secureCookies: env.HMMARR_SECURE_COOKIES === 'true',
    authRequired: true,
    databaseUrl,
    sessionSecret,
    bootstrapUser,
    bootstrapPass,
    services: Object.freeze(services),
  });
}
