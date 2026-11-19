/** Procedural backdrop layers: nebula clouds and tileable star fields. */
import { RNG, hashSeed } from '../core/rng';
import { Noise2D, clamp, makeCanvas, parseColor, rgba, smoothstep } from './noise';

const TAU = Math.PI * 2;

/**
 * Soft colourful nebula, dark overall. Tileable (seamless wrap) so it can be repeated for parallax.
 * Rendered at reduced resolution then smoothly upscaled.
 */
export function makeNebula(seed: number, w: number, h: number, palette: [string, string, string]): HTMLCanvasElement {
  const rng = new RNG(hashSeed(seed, 'nebula'));
  const n1 = new Noise2D(rng.fork());
  const n2 = new Noise2D(rng.fork());
  const n3 = new Noise2D(rng.fork());
  const scale = 4;
  const lw = Math.max(16, Math.ceil(w / scale));
  const lh = Math.max(16, Math.ceil(h / scale));
  const [low, lc] = makeCanvas(lw, lh);
  const img = lc.createImageData(lw, lh);
  const data = img.data;
  const cols = palette.map(parseColor);
  // base frequency: integer number of noise cells across => seamless tiling
  const px = Math.max(2, Math.round(w / 360));
  const py = Math.max(2, Math.round(h / 360));
  const fbmT = (n: Noise2D, x: number, y: number, oct: number) => {
    // periodic fbm (period px,py at base octave)
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      sum += amp * periodic(n, x * f, y * f, px * f, py * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  const off = rng.range(0, 100) | 0;
  const strength = [rng.range(0.8, 1.2), rng.range(0.5, 0.9), rng.range(0.35, 0.7)];
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const u = (x / lw) * px;
      const v = (y / lh) * py;
      // domain warp (periodic)
      const qx = fbmT(n1, u + off, v, 3);
      const qy = fbmT(n1, u, v + off, 3);
      const wu = u + (qx - 0.5) * 1.6;
      const wv = v + (qy - 0.5) * 1.6;
      const a = fbmT(n2, wu, wv, 5);
      const b = fbmT(n3, wu * 1.0 + 3, wv + 3, 5);
      const c = fbmT(n1, wu + 7, wv + 11, 4);
      // cloud density with soft threshold
      const dA = smoothstep(0.42, 0.85, a) * strength[0];
      const dB = smoothstep(0.45, 0.85, b) * strength[1];
      const dC = smoothstep(0.5, 0.8, c * 0.6 + a * 0.4) * strength[2];
      // dark dust lanes
      const dust = smoothstep(0.55, 0.75, fbmT(n3, u * 2 + 5, v * 2 + 9, 4));
      const dim = 1 - dust * 0.75;
      let r = (cols[0][0] * dA + cols[1][0] * dB + cols[2][0] * dC) * 0.42;
      let g = (cols[0][1] * dA + cols[1][1] * dB + cols[2][1] * dC) * 0.42;
      let bl = (cols[0][2] * dA + cols[1][2] * dB + cols[2][2] * dC) * 0.42;
      // bright cores where clouds overlap
      const core = Math.pow(dA * dB, 2) * 60;
      r = (r + core) * dim;
      g = (g + core) * dim;
      bl = (bl + core) * dim;
      // deep space floor (very dark blue)
      const i = (y * lw + x) * 4;
      data[i] = clamp(r + 4, 0, 255);
      data[i + 1] = clamp(g + 5, 0, 255);
      data[i + 2] = clamp(bl + 10, 0, 255);
      data[i + 3] = 255;
    }
  }
  lc.putImageData(img, 0, 0);
  const [cv, c] = makeCanvas(w, h);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  // draw with wrap padding so the upscale filter stays seamless
  c.drawImage(low, 0, 0, w, h);
  // glowing knots (embedded young stars)
  c.globalCompositeOperation = 'lighter';
  const knots = rng.int(2, 5);
  for (let i = 0; i < knots; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const R = rng.range(40, 160);
    const col = palette[rng.int(0, 2)];
    for (const [ox, oy] of wrapOffsets(x, y, R, w, h)) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R);
      g.addColorStop(0, rgba(col, 0.18));
      g.addColorStop(0.3, rgba(col, 0.06));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(x + ox - R, y + oy - R, R * 2, R * 2);
    }
  }
  // fine grain to avoid banding
  c.globalCompositeOperation = 'source-over';
  const grainN = Math.floor((w * h) / 900);
  for (let i = 0; i < grainN; i++) {
    c.fillStyle = `rgba(${rng.chance(0.5) ? '255,255,255' : '0,0,0'},${rng.range(0.01, 0.035)})`;
    c.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
  }
  return cv;
}

function periodic(n: Noise2D, x: number, y: number, pxp: number, pyp: number): number {
  // value noise with independent x/y periods (integers): wrap lattice coordinates
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const PX = Math.max(1, Math.round(pxp));
  const PY = Math.max(1, Math.round(pyp));
  const wrap = (a: number, p: number) => ((a % p) + p) % p;
  const x0 = wrap(xi, PX);
  const x1 = wrap(xi + 1, PX);
  const y0 = wrap(yi, PY);
  const y1 = wrap(yi + 1, PY);
  // lattice lookup via the noise's own value function at integer coords
  const a = n.noise(x0, y0);
  const b = n.noise(x1, y0);
  const c = n.noise(x0, y1);
  const d = n.noise(x1, y1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function wrapOffsets(x: number, y: number, R: number, w: number, h: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  const xs = [0];
  const ys = [0];
  if (x - R < 0) xs.push(w);
  if (x + R > w) xs.push(-w);
  if (y - R < 0) ys.push(h);
  if (y + R > h) ys.push(-h);
  for (const ox of xs) for (const oy of ys) if (ox || oy) out.push([ox, oy]);
  return out;
}

const STAR_COLS = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffe8c8', '#ffd2a1', '#ffb070'];

/**
 * Tileable star layer. density ~1 → about 1 star per 2500 px²; brightness 0..1+ scales intensity.
 */
export function makeStarLayer(seed: number, w: number, h: number, density: number, brightness: number): HTMLCanvasElement {
  const rng = new RNG(hashSeed(seed, 'stars', w, h));
  const [cv, c] = makeCanvas(w, h);
  const n = Math.round((w * h * Math.max(0, density)) / 2500);
  const B = Math.max(0, brightness);
  const dot = (x: number, y: number, s: number, col: string, a: number) => {
    for (const [ox, oy] of wrapOffsets(x, y, s + 1, w, h)) {
      c.fillStyle = rgba(col, a);
      c.fillRect(x + ox - s / 2, y + oy - s / 2, s, s);
    }
  };
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    // weighted toward white/blue-white, some warm
    const col = STAR_COLS[Math.min(STAR_COLS.length - 1, Math.floor(Math.pow(rng.next(), 1.3) * STAR_COLS.length))];
    const m = Math.pow(rng.next(), 3); // magnitude: most faint
    const a = clamp((0.25 + m * 0.75) * B, 0, 1);
    const s = m > 0.7 ? 2 : m > 0.35 ? 1.5 : 1;
    dot(x, y, s, col, a);
  }
  // a few bright stars with glow and subtle spikes
  const bright = Math.max(1, Math.round(n / 120));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < bright; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const col = rng.pick(STAR_COLS);
    const R = rng.range(4, 10);
    const a = clamp(0.9 * B, 0, 1);
    for (const [ox, oy] of wrapOffsets(x, y, R * 2, w, h)) {
      const cx = x + ox;
      const cy = y + oy;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, rgba('#ffffff', a));
      g.addColorStop(0.15, rgba(col, a * 0.6));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, R, 0, TAU);
      c.fill();
      if (R > 6) {
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ]) {
          const L = R * 2;
          const lg = c.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
          lg.addColorStop(0, rgba(col, 0));
          lg.addColorStop(0.5, rgba(col, a * 0.5));
          lg.addColorStop(1, rgba(col, 0));
          c.fillStyle = lg;
          if (dx) c.fillRect(cx - L, cy - 0.5, L * 2, 1);
          else c.fillRect(cx - 0.5, cy - L, 1, L * 2);
        }
      }
    }
  }
  return cv;
}
