/**
 * Postgres connection pool + user management.
 */
import pg from 'pg';

const { Pool } = pg;
let _pool = null;

export function getPool(config) {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on('error', (err) =>
      process.stderr.write('[db] pool error: ' + err.message + '\n')
    );
  }
  return _pool;
}

const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS hmmarr_users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hmmarr_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hmmarr_users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
UPDATE hmmarr_users
SET is_admin = TRUE
WHERE id = (SELECT MIN(id) FROM hmmarr_users)
  AND NOT EXISTS (SELECT 1 FROM hmmarr_users WHERE is_admin = TRUE);
`;

export async function migrate(pool) {
  await pool.query(MIGRATE_SQL);
}

export async function findUserByUsername(pool, username) {
  const { rows } = await pool.query(
    'SELECT id, username, password_hash, is_admin, session_version FROM hmmarr_users WHERE username = $1',
    [username]
  );
  return rows[0] ?? null;
}

export async function findUserById(pool, id) {
  const { rows } = await pool.query(
    'SELECT id, username, is_admin, session_version FROM hmmarr_users WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(pool, username, passwordHash, isAdmin = false) {
  const { rows } = await pool.query(
    'INSERT INTO hmmarr_users (username, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, username, is_admin, session_version, created_at',
    [username, passwordHash, isAdmin]
  );
  return rows[0];
}

export async function listUsers(pool) {
  const { rows } = await pool.query(
    'SELECT id, username, is_admin, created_at FROM hmmarr_users ORDER BY id'
  );
  return rows;
}

export async function updateUserPassword(pool, id, passwordHash) {
  const { rows } = await pool.query(
    'UPDATE hmmarr_users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING session_version',
    [id, passwordHash]
  );
  return rows[0]?.session_version ?? null;
}

export async function deleteUser(pool, username) {
  const { rowCount } = await pool.query(
    'DELETE FROM hmmarr_users WHERE username = $1 AND is_admin = FALSE',
    [username]
  );
  return rowCount > 0;
}

export async function userCount(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM hmmarr_users');
  return rows[0].n;
}
