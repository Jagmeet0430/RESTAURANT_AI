import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { applyMenuReceiverMigration, receiverLedgerName } from '../scripts/menuReceiverMigration.js';
import { applyMenuEvents } from '../src/services/menuSyncApiService.js';

test('local 019 and separate cloud receiver on disposable copied schema', { timeout: 180000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'restaurantai-receiver-review-'));
  const cluster = path.join(root, 'postgres');
  const bin = process.env.RESTAURANTAI_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  const tool = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  const run = (name, args) => new Promise((resolve, reject) => {
    const child = spawn(tool(name), args, { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${name} timeout`)); }, 60000);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`${name} exit ${code}`)); });
  });
  const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const connection = { host: '127.0.0.1', port, user: 'postgres' };
  const clients = []; let started = false, admin, serial = 0, backupSerial = 0;
  const local018 = await fs.readFile(new URL('../database/migrations/018_menu_sync.sql', import.meta.url), 'utf8');
  const local019 = await fs.readFile(new URL('../database/migrations/019_menu_sync_import_delete.sql', import.meta.url), 'utf8');
  const bootstrap = (await fs.readFile(new URL('../database/bootstrap/offline_v1_schema.sql', import.meta.url), 'utf8'))
    .split(/\r?\n/).filter(line => !line.startsWith('\\') && !line.startsWith('INSERT INTO public.schema_migrations')).join('\n');
  const schemaDump = process.env.RESTAURANTAI_TEST_SCHEMA_DUMP;
  const fresh = async () => {
    const name = `receiver_fixture_${++serial}`;
    await admin.query(`CREATE DATABASE ${name}`);
    if (schemaDump) await run('pg_restore', ['--exit-on-error','--schema-only','--no-owner','--no-privileges',
      '-h','127.0.0.1','-p',String(port),'-U','postgres','-d',name,path.resolve(schemaDump)]);
    const db = new pg.Client({ ...connection, database: name }); await db.connect(); clients.push(db);
    if (!schemaDump) await db.query(bootstrap);
    await db.query('SET search_path=public');
    await db.query("INSERT INTO categories(id,name) SELECT n,'Category '||n FROM generate_series(1,23) n");
    await db.query("INSERT INTO menu(id,name,category_id,price,veg_type) SELECT n,'Product '||n,1+(n%23),n+0.25,'Veg' FROM generate_series(1,185) n");
    await db.query("SELECT setval('categories_id_seq',23),setval('menu_id_seq',185)");
    await db.query("INSERT INTO customers(id,name,phone) VALUES (1,'Receiver fixture','RECEIVER-FIXTURE')");
    await db.query("INSERT INTO orders(id,customer_id,order_number,status,subtotal,tax,total_amount) SELECT n,1,'RECEIVER-'||n,'Completed',100,5,105 FROM generate_series(1,11) n");
    await db.query('INSERT INTO order_items(order_id,menu_id,quantity,unit_price,total_price) SELECT n,n,1,100,100 FROM generate_series(1,11) n');
    assert.equal((await db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n, 0);
    return { db, name };
  };
  const snapshot = async db => {
    const result = {};
    for (const table of ['menu','categories','orders','order_items','customers','bills','payments','app_settings']) {
      const ignored = table === 'menu' ? ['sync_id','sync_version','sync_owner','deleted_at','display_order','visible_kiosk','visible_website','image_fallback_id']
        : table === 'categories' ? ['sync_id','sync_version','sync_owner','deleted_at'] : [];
      result[table] = (await db.query(`SELECT to_jsonb(t)-$1::text[] row FROM public.${table} t ORDER BY (to_jsonb(t)-$1::text[])::text`, [ignored])).rows;
    }
    return result;
  };
  const options = fixture => ({ mode: 'online', syncEnabled: false, expectedCounts: { menu: 185, categories: 23, orders: 11 },
    backup: async () => {
      const backupPath = path.join(root, `${fixture.name}.dump`);
      await run('pg_dump', ['-h','127.0.0.1','-p',String(port),'-U','postgres','-d',fixture.name,'-Fc','-f',backupPath]);
      await run('pg_restore', ['--list',backupPath]);
      const restoredName = `restore_fixture_${++backupSerial}`;
      await admin.query(`CREATE DATABASE ${restoredName}`);
      await run('pg_restore', ['--exit-on-error','--no-owner','--no-privileges','-h','127.0.0.1',
        '-p',String(port),'-U','postgres','-d',restoredName,backupPath]);
      const restored = new pg.Client({ ...connection, database: restoredName }); await restored.connect();
      try { assert.deepEqual(await snapshot(restored),await snapshot(fixture.db)); } finally { await restored.end(); }
      return { backupPath, checksum: crypto.createHash('sha256').update(await fs.readFile(backupPath)).digest('hex') };
    } });
  try {
    await run('initdb', ['-D',cluster,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
    await run('pg_ctl', ['-D',cluster,'-l',path.join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']); started = true;
    admin = new pg.Client({ ...connection, database: 'postgres' }); await admin.connect();
    await admin.query('CREATE ROLE anon; CREATE ROLE authenticated');
    const local = await fresh(), cloud = await fresh();
    const original = await snapshot(local.db), cloudOriginal = await snapshot(cloud.db);
    await t.test('read-only preflight and backup fingerprint SQL execute without changing the empty ledger or catalog', async () => {
      await cloud.db.query(await fs.readFile(new URL('../database/cloud/menu_sync_preflight.sql',import.meta.url),'utf8'));
      const fingerprints=await cloud.db.query(await fs.readFile(new URL('../database/cloud/menu_backup_fingerprint.sql',import.meta.url),'utf8'));
      assert.equal(fingerprints.at(-1).rows.length,4);
      assert.deepEqual(await snapshot(cloud.db),cloudOriginal);
      assert.equal((await cloud.db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,0);
    });
    await t.test('018 remains byte-identical to the recorded development checksum', () => {
      assert.equal(crypto.createHash('sha256').update(local018).digest('hex'), '30d37853e71c98f35eb4c0d69729ee89637ff3cb599b0ecd27cb8140253f063d');
    });
    await local.db.query(local018);
    const hash018=crypto.createHash('sha256').update(local018).digest('hex');
    await local.db.query("INSERT INTO schema_migrations(migration_name,checksum,baseline) VALUES('windows-018_menu_sync.sql',$1,false)",[hash018]);
    await t.test('reproduces old import DELETE cancellation; 019 rolls back and then fixes it without reseeding', async () => {
      await local.db.query("BEGIN; SET LOCAL restaurantai.menu_import='on'");
      assert.equal((await local.db.query('DELETE FROM menu WHERE id=185')).rowCount, 0);
      await local.db.query('ROLLBACK');
      const before = (await local.db.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows;
      await local.db.query('BEGIN'); await local.db.query(local019); await local.db.query('ROLLBACK');
      await local.db.query("BEGIN; SET LOCAL restaurantai.menu_import='on'");
      assert.equal((await local.db.query('DELETE FROM menu WHERE id=185')).rowCount, 0); await local.db.query('ROLLBACK');
      await local.db.query(local019); await local.db.query(local019);
      assert.deepEqual((await local.db.query('SELECT migration_name,checksum FROM schema_migrations')).rows,
        [{migration_name:'windows-018_menu_sync.sql',checksum:hash018}]);
      assert.deepEqual(await snapshot(local.db), original);
      assert.equal(before.length, 208);
      assert.deepEqual((await local.db.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows, before);
    });
    await t.test('import INSERT/UPDATE/DELETE work on products and categories with no echo; local DELETE still emits', async () => {
      await local.db.query("BEGIN; SET LOCAL restaurantai.menu_import='on'");
      const c = (await local.db.query("INSERT INTO categories(name) VALUES('Import temporary') RETURNING id")).rows[0].id;
      const m = (await local.db.query("INSERT INTO menu(name,category_id,price,veg_type) VALUES('Import temporary',$1,1,'Veg') RETURNING id",[c])).rows[0].id;
      assert.equal((await local.db.query("UPDATE menu SET price=2 WHERE id=$1",[m])).rowCount,1);
      assert.equal((await local.db.query("UPDATE categories SET name='Import edit' WHERE id=$1",[c])).rowCount,1);
      assert.equal((await local.db.query('DELETE FROM menu WHERE id=$1',[m])).rowCount,1);
      assert.equal((await local.db.query('DELETE FROM categories WHERE id=$1',[c])).rowCount,1);
      assert.equal((await local.db.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n,208);
      await local.db.query('COMMIT');
      await local.db.query('BEGIN');
      assert.equal((await local.db.query('DELETE FROM menu WHERE id=185')).rowCount,1);
      assert.equal((await local.db.query("SELECT count(*)::int n FROM menu_sync_outbox WHERE payload->>'deleted_at' IS NOT NULL")).rows[0].n,1);
      await local.db.query('ROLLBACK'); assert.deepEqual(await snapshot(local.db),original);
    });
    await t.test('wrong role/count and failed backup prevent receiver changes', async () => {
      await assert.rejects(applyMenuReceiverMigration(cloud.db,{...options(cloud),mode:'local'}),/online mode/);
      await assert.rejects(applyMenuReceiverMigration(cloud.db,{...options(cloud),expectedCounts:{menu:184,categories:23,orders:11}}),/count changed/);
      await assert.rejects(applyMenuReceiverMigration(cloud.db,{...options(cloud),backup:async()=>{throw Error('backup failure');}}),/backup failure/);
      assert.equal((await cloud.db.query("SELECT to_regclass('public.menu_sync_outbox') x")).rows[0].x,null);
    });
    await t.test('ledger failure atomically rolls back receiver DDL and preserves original rows', async () => {
      await cloud.db.query("ALTER TABLE schema_migrations ADD CONSTRAINT reject_cloud CHECK (migration_name NOT LIKE 'cloud-%')");
      await assert.rejects(applyMenuReceiverMigration(cloud.db,options(cloud)),{code:'23514'});
      assert.equal((await cloud.db.query("SELECT to_regclass('public.menu_sync_outbox') x")).rows[0].x,null);
      assert.deepEqual(await snapshot(cloud.db),cloudOriginal);
      await cloud.db.query('ALTER TABLE schema_migrations DROP CONSTRAINT reject_cloud');
    });
    await t.test('receiver preserves 185 products, 23 categories, 11 orders; creates zero outbound events and only its true ledger entry', async () => {
      assert.equal((await applyMenuReceiverMigration(cloud.db,options(cloud))).applied,true);
      assert.deepEqual(await snapshot(cloud.db),cloudOriginal);
      assert.deepEqual((await cloud.db.query('SELECT migration_name FROM schema_migrations')).rows,[{migration_name:receiverLedgerName}]);
      assert.equal((await cloud.db.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n,0);
      assert.equal((await cloud.db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('menu_sync_capture','category_sync_capture')")).rows[0].n,0);
      const ids=(await cloud.db.query('SELECT sync_id FROM menu ORDER BY id')).rows;
      assert.equal(new Set(ids.map(x=>x.sync_id)).size,185);
      assert.equal((await applyMenuReceiverMigration(cloud.db,options(cloud))).applied,false);
      assert.deepEqual((await cloud.db.query('SELECT sync_id FROM menu ORDER BY id')).rows,ids);
      await cloud.db.query("BEGIN; UPDATE menu SET price=99 WHERE id=185");
      assert.equal((await cloud.db.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n,0); await cloud.db.query('ROLLBACK');
    });
    await t.test('new receiver tables are RLS protected from browser roles', async () => {
      for(const role of ['anon','authenticated']) {
        for(const table of ['menu_sync_clock','menu_sync_receipts','menu_sync_outbox','menu_image_assets']) {
          assert.equal((await cloud.db.query('SELECT has_table_privilege($1,$2,\'SELECT\') allowed',[role,'public.'+table])).rows[0].allowed,false);
        }
      }
      assert.equal((await cloud.db.query("SELECT count(*)::int n FROM pg_class WHERE relname IN ('menu_sync_clock','menu_sync_receipts','menu_sync_outbox','menu_image_assets') AND relrowsecurity")).rows[0].n,4);
    });
    await t.test('real receiver imports adopt IDs, keep history and ACK duplicate/older versions without outbound echo', async () => {
      const config={restaurantId:crypto.randomUUID(),sourceId:crypto.randomUUID()};
      const events=(await local.db.query('SELECT entity,sync_id,version,payload FROM menu_sync_outbox ORDER BY version')).rows;
      const pool=new pg.Pool({...connection,database:cloud.name});
      try {
        for(let i=0;i<events.length;i+=20)await applyMenuEvents(pool,{restaurant_id:config.restaurantId,source_id:config.sourceId,events:events.slice(i,i+20)},config);
        await applyMenuEvents(pool,{restaurant_id:config.restaurantId,source_id:config.sourceId,events:events.slice(0,20)},config);
        assert.equal((await cloud.db.query('SELECT count(*)::int n FROM menu_sync_receipts')).rows[0].n,208);
        assert.equal((await cloud.db.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n,0);
        assert.equal((await cloud.db.query('SELECT count(*)::int n FROM menu')).rows[0].n,185);
        const after=await snapshot(cloud.db);
        for(const key of ['orders','order_items','customers','bills','payments','app_settings'])assert.deepEqual(after[key],cloudOriginal[key]);
        assert.deepEqual((await cloud.db.query('SELECT id,price,category_id FROM menu ORDER BY id')).rows,(await local.db.query('SELECT id,price,category_id FROM menu ORDER BY id')).rows);
        await cloud.db.query('BEGIN');
        await assert.rejects(cloud.db.query('UPDATE menu SET sync_id=(SELECT sync_id FROM menu WHERE id=1) WHERE id=2'),{code:'23505'});
        await cloud.db.query('ROLLBACK');
      }finally{await pool.end();}
    });
    await t.test('mismatched recorded receiver checksum blocks reruns', async () => {
      await cloud.db.query("UPDATE schema_migrations SET checksum='changed'");
      await assert.rejects(applyMenuReceiverMigration(cloud.db,options(cloud)),/checksum mismatch/);
    });
    for(const [name,setup] of [
      ['incompatible sync column',"ALTER TABLE menu ADD COLUMN sync_id text"],
      ['pre-existing sync UUIDs',"ALTER TABLE menu ADD COLUMN sync_id uuid DEFAULT '11111111-1111-4111-8111-111111111111'"],
      ['conflicting object',"CREATE TABLE menu_sync_outbox(unrelated text)"],
      ['duplicate product identity',"UPDATE menu SET name=(SELECT name FROM menu WHERE id=1),category_id=(SELECT category_id FROM menu WHERE id=1) WHERE id=2"],
      ['missing prerequisite',"ALTER TABLE menu RENAME COLUMN barcode TO legacy_barcode"],
      ['invalid price',"UPDATE menu SET price=-1 WHERE id=185"],
    ]) await t.test(`preflight refuses ${name} without modifying original data`,async()=>{
      const f=await fresh();await f.db.query(setup);const before=await snapshot(f.db);
      await assert.rejects(applyMenuReceiverMigration(f.db,options(f)));
      assert.deepEqual(await snapshot(f.db),before);
      assert.equal((await f.db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,0);
    });
    console.log(`Schema source: ${schemaDump?'schema-only restore of existing local pre-018 archive':'repository baseline schema copy'}; fixtures 185/23/11, NOT a production Supabase clone.`);
  } finally {
    for(const client of clients)await client.end(); if(admin)await admin.end();
    if(started)await run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);
    console.log(`Disposable PostgreSQL stopped: ${root}`);
  }
});
