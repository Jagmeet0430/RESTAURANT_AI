export const notificationDefaults = {
  orderNotificationPopup: 'true', orderNotificationSound: 'true', orderNotificationVoice: 'false',
  orderNotificationLanguage: 'en', orderNotificationRepeatSeconds: '0', orderNotificationAutoNavigate: 'false',
};
export const policyKey = 'restaurantai-order-notification-policy';
export const deviceKey = 'restaurantai-order-notification-device';
export function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
export function normalizePolicy(value = {}) {
  return Object.fromEntries(Object.entries(notificationDefaults).map(([key, fallback]) => {
    const text = String(value[key] ?? fallback);
    const allowed = key.endsWith('Language') ? ['en', 'hi'] : key.endsWith('Seconds') ? ['0', '30', '60', '120', '300'] : ['true', 'false'];
    return [key, allowed.includes(text) ? text : fallback];
  }));
}
export function storePolicy(policy) {
  const normalized = normalizePolicy(policy);
  localStorage.setItem(policyKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event('restaurantai-notification-policy'));
  return normalized;
}

// A fixed-size ledger fails closed rather than evicting IDs and replaying old orders.
export function claimAnnouncement(prefix, id, channel, repeatSeconds = 0) {
  const key = `${prefix}:announced`;
  const ledger = readLocal(key, {});
  const previous = ledger[id]?.[channel];
  if (previous && (!repeatSeconds || Date.now() - previous < repeatSeconds * 1000)) return false;
  if (!ledger[id] && Object.keys(ledger).length >= 5000) throw new Error('Announcement history is full. Visual alerts remain available.');
  ledger[id] = { ...ledger[id], [channel]: Date.now() };
  localStorage.setItem(key, JSON.stringify(ledger));
  return true;
}

export function orderAnnouncement(number, language = 'en') {
  const n = String(number).slice(0, 80);
  return language === 'hi'
    ? `\u0928\u092f\u093e \u0911\u0930\u094d\u0921\u0930 \u092a\u094d\u0930\u093e\u092a\u094d\u0924 \u0939\u0941\u0906 \u0939\u0948\u0964 \u0915\u0943\u092a\u092f\u093e \u0911\u0930\u094d\u0921\u0930 \u0928\u0902\u092c\u0930 ${n} \u0926\u0947\u0916\u0947\u0902\u0964`
    : `New customer order received. Order number ${n}. Please check the order.`;
}
