// موتور صدا: همه‌ی افکت‌ها با WebAudio ساخته می‌شوند تا بدون فایل صوتی هم غنی باشند.

import { getSettings } from './store.js';

let ctx = null;
let master = null;
let noiseCache = null;

function ensure() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      master.connect(comp).connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(audio) {
  if (noiseCache && noiseCache.sampleRate === audio.sampleRate) return noiseCache;
  const length = Math.floor(audio.sampleRate * 1);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache = buffer;
  return buffer;
}

function tone({ freq = 440, dur = 0.1, type = 'sine', gain = 0.05, when = 0, slide = null, attack = 0.006 } = {}) {
  const audio = ensure();
  if (!audio) return;
  const t0 = audio.currentTime + when;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.06, gain = 0.08, when = 0, freq = 2400, q = 0.9, type = 'bandpass' } = {}) {
  const audio = ensure();
  if (!audio) return;
  const t0 = audio.currentTime + when;
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer(audio);
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(40, freq), t0);
  filter.Q.setValueAtTime(q, t0);
  const amp = audio.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(amp).connect(master);
  src.start(t0, Math.random() * 0.4);
  src.stop(t0 + dur + 0.05);
}

const EFFECTS = {
  click: () => {
    noise({ dur: 0.025, gain: 0.09, freq: 2600 });
    tone({ freq: 900, dur: 0.03, gain: 0.03, type: 'triangle' });
  },
  move: () => {
    noise({ dur: 0.05, gain: 0.1, freq: 900, type: 'lowpass' });
    tone({ freq: 190, dur: 0.09, gain: 0.05, type: 'triangle' });
  },
  place: () => {
    noise({ dur: 0.045, gain: 0.12, freq: 1200, type: 'lowpass' });
    tone({ freq: 165, dur: 0.12, gain: 0.06, type: 'triangle' });
    tone({ freq: 320, dur: 0.05, gain: 0.02, when: 0.01 });
  },
  capture: () => {
    noise({ dur: 0.12, gain: 0.16, freq: 700, type: 'lowpass' });
    tone({ freq: 120, dur: 0.16, gain: 0.08, type: 'triangle' });
    tone({ freq: 240, dur: 0.06, gain: 0.03, when: 0.02 });
  },
  reveal: () => {
    noise({ dur: 0.06, gain: 0.08, freq: 1600, type: 'bandpass' });
    tone({ freq: 480, dur: 0.05, gain: 0.025, type: 'sine', when: 0.01 });
  },
  flag: () => {
    tone({ freq: 1250, dur: 0.05, gain: 0.05, type: 'triangle' });
    tone({ freq: 820, dur: 0.05, gain: 0.03, type: 'triangle', when: 0.05 });
  },
  correct: () => {
    tone({ freq: 660, dur: 0.09, gain: 0.05, type: 'triangle' });
    tone({ freq: 880, dur: 0.1, gain: 0.05, type: 'triangle', when: 0.08 });
    tone({ freq: 1320, dur: 0.14, gain: 0.04, type: 'sine', when: 0.16 });
  },
  wrong: () => {
    tone({ freq: 170, dur: 0.18, gain: 0.06, type: 'sawtooth', slide: 120 });
    tone({ freq: 110, dur: 0.2, gain: 0.04, type: 'triangle', when: 0.03 });
  },
  card: () => {
    noise({ dur: 0.05, gain: 0.11, freq: 3200, q: 1.4 });
    tone({ freq: 760, dur: 0.035, gain: 0.02, type: 'triangle', when: 0.005 });
  },
  chip: () => {
    tone({ freq: 1500, dur: 0.02, gain: 0.035, type: 'square' });
    tone({ freq: 2100, dur: 0.03, gain: 0.025, type: 'square', when: 0.015 });
  },
  dice: () => {
    for (let i = 0; i < 5; i++) {
      noise({ dur: 0.03, gain: 0.09 - i * 0.012, freq: 2200 + Math.random() * 1800, when: i * 0.065 + Math.random() * 0.02 });
    }
    tone({ freq: 150, dur: 0.08, gain: 0.03, type: 'triangle', when: 0.34 });
  },
  boom: () => {
    noise({ dur: 0.4, gain: 0.28, freq: 420, type: 'lowpass', q: 0.8 });
    tone({ freq: 70, dur: 0.35, gain: 0.12, type: 'sawtooth', slide: 40 });
  },
  valve: () => {
    tone({ freq: 260, dur: 0.16, gain: 0.045, type: 'triangle', slide: 460 });
    noise({ dur: 0.04, gain: 0.06, freq: 2000 });
  },
  water: () => {
    tone({ freq: 300, dur: 0.3, gain: 0.04, type: 'sine', slide: 780 });
    noise({ dur: 0.25, gain: 0.04, freq: 1200, q: 2, when: 0.03 });
  },
  slide: () => {
    noise({ dur: 0.22, gain: 0.09, freq: 600, type: 'lowpass', q: 0.6 });
    tone({ freq: 240, dur: 0.2, gain: 0.03, type: 'triangle', slide: 160 });
  },
  eat: () => {
    tone({ freq: 520, dur: 0.06, gain: 0.05, type: 'square' });
    tone({ freq: 780, dur: 0.08, gain: 0.045, type: 'square', when: 0.06 });
  },
  cue: () => {
    noise({ dur: 0.025, gain: 0.12, freq: 2800, q: 1.5 });
    tone({ freq: 420, dur: 0.08, gain: 0.05, type: 'triangle', slide: 300 });
  },
  pot: () => {
    noise({ dur: 0.09, gain: 0.12, freq: 700, type: 'lowpass' });
    tone({ freq: 200, dur: 0.14, gain: 0.06, type: 'sine', slide: 150 });
    tone({ freq: 520, dur: 0.06, gain: 0.03, type: 'triangle', when: 0.02 });
  },
  check: () => {
    tone({ freq: 990, dur: 0.1, gain: 0.05, type: 'triangle' });
    tone({ freq: 660, dur: 0.14, gain: 0.04, type: 'triangle', when: 0.09 });
  },
  tick: () => tone({ freq: 1050, dur: 0.03, gain: 0.02, type: 'square' }),
  win: () => {
    [523, 659, 784, 1046].forEach((freq, i) => tone({ freq, dur: 0.16, gain: 0.055, type: 'triangle', when: i * 0.11 }));
    tone({ freq: 1568, dur: 0.4, gain: 0.025, type: 'sine', when: 0.44 });
    noise({ dur: 0.5, gain: 0.02, freq: 5000, when: 0.1 });
  },
  lose: () => {
    [392, 330, 262].forEach((freq, i) => tone({ freq, dur: 0.2, gain: 0.05, type: 'triangle', when: i * 0.14 }));
    noise({ dur: 0.3, gain: 0.02, freq: 300, type: 'lowpass', when: 0.1 });
  },
};

export function play(name) {
  if (!getSettings().sound) return;
  const fn = EFFECTS[name];
  if (!fn) return;
  try {
    fn();
  } catch (err) {
    /* صدا هیچ‌وقت نباید بازی را بشکند. */
  }
}
