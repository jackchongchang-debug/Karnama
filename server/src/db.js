import pg from 'pg'

export const TABLES = ['projects', 'tasks', 'notes', 'customers', 'contacts', 'finances', 'leads', 'templates', 'labels', 'holidays']

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new pg.Pool({ connectionString })
}

export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      tbl        text   NOT NULL,
      id         text   NOT NULL,
      data       jsonb  NOT NULL,
      updated_at bigint NOT NULL,
      seq        bigint NOT NULL,
      PRIMARY KEY (tbl, id)
    );
    CREATE INDEX IF NOT EXISTS records_seq ON records (seq);
    CREATE SEQUENCE IF NOT EXISTS records_seq_gen;
    CREATE TABLE IF NOT EXISTS tokens (
      token      text PRIMARY KEY,
      device     text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen  timestamptz NOT NULL DEFAULT now()
    );
  `)
}

/**
 * Stores pushed rows (a row replaces the stored one only when its updatedAt is newer) and returns
 * every row stored after `cursor`. The advisory lock serialises syncs so sequence numbers commit
 * in order and no device can skip past a row that is still being written.
 */
export async function sync(pool, cursor, changes) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(4242)')
    for (const [tbl, rows] of Object.entries(changes ?? {})) {
      if (!TABLES.includes(tbl) || !Array.isArray(rows)) continue
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || typeof row.updatedAt !== 'number') continue
        await client.query(
          `INSERT INTO records (tbl, id, data, updated_at, seq)
           VALUES ($1, $2, $3, $4, nextval('records_seq_gen'))
           ON CONFLICT (tbl, id) DO UPDATE
             SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, seq = EXCLUDED.seq
             WHERE records.updated_at < EXCLUDED.updated_at`,
          [tbl, row.id, row, row.updatedAt],
        )
      }
    }
    const { rows } = await client.query('SELECT tbl, data, seq FROM records WHERE seq > $1 ORDER BY seq', [cursor])
    const { rows: [{ max }] } = await client.query('SELECT COALESCE(MAX(seq), 0)::bigint AS max FROM records')
    await client.query('COMMIT')
    const out = {}
    for (const r of rows) (out[r.tbl] ??= []).push(r.data)
    return { cursor: Number(max), changes: out }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
