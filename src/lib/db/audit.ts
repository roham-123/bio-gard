import type { PoolClient } from "pg";

export async function logAction(
  client: PoolClient,
  action: string,
  entityType: string,
  entityId: string | number | null,
  detail: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (action, entity_type, entity_id, detail)
     VALUES ($1, $2, $3, $4)`,
    [action, entityType, entityId != null ? String(entityId) : null, JSON.stringify(detail)]
  );
}
