import { Pool } from "pg";

const g = globalThis;

function getPool() {
  if (!g._pgPool) {
    const connectionString = process.env.DATABASE_URL.split("?")[0];
    g._pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return g._pgPool;
}

let ready;
async function ensureSchema(pool) {
  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS tabs (
        id text PRIMARY KEY,
        title text NOT NULL DEFAULT '',
        content text NOT NULL DEFAULT '',
        position integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }
  await ready;
}

export async function saveTabs(tabs) {
  const pool = getPool();
  await ensureSchema(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tabs");
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      await client.query(
        "INSERT INTO tabs (id, title, content, position) VALUES ($1, $2, $3, $4)",
        [t.id, t.title || "", t.content || "", i]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
