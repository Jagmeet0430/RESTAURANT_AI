import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cancelAdminSpeech, enqueueAdminSpeech } from '../services/adminSpeech';
import { claimAnnouncement, deviceKey, orderAnnouncement, readLocal } from '../services/orderNotificationPreferences';

const permission = () => !window.isSecureContext || !('Notification' in window) ? 'unavailable' : Notification.permission;
export function useOrderNotificationMedia({ queue, leader, policy, policyReady, sessionRef, userId }) {
  const navigate = useNavigate(), location = useLocation();
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(100, Number(readLocal(deviceKey, {}).volume ?? 70))));
  const [unlocked, setUnlocked] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [desktopPermission, setDesktopPermission] = useState(permission);
  const audio = useRef(null), desktop = useRef(new Map()), current = useRef(null);
  const speechOwner = `order-alerts-${userId}`;
  current.current = { queue, leader, policy, policyReady, volume, unlocked };
  const report = message => setMediaError(message);
  const saveDevice = values => {
    try { localStorage.setItem(deviceKey, JSON.stringify({ ...readLocal(deviceKey, {}), ...values })); }
    catch { report('Device preferences could not be saved.'); }
  };
  const changeVolume = value => { setVolume(value); saveDevice({ volume: value }); };
  const chime = () => {
    const ctx = audio.current;
    if (!ctx || ctx.state !== 'running') { report('Audio is blocked. Select Enable Sound; visual alerts remain active.'); setUnlocked(false); return; }
    const gain = ctx.createGain(), tone = ctx.createOscillator();
    gain.gain.setValueAtTime(current.current.volume / 100 * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    tone.frequency.setValueAtTime(880, ctx.currentTime); tone.frequency.setValueAtTime(1175, ctx.currentTime + 0.15);
    tone.connect(gain); gain.connect(ctx.destination); tone.start(); tone.stop(ctx.currentTime + 0.45);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  };
  const enableSound = async () => {
    setMediaError('');
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      audio.current ||= new Audio();
      await audio.current.resume();
      if (audio.current.state !== 'running') throw new Error('Audio blocked');
      setUnlocked(true); saveDevice({ audioUnlocked: true });
      window.speechSynthesis?.resume();
    } catch { report('Audio is unavailable or blocked. Visual alerts remain active.'); }
  };
  const speak = (number, key, valid = () => true) => enqueueAdminSpeech({ owner: `${speechOwner}:test`, key,
    language: policy.orderNotificationLanguage, text: orderAnnouncement(number, policy.orderNotificationLanguage),
    englishText: orderAnnouncement(number), volume: volume / 100, valid, onError: report });
  const testSound = async () => { await enableSound(); chime(); };
  const testVoice = () => { setMediaError(''); speak('123', `${speechOwner}-test`); };
  const enableDesktop = async () => {
    if (permission() === 'unavailable') { report('Desktop notifications require a supported browser and a secure connection.'); return; }
    try { const value = await Notification.requestPermission(); setDesktopPermission(value); saveDevice({ desktopPermission: value }); }
    catch { report('Desktop notification permission could not be enabled.'); }
  };
  useEffect(() => {
    const focus = () => setDesktopPermission(permission());
    const storage = event => { if (event.key === deviceKey) setVolume(Math.max(0, Math.min(100, Number(readLocal(deviceKey, {}).volume ?? 70)))); };
    window.addEventListener('focus', focus); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('focus', focus); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => () => {
    cancelAdminSpeech(speechOwner);
    cancelAdminSpeech(`${speechOwner}:test`);
    audio.current?.close().catch(() => {}); audio.current = null;
    for (const entry of desktop.current.values()) { clearTimeout(entry.timer); entry.notification.close(); }
    desktop.current.clear();
  }, [speechOwner]);

  useEffect(() => {
    const valid = id => {
      const live = current.current, session = sessionRef.current;
      try {
        return Boolean(live.leader && live.policyReady && session?.owns() && live.queue.some(order => order.id === id)
          && !(session.readSuppressions()[id]?.until > Date.now()));
      } catch { return false; }
    };
    cancelAdminSpeech(speechOwner, job => valid(job.orderId) && policy.orderNotificationVoice === 'true' && volume > 0);
    for (const [id, entry] of desktop.current) if (!valid(id)) {
      clearTimeout(entry.timer); entry.notification.close(); desktop.current.delete(id);
    }
    if (!leader || !policyReady || !sessionRef.current) return;
    for (const order of queue) {
      if (!valid(order.id)) continue;
      try {
        const prefix = sessionRef.current.prefix;
        if (desktopPermission === 'granted' && claimAnnouncement(prefix, order.id, 'desktop')) {
          const notification = new Notification('New customer order', { body: `Order ${order.order_number || order.id}`, tag: `restaurantai-order-${order.id}`, silent: true });
          notification.onclick = () => { window.focus(); navigate(`/orders?order=${encodeURIComponent(order.id)}`); notification.close(); };
          const timer = setTimeout(() => { notification.close(); desktop.current.delete(order.id); }, 30000);
          desktop.current.set(order.id, { notification, timer });
          if (desktop.current.size > 10) { const [id, old] = desktop.current.entries().next().value; clearTimeout(old.timer); old.notification.close(); desktop.current.delete(id); }
        }
        if (policy.orderNotificationAutoNavigate === 'true' && location.pathname === '/dashboard' && !document.hidden
          && !document.querySelector('input, textarea, select, [contenteditable="true"], [role="dialog"]')
          && claimAnnouncement(prefix, order.id, 'navigation')) navigate(`/orders?order=${encodeURIComponent(order.id)}`);
        if (!unlocked || volume === 0 || (policy.orderNotificationSound !== 'true' && policy.orderNotificationVoice !== 'true')) continue;
        if (!claimAnnouncement(prefix, order.id, 'audio', Number(policy.orderNotificationRepeatSeconds))) continue;
        if (policy.orderNotificationSound === 'true') chime();
        if (policy.orderNotificationVoice === 'true') enqueueAdminSpeech({ owner: speechOwner, key: `${speechOwner}-${order.id}`, orderId: order.id,
          language: policy.orderNotificationLanguage, text: orderAnnouncement(order.order_number || order.id, policy.orderNotificationLanguage),
          englishText: orderAnnouncement(order.order_number || order.id), volume: volume / 100,
          getVolume: () => current.current.volume / 100,
          valid: () => valid(order.id), onError: report });
        // Spread simultaneous arrivals over the existing poll ticks, not another timer.
        break;
      } catch (error) { report(error.message || 'Order audio is unavailable. Visual alerts remain active.'); break; }
    }
  }, [queue, leader, policy, policyReady, volume, unlocked, desktopPermission, location.pathname, navigate, speechOwner, sessionRef]);
  return { volume, changeVolume, audioUnlocked: unlocked, mediaError, enableSound, testSound, testVoice, desktopPermission, enableDesktop };
}
