import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

let enabled = false, configurationError = false, dbError = null, pending = 0, code = null;
mock.module('../src/config/database.js', { exports: { pool: { query: async sql => {
  if (dbError) throw Object.assign(new Error('fixture database error'), { code: dbError });
  return { rows: sql.includes('count(*)') ? [{ pending_changes: pending, last_success_at: null }] : code ? [{ last_error_code: code }] : [] };
} } } });
mock.module('../src/config/index.js', { exports: { appConfig: { mode: 'local' } } });
mock.module('../src/config/menuSyncConfig.js', { exports: { menuSyncConfig: () => {
  if (configurationError) throw new Error('fixture configuration');
  return { enabled };
} } });
const { getMenuSyncStatus } = await import('../src/controllers/menuSyncController.js');

test('menu sync status distinguishes database, configuration, transport and cloud state', async t => {
  const app = express(); app.get('/status', getMenuSyncStatus);
  app.use((error, req, res, next) => res.status(500).json({ success: false }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const read = async () => { const r = await fetch(`http://127.0.0.1:${server.address().port}/status`); return { status: r.status, body: await r.json() }; };
  try {
    await t.test('disabled sync is honest even with queued changes or old errors', async () => {
      pending = 208; code = 'SYNC_HTTP_500';
      const r = await read(); assert.equal(r.status, 200); assert.equal(r.body.data.state, 'disabled');
      assert.equal(r.body.data.pending_changes, 208); assert.equal(r.body.data.error_message, null);
    });
    await t.test('missing table or column is 503, never fake disabled success', async () => {
      for (const value of ['42P01', '42703']) { dbError = value; const r = await read();
        assert.equal(r.status, 503); assert.equal(r.body.success, false); assert.equal(r.body.code, 'MENU_SCHEMA_MISSING'); }
      dbError = null;
    });
    await t.test('other database failures remain failures', async () => {
      dbError = 'ECONNREFUSED'; assert.equal((await read()).status, 500); dbError = null;
    });
    await t.test('enabled pending, synchronized, offline and cloud errors are distinct', async () => {
      enabled = true;
      for (const [error, count, state] of [[null, 1, 'pending'], [null, 0, 'synced'],
        ['SYNC_NETWORK_UNAVAILABLE', 1, 'offline'], ['SYNC_HTTP_503', 1, 'cloud_error'], ['SYNC_IMAGE_UPLOAD_FAILED', 1, 'retrying']]) {
        code = error; pending = count; assert.equal((await read()).body.data.state, state);
      }
    });
    await t.test('invalid enabled configuration is not misreported as disabled', async () => {
      configurationError = true; assert.equal((await read()).body.data.state, 'configuration_error');
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
