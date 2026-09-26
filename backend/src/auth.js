/**
 * User-bound session cookies and bcrypt password verification.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

const COOKIE_NAME = 'hmmarr_session';
const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

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
    const key = pair.slice(0, i).trim();
    if (key) map.set(key, pair.slice(i + 1).trim());
  }
  return map;
}

export function createSessionCookie(config, user, now = Date.now()) {
  const expires = Math.floor(now / 1000) + config.sessionTtlSeconds;
  const payload = [user.id, user.session_version, expires].join('.');
  const value = payload + '.' + sign(payload, config.sessionSecret);
  const attrs = [
    COOKIE_NAME + '=' + value,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + config.sessionTtlSeconds
  ];
  if (config.secureCookies) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
}

export function readSessionCookie(request, config) {
  const value = parseCookies(request.headers.cookie ?? '').get(COOKIE_NAME);
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [id, version, expires, signature] = parts;
  if (![id, version, expires].every((part) => /^\d+$/.test(part))) return null;
  const userId = Number(id);
  const sessionVersion = Number(version);
  if (!Number.isSafeInteger(userId) || userId < 1 || !Number.isSafeInteger(sessionVersion) || sessionVersion < 1) return null;
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return null;
  const payload = [id, version, expires].join('.');
  if (!equal(signature, sign(payload, config.sessionSecret))) return null;
  return { userId, sessionVersion };
}

export function generateSecret() {
  return randomBytes(32).toString('base64url');
}
