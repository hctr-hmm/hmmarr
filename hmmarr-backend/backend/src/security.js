import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'hmmarr_session';
const equalSecrets = (left, right) => {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
};
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

function parseCookies(header = '') {
  const cookies = new Map();
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key) cookies.set(key, pair.slice(separator + 1).trim());
  }
  return cookies;
}

export function createSessionCookie(config, now = Date.now()) {
  const expires = Math.floor(now / 1000) + config.sessionTtlSeconds;
  const value = `${expires}.${sign(String(expires), config.authToken)}`;
  const attributes = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${config.sessionTtlSeconds}`];
  if (config.secureCookies) attributes.push('Secure');
  return attributes.join('; ');
}

export function clearSessionCookie(config) {
  const attributes = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (config.secureCookies) attributes.push('Secure');
  return attributes.join('; ');
}

function validSession(cookieHeader, config, now = Date.now()) {
  const value = parseCookies(cookieHeader).get(COOKIE_NAME);
  if (!value) return false;
  const separator = value.indexOf('.');
  if (separator < 1) return false;
  const expires = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(now / 1000)) return false;
  return equalSecrets(signature, sign(expires, config.authToken));
}

export function isAuthenticated(request, config) {
  if (!config.authRequired) return true;
  const authorization = request.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return equalSecrets(bearer, config.authToken) || equalSecrets(request.headers['x-hmmarr-token'], config.authToken) || validSession(request.headers.cookie, config);
}

export const verifyLoginToken = (candidate, config) => config.authRequired && equalSecrets(candidate, config.authToken);
