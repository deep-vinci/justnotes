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
        custom_title boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE tabs ADD COLUMN IF NOT EXISTS custom_title boolean NOT NULL DEFAULT false;
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
        "INSERT INTO tabs (id, title, content, custom_title, position) VALUES ($1, $2, $3, $4, $5)",
        [t.id, t.title || "", t.content || "", !!t.customTitle, i]
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

// Only ever called as a fallback when localStorage is empty (e.g. cleared,
// or a new device) -- normal page loads never touch the DB.
export async function loadTabs() {
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query("SELECT id, title, content, custom_title FROM tabs ORDER BY position");
  return rows.map((r) => ({ id: r.id, title: r.title, content: r.content, customTitle: r.custom_title }));
}
