// Tiny WebAudio synth. No audio files: every sound is generated on the fly.
const STORE_KEY = 'upi-sound';
const MASTER = 0.15;

let ctx = null;
let master = null;
let enabled = false;

try { enabled = localStorage.getItem(STORE_KEY) === '1'; } catch { /* storage blocked */ }

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER;
    // gentle compressor keeps overlapping blips from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

function ready() {
  if (!enabled) return null;
  const c = ensure();
  if (!c) return null;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

/** One enveloped oscillator note. */
function tone(c, { freq = 440, to = null, type = 'sine', at = 0, dur = 0.15, vol = 0.6, attack = 0.005, dest = master }) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Bell-ish tone: fundamental + inharmonic partials with longer decay. */
function bell(c, freq, at, dur = 1.1, vol = 0.5) {
  tone(c, { freq, at, dur, vol, type: 'sine', attack: 0.004 });
  tone(c, { freq: freq * 2.01, at, dur: dur * 0.6, vol: vol * 0.35, type: 'sine', attack: 0.003 });
  tone(c, { freq: freq * 3.02, at, dur: dur * 0.35, vol: vol * 0.15, type: 'sine', attack: 0.002 });
}

function noiseBurst(c, { at = 0, dur = 0.2, vol = 0.4, freq = 400 }) {
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

function play(fn) {
  const c = ready();
  if (!c) return;
  try { fn(c); } catch { /* never let audio break the game */ }
}

export const audio = {
  get enabled() { return enabled; },

  setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
    if (enabled) this.unlock();
    else if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    return enabled;
  },

  toggle() { return this.setEnabled(!enabled); },

  /** Call on the first user gesture so browsers allow playback. */
  unlock() {
    if (!enabled) return;
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  },

  coin() {
    play((c) => {
      tone(c, { freq: 1320, type: 'square', dur: 0.06, vol: 0.25 });
      tone(c, { freq: 1980, type: 'square', at: 0.05, dur: 0.12, vol: 0.22 });
    });
  },

  skill() {
    play((c) => {
      [659.25, 830.61, 987.77].forEach((f, i) =>
        tone(c, { freq: f, type: 'triangle', at: i * 0.06, dur: 0.18, vol: 0.45 }));
    });
  },

  hit() {
    play((c) => {
      tone(c, { freq: 140, to: 45, type: 'sawtooth', dur: 0.28, vol: 0.55 });
      tone(c, { freq: 90, to: 40, type: 'square', dur: 0.22, vol: 0.25 });
      noiseBurst(c, { dur: 0.18, vol: 0.5, freq: 600 });
    });
  },

  dock() {
    play((c) => {
      [523.25, 659.25, 783.99].forEach((f, i) => bell(c, f, i * 0.07, 0.9, 0.28));
    });
  },

  success() {
    play((c) => {
      // the classic two-tone "payment done" ding: up a major sixth
      bell(c, 783.99, 0, 1.0, 0.5);
      bell(c, 1318.51, 0.16, 1.6, 0.5);
    });
  },

  click() {
    play((c) => tone(c, { freq: 2400, type: 'square', dur: 0.025, vol: 0.12, attack: 0.001 }));
  },
};
