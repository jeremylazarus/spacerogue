/** Small seeded value-noise / fbm helpers for procedural textures. */

export class Noise2D {
  private perm: Uint8Array;
  private vals: Float32Array;
  constructor(seed: number) {
    let s = seed >>> 0 || 1;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.perm = new Uint8Array(512);
    this.vals = new Float32Array(256);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
      this.vals[i] = rnd();
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    // flattened 256x256 lattice for single-lookup sampling
    this.lat = new Float32Array(65536);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) this.lat[(y << 8) | x] = this.vals[this.perm[this.perm[x] + y]];
  }
  private lat: Float32Array;

  /** value noise in [0,1]. Optional period (integer) for tiling. */
  noise(x: number, y: number, period = 256): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    let x0: number, y0: number, x1: number, y1: number;
    if (period >= 256) {
      x0 = xi & 255;
      y0 = yi & 255;
      x1 = (xi + 1) & 255;
      y1 = (yi + 1) & 255;
    } else {
      const per = period | 0;
      x0 = (((xi % per) + per) % per) & 255;
      y0 = (((yi % per) + per) % per) & 255;
      x1 = ((((xi + 1) % per) + per) % per) & 255;
      y1 = ((((yi + 1) % per) + per) % per) & 255;
    }
    const L = this.lat;
    const a = L[(y0 << 8) | x0];
    const b = L[(y0 << 8) | x1];
    const c = L[(y1 << 8) | x0];
    const d = L[(y1 << 8) | x1];
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** fractal brownian motion, result roughly in [0,1]. */
  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5, period = 256): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    let per = period;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq, per);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
      per *= lacunarity;
    }
    return sum / norm;
  }

  /** ridged fbm in [0,1] — sharp crests, good for mountains/veins. */
  ridged(x: number, y: number, octaves = 5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise(x * freq, y * freq) * 2 - 1);
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  /** domain-warped fbm for swirly clouds. */
  warped(x: number, y: number, strength = 1.5, octaves = 4): number {
    const qx = this.fbm(x + 1.7, y + 9.2, octaves);
    const qy = this.fbm(x + 8.3, y + 2.8, octaves);
    return this.fbm(x + strength * qx, y + strength * qy, octaves);
  }
}

/** Parse "#rgb", "#rrggbb", "rgb(a)" or "hsl(...)" into [r,g,b] 0..255. */
export function parseColor(c: string): [number, number, number] {
  c = c.trim();
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/^(rgba?|hsla?)\(([^)]+)\)/i);
  if (m) {
    const parts = m[2].split(/[\s,/]+/).filter(Boolean).map((s) => parseFloat(s));
    if (m[1].toLowerCase().startsWith('rgb')) return [parts[0] | 0, parts[1] | 0, parts[2] | 0];
    return hslToRgb(parts[0], parts[1] / 100, parts[2] / 100);
  }
  // Fallback: let canvas resolve named colours
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const x = cv.getContext('2d')!;
    x.fillStyle = c;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  return [128, 128, 128];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

/** Return css rgba string for colour scaled by brightness factor k (k>1 lightens toward white). */
export function shade(c: string, k: number, alpha = 1): string {
  const [r, g, b] = parseColor(c);
  let R: number, G: number, B: number;
  if (k <= 1) {
    R = r * k;
    G = g * k;
    B = b * k;
  } else {
    const t = Math.min(1, k - 1);
    R = r + (255 - r) * t;
    G = g + (255 - g) * t;
    B = b + (255 - b) * t;
  }
  return `rgba(${R | 0},${G | 0},${B | 0},${alpha})`;
}

export function mix(a: string, b: string, t: number, alpha = 1): string {
  const A = parseColor(a);
  const B = parseColor(b);
  return `rgba(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0},${alpha})`;
}

export function rgba(c: string, alpha: number): string {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
