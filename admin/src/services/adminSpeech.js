// Shared by chatbot and alerts. The cross-tab lease stores no spoken text.
const leaseKey = 'restaurantai-admin-speech';
const ownerId = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
let queue = [], active = null, timer;
window.addEventListener('pagehide', () => {
  queue = []; clearTimeout(timer);
  const speaking = active && !active.waiting;
  active = null;
  if (speaking) window.speechSynthesis?.cancel();
  release();
});
function release() {
  try { if (JSON.parse(localStorage.getItem(leaseKey))?.owner === ownerId) localStorage.removeItem(leaseKey); } catch { /* expires */ }
}
function finish() {
  clearTimeout(timer); active = null; release(); pump();
}
function pump() {
  if (active || !queue.length) return;
  clearTimeout(timer);
  const job = queue[0];
  if (job.valid && !job.valid()) { queue.shift(); pump(); return; }
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) { queue.shift(); job.onError?.('Speech is unavailable. Visual alerts remain active.'); pump(); return; }
  try {
    const lease = JSON.parse(localStorage.getItem(leaseKey));
    if (lease?.expires > Date.now() || synth.speaking) { timer = setTimeout(pump, 500); return; }
    localStorage.setItem(leaseKey, JSON.stringify({ owner: ownerId, expires: Date.now() + 125000 }));
  } catch { queue.shift(); job.onError?.('Speech coordination is unavailable. Visual alerts remain active.'); pump(); return; }
  active = { ...job, waiting: true };
  timer = setTimeout(() => {
    try {
      if (JSON.parse(localStorage.getItem(leaseKey))?.owner !== ownerId) { active = null; timer = setTimeout(pump, 500); return; }
    } catch { active = null; queue.shift(); job.onError?.('Speech coordination is unavailable.'); return; }
    if (job.valid && !job.valid()) { queue.shift(); finish(); return; }
    start(job, synth);
  }, 80);
}
function start(job, synth) {
  const voices = synth.getVoices().filter(voice => voice.localService);
  const voice = voices.find(v => v.lang.toLowerCase().startsWith(job.language || 'en')) || voices.find(v => v.lang.toLowerCase().startsWith('en'));
  queue.shift();
  if (!voice) { job.onError?.('No local speech voice is available. Visual alerts remain active.'); finish(); return; }
  const utterance = new SpeechSynthesisUtterance(voice.lang.toLowerCase().startsWith('hi') ? job.text : job.englishText || job.text);
  utterance.voice = voice; utterance.lang = voice.lang; utterance.volume = job.getVolume ? job.getVolume() : job.volume ?? 1;
  active = { ...job, utterance };
  const done = error => {
    if (active?.utterance !== utterance) return;
    if (error) job.onError?.('Speech was blocked or interrupted. Visual alerts remain active.');
    finish();
  };
  utterance.onend = () => done(false);
  utterance.onerror = () => done(true);
  timer = setTimeout(() => {
    if (active?.utterance === utterance) { synth.cancel(); done(true); }
  }, 120000);
  try { synth.speak(utterance); } catch { done(true); }
}
export function enqueueAdminSpeech(job) {
  if (active?.key === job.key || queue.some(row => row.key === job.key)) return;
  if (queue.length >= 50) { job.onError?.('Speech queue is busy. Visual alerts remain active.'); return; }
  queue.push(job); pump();
}
export function cancelAdminSpeech(owner, valid = () => false) {
  queue = queue.filter(job => job.owner !== owner || valid(job));
  if (active?.owner === owner && !valid(active)) {
    const synth = window.speechSynthesis;
    const waiting = active.waiting;
    active = null; clearTimeout(timer); if (!waiting) synth?.cancel(); release();
  }
  if (!active) { clearTimeout(timer); pump(); }
}
