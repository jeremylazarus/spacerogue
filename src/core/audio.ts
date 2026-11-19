/**
 * WebAudio synthesis: sound effects, continuous thrust rumble and generative ambient music.
 * No samples — everything is oscillators, filtered noise and envelopes.
 */

export type Sfx =
  | 'laser'
  | 'laser_heavy'
  | 'scatter'
  | 'rail'
  | 'missile'
  | 'beam_start'
  | 'arc'
  | 'mine'
  | 'flak'
  | 'hit'
  | 'hit_shield'
  | 'hit_player'
  | 'shield_break'
  | 'explode_small'
  | 'explode_big'
  | 'pickup'
  | 'credits'
  | 'ui_click'
  | 'ui_hover'
  | 'ui_open'
  | 'ui_close'
  | 'levelup'
  | 'jump_charge'
  | 'jump'
  | 'dock'
  | 'warning'
  | 'blink'
  | 'ability'
  | 'error'
  | 'scan'
  | 'boss_roar'
  | 'thrust';
export type Mood = 'menu' | 'calm' | 'tense' | 'combat' | 'boss' | 'victory' | 'death' | 'none';

interface SfxOpts {
  vol?: number;
  pitch?: number;
  pan?: number;
}

// ------------------------------------------------------------------ graph

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let reverbIn: GainNode;
let delayIn: GainNode;
let noiseBuf: AudioBuffer;
let distCurve: Float32Array<ArrayBuffer>;
const vols = { master: 0.8, sfx: 0.8, music: 0.55 };

function build() {
  const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const c = new AC();
  ctx = c;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master = c.createGain();
  master.gain.value = vols.master;
  comp.connect(master).connect(c.destination);
  sfxBus = c.createGain();
  sfxBus.gain.value = vols.sfx;
  musicBus = c.createGain();
  musicBus.gain.value = vols.music;
  sfxBus.connect(comp);
  musicBus.connect(comp);

  // reverb (generated impulse)
  const conv = c.createConvolver();
  conv.buffer = impulse(c, 3.2, 2.6);
  reverbIn = c.createGain();
  reverbIn.gain.value = 1;
  const revOut = c.createGain();
  revOut.gain.value = 0.55;
  reverbIn.connect(conv).connect(revOut).connect(comp);

  // tempo-free feedback delay for music sparkle
  const dl = c.createDelay(2);
  dl.delayTime.value = 0.48;
  const fb = c.createGain();
  fb.gain.value = 0.38;
  const dlf = c.createBiquadFilter();
  dlf.type = 'lowpass';
  dlf.frequency.value = 2400;
  delayIn = c.createGain();
  delayIn.connect(dl);
  dl.connect(dlf).connect(fb).connect(dl);
  const dOut = c.createGain();
  dOut.gain.value = 0.5;
  dlf.connect(dOut);
  dOut.connect(musicBus);
  dOut.connect(reverbIn);

  // noise buffer
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // soft-clip curve
  distCurve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    distCurve[i] = Math.tanh(x * 3);
  }
}

function impulse(c: AudioContext, secs: number, decay: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * secs);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
    }
  }
  return b;
}

// ------------------------------------------------------------------ primitives

let activeVoices = 0;
const MAX_VOICES = 26;
const lastPlayed = new Map<string, number>();

interface Voice {
  out: GainNode;
  t: number;
  p: number; // pitch mul
}

function voice(o: SfxOpts | undefined, dur: number, rev = 0.15): Voice | null {
  if (!ctx) return null;
  if (activeVoices >= MAX_VOICES) return null;
  const c = ctx;
  const out = c.createGain();
  out.gain.value = Math.max(0, o?.vol ?? 1);
  let node: AudioNode = out;
  if (o?.pan) {
    const pn = c.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, o.pan));
    out.connect(pn);
    node = pn;
  }
  node.connect(sfxBus);
  if (rev > 0) {
    const s = c.createGain();
    s.gain.value = rev;
    node.connect(s).connect(reverbIn);
  }
  activeVoices++;
  setTimeout(() => {
    activeVoices--;
    try {
      out.disconnect();
    } catch {
      /* ignore */
    }
  }, (dur + 0.6) * 1000);
  return { out, t: c.currentTime + 0.005, p: o?.pitch ?? 1 };
}

function osc(
  v: Voice,
  type: OscillatorType,
  f0: number,
  f1: number,
  t0: number,
  dur: number,
  peak: number,
  opts: { attack?: number; curve?: 'exp' | 'lin'; dest?: AudioNode; detune?: number } = {},
) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  if (opts.detune) o.detune.value = opts.detune;
  const t = v.t + t0;
  o.frequency.setValueAtTime(Math.max(1, f0 * v.p), t);
  if (f1 !== f0) {
    if (opts.curve === 'lin') o.frequency.linearRampToValueAtTime(Math.max(1, f1 * v.p), t + dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * v.p), t + dur);
  }
  const g = c.createGain();
  const a = opts.attack ?? 0.004;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(opts.dest ?? v.out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noise(
  v: Voice,
  t0: number,
  dur: number,
  peak: number,
  filt: { type: BiquadFilterType; f0: number; f1?: number; q?: number },
  attack = 0.003,
  dest?: AudioNode,
) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = filt.type;
  f.Q.value = filt.q ?? 1;
  const t = v.t + t0;
  f.frequency.setValueAtTime(filt.f0 * v.p, t);
  if (filt.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, filt.f1 * v.p), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f).connect(g).connect(dest ?? v.out);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

function shaper(v: Voice): WaveShaperNode {
  const w = ctx!.createWaveShaper();
  w.curve = distCurve;
  w.connect(v.out);
  return w;
}

// ------------------------------------------------------------------ sfx library

const SFX: Record<Sfx, (o?: SfxOpts) => void> = {
  laser(o) {
    const v = voice(o, 0.16, 0.08);
    if (!v) return;
    const f = ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200 * v.p;
    f.connect(v.out);
    osc(v, 'square', 1500, 260, 0, 0.13, 0.13, { dest: f });
    osc(v, 'sine', 900, 180, 0, 0.12, 0.18);
  },
  laser_heavy(o) {
    const v = voice(o, 0.35, 0.15);
    if (!v) return;
    const f = ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, v.t);
    f.frequency.exponentialRampToValueAtTime(300, v.t + 0.3);
    f.connect(v.out);
    osc(v, 'sawtooth', 640, 70, 0, 0.3, 0.16, { dest: f });
    osc(v, 'sawtooth', 652, 72, 0, 0.3, 0.16, { dest: f });
    osc(v, 'sine', 180, 45, 0, 0.25, 0.35);
    noise(v, 0, 0.08, 0.15, { type: 'bandpass', f0: 2500, q: 1.5 });
  },
  scatter(o) {
    const v = voice(o, 0.18, 0.1);
    if (!v) return;
    noise(v, 0, 0.12, 0.35, { type: 'bandpass', f0: 3000, f1: 900, q: 0.8 });
    for (let i = 0; i < 3; i++) osc(v, 'square', 1200 + i * 330, 400, i * 0.012, 0.06, 0.05);
    osc(v, 'sine', 220, 80, 0, 0.1, 0.25);
  },
  rail(o) {
    const v = voice(o, 0.6, 0.35);
    if (!v) return;
    osc(v, 'sine', 3800, 900, 0, 0.18, 0.14);
    osc(v, 'sawtooth', 1900, 120, 0, 0.35, 0.08);
    noise(v, 0, 0.05, 0.5, { type: 'highpass', f0: 3000 });
    osc(v, 'sine', 140, 38, 0, 0.3, 0.45);
  },
  missile(o) {
    const v = voice(o, 0.55, 0.15);
    if (!v) return;
    noise(v, 0, 0.5, 0.3, { type: 'bandpass', f0: 500, f1: 2200, q: 1.2 }, 0.04);
    osc(v, 'sawtooth', 110, 220, 0, 0.4, 0.06);
    osc(v, 'sine', 160, 60, 0, 0.12, 0.25);
  },
  beam_start(o) {
    const v = voice(o, 0.45, 0.2);
    if (!v) return;
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(400, v.t);
    f.frequency.exponentialRampToValueAtTime(3000, v.t + 0.35);
    f.connect(v.out);
    osc(v, 'sawtooth', 180, 720, 0, 0.4, 0.28, { dest: f, attack: 0.05 });
    osc(v, 'sawtooth', 182, 726, 0, 0.4, 0.28, { dest: f, attack: 0.05 });
    osc(v, 'sine', 1440, 2880, 0, 0.35, 0.05, { attack: 0.08 });
  },
  arc(o) {
    const v = voice(o, 0.26, 0.12);
    if (!v) return;
    const c = ctx!;
    const s = c.createOscillator();
    s.type = 'square';
    for (let i = 0; i < 14; i++) s.frequency.setValueAtTime((200 + Math.random() * 1800) * v.p, v.t + i * 0.015);
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, v.t);
    g.gain.exponentialRampToValueAtTime(0.001, v.t + 0.22);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    s.connect(hp).connect(g).connect(v.out);
    s.start(v.t);
    s.stop(v.t + 0.25);
    noise(v, 0, 0.2, 0.22, { type: 'highpass', f0: 4000, q: 0.7 });
  },
  mine(o) {
    const v = voice(o, 0.4, 0.2);
    if (!v) return;
    osc(v, 'sine', 520, 520, 0, 0.12, 0.2);
    osc(v, 'sine', 390, 390, 0.12, 0.18, 0.2);
    osc(v, 'triangle', 90, 60, 0, 0.15, 0.25);
  },
  flak(o) {
    const v = voice(o, 0.3, 0.2);
    if (!v) return;
    noise(v, 0, 0.18, 0.55, { type: 'lowpass', f0: 2400, f1: 300 });
    osc(v, 'sine', 160, 45, 0, 0.15, 0.4);
  },
  hit(o) {
    const v = voice(o, 0.12, 0.05);
    if (!v) return;
    noise(v, 0, 0.06, 0.35, { type: 'bandpass', f0: 1800, f1: 700, q: 1.2 });
    osc(v, 'square', 260, 90, 0, 0.07, 0.07);
  },
  hit_shield(o) {
    const v = voice(o, 0.3, 0.25);
    if (!v) return;
    osc(v, 'sine', 1300, 1150, 0, 0.22, 0.12);
    osc(v, 'sine', 1950, 1800, 0, 0.18, 0.07);
    osc(v, 'triangle', 650, 600, 0, 0.12, 0.08);
    noise(v, 0, 0.08, 0.12, { type: 'highpass', f0: 5000 });
  },
  hit_player(o) {
    const v = voice(o, 0.3, 0.12);
    if (!v) return;
    const w = shaper(v);
    osc(v, 'sawtooth', 160, 45, 0, 0.22, 0.3, { dest: w });
    noise(v, 0, 0.2, 0.5, { type: 'lowpass', f0: 1400, f1: 200 });
  },
  shield_break(o) {
    const v = voice(o, 0.9, 0.4);
    if (!v) return;
    for (let i = 0; i < 9; i++) {
      const f = 1800 + Math.random() * 3200;
      osc(v, 'sine', f, f * 0.92, i * 0.025 + Math.random() * 0.02, 0.35 + Math.random() * 0.3, 0.05);
    }
    noise(v, 0, 0.5, 0.3, { type: 'highpass', f0: 6000, f1: 1200 });
    osc(v, 'sawtooth', 900, 90, 0, 0.45, 0.06);
  },
  explode_small(o) {
    const v = voice(o, 0.55, 0.25);
    if (!v) return;
    noise(v, 0, 0.45, 0.7, { type: 'lowpass', f0: 2400, f1: 160 });
    osc(v, 'sine', 130, 35, 0, 0.35, 0.55);
    noise(v, 0.02, 0.15, 0.2, { type: 'bandpass', f0: 3500, q: 1 });
  },
  explode_big(o) {
    const v = voice(o, 2.0, 0.5);
    if (!v) return;
    const w = shaper(v);
    noise(v, 0, 1.6, 0.9, { type: 'lowpass', f0: 1600, f1: 60 }, 0.01);
    osc(v, 'sine', 90, 24, 0, 1.2, 0.8, { dest: w });
    osc(v, 'triangle', 55, 28, 0.05, 1.5, 0.4);
    for (let i = 0; i < 6; i++) noise(v, 0.1 + Math.random() * 0.6, 0.12, 0.18, { type: 'bandpass', f0: 1500 + Math.random() * 2500, q: 2 });
  },
  pickup(o) {
    const v = voice(o, 0.3, 0.25);
    if (!v) return;
    osc(v, 'sine', 880, 880, 0, 0.12, 0.18);
    osc(v, 'sine', 1320, 1320, 0.06, 0.18, 0.16);
    osc(v, 'triangle', 1760, 1760, 0.06, 0.14, 0.05);
  },
  credits(o) {
    const v = voice(o, 0.35, 0.2);
    if (!v) return;
    osc(v, 'square', 1046, 1046, 0, 0.07, 0.06);
    osc(v, 'square', 1568, 1568, 0.06, 0.22, 0.06);
    osc(v, 'sine', 3136, 3136, 0.06, 0.2, 0.04);
  },
  ui_click(o) {
    const v = voice(o, 0.05, 0);
    if (!v) return;
    osc(v, 'sine', 1900, 1300, 0, 0.035, 0.12);
    noise(v, 0, 0.012, 0.06, { type: 'highpass', f0: 6000 });
  },
  ui_hover(o) {
    const v = voice(o, 0.04, 0);
    if (!v) return;
    osc(v, 'sine', 1400, 1500, 0, 0.03, 0.035);
  },
  ui_open(o) {
    const v = voice(o, 0.25, 0.2);
    if (!v) return;
    osc(v, 'sine', 520, 780, 0, 0.12, 0.12, { attack: 0.01 });
    osc(v, 'sine', 780, 1040, 0.07, 0.14, 0.09, { attack: 0.01 });
    noise(v, 0, 0.15, 0.05, { type: 'bandpass', f0: 800, f1: 4000, q: 2 }, 0.04);
  },
  ui_close(o) {
    const v = voice(o, 0.25, 0.2);
    if (!v) return;
    osc(v, 'sine', 1040, 780, 0, 0.12, 0.09, { attack: 0.01 });
    osc(v, 'sine', 780, 520, 0.07, 0.14, 0.11, { attack: 0.01 });
  },
  levelup(o) {
    const v = voice(o, 1.4, 0.5);
    if (!v) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      osc(v, 'triangle', f, f, i * 0.08, 0.7, 0.12);
      osc(v, 'sine', f * 2, f * 2, i * 0.08, 0.5, 0.04);
    });
    noise(v, 0.3, 0.8, 0.06, { type: 'highpass', f0: 7000 }, 0.2);
  },
  jump_charge(o) {
    const v = voice(o, 1.8, 0.3);
    if (!v) return;
    const c = ctx!;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(200, v.t);
    f.frequency.exponentialRampToValueAtTime(4000, v.t + 1.6);
    const trem = c.createGain();
    const lfo = c.createOscillator();
    lfo.frequency.setValueAtTime(4, v.t);
    lfo.frequency.exponentialRampToValueAtTime(28, v.t + 1.6);
    const lg = c.createGain();
    lg.gain.value = 0.5;
    trem.gain.value = 0.5;
    lfo.connect(lg).connect(trem.gain);
    lfo.start(v.t);
    lfo.stop(v.t + 1.8);
    f.connect(trem).connect(v.out);
    osc(v, 'sawtooth', 90, 900, 0, 1.7, 0.18, { dest: f, attack: 1.2 });
    osc(v, 'sawtooth', 91, 905, 0, 1.7, 0.18, { dest: f, attack: 1.2, detune: 12 });
    osc(v, 'sine', 45, 180, 0, 1.7, 0.25, { attack: 1.3 });
  },
  jump(o) {
    const v = voice(o, 2.0, 0.6);
    if (!v) return;
    noise(v, 0, 1.2, 0.6, { type: 'bandpass', f0: 4000, f1: 120, q: 0.9 }, 0.01);
    osc(v, 'sine', 900, 30, 0, 1.0, 0.45);
    osc(v, 'sawtooth', 300, 20, 0, 0.8, 0.12);
    osc(v, 'sine', 2400, 4800, 0, 0.25, 0.05);
  },
  dock(o) {
    const v = voice(o, 1.0, 0.25);
    if (!v) return;
    noise(v, 0, 0.1, 0.5, { type: 'lowpass', f0: 900, f1: 200 });
    osc(v, 'sine', 95, 50, 0, 0.25, 0.5);
    osc(v, 'square', 220, 200, 0.02, 0.06, 0.05);
    noise(v, 0.18, 0.7, 0.12, { type: 'highpass', f0: 3000, f1: 6000 }, 0.05);
  },
  warning(o) {
    const v = voice(o, 0.9, 0.15);
    if (!v) return;
    for (let i = 0; i < 2; i++) {
      osc(v, 'square', 880, 880, i * 0.4, 0.18, 0.07, { attack: 0.01 });
      osc(v, 'square', 660, 660, i * 0.4 + 0.2, 0.18, 0.07, { attack: 0.01 });
    }
  },
  blink(o) {
    const v = voice(o, 0.25, 0.3);
    if (!v) return;
    osc(v, 'sine', 2400, 180, 0, 0.14, 0.18);
    osc(v, 'triangle', 180, 2400, 0.1, 0.1, 0.06);
    noise(v, 0, 0.12, 0.15, { type: 'highpass', f0: 5000, f1: 1500 });
  },
  ability(o) {
    const v = voice(o, 0.7, 0.35);
    if (!v) return;
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(300, v.t);
    f.frequency.exponentialRampToValueAtTime(3500, v.t + 0.4);
    f.connect(v.out);
    for (const m of [1, 1.25, 1.5, 2]) osc(v, 'sawtooth', 220 * m, 220 * m, 0, 0.55, 0.09, { dest: f, attack: 0.03 });
    osc(v, 'sine', 110, 110, 0, 0.4, 0.2);
  },
  error(o) {
    const v = voice(o, 0.35, 0.05);
    if (!v) return;
    osc(v, 'square', 150, 140, 0, 0.1, 0.09);
    osc(v, 'square', 150, 140, 0.14, 0.12, 0.09);
  },
  scan(o) {
    const v = voice(o, 1.4, 0.6);
    if (!v) return;
    osc(v, 'sine', 1200, 1200, 0, 0.9, 0.14);
    osc(v, 'sine', 1800, 1800, 0, 0.5, 0.04);
    osc(v, 'triangle', 300, 1600, 0.05, 0.6, 0.04, { attack: 0.2 });
  },
  boss_roar(o) {
    const v = voice(o, 2.4, 0.5);
    if (!v) return;
    const c = ctx!;
    const w = shaper(v);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, v.t);
    lp.frequency.linearRampToValueAtTime(1400, v.t + 0.6);
    lp.frequency.exponentialRampToValueAtTime(200, v.t + 2.0);
    lp.connect(w);
    for (const [f, dt] of [
      [55, 0],
      [57, 9],
      [82, -6],
      [110, 4],
    ]) {
      const oo = osc(v, 'sawtooth', f, f * 0.7, 0, 2.1, 0.12, { dest: lp, attack: 0.25, detune: dt });
      const lfo = c.createOscillator();
      lfo.frequency.value = 7 + Math.random() * 4;
      const lg = c.createGain();
      lg.gain.value = f * 0.08;
      lfo.connect(lg).connect(oo.frequency);
      lfo.start(v.t);
      lfo.stop(v.t + 2.2);
    }
    noise(v, 0, 1.9, 0.3, { type: 'lowpass', f0: 800, f1: 150 }, 0.3);
  },
  thrust(o) {
    const v = voice(o, 0.3, 0.05);
    if (!v) return;
    noise(v, 0, 0.25, 0.3, { type: 'lowpass', f0: 600, f1: 250 }, 0.03);
  },
};

const THROTTLE_MS: Partial<Record<Sfx, number>> = {
  ui_hover: 45,
  hit: 35,
  laser: 30,
  explode_small: 45,
  explode_big: 120,
  boss_roar: 1500,
  jump_charge: 500,
  warning: 600,
};

// ------------------------------------------------------------------ thrust loop

let thrustGain: GainNode | null = null;
let thrustFilter: BiquadFilterNode | null = null;
let rumbleGain: GainNode | null = null;

function ensureThrust() {
  if (!ctx || thrustGain) return;
  const c = ctx;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  thrustFilter = c.createBiquadFilter();
  thrustFilter.type = 'lowpass';
  thrustFilter.frequency.value = 200;
  thrustFilter.Q.value = 0.8;
  thrustGain = c.createGain();
  thrustGain.gain.value = 0;
  s.connect(thrustFilter).connect(thrustGain).connect(sfxBus);
  s.start();
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 42;
  rumbleGain = c.createGain();
  rumbleGain.gain.value = 0;
  o.connect(rumbleGain).connect(sfxBus);
  o.start();
}

// ------------------------------------------------------------------ music

const MIDI = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface MoodDef {
  bpm: number;
  scale: number[]; // semitone offsets
  roots: number[]; // candidate tonic midi notes
  prog: number[][]; // allowed degree transitions graph: index = from-degree position
  degrees: number[]; // chord root scale-degrees used
  barsPerChord: number;
  pad: number; // pad level
  padBright: number; // filter cutoff base
  bell: number; // melody probability per beat
  arp: number; // arp level (0 = none)
  bass: number;
  kick: number;
  hat: number;
  drone: number;
  snare: number;
}

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const MOODS: Record<Exclude<Mood, 'none'>, MoodDef> = {
  menu: {
    bpm: 64,
    scale: AEOLIAN,
    roots: [45, 47, 50, 52],
    degrees: [0, 5, 2, 6, 3, 4],
    prog: [],
    barsPerChord: 2,
    pad: 0.11,
    padBright: 900,
    bell: 0.22,
    arp: 0,
    bass: 0,
    kick: 0,
    hat: 0,
    drone: 0.07,
    snare: 0,
  },
  calm: {
    bpm: 56,
    scale: DORIAN,
    roots: [43, 45, 48, 50],
    degrees: [0, 3, 6, 2, 4, 5],
    prog: [],
    barsPerChord: 2,
    pad: 0.09,
    padBright: 750,
    bell: 0.14,
    arp: 0.025,
    bass: 0,
    kick: 0,
    hat: 0,
    drone: 0.06,
    snare: 0,
  },
  tense: {
    bpm: 84,
    scale: PHRYGIAN,
    roots: [40, 42, 45],
    degrees: [0, 1, 5, 6, 3],
    prog: [],
    barsPerChord: 2,
    pad: 0.09,
    padBright: 600,
    bell: 0.06,
    arp: 0,
    bass: 0.1,
    kick: 0.0,
    hat: 0.025,
    drone: 0.08,
    snare: 0,
  },
  combat: {
    bpm: 116,
    scale: AEOLIAN,
    roots: [40, 43, 45],
    degrees: [0, 5, 6, 4, 3, 2],
    prog: [],
    barsPerChord: 2,
    pad: 0.07,
    padBright: 1100,
    bell: 0.03,
    arp: 0.06,
    bass: 0.14,
    kick: 0.35,
    hat: 0.04,
    drone: 0,
    snare: 0.06,
  },
  boss: {
    bpm: 124,
    scale: PHRYGIAN,
    roots: [38, 40, 41],
    degrees: [0, 1, 0, 6, 5],
    prog: [],
    barsPerChord: 2,
    pad: 0.08,
    padBright: 800,
    bell: 0,
    arp: 0.055,
    bass: 0.2,
    kick: 0.5,
    hat: 0.05,
    drone: 0.06,
    snare: 0.1,
  },
  victory: {
    bpm: 72,
    scale: LYDIAN,
    roots: [48, 50, 53],
    degrees: [0, 1, 4, 5, 3],
    prog: [],
    barsPerChord: 2,
    pad: 0.11,
    padBright: 1600,
    bell: 0.35,
    arp: 0.03,
    bass: 0,
    kick: 0,
    hat: 0,
    drone: 0.04,
    snare: 0,
  },
  death: {
    bpm: 48,
    scale: AEOLIAN,
    roots: [38, 40, 41],
    degrees: [0, 5, 3, 0, 4],
    prog: [],
    barsPerChord: 2,
    pad: 0.1,
    padBright: 500,
    bell: 0.08,
    arp: 0,
    bass: 0,
    kick: 0,
    hat: 0,
    drone: 0.1,
    snare: 0,
  },
};

class MoodLayer {
  out: GainNode;
  def: MoodDef;
  root: number;
  step = 0;
  next: number;
  chordIdx = 0;
  chord: number[] = [];
  arpPattern: number[] = [];
  arpFilter: BiquadFilterNode;
  dying = false;
  dieAt = 0;
  lastBell = -1;
  motif: number[] = [];
  constructor(
    public mood: Exclude<Mood, 'none'>,
    t: number,
  ) {
    const c = ctx!;
    this.def = MOODS[mood];
    this.root = this.def.roots[Math.floor(Math.random() * this.def.roots.length)];
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + (mood === 'combat' || mood === 'boss' ? 1.5 : 4));
    this.out.connect(musicBus);
    const rs = c.createGain();
    rs.gain.value = mood === 'combat' || mood === 'boss' ? 0.25 : 0.6;
    this.out.connect(rs).connect(reverbIn);
    this.arpFilter = c.createBiquadFilter();
    this.arpFilter.type = 'lowpass';
    this.arpFilter.Q.value = 5;
    this.arpFilter.frequency.value = 1200;
    this.arpFilter.connect(this.out);
    const ds = c.createGain();
    ds.gain.value = 0.35;
    this.arpFilter.connect(ds).connect(delayIn);
    this.next = t + 0.05;
    this.newMotif();
  }
  stepDur() {
    return 60 / this.def.bpm / 4; // 16th note
  }
  scaleNote(deg: number, oct = 0): number {
    const s = this.def.scale;
    const n = s.length;
    const o = Math.floor(deg / n);
    const i = ((deg % n) + n) % n;
    return this.root + s[i] + 12 * (o + oct);
  }
  newMotif() {
    const len = 3 + Math.floor(Math.random() * 3);
    this.motif = [];
    let d = Math.floor(Math.random() * 5);
    for (let i = 0; i < len; i++) {
      this.motif.push(d);
      d += [-2, -1, -1, 1, 1, 2, 3][Math.floor(Math.random() * 7)];
    }
  }
  pickChord() {
    const degs = this.def.degrees;
    // random walk that prefers moving to a neighbour in the list, returns home often
    if (Math.random() < 0.25) this.chordIdx = 0;
    else this.chordIdx = (this.chordIdx + 1 + Math.floor(Math.random() * Math.min(3, degs.length - 1))) % degs.length;
    const d = degs[this.chordIdx];
    // triad + optional 7th/9th for colour
    const tones = [d, d + 2, d + 4];
    if (Math.random() < 0.55) tones.push(d + 6);
    if (Math.random() < 0.3) tones.push(d + 8);
    this.chord = tones.map((x) => this.scaleNote(x, 1));
    // arp pattern over 2 octaves
    const base = tones.slice(0, 4).map((x) => this.scaleNote(x, 2));
    const pat = [...base, ...base.map((n) => n + 12)];
    const style = Math.floor(Math.random() * 3);
    if (style === 0) this.arpPattern = pat;
    else if (style === 1) this.arpPattern = [...pat, ...pat.slice(1, -1).reverse()];
    else this.arpPattern = pat.map((_, i) => pat[(i * 3) % pat.length]);
    if (Math.random() < 0.3) this.newMotif();
    // occasional key drift for long sessions
    if (Math.random() < 0.06) this.root += [-5, -2, 2, 5, 7][Math.floor(Math.random() * 5)];
    if (this.root > 54) this.root -= 12;
    if (this.root < 36) this.root += 12;
  }
  schedule(until: number) {
    const sd = this.stepDur();
    const stepsPerChord = 16 * this.def.barsPerChord;
    // if the timer was throttled (background tab), skip ahead instead of bursting stale notes
    const now = ctx!.currentTime;
    if (this.next < now - 0.05) {
      const lag = Math.ceil((now - this.next) / sd);
      this.step = 0; // restart phrase so a fresh chord sounds right away
      this.next += lag * sd;
    }
    while (this.next < until) {
      const t = this.next;
      const s = this.step;
      if (s % stepsPerChord === 0) {
        this.pickChord();
        const dur = stepsPerChord * sd;
        this.pad(t, dur);
        if (this.def.drone > 0) this.drone(t, dur);
      }
      const D = this.def;
      // bass
      if (D.bass > 0) {
        const pattern = this.mood === 'boss' ? s % 2 === 0 : this.mood === 'tense' ? s % 4 === 0 : s % 2 === 0 && s % 8 !== 6;
        if (pattern) this.bass(t, sd * (this.mood === 'tense' ? 3 : 1.6), D.bass * (s % 8 === 0 ? 1 : 0.7));
      }
      if (D.kick > 0 && s % 4 === 0 && !(this.mood === 'combat' && s % 32 === 28)) this.kick(t, D.kick);
      if (D.snare > 0 && s % 8 === 4) this.snare(t, D.snare);
      if (D.hat > 0 && s % 2 === 0) this.hat(t, D.hat * (s % 4 === 2 ? 1 : 0.5));
      if (D.arp > 0) {
        const div = this.mood === 'calm' ? 4 : 1;
        if (s % div === 0) {
          const n = this.arpPattern[(s / div) % this.arpPattern.length];
          if (!(this.mood === 'calm' && Math.random() < 0.4)) this.arp(t, n, sd * (div === 4 ? 3 : 0.9), D.arp);
        }
        // slow filter sweep
        const ph = (s % 128) / 128;
        this.arpFilter.frequency.setTargetAtTime(700 + 2400 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2)), t, 0.3);
      }
      if (D.bell > 0 && s % 4 === 0 && Math.random() < D.bell) {
        // play next motif note (melodic memory) with variations
        const idx = (s / 4) % this.motif.length;
        let deg = this.motif[idx] + this.def.degrees[this.chordIdx];
        if (Math.random() < 0.2) deg += Math.random() < 0.5 ? 2 : -2;
        this.bell(t, this.scaleNote(deg, 2), D.bell > 0.2 ? 0.07 : 0.055);
      }
      this.step++;
      this.next += sd;
    }
  }
  pad(t: number, dur: number) {
    const c = ctx!;
    const D = this.def;
    const atk = Math.min(2.5, dur * 0.35);
    const rel = 2.5;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.7;
    const fc = D.padBright * (0.7 + Math.random() * 0.6);
    f.frequency.setValueAtTime(fc * 0.6, t);
    f.frequency.linearRampToValueAtTime(fc * 1.3, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(fc * 0.7, t + dur + rel);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(D.pad, t + atk);
    g.gain.setValueAtTime(D.pad, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + rel);
    f.connect(g).connect(this.out);
    for (const n of this.chord) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = MIDI(n);
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const og = c.createGain();
        og.gain.value = 0.22 / this.chord.length;
        o.connect(og).connect(f);
        o.start(t);
        o.stop(t + dur + rel + 0.1);
      }
    }
    // soft sine octave below for warmth
    const so = c.createOscillator();
    so.type = 'sine';
    so.frequency.value = MIDI(this.chord[0] - 12);
    const sg = c.createGain();
    sg.gain.value = 0.25;
    so.connect(sg).connect(g);
    so.start(t);
    so.stop(t + dur + rel + 0.1);
  }
  drone(t: number, dur: number) {
    const c = ctx!;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = MIDI(this.root - 12);
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = MIDI(this.root - 12 + 7);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.def.drone, t + 2);
    g.gain.setValueAtTime(this.def.drone, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 2);
    const g2 = c.createGain();
    g2.gain.value = 0.4;
    o.connect(g).connect(this.out);
    o2.connect(g2).connect(g);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 2.1);
    o2.stop(t + dur + 2.1);
  }
  bass(t: number, dur: number, lvl: number) {
    const c = ctx!;
    const n = this.chord[0] - 24;
    const o = c.createOscillator();
    o.type = this.mood === 'boss' ? 'sawtooth' : 'square';
    o.frequency.value = MIDI(n);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(this.mood === 'boss' ? 900 : 600, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  kick(t: number, lvl: number) {
    const c = ctx!;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }
  snare(t: number, lvl: number) {
    const c = ctx!;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.2);
  }
  hat(t: number, lvl: number) {
    const c = ctx!;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = c.createGain();
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }
  arp(t: number, n: number, dur: number, lvl: number) {
    const c = ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = MIDI(n);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.arpFilter);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  bell(t: number, n: number, lvl: number) {
    const c = ctx!;
    const f = MIDI(n);
    // simple FM bell
    const car = c.createOscillator();
    car.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f * 3.5;
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 1.5);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3);
    const pn = c.createStereoPanner();
    pn.pan.value = (Math.random() - 0.5) * 1.2;
    car.connect(g).connect(pn).connect(this.out);
    const ds = c.createGain();
    ds.gain.value = 0.5;
    pn.connect(ds).connect(delayIn);
    car.start(t);
    mod.start(t);
    car.stop(t + 3.1);
    mod.stop(t + 3.1);
  }
  fadeOut(t: number, secs: number) {
    this.dying = true;
    this.dieAt = t + secs;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + secs);
  }
}

let layers: MoodLayer[] = [];
let currentMood: Mood = 'none';
let timer: number | null = null;

function tick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const ahead = now + 0.35;
  for (const l of layers) if (!l.dying || now < l.dieAt) l.schedule(Math.min(ahead, l.dying ? l.dieAt : ahead));
  layers = layers.filter((l) => {
    if (l.dying && now > l.dieAt + 4) {
      l.out.disconnect();
      return false;
    }
    return true;
  });
}

function applyMood() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const fast = currentMood === 'combat' || currentMood === 'boss' || currentMood === 'death';
  for (const l of layers) if (!l.dying) l.fadeOut(t, fast ? 1.8 : 4);
  if (currentMood !== 'none') layers.push(new MoodLayer(currentMood, t + 0.05));
  if (timer === null) timer = window.setInterval(tick, 60);
  tick();
}

// ------------------------------------------------------------------ public API

export const audio = {
  unlock(): void {
    try {
      if (!ctx) {
        build();
        if (currentMood !== 'none') applyMood();
      }
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch {
      /* audio unavailable */
    }
  },
  sfx(name: Sfx, opts?: { vol?: number; pitch?: number; pan?: number }): void {
    if (!ctx || ctx.state !== 'running') return;
    const now = performance.now();
    const last = lastPlayed.get(name) ?? -1e9;
    if (now - last < (THROTTLE_MS[name] ?? 30)) return;
    lastPlayed.set(name, now);
    const fn = SFX[name];
    if (fn) fn(opts);
  },
  setThrust(level: number): void {
    if (!ctx) return;
    ensureThrust();
    const l = Math.max(0, Math.min(1, level));
    const t = ctx.currentTime;
    thrustGain!.gain.setTargetAtTime(l * 0.22, t, 0.08);
    thrustFilter!.frequency.setTargetAtTime(160 + l * 700, t, 0.1);
    rumbleGain!.gain.setTargetAtTime(l * 0.12, t, 0.1);
  },
  setMood(m: Mood): void {
    if (m === currentMood) return;
    currentMood = m;
    applyMood();
  },
  setVolumes(m: number, s: number, mu: number): void {
    const cl = (x: number) => Math.max(0, Math.min(1, x));
    vols.master = cl(m);
    vols.sfx = cl(s);
    vols.music = cl(mu);
    if (ctx) {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(vols.master, t, 0.03);
      sfxBus.gain.setTargetAtTime(vols.sfx, t, 0.03);
      musicBus.gain.setTargetAtTime(vols.music, t, 0.03);
    }
  },
  getVolumes(): { master: number; sfx: number; music: number } {
    return { ...vols };
  },
  /** AudioContext state (extra): 'none' before unlock */
  getState(): string {
    return ctx ? ctx.state : 'none';
  },
  /** current mood (extra) */
  getMood(): Mood {
    return currentMood;
  },
};
