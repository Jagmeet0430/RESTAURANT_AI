// Only IDs, suppression times, and non-personal notification summaries are persisted.
export function createNotificationSession(userId) {
  const prefix = `restaurantai-order-alerts:v1:${userId}`;
  const owner = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  const key = name => `${prefix}:${name}`;
  const read = (name, fallback) => {
    const value = localStorage.getItem(key(name));
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  return {
    prefix,
    owner,
    owns() { return read('leader', {})?.owner === owner; },
    claim() {
      const lease = read('leader', {});
      if (lease?.owner !== owner && lease?.expires > Date.now() && !(lease.hidden && !document.hidden)) return false;
      write('leader', { owner, hidden: document.hidden, expires: Date.now() + (document.hidden ? 45000 : 12000) });
      return true;
    },
    release() { if (this.owns()) localStorage.removeItem(key('leader')); },
    beginAction(id) {
      const action = read('action', {});
      if (!this.owns() || action?.until > Date.now()) return false;
      write('action', { owner, id: String(id), until: Date.now() + 30000 });
      return true;
    },
    endAction() { if (read('action', {})?.owner === owner) localStorage.removeItem(key('action')); },
    readSnapshot() {
      const snapshot = read('snapshot', null);
      return snapshot && Date.now() - snapshot.time < 60000 && Array.isArray(snapshot.queue)
        ? { ...snapshot, queue: snapshot.queue.slice(0, 100) } : null;
    },
    writeSnapshot(snapshot) { if (this.owns()) write('snapshot', { ...snapshot, time: Date.now() }); },
    readSuppressions() {
      const entries = read('suppressed', {});
      return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
    },
    suppress(id, until) {
      const entries = this.readSuppressions();
      entries[String(id)] = { until, updated: Date.now() };
      const bounded = Object.fromEntries(Object.entries(entries)
        .filter(([, value]) => value?.until > Date.now())
        .sort((a, b) => b[1].updated - a[1].updated).slice(0, 500));
      write('suppressed', bounded);
      return bounded;
    },
    restore(ids) {
      const entries = this.readSuppressions();
      for (const id of ids) delete entries[String(id)];
      write('suppressed', entries);
      return entries;
    },
  };
}
