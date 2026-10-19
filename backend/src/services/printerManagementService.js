import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getReceipt, getTestReceipt } from './billingService.js';
import { getPrinterConfig, getPrinterConfigPath, cleanPrinterConfig, resolvePrintScriptPath,
  buildThermalReceiptLayout, buildThermalReceiptText, spoolReceiptText } from './receiptPrinterService.js';

const exec = promisify(execFile);
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const localWindows = () => os.platform() === 'win32' && String(process.env.RESTAURANTAI_MODE || '').trim().toLowerCase() === 'local';
const capabilities = { printModes: ['windows_driver'], logo: false, autoCut: false, density: false, codePage: false };

function requireHost() {
  if (!localWindows()) throw fail('Printer control requires the local Windows restaurant backend.', 503);
}

// Some thermal drivers expose the printable head width as their paper form:
// the installed Everycom 58-series driver reports 48mm for a nominal 58mm roll.
export function supportsReceiptPaper(printer, paper) {
  const [min, max] = paper === '58mm' ? [47, 61] : [69, 83];
  return printer.paperWidthsMm?.some(width => width >= min && width <= max) || false;
}

export async function discoverPrinters() {
  requireHost();
  const script = await resolvePrintScriptPath('list-printers.ps1');
  try {
    const { stdout } = await exec(process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe') : 'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-AsJson'],
    { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
    const rows = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    if (!Array.isArray(rows)) throw new Error('Invalid discovery response');
    return rows.map(printer => ({ ...printer, supportedPaperSizes: ['58mm', '80mm'].filter(size => supportsReceiptPaper(printer, size)) }));
  } catch {
    throw fail('Windows printer discovery failed. Check the backend account and Print Spooler service.', 503);
  }
}

export async function getPrinterManagement() {
  const { config } = await getPrinterConfig();
  let printers = [], connectionError = '';
  try { printers = await discoverPrinters(); } catch (error) { connectionError = error.message; }
  return { config, printers, capabilities, host: os.hostname(), supported: localWindows(), connectionError };
}

export function validatePrinterSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('Invalid printer settings.');
  const allowed = ['enabled', 'printerName', 'kitchenPrinterName', 'paperWidth', 'copies',
    'autoPrintKioskOrders', 'printMode', 'fontScale', 'lineSpacing', 'charactersPerLine', 'logoPrinting', 'autoCut'];
  if (Object.keys(raw).some(key => !allowed.includes(key))) throw fail('Unsupported printer setting.');
  for (const key of ['enabled', 'autoPrintKioskOrders', 'logoPrinting']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw fail(`Invalid ${key}.`);
  }
  for (const key of ['printerName', 'kitchenPrinterName']) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > 200 || /[\x00-\x1f\x7f]/.test(raw[key]))) throw fail('Invalid printer name.');
  }
  if (!['58mm', '80mm'].includes(raw.paperWidth)) throw fail('Paper must be 58mm or 80mm.');
  if (!Number.isInteger(raw.copies) || raw.copies < 1 || raw.copies > 5) throw fail('Copies must be between 1 and 5.');
  if (raw.printMode !== 'windows_driver' || raw.logoPrinting || (raw.autoCut !== undefined && raw.autoCut !== 'driver')) throw fail('This driver integration does not support raw commands, logos or software-controlled cutting.');
  for (const [key, min, max] of [['fontScale', .85, 1.15], ['lineSpacing', 1, 1.5], ['charactersPerLine', 24, 64]]) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] < min || raw[key] > max)) throw fail(`Invalid ${key}.`);
  }
  if (raw.charactersPerLine !== undefined && !Number.isInteger(raw.charactersPerLine)) throw fail('Character width must be an integer.');
  const result = cleanPrinterConfig(raw);
  if (result.enabled && !result.printerName) throw fail('Select a receipt printer before enabling printing.');
  return result;
}

export async function savePrinterSettings(raw) {
  requireHost();
  const config = validatePrinterSettings(raw);
  if (config.printerName || config.kitchenPrinterName) {
    const printers = await discoverPrinters();
    for (const name of [config.printerName, config.kitchenPrinterName].filter(Boolean)) {
      const printer = printers.find(row => row.name === name);
      if (!printer || printer.virtual) throw fail('Select a physical printer installed on the backend host.');
      if (name === config.printerName && !supportsReceiptPaper(printer, config.paperWidth)) {
        throw fail('The selected driver has no matching paper form. Configure its 58mm/80mm roll form in Windows first.');
      }
    }
  }
  const filename = getPrinterConfigPath();
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    await fs.rename(temporary, filename);
  } catch {
    throw fail('Printer settings could not be saved. Check backend write permission to the printer configuration.', 503);
  } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  return config;
}

export async function previewSavedReceipt(client, source, id) {
  if (!['test', 'order', 'restaurant_order', 'pos', 'counter_sale'].includes(source)) throw fail('Invalid receipt source.');
  const receipt = source === 'test' ? await getTestReceipt(client) : await getReceipt(client, source, id);
  const { config } = await getPrinterConfig();
  return { receipt, layout: buildThermalReceiptLayout(receipt, config), text: buildThermalReceiptText(receipt, config),
    config, host: os.hostname(), supported: localWindows() };
}

export async function printSavedReceipt(client, source, id, requestId) {
  requireHost();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) throw fail('A valid print request ID is required.');
  const { receipt, config } = await previewSavedReceipt(client, source, id);
  if (!config.enabled || !config.printerName) throw fail('Receipt printing is disabled or no printer is selected.', 409);
  const printers = await discoverPrinters();
  const printer = printers.find(row => row.name === config.printerName);
  if (!printer || printer.offline || printer.virtual) throw fail('Selected receipt printer is unavailable or offline on the backend host.', 503);
  if (!supportsReceiptPaper(printer, config.paperWidth)) throw fail('The selected printer does not support the configured receipt paper. Check Printer Settings.', 409);
  const directory = path.resolve(path.dirname(getPrinterConfigPath()), '../runtime/admin-print-jobs');
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, requestId.toLowerCase() + '.json');
  const record = { requestId, source, id: String(id), status: 'submitting', printerName: config.printerName,
    confirmed: false, createdAt: new Date().toISOString() };
  try { await fs.writeFile(filename, JSON.stringify(record), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw fail('Unable to safely record this print request.', 503);
    const previous = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (previous.source !== source || previous.id !== String(id)) throw fail('Print reference already belongs to another receipt.', 409);
    return previous;
  }
  try {
    await spoolReceiptText({ receipt, config, duplicate: source !== 'test' });
    record.status = 'queued';
    record.message = 'Accepted by the Windows print interface. Physical output is not confirmed.';
  } catch {
    // A timeout/error can occur after a copy entered the spooler. Never blindly resubmit.
    record.status = 'unknown';
    record.message = 'Print delivery could not be confirmed. Check the host printer queue before reprinting.';
  }
  const temporary = filename + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(record));
  await fs.rename(temporary, filename);
  return record;
}
