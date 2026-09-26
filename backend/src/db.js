/**
 * Postgres connection pool + user management.
 * Requires the `pg` npm package.
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
      process.stderr.write(`[db] pool error: ${err.message}\n`)
    );
  }
  return _pool;
}

const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS hmmarr_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function migrate(pool) {
  await pool.query(MIGRATE_SQL);
}

export async function findUserByUsername(pool, username) {
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM hmmarr_users WHERE username = $1',
    [username]
  );
  return rows[0] ?? null;
}

export async function createUser(pool, username, passwordHash) {
  const { rows } = await pool.query(
    'INSERT INTO hmmarr_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
    [username, passwordHash]
  );
  return rows[0];
}

export async function listUsers(pool) {
  const { rows } = await pool.query(
    'SELECT id, username, created_at FROM hmmarr_users ORDER BY id'
  );
  return rows;
}

export async function deleteUser(pool, username) {
  const { rowCount } = await pool.query(
    'DELETE FROM hmmarr_users WHERE username = $1',
    [username]
  );
  return rowCount > 0;
}

export async function userCount(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM hmmarr_users');
  return rows[0].n;
}
