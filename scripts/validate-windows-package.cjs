const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const required = [
  'app/package.json', 'app/backend/package.json', 'app/backend/package-lock.json',
  'app/backend/src/server.js', 'app/backend/src/app.js', 'app/backend/node_modules/express/package.json',
  'app/backend/src/services/cloudOrderSyncService.js', 'app/backend/scripts/deployment.js',
  'app/backend/src/services/cloudOrderImportService.js', 'app/backend/src/config/cloudSyncConfig.js',
  'app/backend/src/routes/cloudSyncRoutes.js', 'app/backend/src/services/cloudOrderSyncApiService.js',
  'app/backend/src/services/receiptPrinterService.js', 'app/backend/src/services/orderTotalsService.js',
  'app/backend/src/services/printerManagementService.js', 'scripts/list-printers.ps1',
  'app/backend/src/services/billingService.js', 'scripts/print-receipt.ps1', 'app/frontend/styles.css',
  'app/backend/scripts/backupDatabase.js', 'app/backend/scripts/restoreDatabase.js',
  'app/backend/database/bootstrap/offline_v1_schema.sql',
  'app/backend/database/migrations/016_cloud_order_sync.sql',
  'app/backend/database/migrations/017_admin_order_notifications.sql',
  'app/backend/database/migrations/018_menu_sync.sql',
  'app/backend/src/config/menuSyncConfig.js',
  'app/backend/src/controllers/menuSyncController.js',
  'app/backend/src/services/menuSyncService.js',
  'app/backend/src/services/menuSyncApiService.js',
  'app/backend/src/services/menuImageService.js',
  'app/backend/src/services/menuCheckoutService.js',
  'app/backend/node_modules/sharp/package.json',
  'app/backend/src/controllers/adminOrderNotificationController.js',
  'app/backend/src/services/adminOrderNotificationService.js',
  'scripts/prepare-installed-database.ps1',
  'app/admin/dist/index.html', 'app/frontend/index.html', 'app/frontend/script.js',
  'config/.env.example', 'config/printer.example.json', 'docs/CUSTOMER_INSTALLATION.md',
  'scripts/setup-restaurantai.ps1', 'scripts/start-restaurantai.ps1', 'scripts/stop-restaurantai.ps1',
  'scripts/backup-restaurantai.ps1', 'scripts/check-installer.ps1', 'scripts/install-startup-task.ps1',
  'scripts/install-kiosk-autostart.ps1', 'README.txt', 'package-manifest.json',
];
function filesIn(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Package contains a link; refusing validation');
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}
function validatePackage(root, { knownSecrets = [], writeManifest = false } = {}) {
  root = path.resolve(root);
  for (const name of required) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`Missing package file: ${name}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package-manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const name of Object.values(manifest.entrypoints || {})) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`Missing entrypoint: ${name}`);
  }
  for (const name of ['app/package.json', 'app/backend/package.json']) {
    if (JSON.parse(fs.readFileSync(path.join(root, name))).version !== manifest.version) throw new Error('Package version mismatch');
  }
  const html = fs.readFileSync(path.join(root, 'app/admin/dist/index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\/admin\/assets\/[^"?#]+)"/g)];
  if (!assets.length) throw new Error('Admin was not built for /admin/');
  for (const [, asset] of assets) {
    if (!fs.existsSync(path.join(root, 'app/admin/dist', asset.replace('/admin/', '')))) throw new Error('Missing Admin asset');
  }
  const dependencies = JSON.parse(fs.readFileSync(path.join(root, 'app/backend/package.json'))).dependencies;
  const { createRequire } = require('node:module');
  const resolve = createRequire(path.join(root, 'app/backend/package.json'));
  for (const name of Object.keys(dependencies)) resolve.resolve(name);
  if (fs.existsSync(path.join(root, 'app/backend/node_modules/nodemon'))) throw new Error('Development dependencies packaged');
  const hashes = {};
  for (const file of filesIn(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const name = path.basename(file);
    if (/(^|\/)(\.git|\.aws|\.ssh|\.codex)(\/|$)/i.test(relative) ||
        (/^\.env(?:\.|$)/i.test(name) && name !== '.env.example') ||
        /\.(dump|bak|pfx|p12|key|pem|log)$/i.test(name) || /^(\.npmrc|id_rsa|id_ed25519)$/i.test(name) ||
        /^(data|logs|runtime|backups)\//.test(relative)) throw new Error(`Prohibited package file: ${relative}`);
    const bytes = fs.readFileSync(file);
    const content = bytes.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]+-----END/.test(content) ||
        /(?:AKIA|ASIA)[A-Z0-9]{16}/.test(content) ||
        /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/.test(content) ||
        knownSecrets.some(secret => secret.length >= 8 && content.includes(secret))) {
      throw new Error(`Potential credential in package file (value suppressed): ${relative}`);
    }
    if (name === '.env.example') {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_]*(?:PASSWORD|SECRET|API_KEY|SERVICE_KEY|TOKEN|DATABASE_URL))\s*=\s*(.*?)\s*$/);
        if (match && match[2] && !/^(?:your[-_]|change[-_]?me|replace[-_]|<|""|''|postgresql:\/\/USER:PASSWORD@)/i.test(match[2])) {
          throw new Error(`Unsafe configuration template value: ${match[1]} (value suppressed)`);
        }
      }
    }
    if (relative !== 'package-manifest.json') hashes[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  if (writeManifest) {
    manifest.files_sha256 = hashes;
    fs.writeFileSync(path.join(root, 'package-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  } else if (JSON.stringify(manifest.files_sha256) !== JSON.stringify(hashes)) {
    throw new Error('Package file inventory/checksums do not match; rebuild the package');
  }
  return { version: manifest.version, files: Object.keys(hashes).length };
}
module.exports = { validatePackage, required };
if (require.main === module) {
  try {
    // Compare real local secret values in memory only; never print them or copy them.
    const repo = path.resolve(__dirname, '..');
    const dotenv = require(path.join(repo, 'backend/node_modules/dotenv'));
    const knownSecrets = [];
    for (const relative of ['backend/.env', '.env', 'admin/.env']) {
      const file = path.join(repo, relative);
      if (!fs.existsSync(file)) continue;
      for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
        if (/PASSWORD|SECRET|TOKEN|API_KEY|SERVICE_KEY|DATABASE_URL/.test(key)) knownSecrets.push(value);
      }
    }
    console.log('Package validation PASS', validatePackage(process.argv[2], { knownSecrets, writeManifest: process.argv.includes('--write-manifest') }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
