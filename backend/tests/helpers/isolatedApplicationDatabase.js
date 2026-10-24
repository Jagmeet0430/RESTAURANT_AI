// Test-only harness: never load backend/.env or the installed ProgramData .env.
import { after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';

const exec = promisify(execFile);
export async function isolatedApplicationDatabase() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'restaurantai-isolated-app-'));
  const data = path.join(root, 'data');
  const bin = process.env.RESTAURANTAI_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  const run = (name, args) => exec(path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')), args,
    { windowsHide: true, timeout: 30000 });
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  let started = false, setup;
  const stop = async () => {
    if (started || await fs.access(path.join(data, 'postmaster.pid')).then(() => true, () => false)) {
      await run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
      started = false;
      if (await fs.access(path.join(data, 'postmaster.pid')).then(() => true, () => false)) {
        throw new Error('Isolated test PostgreSQL did not stop');
      }
      console.log('Stopped isolated application test PostgreSQL on port ' + port);
    }
  };
  try {
    await run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
    await run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
    started = true;
    setup = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    await setup.connect();
    const schema = (await fs.readFile(new URL('../../database/bootstrap/offline_v1_schema.sql', import.meta.url), 'utf8'))
      .split(/\r?\n/).filter(line => !line.startsWith('\\')).join('\n');
    await setup.query(schema);
    await setup.query('SET search_path TO public');
    for (const name of ['014_table_qr_ordering.sql', '015_billing_receipts_settlement.sql', '016_cloud_order_sync.sql',
      '017_admin_order_notifications.sql', '018_menu_sync.sql']) {
      await setup.query(await fs.readFile(new URL('../../database/migrations/' + name, import.meta.url), 'utf8'));
    }
    const envPath = path.join(root, 'test.env');
    await fs.writeFile(envPath, '# Isolated automated test; deliberately contains no restaurant credentials.\n');
    Object.assign(process.env, {
      RESTAURANTAI_ENV_FILE: envPath, RESTAURANTAI_ENV_PATH: envPath, RESTAURANTAI_STATE_ROOT: path.join(root, 'state'),
      NODE_ENV: 'test', RESTAURANTAI_MODE: 'local', DB_HOST: '127.0.0.1', DB_PORT: String(port),
      DB_NAME: 'postgres', DB_USER: 'postgres', DB_PASSWORD: '', DATABASE_URL: '',
      CLOUD_SYNC_ENABLED: 'false', MENU_SYNC_ENABLED: 'false', WHATSAPP_ENABLED: 'false',
      PUBLIC_ORDER_OTP_REQUIRED: 'true', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      OTP_SECRET: crypto.randomBytes(32).toString('hex'),
    });
    // Registered before callers import the application; runs even on failed assertions.
    after(stop);
  } catch (error) {
    await stop();
    throw error;
  } finally {
    await setup?.end();
  }
  return { root, port };
}
