const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validatePackage, required } = require('../scripts/validate-windows-package.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restaurantai-package-test-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'restaurantai-package-test-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  for (const file of required) write(file, '');
  write('app/package.json', '{"version":"1.4.4"}');
  write('app/backend/package.json', '{"version":"1.4.4","dependencies":{"express":"*"}}');
  write('app/backend/node_modules/express/package.json', '{"main":"index.js"}');
  write('app/backend/node_modules/express/index.js', 'module.exports = {};');
  write('app/admin/dist/index.html', '<script src="/admin/assets/main.js"></script>');
  write('app/admin/dist/assets/main.js', 'console.log("fixture");');
  write('config/.env.example', 'JWT_SECRET=your-secret-here\nCLOUD_SYNC_SECRET=\nDB_PASSWORD=');
  write('package-manifest.json', '{"version":"1.4.4","entrypoints":{"start":"scripts/start-restaurantai.ps1"}}');
  return { root, write };
}
test('complete package, safe templates and checksum manifest pass', t => {
  const { root } = fixture(t);
  validatePackage(root, { writeManifest: true });
  assert.equal(validatePackage(root).version, '1.4.4');
});
for (const file of ['config/.env', 'app/frontend/.env.production', 'app/backend/data.dump', 'config/id_rsa', 'logs/backend.log']) {
  test(`prohibited file rejected: ${file}`, t => {
    const { root, write } = fixture(t); write(file, 'fixture');
    assert.throws(() => validatePackage(root, { writeManifest: true }), /Prohibited/);
  });
}
test('known credential in arbitrary code is rejected without logging its value', t => {
  const { root, write } = fixture(t);
  const secret = 'unique-fixture-secret-only';
  write('app/frontend/script.js', `const key = '${secret}';`);
  assert.throws(() => validatePackage(root, { knownSecrets: [secret], writeManifest: true }), error => !error.message.includes(secret));
});
test('non-placeholder template credentials rejected', t => {
  const { root, write } = fixture(t); write('config/.env.example', 'DB_PASSWORD=fixture-not-a-placeholder');
  assert.throws(() => validatePackage(root, { writeManifest: true }), /Unsafe configuration/);
});
test('missing required script and changed asset cannot pass release validation', t => {
  const { root, write } = fixture(t);
  validatePackage(root, { writeManifest: true });
  write('app/frontend/script.js', 'changed');
  assert.throws(() => validatePackage(root), /checksums/);
  fs.unlinkSync(path.join(root, 'scripts/start-restaurantai.ps1'));
  assert.throws(() => validatePackage(root), /Missing package file/);
});
for (const file of [
  'app/backend/database/migrations/017_admin_order_notifications.sql',
  'app/backend/database/migrations/018_menu_sync.sql',
  'app/backend/src/services/menuSyncService.js',
  'app/backend/src/services/menuSyncApiService.js',
  'app/backend/src/services/menuImageService.js',
  'app/backend/src/controllers/adminOrderNotificationController.js',
  'app/backend/src/services/adminOrderNotificationService.js',
  'scripts/prepare-installed-database.ps1',
]) {
  test(`notification upgrade dependency is mandatory and checksummed: ${file}`, t => {
    const { root, write } = fixture(t);
    assert.ok(required.includes(file));
    validatePackage(root, { writeManifest: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package-manifest.json'), 'utf8'));
    assert.match(manifest.files_sha256[file], /^[a-f0-9]{64}$/);
    write(file, 'changed fixture');
    assert.throws(() => validatePackage(root), /checksums/);
    fs.unlinkSync(path.join(root, file));
    assert.throws(() => validatePackage(root, { writeManifest: true }), error =>
      error.message === `Missing package file: ${file}`);
  });
}
