/**
 * Session cookie helpers + bcrypt password verification.
 * Replaces the old shared-token approach.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

const COOKIE_NAME = 'hmmarr_session';
const BCRYPT_ROUNDS = 12;

// ── Password helpers ──────────────────────────────────────────────────────────

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// ── Session cookie (HMAC-signed expiry, same scheme as before) ────────────────

const sign = (value, secret) =>
  createHmac('sha256', secret).update(value).digest('base64url');

const equal = (a, b) => {
  const ba = Buffer.from(a ?? '');
  const bb = Buffer.from(b ?? '');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

function parseCookies(header = '') {
  const map = new Map();
  for (const pair of header.split(';')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const k = pair.slice(0, i).trim();
    if (k) map.set(k, pair.slice(i + 1).trim());
  }
  return map;
}

export function createSessionCookie(config, now = Date.now()) {
  const expires = Math.floor(now / 1000) + config.sessionTtlSeconds;
  const value = `${expires}.${sign(String(expires), config.sessionSecret)}`;
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${config.sessionTtlSeconds}`,
  ];
  if (config.secureCookies) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie(config) {
  const attrs = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (config.secureCookies) attrs.push('Secure');
  return attrs.join('; ');
}

export function isAuthenticated(request, config) {
  if (!config.authRequired) return true;
  const cookie = request.headers.cookie ?? '';
  const value = parseCookies(cookie).get(COOKIE_NAME);
  if (!value) return false;
  const sep = value.indexOf('.');
  if (sep < 1) return false;
  const expires = value.slice(0, sep);
  const sig = value.slice(sep + 1);
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return equal(sig, sign(expires, config.sessionSecret));
}

// ── Bootstrap: generate a random secret if none is set ───────────────────────
export function generateSecret() {
  return randomBytes(32).toString('base64url');
}
