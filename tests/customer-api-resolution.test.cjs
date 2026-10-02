const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const frontend = path.join(__dirname, '..', 'frontend');
const config = fs.readFileSync(path.join(frontend, 'config.js'), 'utf8');
const script = fs.readFileSync(path.join(frontend, 'script.js'), 'utf8');
function section(start, end) {
  assert.ok(script.includes(start) && script.includes(end));
  return script.slice(script.indexOf(start), script.indexOf(end, script.indexOf(start)));
}
const helpers = section('const API_BASE_URL =', 'const defaultRestaurantSettings =') +
  section('function normalizePhone(', 'async function requestPhoneOtp(') +
  section('async function requestJson(', 'async function findOrCreateCustomer(') +
  section('async function requestPhoneOtp(', 'function selectedPaymentMethod(') +
  section('async function sendPhoneOtp(', 'function trackOrderStatusKey(') +
  section('async function loadCustomerNotifications(', 'function startCustomerNotificationPolling(');
const production = 'https://restaurant-ai-4myq.onrender.com/api';

function client(url, options = {}) {
  const calls = [];
  const logs = [];
  const toasts = [];
  const context = vm.createContext({
    URL, AbortController,
    state: {
      kiosk: { enabled: false }, tableQr: { enabled: false }, checkoutStep: 'phone',
      phoneVerification: { status: 'idle', phone: '', otp: '', token: '' },
    },
    elements: { customerPhone: { value: '98765 43210' } },
    renderCart: () => {},
    showToast: (...args) => toasts.push(args),
    window: {
      location: new URL(url), setTimeout: (...args) => setTimeout(...args).unref(), clearTimeout,
      RESTAURANTAI_API_BASE_URL: options.override,
    },
    // Simulate an old installation with a stale local API preference.
    localStorage: { getItem: () => 'http://localhost:5001/api', setItem: () => assert.fail('API base must not be persisted') },
    console: { log: (...args) => logs.push(args) },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (options.respond) return options.respond(url, init);
      if (options.fail) throw new TypeError('Failed to fetch');
      if (options.abort) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      return { ok: !options.status, status: options.status || 200, json: async () => options.status
        ? { message: 'Start the backend at localhost; PostgreSQL is unavailable' }
        : { data: { ok: true } } };
    },
  });
  vm.runInContext(config, context);
  vm.runInContext(helpers, context);
  return { calls, logs, toasts, run: (source) => vm.runInContext(source, context) };
}

for (const [url, base] of [
  ['https://restaurant-ai-nk2b.vercel.app/customer', production],
  ['https://restaurant-ai-preview.vercel.app/customer', production],
  ['http://localhost:3000/customer', 'http://localhost:5001/api'],
  ['http://127.0.0.1:5001/customer', 'http://127.0.0.1:5001/api'],
  ['http://192.168.1.20:5001/customer?kiosk=1', 'http://192.168.1.20:5001/api'],
  ['http://10.0.0.20:5001/customer?table=test-token', 'http://10.0.0.20:5001/api'],
  ['http://172.16.0.20:5001/customer', 'http://172.16.0.20:5001/api'],
  ['file:///customer/index.html', 'http://localhost:5001/api'],
]) {
  test(`all customer requests share the base on ${url}`, async () => {
    const c = client(url);
    await c.run('requestPhoneOtp("invalid")');
    await c.run('requestPhoneOtpVerification("invalid", "invalid")');
    for (const [path, method] of [
      ['/menu', 'GET'], ['/settings/public', 'GET'], ['/payments/methods', 'GET'],
      ['/customers/orders', 'POST'], ['/orders/track/test-token', 'GET'],
      ['/payments/create-order', 'POST'], ['/payments/verify', 'POST'],
      ['/payments/cash-order', 'POST'], ['/tables/public/test-token', 'GET'],
    ]) {
      await c.run(`requestJson(${JSON.stringify(path)}, { method: ${JSON.stringify(method)} })`);
    }
    assert.equal(c.calls.length, 11);
    for (const call of c.calls) assert.ok(call.url.startsWith(base + '/'), call.url);
    assert.equal(c.calls[0].url, base + '/customers/otp/send');
    assert.equal(c.calls[1].url, base + '/customers/otp/verify');
    assert.equal(c.run('apiUrl("/orders/track/test-token/events")'), base + '/orders/track/test-token/events');
    if (url.includes('vercel.app')) assert.equal(c.logs.length, 0);
  });
}

test('failed production requests never retry on a local or alternate server', async () => {
  const c = client('https://restaurant-ai-nk2b.vercel.app', { fail: true });
  await assert.rejects(c.run('requestPhoneOtp("invalid")'), /Unable to connect right now\. Please try again\./);
  await assert.rejects(c.run('requestJson("/menu")'));
  assert.deepEqual(c.calls.map(call => call.url), [production + '/customers/otp/send', production + '/menu']);
});

test('configuration overrides are honored and stale local overrides rejected in production', () => {
  const local = client('http://localhost:3000', { override: 'http://192.168.1.30:5001/api/' });
  assert.equal(local.run('API_BASE_URL'), 'http://192.168.1.30:5001/api');
  assert.equal(local.logs.length, 1);
  const publicClient = client('https://restaurant-ai-nk2b.vercel.app', { override: 'http://localhost:5001/api' });
  assert.equal(publicClient.run('API_BASE_URL'), production);
});

test('server errors and timeouts have friendly public messages', async () => {
  const c = client('https://restaurant-ai-nk2b.vercel.app', { status: 503 });
  await assert.rejects(c.run('requestJson("/customers/otp/send")'), /Unable to connect right now\. Please try again\./);
  assert.equal(c.run('friendlyNetworkError({ name: "AbortError" })'), 'Unable to connect right now. Please try again.');
  assert.equal(c.run('friendlyNetworkError({ message: "CORS blocked origin: https://restaurant-ai-nk2b.vercel.app" })'), 'Unable to connect right now. Please try again.');
  const aborted = client('https://restaurant-ai-nk2b.vercel.app', { abort: true });
  await assert.rejects(aborted.run('fetchApi("/menu", { timeoutMs: 15000 })'), { name: 'AbortError' });
  assert.equal(aborted.calls.length, 1);
});

function response(status, data) {
  return { ok: status < 400, status, json: async () => ({ data, message: status >= 400 ? 'Request rejected' : undefined }) };
}

test('checkout sends and verifies normalized OTP without any notification lookup', async () => {
  const c = client('https://restaurant-ai-nk2b.vercel.app/customer', {
    respond: (url) => response(200, url.endsWith('/send')
      ? { phone: '+919876543210', resend_after_seconds: 30 }
      : { phone: '+919876543210', verification_token: 'test-token' }),
  });
  await c.run('loadCustomerNotifications()');
  assert.equal(c.calls.length, 0);
  await c.run('sendPhoneOtp()');
  assert.equal(c.run('state.phoneVerification.status'), 'sent');
  await c.run('loadCustomerNotifications()');
  assert.equal(c.calls.length, 1);
  c.run('state.phoneVerification.otp = "123456"');
  await c.run('verifyPhoneOtpForCheckout()');
  assert.equal(c.run('state.phoneVerification.status'), 'verified');
  assert.equal(c.run('state.phoneVerification.token'), 'test-token');
  assert.equal(c.run('state.checkoutStep'), 'details');
  assert.deepEqual(c.calls.map(call => ({ url: call.url, method: call.init.method, body: JSON.parse(call.init.body) })), [
    { url: production + '/customers/otp/send', method: 'POST', body: { phone: '+919876543210' } },
    { url: production + '/customers/otp/verify', method: 'POST', body: { phone: '+919876543210', otp: '123456' } },
  ]);
});

test('optional notification 404 is silent and does not prevent OTP send or verify', async () => {
  const c = client('https://restaurant-ai-nk2b.vercel.app/customer', {
    respond: (url) => url.includes('/notifications/') ? response(404) : response(200, { verification_token: 'test-token' }),
  });
  c.run('Object.assign(state.phoneVerification, { status: "verified", phone: "+919876543210", token: "old-token" })');
  await c.run('loadCustomerNotifications({ announce: true })');
  assert.equal(c.calls.length, 1);
  assert.equal(c.toasts.length, 0);
  await c.run('sendPhoneOtp()');
  c.run('state.phoneVerification.otp = "123456"');
  await c.run('verifyPhoneOtpForCheckout()');
  assert.equal(c.run('state.phoneVerification.status'), 'verified');
  assert.ok(c.toasts.every(toast => toast[2] === 'success'));
});

test('an in-flight notification lookup cannot block OTP sending', async () => {
  let release;
  const c = client('https://restaurant-ai-nk2b.vercel.app/customer', {
    respond: (url) => url.includes('/notifications/')
      ? new Promise(resolve => { release = () => resolve(response(404)); })
      : response(200, {}),
  });
  c.run('Object.assign(state.phoneVerification, { status: "verified", phone: "+919876543210", token: "old-token" })');
  const polling = c.run('loadCustomerNotifications()');
  await c.run('sendPhoneOtp()');
  assert.equal(c.run('state.phoneVerification.status'), 'sent');
  release();
  await polling;
});

for (const [status, message] of [
  [403, 'Request not allowed.'],
  [429, 'Too many attempts. Please wait and try again.'],
  [500, 'Unable to send OTP right now. Please try again.'],
]) {
  test(`checkout OTP maps HTTP ${status} without reporting a network failure`, async () => {
    const c = client('https://restaurant-ai-nk2b.vercel.app/customer', { status });
    await c.run('sendPhoneOtp()');
    assert.equal(c.run('state.phoneVerification.error'), message);
    assert.equal(c.run('state.phoneVerification.status'), 'idle');
    c.run('state.phoneVerification.otp = "123456"');
    await c.run('verifyPhoneOtpForCheckout()');
    assert.equal(c.run('state.phoneVerification.error'), message.replace('send OTP', 'verify OTP'));
  });
}

test('checkout reports network failure separately', async () => {
  const c = client('https://restaurant-ai-nk2b.vercel.app/customer', { fail: true });
  await c.run('sendPhoneOtp()');
  assert.equal(c.run('state.phoneVerification.error'), 'Unable to connect right now. Please try again.');
});
