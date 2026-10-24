// Explicit operator adapter only: importing this module never opens a connection.
// No CLI, environment loading, worker startup or production auto-migration.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export const receiverLedgerName = 'cloud-018_menu_sync_receiver.sql';
export async function applyMenuReceiverMigration(client, { mode, syncEnabled, expectedCounts, backup } = {}) {
  if (mode !== 'online' || syncEnabled !== false || typeof backup !== 'function') {
    throw new Error('Receiver migration requires online mode, sync disabled and a verified-backup callback');
  }
  for (const key of ['menu','categories','orders']) {
    if (!Number.isSafeInteger(expectedCounts?.[key]) || expectedCounts[key] < 0) throw new Error('Reviewed row counts are required');
  }
  const sql = await fs.readFile(new URL('../database/cloud/018_menu_sync_receiver.sql', import.meta.url), 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='120s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('restaurantai_cloud_menu_receiver'))");
    const applied = (await client.query('SELECT checksum FROM public.schema_migrations WHERE migration_name=$1', [receiverLedgerName])).rows[0];
    if (applied) {
      if (applied.checksum !== checksum) throw new Error('Receiver migration checksum mismatch');
      await client.query('COMMIT');
      return { applied: false, checksum };
    }
    for (const key of ['menu','categories','orders']) {
      const count = Number((await client.query(`SELECT count(*) FROM public.${key}`)).rows[0].count);
      if (count !== expectedCounts[key]) throw new Error(`Reviewed count changed: ${key}`);
    }
    // The callback must perform archive and restore verification outside this
    // connection. This adapter independently checks the exact backup bytes.
    const saved = await backup();
    if (!saved?.backupPath || !saved?.checksum) throw new Error('Verified backup metadata required');
    const bytes = await fs.readFile(saved.backupPath);
    if (!bytes.length || crypto.createHash('sha256').update(bytes).digest('hex') !== saved.checksum) throw new Error('Backup checksum mismatch');
    await client.query(sql);
    await client.query('INSERT INTO public.schema_migrations(migration_name,checksum,baseline) VALUES($1,$2,false)', [receiverLedgerName,checksum]);
    await client.query('COMMIT');
    return { applied: true, checksum };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
