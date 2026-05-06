import { Pool, PoolClient } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Acquire a pooled client and release it after `fn` completes.
 */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Run `fn` inside a transaction. Commits on success, rolls back on error.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

/**
 * Postgres error code for "undefined_table" — used to gracefully degrade when
 * an optional migration has not been run yet.
 */
export const PG_UNDEFINED_TABLE = "42P01";

export function isMissingTableError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === PG_UNDEFINED_TABLE;
}
