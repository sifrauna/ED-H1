// Text-to-speech through the browser's built-in voices (Web Speech API).
// RECONSTRUCTED from usage: speak(id, text, {voiceName, rate, pitch}), stopSpeaking(), onSpeaking(cb) -> unsubscribe, voicesAvailable().
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const listeners = new Set();
let speakingId = null;
let token = 0;

function emit(id) { speakingId = id; listeners.forEach((fn) => fn(id)); }

export function voicesAvailable() {
  return synth ? synth.getVoices() : [];
}

export function onSpeaking(cb) {
  listeners.add(cb);
  cb(speakingId);
  return () => { listeners.delete(cb); };
}

export function stopSpeaking() {
  token += 1;
  if (synth) synth.cancel();
  emit(null);
}

export function speak(id, text, voice = {}) {
  if (!synth || !text) return;
  const clean = String(text).replace(/[*_`#>]/g, '').trim();
  if (!clean) return;
  const mine = ++token;
  const u = new SpeechSynthesisUtterance(clean);
  const v = voice || {};
  if (v.voiceName) {
    const found = synth.getVoices().find((x) => x.name === v.voiceName);
    if (found) { u.voice = found; u.lang = found.lang; }
  }
  u.rate = Number(v.rate ?? 1);
  u.pitch = Number(v.pitch ?? 1);
  u.onstart = () => { if (mine === token) emit(id); };
  u.onend = () => { if (mine === token) emit(null); };
  u.onerror = () => { if (mine === token) emit(null); };
  synth.speak(u);
}
