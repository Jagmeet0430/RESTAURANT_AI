import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import jwt from "jsonwebtoken";
import { prepareDatabase, validateLocalConfig } from "../scripts/deployment.js";

const exec = promisify(execFile);
const repo = path.resolve(import.meta.dirname, "../..");
test("Windows deployment: isolated migrations, backup restore, installed-layout startup and shutdown", { timeout: 240000 }, async t => {
  const freePort = async () => {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    return port;
  };
  const savedEnv = { ...process.env };
  const bin = process.env.RESTAURANTAI_TEST_PG_BIN || "C:/Program Files/PostgreSQL/18/bin";
  const executable = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  const connection = { host: "127.0.0.1", port: await freePort(), user: "postgres", password: crypto.randomBytes(24).toString("hex") };
  const name = `restaurantai_deploy_test_${Date.now()}`;
  assert.match(name, /^restaurantai_deploy_test_\d+$/);
  const state = await fs.mkdtemp(path.join(os.tmpdir(), "restaurantai-deploy-test-"));
  const cluster = path.join(state, "postgres");
  const configFile = path.join(state, "config/.env");
  const packageRoot = path.join(state, "installation");
  let db, admin, started = false, clusterStarted = false;
  let acknowledgedId, pendingId;
  const runPowerShell = async (script, extra = []) => {
    // Windows background children can inherit execFile's capture pipes. Use a
    // fixture log and wait for the launcher process, not for descendant pipe EOF.
    const log = path.join(state, `${crypto.randomUUID()}.launcher.log`);
    const handle = await fs.open(log, 'w');
    try {
      const childEnv = { ...process.env, FORCE_COLOR: '1' };
      delete childEnv.NO_COLOR;
      delete childEnv.NODE_DISABLE_COLORS;
      const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
        path.join(packageRoot, "scripts", script), "-InstallRoot", packageRoot, "-StateRoot", state, ...extra],
      { env: childEnv, windowsHide: true, stdio: ['ignore', handle.fd, handle.fd] });
      const code = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { child.kill(); reject(new Error('Fixture launcher timed out')); }, 90000);
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); resolve(code); });
      });
      const stdout = await fs.readFile(log, 'utf8');
      assert.equal(code, 0, stdout);
      return { stdout };
    } finally { await handle.close(); }
  };
  try {
    await exec(executable("initdb"), ["-D", cluster, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"],
      { windowsHide: true, timeout: 30000 });
    await exec(executable("pg_ctl"), ["-D", cluster, "-l", path.join(state, "postgres.log"), "-o",
      `-h 127.0.0.1 -p ${connection.port} -F`, "-w", "start"], { windowsHide: true, timeout: 30000 });
    clusterStarted = true;
    admin = new pg.Pool({ ...connection, database: "postgres" });
    await admin.query(`CREATE DATABASE "${name}"`);
    db = new pg.Pool({ ...connection, database: name });
    // Exercise current installer scripts in a disposable installed layout, not
    // the stale distribution or a build. Dependencies/assets are read-only links.
    const backend = path.join(packageRoot, "app/backend");
    await fs.mkdir(backend, { recursive: true });
    for (const folder of ["src", "scripts", "database"]) {
      await fs.cp(path.join(repo, "backend", folder), path.join(backend, folder), { recursive: true });
    }
    for (const file of ["package.json", "package-lock.json"]) await fs.copyFile(path.join(repo, "backend", file), path.join(backend, file));
    await fs.copyFile(path.join(repo, "package.json"), path.join(packageRoot, "app/package.json"));
    await fs.mkdir(path.join(packageRoot, "scripts"), { recursive: true });
    for (const script of ["start-restaurantai.ps1", "stop-restaurantai.ps1", "check-installer.ps1",
      "backup-restaurantai.ps1", "prepare-installed-database.ps1"]) {
      await fs.copyFile(path.join(repo, "scripts", script), path.join(packageRoot, "scripts", script));
    }
    await fs.mkdir(path.join(packageRoot, "app/admin"), { recursive: true });
    await fs.access(path.join(repo, "admin/dist/index.html"));
    for (const [source, target] of [["backend/node_modules", "app/backend/node_modules"],
      ["admin/dist", "app/admin/dist"], ["frontend", "app/frontend"]]) {
      await fs.symlink(path.join(repo, source), path.join(packageRoot, target), process.platform === "win32" ? "junction" : "dir");
    }
    const bootstrap = (await fs.readFile(path.join(repo, "backend/database/bootstrap/offline_v1_schema.sql"), "utf8"))
      .split(/\r?\n/).filter(line => !line.startsWith("\\")).join("\n");
    await db.query(bootstrap);
    await db.query("SET search_path=public");
    await db.query("INSERT INTO customers(name,phone) VALUES ('Deployment Fixture','DEPLOY-FIXTURE')");
    await db.query("INSERT INTO orders(customer_id,order_number,status,subtotal,total_amount) VALUES (1,'DEPLOY-FIXTURE','Confirmed',100,105)");
    const port = await freePort();
    const env = { RESTAURANTAI_MODE: "local", NODE_ENV: "production", DB_HOST: "127.0.0.1", DB_PORT: String(connection.port),
      DB_NAME: name, DB_USER: connection.user, DB_PASSWORD: connection.password,
      JWT_SECRET: crypto.randomBytes(32).toString("hex"), OTP_SECRET: crypto.randomBytes(32).toString("hex"),
      WHATSAPP_ENABLED: "false", CLOUD_SYNC_ENABLED: "false", CLOUD_SYNC_SECRET: crypto.randomBytes(32).toString('hex'),
      CLOUD_SYNC_BASE_URL: 'https://fixture.invalid/api', HOST: "127.0.0.1", PORT: String(port),
      POSTGRES_BIN_DIR: bin,
      BACKUP_DIR: path.join(state, "backups/database"), UPLOAD_DIR: path.join(state, "data/uploads") };
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    await fs.writeFile(configFile, Object.entries(env).map(([key,value]) => `${key}=${value}`).join("\n"));
    const printer = JSON.stringify({ enabled: false, printerName: 'Fixture printer', paperWidth: '58mm' });
    const kiosk = JSON.stringify({ displayMode: 'portrait', fixture: true });
    await fs.writeFile(path.join(state, 'config/printer.json'), printer);
    await fs.writeFile(path.join(state, 'config/kiosk.json'), kiosk);
    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(env.UPLOAD_DIR, 'fixture.txt'), 'persistent upload fixture');
    const restaurantSettings = { restaurantName: 'Preserved fixture restaurant', gst: 'FIXTURE-GST', receiptWidth: '58' };
    await db.query("INSERT INTO app_settings(key,value) VALUES ('restaurant',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [restaurantSettings]);
    const originalConfig = await fs.readFile(configFile);
    const historicalOrder = async () => (await db.query(`SELECT id,order_number,status,subtotal,tax,discount,
      delivery_charge,total_amount,payment_status FROM orders WHERE id=1`)).rows[0];
    const originalOrder = await historicalOrder();
    Object.assign(process.env, env, { RESTAURANTAI_ENV_FILE: configFile, RESTAURANTAI_ENV_PATH: configFile });
    const { runBackup } = await import("../scripts/backupDatabase.js");
    await t.test('018-only repair verifies backup, rolls back atomically, records checksum and preserves legacy rows on rerun', async () => {
      const repairName = `${name}_menu`;
      await admin.query(`CREATE DATABASE "${repairName}"`);
      const repair = new pg.Pool({ ...connection, database: repairName });
      const repairEnv = { ...env, DB_NAME: repairName };
      let backupCalls = 0;
      const backup = async () => {
        backupCalls++;
        const backupPath = path.join(state, 'menu-repair.dump');
        await exec(executable('pg_dump'), ['-h', connection.host, '-p', String(connection.port), '-U', connection.user,
          '-d', repairName, '-Fc', '-f', backupPath], { windowsHide: true });
        await exec(executable('pg_restore'), ['--list', backupPath], { windowsHide: true });
        return { backupPath, checksum: crypto.createHash('sha256').update(await fs.readFile(backupPath)).digest('hex') };
      };
      try {
        await repair.query(bootstrap);
        await repair.query('SET search_path=public');
        await assert.rejects(prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup }), /recorded migration 017/);
        assert.equal(backupCalls, 0);
        await repair.query(await fs.readFile(path.join(repo, 'backend/database/migrations/017_admin_order_notifications.sql'), 'utf8'));
        await repair.query("INSERT INTO schema_migrations(migration_name,baseline) VALUES ('windows-017_admin_order_notifications.sql',false)");
        await repair.query("INSERT INTO categories(name) VALUES ('Preserved category')");
        await repair.query("INSERT INTO menu(name,category_id,price,is_available,image_url,veg_type) VALUES ('Preserved product',1,123.45,false,'/images/preserved.jpg','Veg')");
        const before = (await repair.query('SELECT * FROM menu')).rows[0];
        const category = (await repair.query('SELECT * FROM categories')).rows[0];
        await assert.rejects(prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup: async () => { throw new Error('backup fixture failure'); } }), /backup fixture failure/);
        await repair.query("ALTER TABLE schema_migrations ADD CONSTRAINT reject_018 CHECK (migration_name <> 'windows-018_menu_sync.sql')");
        await assert.rejects(prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup }), { code: '23514' });
        assert.equal((await repair.query("SELECT to_regclass('public.menu_sync_outbox') AS name")).rows[0].name, null);
        assert.deepEqual((await repair.query('SELECT * FROM menu')).rows[0], before);
        await repair.query('ALTER TABLE schema_migrations DROP CONSTRAINT reject_018');
        await prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup });
        const ledger = (await repair.query("SELECT * FROM schema_migrations WHERE migration_name LIKE 'windows-%' ORDER BY id")).rows;
        assert.deepEqual(ledger.map(row => row.migration_name), ['windows-017_admin_order_notifications.sql','windows-018_menu_sync.sql']);
        const sql = await fs.readFile(path.join(repo, 'backend/database/migrations/018_menu_sync.sql'), 'utf8');
        assert.equal(ledger[1].checksum, crypto.createHash('sha256').update(sql).digest('hex'));
        const row = (await repair.query('SELECT * FROM menu m WHERE m.deleted_at IS NULL')).rows[0];
        for (const key of Object.keys(before)) assert.deepEqual(row[key], before[key], key);
        const afterCategory = (await repair.query('SELECT * FROM categories')).rows[0];
        for (const key of Object.keys(category)) assert.deepEqual(afterCategory[key], category[key], key);
        const outbox = (await repair.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows;
        await prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup });
        assert.deepEqual((await repair.query('SELECT * FROM menu')).rows[0], row);
        assert.deepEqual((await repair.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows, outbox);
        assert.deepEqual((await repair.query("SELECT * FROM schema_migrations WHERE migration_name LIKE 'windows-%' ORDER BY id")).rows, ledger);
        await repair.query("UPDATE schema_migrations SET checksum='invalid' WHERE migration_name='windows-018_menu_sync.sql'");
        await assert.rejects(prepareDatabase(repairEnv, { migrate: true, menuOnly: true, backup }), { code: 'MIGRATION_CHECKSUM_MISMATCH' });
        assert.deepEqual((await repair.query('SELECT * FROM menu')).rows[0], row);
      } finally { await repair.end(); }
    });
    await t.test("local target and disabled-sync configuration checks", () => {
      validateLocalConfig(env);
      assert.throws(() => validateLocalConfig({ ...env, DB_HOST: "cloud.invalid" }));
      assert.throws(() => validateLocalConfig({ ...env, RESTAURANTAI_MODE: "online" }));
    });
    await t.test("backup failure blocks migrations without altering schema/data", async () => {
      await assert.rejects(prepareDatabase(env, { migrate: true, backup: async () => { throw new Error("fixture backup failure"); } }));
      const result = await db.query("SELECT to_regclass('public.cloud_order_sync_events') AS name");
      assert.equal(result.rows[0].name, null);
      assert.equal((await db.query("SELECT total_amount FROM orders WHERE id=1")).rows[0].total_amount, '105.00');
    });
    await t.test("incorrect backup checksum blocks migrations", async () => {
      const invalidBackup = path.join(state, 'invalid.dump');
      await fs.writeFile(invalidBackup, 'fixture');
      await assert.rejects(prepareDatabase(env, { migrate: true,
        backup: async () => ({ backupPath: invalidBackup, checksum: 'invalid' }) }), /checksum/);
      assert.equal((await db.query("SELECT to_regclass('public.cloud_order_sync_events') AS name")).rows[0].name, null);
    });
    await t.test("migration SQL failure rolls back schema and ledger changes", async () => {
      await db.query("ALTER TABLE schema_migrations ADD CONSTRAINT fixture_reject_migration CHECK (migration_name <> 'windows-017_admin_order_notifications.sql')");
      try {
        await assert.rejects(prepareDatabase(env, { migrate: true, backup: runBackup }), { code: '23514' });
        assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM schema_migrations WHERE migration_name LIKE 'windows-%'")).rows[0].count, 0);
        assert.equal((await db.query("SELECT to_regclass('public.restaurant_tables') AS name")).rows[0].name, null);
        assert.equal((await db.query("SELECT to_regclass('public.admin_order_notifications') AS name")).rows[0].name, null);
        assert.equal((await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='admin_notification_eligible'")).rowCount, 0);
        assert.deepEqual(await historicalOrder(), originalOrder);
        assert.deepEqual((await db.query("SELECT value FROM app_settings WHERE key='restaurant'")).rows[0].value, restaurantSettings);
      } finally {
        await db.query("ALTER TABLE schema_migrations DROP CONSTRAINT fixture_reject_migration");
      }
    });
    await t.test("installed migration entrypoint applies 013-018 in order and preserves history/settings/acknowledgements on rerun", async () => {
      await runPowerShell("prepare-installed-database.ps1");
      const ledger = (await db.query("SELECT * FROM schema_migrations WHERE migration_name LIKE 'windows-%' ORDER BY id")).rows;
      assert.deepEqual(ledger.map(row => row.migration_name), [
        "windows-013_counter_sale_idempotency.sql", "windows-014_table_qr_ordering.sql",
        "windows-015_billing_receipts_settlement.sql", "windows-016_cloud_order_sync.sql", "windows-017_admin_order_notifications.sql",
        "windows-018_menu_sync.sql",
      ]);
      assert.equal((await db.query("SELECT admin_notification_eligible FROM orders WHERE id=1")).rows[0].admin_notification_eligible, false);
      await db.query("INSERT INTO admins(name,email,role) VALUES ('Fixture Admin','deploy@example.invalid','admin')");
      const inserted = await db.query(`INSERT INTO orders(customer_id,order_number,status,order_source,subtotal,tax,total_amount)
        VALUES (1,'DEPLOY-ACK','Confirmed','kiosk',100,5,105),
               (1,'DEPLOY-PENDING','Confirmed','table_qr',100,5,105) RETURNING id,admin_notification_eligible`);
      [acknowledgedId, pendingId] = inserted.rows.map(row => row.id);
      assert.ok(inserted.rows.every(row => row.admin_notification_eligible === true));
      await db.query(`INSERT INTO admin_order_notifications(order_id,payload,acknowledged_at,acknowledged_by)
        VALUES ($1,jsonb_build_object('order_number','DEPLOY-ACK','order_source','kiosk'),CURRENT_TIMESTAMP,1)`, [acknowledgedId]);
      const acknowledgements = (await db.query("SELECT * FROM admin_order_notifications")).rows;
      // Also verify SQL replay (e.g. a pre-existing schema without its ledger entry)
      // leaves the eligibility flags and durable acknowledgement untouched.
      await db.query(await fs.readFile(path.join(repo, "backend/database/migrations/017_admin_order_notifications.sql"), "utf8"));
      await runPowerShell("prepare-installed-database.ps1");
      assert.deepEqual((await db.query("SELECT * FROM schema_migrations WHERE migration_name LIKE 'windows-%' ORDER BY id")).rows, ledger);
      assert.deepEqual((await db.query("SELECT * FROM admin_order_notifications")).rows, acknowledgements);
      assert.equal((await db.query("SELECT admin_notification_eligible FROM orders WHERE id=1")).rows[0].admin_notification_eligible, false);
      assert.equal((await db.query("SELECT admin_notification_eligible FROM orders WHERE id=$1", [pendingId])).rows[0].admin_notification_eligible, true);
      assert.deepEqual(await historicalOrder(), originalOrder);
      assert.ok((await db.query("SELECT to_regclass('public.cloud_order_sync_events') AS name")).rows[0].name);
      assert.deepEqual((await db.query("SELECT value FROM app_settings WHERE key='restaurant'")).rows[0].value, restaurantSettings);
      assert.deepEqual(await fs.readFile(configFile), originalConfig);
      assert.equal(await fs.readFile(path.join(state, "config/printer.json"), "utf8"), printer);
    });
    await t.test("actual pg_dump archive restores and reconciles in a newly created disposable DB", async () => {
      const backup = await runBackup();
      const result = await exec(process.execPath, [path.join(repo, "backend/scripts/restoreDatabase.js"), backup.backupPath, "--test", "--yes", "--keep-test-db"],
        { env: process.env, windowsHide: true, timeout: 60000 });
      assert.match(result.stdout, /Restore test passed/);
      assert.doesNotMatch(result.stdout, /match=false/);
    });
    await t.test("packaged full backup preserves configuration and verifies the database archive", async () => {
      const original = await fs.readFile(configFile);
      await runPowerShell('backup-restaurantai.ps1');
      const backups = path.join(state, 'backups/full');
      const entries = await fs.readdir(backups);
      assert.equal(entries.length, 1);
      const directory = path.join(backups, entries[0]);
      const manifest = JSON.parse((await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')).replace(/^\uFEFF/, ''));
      assert.equal(manifest.secrets_included, true);
      assert.deepEqual(await fs.readFile(path.join(directory, 'configuration/.env')), original);
      assert.deepEqual(await fs.readFile(configFile), original);
      for (const [file, value] of [['printer.json', printer], ['kiosk.json', kiosk]]) {
        assert.equal(await fs.readFile(path.join(directory, 'configuration', file), 'utf8'), value);
        assert.equal(await fs.readFile(path.join(state, 'config', file), 'utf8'), value);
      }
      assert.equal(await fs.readFile(path.join(directory, 'files/data/uploads/fixture.txt'), 'utf8'), 'persistent upload fixture');
      const metadata = JSON.parse(await fs.readFile(manifest.database_metadata, 'utf8'));
      assert.equal(crypto.createHash('sha256').update(await fs.readFile(manifest.database_dump)).digest('hex'), metadata.checksum_sha256);
    });
    await t.test("forced-color port checks reject malformed values and accept decimal boundaries without changing configuration", async () => {
      const withPort = value => originalConfig.toString().replace(/^PORT=.*$/m, `PORT=${value}`);
      try {
        for (const value of ['', '0', '65536', '-1', '1.5', '5e3', '0x1389', '5001junk', '999999999999', '\u001b[33m5001\u001b[39m']) {
          const config = withPort(value);
          await fs.writeFile(configFile, config);
          await assert.rejects(runPowerShell('check-installer.ps1', ['-CheckStopped']), /Cannot determine configured backend port safely/);
          await assert.rejects(runPowerShell('start-restaurantai.ps1'), /PORT must be a decimal integer from 1 to 65535/);
          assert.equal(await fs.readFile(configFile, 'utf8'), config);
          assert.equal(await fs.access(path.join(state, 'runtime/restaurantai.pid')).then(() => true, () => false), false);
        }
        for (const value of ['1', '65535', '05001', undefined]) {
          const config = value === undefined ? originalConfig.toString().replace(/^PORT=.*\r?\n/m, '') : withPort(value);
          await fs.writeFile(configFile, config);
          // A valid port may belong to another service; checking must never stop it.
          try {
            assert.match((await runPowerShell('check-installer.ps1', ['-CheckStopped'])).stdout, /replacement may proceed/);
          } catch (error) { assert.match(error.message, /still active/); }
          assert.equal(await fs.readFile(configFile, 'utf8'), config);
        }
      } finally { await fs.writeFile(configFile, originalConfig); }
    });
    await t.test("occupied port blocks startup and upgrade without terminating its unrelated listener", async () => {
      const listener = net.createServer(socket => socket.end('fixture listener'));
      await new Promise(resolve => listener.listen(port, '127.0.0.1', resolve));
      try {
        await assert.rejects(runPowerShell('check-installer.ps1', ['-CheckStopped']), /still active/);
        await assert.rejects(runPowerShell('start-restaurantai.ps1'), /already in use/);
        await runPowerShell('stop-restaurantai.ps1');
        assert.equal(listener.listening, true);
        const received = await new Promise((resolve, reject) => {
          const socket = net.connect(port, '127.0.0.1');
          let value = '';
          socket.setTimeout(3000, () => socket.destroy(new Error('Fixture listener timed out')));
          socket.on('data', chunk => { value += chunk; });
          socket.on('end', () => resolve(value));
          socket.on('error', reject);
        });
        assert.equal(received, 'fixture listener');
      } finally { await new Promise(resolve => listener.close(resolve)); }
    });
    await t.test("packaged launcher, all routes/assets, duplicate start and graceful Windows shutdown", async () => {
      started = true;
      const result = await runPowerShell("start-restaurantai.ps1");
      assert.match(result.stdout, /RestaurantAI ready/);
      const base = `http://127.0.0.1:${port}`;
      for (const route of ["/api/health", "/api/ready", "/admin", "/admin/orders", "/admin/kitchen", "/admin/barcode-pos", "/customer?kiosk=1"]) {
        const response = await fetch(base + route);
        assert.equal(response.status, 200, route);
        if (route.startsWith('/api')) assert.equal((await response.json()).success, true);
        else {
          const html = await response.text();
          assert.match(html, /<html/i);
          for (const [, asset] of html.matchAll(/(?:src|href)="(\/admin\/assets\/[^"?#]+)"/g)) assert.equal((await fetch(base + asset)).status, 200);
        }
      }
      assert.equal((await fetch(base + '/api/orders')).status, 401);
      assert.equal((await fetch(base + '/api/admin/orders/notifications')).status, 401);
      const headers = { Authorization: `Bearer ${jwt.sign({ id: 1, role: "admin" }, env.JWT_SECRET)}` };
      const pending = await fetch(base + '/api/admin/orders/notifications', { headers });
      assert.equal(pending.status, 200);
      const notifications = (await pending.json()).data.notifications;
      assert.deepEqual(notifications.map(row => Number(row.order_id)), [pendingId]);
      assert.equal(notifications[0].status, "Confirmed");
      assert.equal(Number(notifications[0].grand_total), 105);
      const ack = await fetch(`${base}/api/admin/orders/notifications/${pendingId}/ack`, { method: "POST", headers });
      assert.equal(ack.status, 200);
      const acknowledged = (await db.query("SELECT * FROM admin_order_notifications ORDER BY order_id")).rows;
      assert.deepEqual((await (await fetch(base + '/api/admin/orders/notifications', { headers })).json()).data.notifications, []);
      const originalProcess = await fs.readFile(path.join(state, 'runtime/restaurantai.process.json'), 'utf8');
      const second = await runPowerShell("start-restaurantai.ps1");
      assert.match(second.stdout, /already running/);
      assert.equal(await fs.readFile(path.join(state, 'runtime/restaurantai.process.json'), 'utf8'), originalProcess);
      await assert.rejects(runPowerShell('check-installer.ps1', ['-CheckStopped']), /still active/);
      await runPowerShell("stop-restaurantai.ps1"); started = false;
      await assert.rejects(fetch(base + '/api/health'));
      await runPowerShell("prepare-installed-database.ps1");
      started = true;
      await runPowerShell("start-restaurantai.ps1");
      assert.deepEqual((await (await fetch(base + '/api/admin/orders/notifications', { headers })).json()).data.notifications, []);
      assert.deepEqual((await db.query("SELECT * FROM admin_order_notifications ORDER BY order_id")).rows, acknowledged);
      assert.deepEqual(await historicalOrder(), originalOrder);
      assert.deepEqual((await db.query("SELECT value FROM app_settings WHERE key='restaurant'")).rows[0].value, restaurantSettings);
      assert.deepEqual(await fs.readFile(configFile), originalConfig);
      await runPowerShell("stop-restaurantai.ps1"); started = false;
      await assert.rejects(fetch(base + '/api/health'));
      assert.match((await runPowerShell('check-installer.ps1', ['-CheckStopped'])).stdout, /replacement may proceed/);
      const log = await fs.readFile(path.join(state, 'logs/backend.log'), 'utf8');
      assert.match(log, /PostgreSQL pool closed/);
      assert.doesNotMatch(log, /Cloud order sync worker started/);
      for (const secret of [env.DB_PASSWORD, env.JWT_SECRET, env.OTP_SECRET, env.CLOUD_SYNC_SECRET]) assert.ok(!log.includes(secret));
      assert.equal(await fs.readFile(path.join(state, 'config/printer.json'), 'utf8'), printer);
      assert.equal(await fs.readFile(path.join(state, 'config/kiosk.json'), 'utf8'), kiosk);
    });
  } finally {
    try {
      if (started) await runPowerShell("stop-restaurantai.ps1");
    } finally {
      if (db) await db.end();
      if (admin) await admin.end();
      if (clusterStarted || await fs.access(path.join(cluster, "postmaster.pid")).then(() => true, () => false)) {
        await exec(executable("pg_ctl"), ["-D", cluster, "-m", "fast", "-w", "stop"], { windowsHide: true, timeout: 30000 });
      }
      assert.equal(await fs.access(path.join(cluster, "postmaster.pid")).then(() => true, () => false), false);
      for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
      Object.assign(process.env, savedEnv);
      console.log(`Temporary PostgreSQL stopped; isolated fixture retained at ${state}`);
    }
  }
});
