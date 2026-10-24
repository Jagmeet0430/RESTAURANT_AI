import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ordersService } from '../services/order';
import { createNotificationSession } from '../services/orderNotificationSession';
import { settingsService } from '../services/settings';
import { notificationDefaults, normalizePolicy, policyKey, readLocal, storePolicy } from '../services/orderNotificationPreferences';
import { useOrderNotificationMedia } from './useOrderNotificationMedia';

const Context = createContext(null);
const interval = () => document.hidden ? 15000 : 3000;
const isNew = order => String(order?.status || '').toLowerCase() === 'confirmed';
const requireSuccess = result => {
  if (!result?.success) throw new Error('Request unsuccessful');
  return result.data;
};
const summary = event => ({
  id: String(event.order_id), order_number: event.payload?.order_number,
  source: event.payload?.order_source, type: event.payload?.order_type, status: event.status,
  item_count: Number(event.item_count || 0), total: event.grand_total, received_at: event.created_at,
  token: event.payload?.token_number, table: event.payload?.table_number,
});

export function OrderNotificationsProvider({ children }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [snapshot, setSnapshot] = useState({ queue: [], hasMore: false, error: '' });
  const [leader, setLeader] = useState(false);
  const [suppressed, setSuppressed] = useState({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [policy, setPolicy] = useState(notificationDefaults);
  const [policyReady, setPolicyReady] = useState(false);
  const query = useRef(null);
  const refreshRef = useRef(() => {});
  const sessionRef = useRef(null);
  const actionRef = useRef(null);
  const publishRef = useRef(() => {});
  const snapshotRef = useRef(snapshot);
  const revision = useRef(0);
  const canNotify = ['admin', 'staff'].includes(user?.role);
  const refresh = useCallback(() => refreshRef.current(), []);
  const watchOrders = useCallback(filters => {
    query.current = filters;
    setLoading(true);
    refreshRef.current();
    return () => { if (query.current === filters) { query.current = null; setOrders([]); } };
  }, []);

  useEffect(() => {
    const changed = () => { setPolicy(normalizePolicy(readLocal(policyKey, notificationDefaults))); };
    const storage = event => { if (event.key === policyKey) changed(); };
    window.addEventListener('restaurantai-notification-policy', changed);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener('restaurantai-notification-policy', changed); window.removeEventListener('storage', storage); };
  }, []);
  const savePolicy = async next => {
    const saved = requireSuccess(await settingsService.updateSettings(normalizePolicy(next)));
    setPolicy(normalizePolicy(saved)); setPolicyReady(true);
    storePolicy(saved);
  };

  useEffect(() => {
    setOrders([]); setSnapshot({ queue: [], hasMore: false, error: '' }); setLeader(false);
    setActionError(''); setBusy(false); setPolicyReady(false);
    if (!user) return;
    let stopped = false, timer, running = false, rerun = false, failures = 0, forbidden = false;
    let controller, channel, settleTimer, settleResolve;
    let policyFetchedAt = 0;
    const session = createNotificationSession(user.id);
    sessionRef.current = session;
    const publish = next => {
      if (stopped) return;
      snapshotRef.current = next;
      setSnapshot(next);
      try { session.writeSnapshot(next); channel?.postMessage('refresh'); } catch { /* Board remains usable when storage is denied. */ }
    };
    publishRef.current = publish;
    const readShared = () => {
      try {
        setSuppressed(session.readSuppressions());
        if (!session.owns()) {
          setLeader(false);
          const next = session.readSnapshot();
          if (next) { snapshotRef.current = next; setSnapshot(next); }
        }
      } catch { setLeader(false); }
    };
    readShared();
    try { channel = new BroadcastChannel(session.prefix); channel.onmessage = readShared; } catch { /* storage events cover LAN browsers too. */ }
    const schedule = () => {
      if (!stopped) timer = window.setTimeout(tick, failures ? Math.min(60000, interval() * 2 ** Math.min(failures, 5)) : interval());
    };
    async function tick() {
      if (stopped || running) return;
      running = true;
      const startedRevision = revision.current;
      controller = new AbortController();
      const options = { signal: controller.signal };
      let failed = false, board = [];
      try {
        const filters = query.current;
        if (filters) {
          try {
            board = requireSuccess(await ordersService.getAllOrders(filters, options)) || [];
            if (!stopped && query.current === filters && startedRevision === revision.current) {
              setOrders(board); setOrdersError(''); setLastSyncedAt(new Date()); setLoading(false);
            }
          } catch (error) {
            if (error.response?.status === 401) stopSession();
            if (!stopped && query.current === filters) {
              setOrdersError('Restaurant server unavailable. Reconnecting...'); setLoading(false);
            }
            failed = true;
          }
        }
        if (stopped || !canNotify || forbidden) return;
        if (Date.now() - policyFetchedAt > 30000) {
          try {
            const next = normalizePolicy(requireSuccess(await settingsService.getOrderNotificationSettings(options)));
            if (stopped) return;
            setPolicy(next); setPolicyReady(true); policyFetchedAt = Date.now();
            try { storePolicy(next); } catch { /* Reading server policy does not require storage. */ }
          } catch (error) {
            if (error.response?.status === 401) { stopSession(); return; }
            setPolicyReady(false); policyFetchedAt = Date.now();
          }
        }
        let claimed;
        try { claimed = session.claim(); } catch {
          setSnapshot({ queue: [], hasMore: false, error: 'Local alert storage is unavailable. Orders remain accessible.' });
          setLeader(false); return;
        }
        if (!claimed) { readShared(); return; }
        // Settle concurrent localStorage lease claims before polling or displaying.
        await new Promise(resolve => { settleResolve = resolve; settleTimer = window.setTimeout(resolve, 80); });
        if (stopped || !session.owns()) { setLeader(false); return; }
        const pending = requireSuccess(await ordersService.getPendingNotifications(options));
        const events = [...new Map((pending.notifications || []).slice(0, 100).map(row => [String(row.order_id), row])).values()];
        const queue = events.filter(isNew).map(summary);
        if (!stopped && session.owns() && startedRevision === revision.current) {
          setLeader(true);
          publish({ queue, hasMore: Boolean(pending.has_more), error: '' });
          setSuppressed(session.readSuppressions());
        }
      } catch (error) {
        if (error.response?.status === 401) stopSession();
        if (!stopped && error.code !== 'ERR_CANCELED') {
          forbidden = error.response?.status === 403;
          publish({ queue: [], hasMore: false, error: forbidden ? 'Order alerts are not allowed for this account.' : 'Order alerts unavailable. Reconnecting...' });
          failed = true;
        }
      } finally {
        running = false;
        failures = failed ? failures + 1 : 0;
        if (rerun && !stopped) { rerun = false; timer = window.setTimeout(tick, 0); }
        else schedule();
      }
    }
    const requestRefresh = () => {
      window.clearTimeout(timer);
      if (running) rerun = true;
      else void tick();
    };
    refreshRef.current = requestRefresh;
    const onVisibility = () => {
      if (document.hidden) { setLeader(false); try { session.release(); } catch { /* no lease */ } }
      requestRefresh();
    };
    const onStorage = event => {
      if (event.key === 'authToken' || event.key === null) stopSession();
      else if (event.key?.startsWith(session.prefix)) readShared();
    };
    function cleanup() {
      stopped = true; window.clearTimeout(timer); controller?.abort(); actionRef.current?.abort(); actionRef.current = null;
      window.clearTimeout(settleTimer); settleResolve?.();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', requestRefresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', stopSession);
      channel?.close();
      try { session.release(); } catch { /* storage denied */ }
      refreshRef.current = () => {}; publishRef.current = () => {}; sessionRef.current = null;
    }
    function stopSession() {
      cleanup();
      setOrders([]); setLoading(false); setSnapshot({ queue: [], hasMore: false, error: '' }); setLeader(false);
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', requestRefresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', stopSession);
    void tick();
    return cleanup;
  }, [user?.id, user?.role, canNotify]);

  const suppress = (id, snooze = false) => {
    try {
      setSuppressed(sessionRef.current.suppress(id, snooze ? Date.now() + 300000 : Number.MAX_SAFE_INTEGER));
      setActionError('');
    } catch { setActionError('This browser could not save the local dismissal.'); }
  };
  const restore = () => {
    try { setSuppressed(sessionRef.current.restore(snapshot.queue.map(row => row.id))); refresh(); }
    catch { setActionError('Local alert storage is unavailable.'); }
  };
  const act = async (id, action) => {
    if (actionRef.current || !canNotify) return;
    const session = sessionRef.current;
    try {
      if (!session?.beginAction(id)) { setActionError('An order action is already in progress. Please wait.'); return; }
    } catch { setActionError('Local alert storage is unavailable. Open the order to continue.'); return; }
    const controller = new AbortController();
    let resolved = false;
    actionRef.current = controller; setBusy(true); setActionError('');
    try {
      requireSuccess(await (action === 'accept'
        ? ordersService.updateOrderStatus(id, 'Accepted', undefined, {}, { signal: controller.signal })
        : ordersService.acknowledgeNotification(id, { signal: controller.signal })));
      resolved = true;
      if (controller.signal.aborted) return;
      // Discard a poll started before this mutation, even if it returns afterwards.
      revision.current++;
      publishRef.current({ ...snapshotRef.current, queue: snapshotRef.current.queue.filter(row => row.id !== String(id)) });
      refresh();
    } catch (error) {
      resolved = Boolean(error.response && error.response.status < 500);
      if (!controller.signal.aborted) {
        setActionError(error.response?.data?.message || 'Action could not be confirmed. Refresh before retrying.'); refresh();
      }
    } finally {
      // Keep the short lease after an aborted/uncertain response: the server may still commit it.
      if (resolved && !controller.signal.aborted) { try { session.endAction(); } catch { /* expires automatically */ } }
      if (actionRef.current === controller) { actionRef.current = null; setBusy(false); }
    }
  };
  const visibleQueue = snapshot.queue.filter(row => !(suppressed[row.id]?.until > Date.now()));
  const media = useOrderNotificationMedia({ queue: visibleQueue, leader, policy, policyReady, sessionRef, userId: user?.id });
  return <Context.Provider value={{ orders, setOrders, loading, ordersError, lastSyncedAt, watchOrders, refresh,
    pendingCount: snapshot.queue.length, queue: visibleQueue, leader, busy, actionError,
    notificationError: snapshot.error, hasMore: snapshot.hasMore, suppress, restore, act,
    policy, policyReady, savePolicy, ...media }}>
    {children}
  </Context.Provider>;
}

export function useOrderNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('Order notifications require the Admin provider');
  return context;
}
