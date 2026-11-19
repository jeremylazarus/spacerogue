/**
 * Procedural ship & boss sprites. All sprites face +X, centred in a square canvas of side ≈ size*1.2.
 * Internally everything is drawn in "units": the ship spans roughly x,y ∈ [-50,50] and the canvas
 * covers [-60,60]; the context is scaled by size/100.
 */
import { RNG, hashSeed } from '../core/rng';
import { makeCanvas, mix, parseColor, rgbToHsl, rgba, shade } from './noise';

export type ShipStyle =
  | 'player'
  | 'mercantile'
  | 'zealot'
  | 'hive'
  | 'machine'
  | 'raider'
  | 'ancient'
  | 'warden'
  | 'monster'
  | 'drone';

export type P = [number, number] | [number, number, number];
const TAU = Math.PI * 2;

export interface D {
  c: CanvasRenderingContext2D;
  k: number; // px per unit
  r: RNG;
  p: string;
  s: string;
  /** convert screen pixels to units */
  px: (n: number) => number;
}

// ---------------------------------------------------------------- helpers

export function setup(size: number, seed: number, primary: string, secondary: string) {
  const S = Math.ceil(size * 1.2);
  const [cv, c] = makeCanvas(S, S);
  c.translate(S / 2, S / 2);
  const k = size / 100;
  c.scale(k, k);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const d: D = { c, k, r: new RNG(seed), p: primary, s: secondary, px: (n) => n / k };
  return { cv, d };
}

/** Bright glow variant of a colour (keeps hue). */
export function glowCol(col: string, minL = 0.62): string {
  const [r, g, b] = parseColor(col);
  const [h, s, l] = rgbToHsl(r, g, b);
  return `hsl(${h.toFixed(1)},${(Math.max(s, 0.65) * 100).toFixed(1)}%,${(Math.max(l, minL) * 100).toFixed(1)}%)`;
}

export function mirrorList(half: P[]): P[] {
  const out: P[] = half.slice();
  for (let i = half.length - 1; i >= 0; i--) {
    const p = half[i];
    if (Math.abs(p[1]) < 1e-6) continue;
    out.push(p.length === 3 ? [p[0], -p[1], p[2]] : [p[0], -p[1]]);
  }
  return out;
}

export function polyPath(pts: P[]): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

/** Smooth closed curve through-ish the points; points with third element 1 stay sharp corners. */
export function smoothPath(pts: P[]): Path2D {
  const p = new Path2D();
  const n = pts.length;
  const mid = (a: P, b: P): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = pts[0][2] ? [pts[0][0], pts[0][1]] : mid(pts[n - 1], pts[0]);
  p.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const m = mid(a, b);
    if (a[2]) {
      p.lineTo(a[0], a[1]);
      if (b[2]) p.lineTo(b[0], b[1]);
      else p.lineTo(m[0], m[1]);
    } else {
      if (b[2]) p.quadraticCurveTo(a[0], a[1], b[0], b[1]);
      else p.quadraticCurveTo(a[0], a[1], m[0], m[1]);
    }
  }
  p.closePath();
  return p;
}

export const symPoly = (half: P[]) => polyPath(mirrorList(half));
export const symSmooth = (half: P[]) => smoothPath(mirrorList(half));

export function ellipsePath(x: number, y: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  return p;
}

export function rectPath(x: number, y: number, w: number, h: number, rad = 0): Path2D {
  const p = new Path2D();
  if (rad > 0) p.roundRect(x, y, w, h, Math.min(rad, Math.abs(w) / 2, Math.abs(h) / 2));
  else p.rect(x, y, w, h);
  return p;
}

export function hexPath(x: number, y: number, R: number, rot = 0): Path2D {
  const p = new Path2D();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    const px = x + Math.cos(a) * R;
    const py = y + Math.sin(a) * R;
    if (i === 0) p.moveTo(px, py);
    else p.lineTo(px, py);
  }
  p.closePath();
  return p;
}

export interface HullOpts {
  H?: number; // half-width for gradient
  x0?: number;
  x1?: number;
  outline?: string;
  outlinePx?: number;
  bevel?: number; // 0..1
  gloss?: number;
}

/** Shaded hull fill: cylindrical cross gradient + longitudinal falloff + bevel + outline. */
export function hull(d: D, path: Path2D, base: string, o: HullOpts = {}) {
  const c = d.c;
  const H = o.H ?? 20;
  const x0 = o.x0 ?? -45;
  const x1 = o.x1 ?? 45;
  const g = c.createLinearGradient(0, -H, 0, H);
  g.addColorStop(0, shade(base, 0.62));
  g.addColorStop(0.3, shade(base, 1.18 + (o.gloss ?? 0)));
  g.addColorStop(0.5, shade(base, 1.0));
  g.addColorStop(0.78, shade(base, 0.72));
  g.addColorStop(1, shade(base, 0.42));
  c.fillStyle = g;
  c.fill(path);
  const g2 = c.createLinearGradient(x1, 0, x0, 0);
  g2.addColorStop(0, 'rgba(255,255,255,0.07)');
  g2.addColorStop(0.55, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = g2;
  c.fill(path);
  const bev = o.bevel ?? 1;
  if (bev > 0) {
    c.save();
    c.clip(path);
    c.lineWidth = d.px(1.6);
    c.translate(0, d.px(1.1));
    c.strokeStyle = `rgba(255,255,255,${0.22 * bev})`;
    c.stroke(path);
    c.translate(0, -d.px(2.2));
    c.strokeStyle = `rgba(0,0,0,${0.35 * bev})`;
    c.stroke(path);
    c.restore();
  }
  c.lineWidth = d.px(o.outlinePx ?? 1.1);
  c.strokeStyle = o.outline ?? shade(base, 0.22, 0.95);
  c.stroke(path);
}

/** Random symmetric panel lines clipped to a path. */
export function panels(d: D, path: Path2D, n: number, x0: number, x1: number, H: number, alpha = 0.32) {
  const { c, r } = d;
  c.save();
  c.clip(path);
  for (let i = 0; i < n; i++) {
    const segs: [number, number, number, number][] = [];
    if (r.chance(0.55)) {
      const x = r.range(x0, x1);
      const a = r.range(0, H * 0.6);
      const b = a + r.range(H * 0.2, H);
      segs.push([x, a, x + r.range(-3, 3), b]);
    } else {
      const y = r.range(H * 0.1, H);
      const xa = r.range(x0, x1);
      segs.push([xa, y, xa + r.range(4, 20), y]);
    }
    for (const [ax, ay, bx, by] of segs) {
      for (const sgn of [1, -1]) {
        c.beginPath();
        c.moveTo(ax, ay * sgn);
        c.lineTo(bx, by * sgn);
        c.strokeStyle = `rgba(0,0,0,${alpha})`;
        c.lineWidth = d.px(0.9);
        c.stroke();
        c.beginPath();
        c.moveTo(ax + d.px(0.8), ay * sgn + d.px(0.8));
        c.lineTo(bx + d.px(0.8), by * sgn + d.px(0.8));
        c.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
        c.lineWidth = d.px(0.6);
        c.stroke();
      }
    }
  }
  c.restore();
}

/** subtle grime / weathering specks clipped to path */
export function grime(d: D, path: Path2D, x0: number, x1: number, H: number, n: number, dark = 0.18) {
  if (d.k < 0.5) return;
  const { c, r } = d;
  c.save();
  c.clip(path);
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const y = r.range(-H, H);
    const rad = r.range(0.4, 2.2);
    c.fillStyle = r.chance(0.7) ? `rgba(0,0,0,${r.range(0.04, dark)})` : `rgba(255,255,255,${r.range(0.02, 0.08)})`;
    c.beginPath();
    c.ellipse(x, y, rad * r.range(1, 3), rad, 0, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** Engine plume pointing toward -X. */
export function engine(d: D, x: number, y: number, rad: number, col: string, len = 2) {
  const c = d.c;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.translate(x - rad * len * 0.55, y);
  c.scale(len, 1);
  const R = rad * 2.1;
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, rgba(col, 0.95));
  g.addColorStop(0.25, rgba(col, 0.55));
  g.addColorStop(0.6, rgba(col, 0.15));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.fill();
  c.restore();
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g2 = c.createRadialGradient(x, y, 0, x, y, rad * 0.9);
  g2.addColorStop(0, 'rgba(255,255,255,0.95)');
  g2.addColorStop(1, rgba(col, 0));
  c.fillStyle = g2;
  c.beginPath();
  c.ellipse(x - rad * 0.2, y, rad * 0.9, rad * 0.75, 0, 0, TAU);
  c.fill();
  c.restore();
}

export function nozzle(d: D, x: number, y: number, rad: number, base: string) {
  const c = d.c;
  const p = rectPath(x - rad * 0.6, y - rad, rad * 1.6, rad * 2, rad * 0.4);
  const g = c.createLinearGradient(0, y - rad, 0, y + rad);
  g.addColorStop(0, shade(base, 0.5));
  g.addColorStop(0.35, shade(base, 0.9));
  g.addColorStop(1, shade(base, 0.25));
  c.fillStyle = g;
  c.fill(p);
  c.lineWidth = d.px(0.9);
  c.strokeStyle = 'rgba(0,0,0,0.7)';
  c.stroke(p);
}

/** Small glowing light. */
export function light(d: D, x: number, y: number, rad: number, col: string, intensity = 1) {
  const c = d.c;
  const R = Math.max(rad * 3, d.px(2.5));
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(255,255,255,${0.9 * intensity})`);
  g.addColorStop(0.2, rgba(col, 0.8 * intensity));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, R, 0, TAU);
  c.fill();
  c.restore();
}

export function glass(d: D, x: number, y: number, rx: number, ry: number, col = '#6fd6ff') {
  const c = d.c;
  const p = ellipsePath(x, y, rx, ry);
  const g = c.createRadialGradient(x + rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry) * 1.2);
  g.addColorStop(0, mix(col, '#ffffff', 0.85));
  g.addColorStop(0.35, col);
  g.addColorStop(1, shade(col, 0.2));
  c.fillStyle = g;
  c.fill(p);
  c.lineWidth = d.px(1);
  c.strokeStyle = 'rgba(0,0,0,0.75)';
  c.stroke(p);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(x + rx * 0.25, y - ry * 0.35, rx * 0.45, ry * 0.22, 0, 0, TAU);
  c.fill();
  c.restore();
}

/** Tapered organic strand along a cubic bezier. */
export function tendril(
  d: D,
  pts: [number, number][], // 4 control points
  w0: number,
  w1: number,
  col: string,
  mirror = true,
) {
  const c = d.c;
  const steps = 24;
  const bez = (t: number) => {
    const u = 1 - t;
    const [a, b, e, f] = pts;
    return [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * e[0] + t * t * t * f[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * e[1] + t * t * t * f[1],
    ];
  };
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = bez(t);
    const [x2, y2] = bez(Math.min(1, t + 0.01));
    const [x3, y3] = bez(Math.max(0, t - 0.01));
    let nx = -(y2 - y3);
    let ny = x2 - x3;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  }
  const all = left.concat(right.reverse());
  for (const sgn of mirror ? [1, -1] : [1]) {
    const p = new Path2D();
    p.moveTo(all[0][0], all[0][1] * sgn);
    for (let i = 1; i < all.length; i++) p.lineTo(all[i][0], all[i][1] * sgn);
    p.closePath();
    const g = c.createLinearGradient(pts[0][0], 0, pts[3][0], 0);
    g.addColorStop(0, shade(col, 0.9));
    g.addColorStop(1, shade(col, 0.45));
    c.fillStyle = g;
    c.fill(p);
    c.lineWidth = d.px(0.8);
    c.strokeStyle = shade(col, 0.2, 0.8);
    c.stroke(p);
  }
}

export function aura(d: D, x: number, y: number, R: number, col: string, a = 0.25) {
  const c = d.c;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, R, 0, TAU);
  c.fill();
  c.restore();
}

/** Glowing rune made of grid strokes; drawn at (x,y) and mirrored at (x,-y). */
export function glyphPair(d: D, x: number, y: number, s: number, col: string) {
  const { c, r } = d;
  const strokes: [number, number, number, number][] = [];
  const n = r.int(2, 4);
  const pt = () => [r.int(-1, 1) * s * 0.5, r.int(-1, 1) * s * 0.5];
  for (let i = 0; i < n; i++) {
    const a = pt();
    const b = pt();
    if (a[0] === b[0] && a[1] === b[1]) b[0] += s * 0.5;
    strokes.push([a[0], a[1], b[0], b[1]]);
  }
  const ring = r.chance(0.35);
  for (const sgn of [1, -1]) {
    c.save();
    c.translate(x, y * sgn);
    c.scale(1, sgn);
    c.globalCompositeOperation = 'lighter';
    for (const [lw, a] of [
      [d.px(2.6), 0.25],
      [d.px(1), 0.95],
    ] as const) {
      c.lineWidth = lw;
      c.strokeStyle = rgba(col, a);
      c.beginPath();
      for (const [ax, ay, bx, by] of strokes) {
        c.moveTo(ax, ay);
        c.lineTo(bx, by);
      }
      if (ring) {
        c.moveTo(s * 0.3, 0);
        c.arc(0, 0, s * 0.3, 0, TAU);
      }
      c.stroke();
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- styles

function drawPlayer(d: D) {
  const { c, r } = d;
  const bw = r.range(6, 9);
  const noseX = r.range(40, 46);
  const tailX = -r.range(30, 35);
  const wingType = r.int(0, 3);
  const span = r.range(28, 40);
  const rootF = r.range(0, 12);
  const sweep = r.range(10, 24);
  const chord = r.range(10, 16);
  const nEng = r.pick([1, 2, 2, 3]);
  const wingCol = mix(d.p, '#1a1f2a', 0.3);
  const eng = glowCol(d.s, 0.66);

  // wings
  let wing: P[];
  if (wingType === 0) {
    wing = [
      [rootF, bw * 0.7],
      [rootF - sweep, span],
      [rootF - sweep - chord * 0.6, span],
      [tailX + 3, bw + 2],
    ];
  } else if (wingType === 1) {
    wing = [
      [rootF - 10, bw * 0.8],
      [rootF - 10 + sweep * 0.5, span],
      [rootF - 10 + sweep * 0.5 - chord * 0.7, span],
      [tailX + 4, bw],
    ];
  } else if (wingType === 2) {
    wing = [
      [rootF, bw * 0.7],
      [rootF - sweep * 0.6, span - 3],
      [rootF - sweep * 0.6 + 4, span],
      [tailX - 1, span],
      [tailX - 1, span - 5],
      [tailX + 8, bw],
    ];
  } else {
    wing = [
      [rootF - 4, bw * 0.7],
      [rootF - 4 - sweep, span],
      [rootF - 4 - sweep - chord * 0.5, span],
      [rootF - 10 - sweep * 0.4, span * 0.55],
      [tailX + 2, span * 0.75],
      [tailX - 1, span * 0.7],
      [tailX + 4, bw],
    ];
  }
  const wp = symPoly(wing);
  hull(d, wp, wingCol, { H: span, x0: tailX, x1: rootF });
  panels(d, wp, 4, tailX, rootF, span, 0.3);
  // wingtip accent band
  c.save();
  c.clip(wp);
  c.fillStyle = shade(d.s, 0.95);
  c.fillRect(-60, span - 4.5, 120, 2.5);
  c.fillRect(-60, -span + 2, 120, 2.5);
  c.restore();
  c.lineWidth = d.px(1.1);
  c.strokeStyle = shade(wingCol, 0.25);
  c.stroke(wp);

  // canards
  if (r.chance(0.45)) {
    const cx = noseX - r.range(14, 20);
    const cp = symPoly([
      [cx, bw * 0.5],
      [cx - 5, bw + r.range(5, 9)],
      [cx - 9, bw + r.range(5, 9)],
      [cx - 9, bw * 0.5],
    ]);
    hull(d, cp, wingCol, { H: bw + 9 });
  }

  // engine pods
  const podY = bw + 2.8;
  const podLen = r.range(14, 22);
  if (nEng >= 2) {
    for (const sgn of [1, -1]) {
      const pp = rectPath(tailX + 1, sgn * podY - 3.4, podLen, 6.8, 3.4);
      hull(d, pp, mix(d.p, '#444', 0.4), { H: podY + 4, x0: tailX, x1: tailX + podLen });
      nozzle(d, tailX + 1, sgn * podY, 2.8, '#333');
    }
  }

  // fuselage
  const fus: P[] = [
    [noseX, 0, 1],
    [noseX - 10, bw * 0.42],
    [noseX - 26, bw * 0.95],
    [-4, bw],
    [tailX + 10, bw * 1.05],
    [tailX, bw * 0.85, 1],
    [tailX, 0, 1],
  ];
  const fp = symSmooth(fus);
  hull(d, fp, d.p, { H: bw * 1.1, x0: tailX, x1: noseX, gloss: 0.08 });
  panels(d, fp, 6, tailX, noseX - 8, bw, 0.28);
  // stripes
  c.save();
  c.clip(fp);
  c.fillStyle = shade(d.s, 1.0, 0.9);
  const sY = bw * r.range(0.35, 0.6);
  c.fillRect(tailX + 4, sY - 0.7, noseX - tailX - 22, 1.4);
  c.fillRect(tailX + 4, -sY - 0.7, noseX - tailX - 22, 1.4);
  if (r.chance(0.5)) {
    c.fillStyle = shade(d.s, 0.8, 0.9);
    c.fillRect(noseX - 8, -bw, 2, bw * 2);
  }
  c.restore();
  // cockpit
  glass(d, noseX - r.range(17, 22), 0, r.range(6, 9), bw * 0.45);
  // engines
  if (nEng !== 2) {
    nozzle(d, tailX + 0.5, 0, 3.4, '#333');
    engine(d, tailX - 0.5, 0, 3.6, eng, 2.2);
  }
  if (nEng >= 2) for (const sgn of [1, -1]) engine(d, tailX, sgn * podY, 3, eng, 2);
  // nav lights
  const tipX = wing[1][0];
  light(d, tipX - 2, span - 1, 0.9, '#ff4848');
  light(d, tipX - 2, -span + 1, 0.9, '#48ff88');
}

function drawMercantile(d: D) {
  const { c, r } = d;
  const sw = r.range(3.5, 5.5);
  const front = r.range(32, 40);
  const rear = -r.range(32, 37);
  const nCols = r.int(2, 4);
  const rows = r.int(1, 2);
  const podW = rows === 1 ? r.range(9, 14) : r.range(7, 9);
  const gap = 1.6;
  const startX = rear + 11;
  const endX = front - 14;
  const podL = (endX - startX - gap * (nCols - 1)) / nCols;
  const metal = mix(d.p, '#7a7f88', 0.55);
  const pal = [d.p, d.s, mix(d.p, d.s, 0.5), mix(d.p, '#8a8478', 0.6), mix(d.s, '#5b6670', 0.5)];
  const eng = glowCol('#ffb060');

  // struts / spine
  const spine = rectPath(rear, -sw, front - rear - 4, sw * 2, 1);
  hull(d, spine, metal, { H: sw });
  // pods
  for (let col = 0; col < nCols; col++) {
    for (let row = 0; row < rows; row++) {
      if (r.chance(0.12)) {
        // missing container: show the mount frame
        const x0 = startX + col * (podL + gap);
        const y0 = sw + 0.8 + row * (podW + 1.4);
        for (const sgn of [1, -1]) {
          c.strokeStyle = shade(metal, 0.7);
          c.lineWidth = 1;
          c.strokeRect(x0 + 1, sgn > 0 ? y0 + 1 : -y0 - podW + 1, podL - 2, podW - 2);
        }
        continue;
      }
      const colr = r.pick(pal);
      const x0 = startX + col * (podL + gap);
      const y0 = sw + 0.8 + row * (podW + 1.4);
      const ribs = r.int(2, 5);
      const roundness = r.chance(0.3) ? podW * 0.45 : 1.2;
      for (const sgn of [1, -1]) {
        const yy = sgn > 0 ? y0 : -y0 - podW;
        const pp = rectPath(x0, yy, podL, podW, roundness);
        // boxes lit from top: gradient per box
        const g = c.createLinearGradient(0, yy, 0, yy + podW);
        g.addColorStop(0, shade(colr, 1.15));
        g.addColorStop(0.5, shade(colr, 0.9));
        g.addColorStop(1, shade(colr, 0.55));
        c.fillStyle = g;
        c.fill(pp);
        c.save();
        c.clip(pp);
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.lineWidth = d.px(0.9);
        for (let i = 1; i <= ribs; i++) {
          const x = x0 + (podL * i) / (ribs + 1);
          c.beginPath();
          c.moveTo(x, yy);
          c.lineTo(x, yy + podW);
          c.stroke();
        }
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.fillRect(x0, yy, podL, podW * 0.18);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x0, yy + podW * 0.85, podL, podW * 0.15);
        c.restore();
        c.lineWidth = d.px(1);
        c.strokeStyle = shade(colr, 0.25);
        c.stroke(pp);
      }
    }
  }
  // engine block
  const eb = rectPath(rear - 2, -(sw + 6), 12, (sw + 6) * 2, 2.5);
  hull(d, eb, mix(metal, '#333', 0.3), { H: sw + 6 });
  const nN = r.int(2, 3);
  const ys = nN === 2 ? [-(sw + 2), sw + 2] : [-(sw + 3), 0, sw + 3];
  for (const y of ys) nozzle(d, rear - 2, y, 2.6, '#3a3a3a');
  for (const y of ys) engine(d, rear - 3, y, 2.8, eng, 1.8);
  // bridge
  const bp = symSmooth([
    [front + 6, 0],
    [front + 3, sw * 0.9],
    [front - 6, sw + 3.5],
    [front - 15, sw + 3.5, 1],
    [front - 15, 0, 1],
  ]);
  hull(d, bp, mix(d.p, '#c8c8c8', 0.35), { H: sw + 4, x0: front - 15, x1: front + 6, gloss: 0.1 });
  // window strip
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    c.fillStyle = 'rgba(160,230,255,0.9)';
    c.fillRect(front + 0.5, t * (sw * 0.75) - 0.5, 1.5, 1);
  }
  c.restore();
  light(d, front - 6, 0, 1, '#ffffff', 0.6);
  // running lights at pod corners
  const lastY = sw + 0.8 + rows * (podW + 1.4) - 1.4;
  light(d, startX, lastY, 0.8, '#ffb040');
  light(d, startX, -lastY, 0.8, '#ffb040');
  light(d, endX, lastY, 0.8, '#ffb040');
  light(d, endX, -lastY, 0.8, '#ffb040');
}

function drawZealot(d: D) {
  const { c, r } = d;
  const L = r.range(42, 48);
  const tail = -r.range(34, 40);
  const w = r.range(5.5, 8);
  const gold = mix(d.s, '#e8c070', 0.3);
  const eng = glowCol(mix(d.s, '#fff2c0', 0.5), 0.75);

  // blades (behind body)
  const nF = r.int(2, 3);
  for (let i = 0; i < nF; i++) {
    const rx = 18 - i * r.range(14, 20);
    const reach = w + r.range(14, 30) * (1 - i * 0.15);
    const back = r.range(12, 22);
    const chord = r.range(6, 10);
    const blade: P[] = [
      [rx, w * 0.5],
      [rx - back, reach],
      [rx - back - chord * 0.6, reach - chord * 0.3],
      [rx - back * 0.6 - chord, w + (reach - w) * 0.4],
      [rx - chord * 1.6, w * 0.5],
    ];
    const bp = symPoly(blade);
    hull(d, bp, i % 2 ? d.p : gold, { H: reach, x0: rx - back, x1: rx, gloss: 0.2 });
    c.save();
    c.strokeStyle = shade(gold, 1.3, 0.6);
    c.lineWidth = d.px(0.8);
    for (const sgn of [1, -1]) {
      c.beginPath();
      c.moveTo(rx - 3, sgn * w * 0.6);
      c.lineTo(rx - back, sgn * reach);
      c.stroke();
    }
    c.restore();
  }
  // forward prongs
  if (r.chance(0.6)) {
    const py = w + r.range(2, 5);
    const pp = symPoly([
      [L - r.range(4, 10), py],
      [L - 22, py + 2.2],
      [L - 26, py - 0.5],
    ]);
    hull(d, pp, gold, { H: py + 3 });
  }
  // rear spires (cathedral fins)
  const sh = r.range(6, 11);
  const rs = symPoly([
    [tail + 14, w * 0.9],
    [tail - 6, w + sh],
    [tail - 2, w + sh * 0.55],
    [tail + 4, w * 0.9],
  ]);
  hull(d, rs, gold, { H: w + sh, gloss: 0.2 });
  // body spire
  const bp = symSmooth([
    [L, 0, 1],
    [L - 16, w * 0.45],
    [L - 30, w],
    [0, w * 1.15],
    [tail + 12, w * 1.35],
    [tail, w * 0.7, 1],
    [tail, 0, 1],
  ]);
  hull(d, bp, d.p, { H: w * 1.3, x0: tail, x1: L, gloss: 0.12 });
  // nave ridge
  c.save();
  c.clip(bp);
  const rg = c.createLinearGradient(0, -2, 0, 2);
  rg.addColorStop(0, shade(gold, 1.3));
  rg.addColorStop(1, shade(gold, 0.6));
  c.fillStyle = rg;
  c.fillRect(tail, -1.1, L - tail - 6, 2.2);
  c.restore();
  // stained glass windows
  c.save();
  c.globalCompositeOperation = 'lighter';
  const wc = [glowCol(d.s), '#ff7050', '#80b0ff', '#ffe090'];
  for (let x = tail + 8; x < L - 22; x += 3.2) {
    const col = wc[r.int(0, wc.length - 1)];
    for (const sgn of [1, -1]) {
      c.fillStyle = rgba(col, 0.85);
      c.fillRect(x, sgn * w * 0.6 - 0.6, 1.4, 1.2);
    }
  }
  c.restore();
  // rose window
  const rx = r.range(-10, 4);
  const rr = w * 0.75;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(glowCol(d.s), 0.9);
  c.lineWidth = d.px(0.8);
  c.beginPath();
  c.arc(rx, 0, rr, 0, TAU);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.moveTo(rx, 0);
    c.lineTo(rx + Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.stroke();
  c.restore();
  light(d, rx, 0, rr * 0.5, glowCol(d.s), 0.9);
  // engines
  for (const y of [0, w * 0.65, -w * 0.65]) {
    engine(d, tail, y, y === 0 ? 2.6 : 1.8, eng, 2.4);
  }
  light(d, L - 2, 0, 0.8, eng);
}

function drawHive(d: D) {
  const { c, r } = d;
  const flesh = d.p;
  const bio = glowCol(d.s, 0.6);
  const nSeg = r.int(3, 4);
  const segs: { x: number; rx: number; ry: number }[] = [];
  const front = r.range(30, 38);
  const rear = -r.range(26, 32);
  for (let i = 0; i < nSeg; i++) {
    const t = i / (nSeg - 1); // 0 = head
    const x = front - t * (front - rear);
    const ry = (0.45 + t * 0.55) * r.range(10, 18) + (i === nSeg - 1 ? 4 : 0);
    const rx = ((front - rear) / (nSeg - 1)) * r.range(0.6, 0.85) + (i === nSeg - 1 ? 4 : 0);
    segs.push({ x, rx, ry });
  }
  const tail = segs[nSeg - 1];
  // tendrils trailing back
  const nT = r.int(2, 4);
  for (let i = 0; i < nT; i++) {
    const sy = tail.ry * r.range(0.2, 0.8);
    const sx = tail.x - tail.rx * 0.6;
    const ex = -r.range(46, 54);
    const ey = sy + r.range(-4, 16);
    tendril(
      d,
      [
        [sx, sy],
        [sx - r.range(5, 12), sy + r.range(-10, 10)],
        [ex + r.range(5, 12), ey + r.range(-10, 10)],
        [ex, ey],
      ],
      r.range(2.5, 4),
      0.3,
      mix(flesh, '#201020', 0.3),
    );
  }
  // claws from middle segments
  for (let i = 1; i < nSeg - 1; i++) {
    const s = segs[i];
    const bx = s.x;
    const by = s.ry * 0.8;
    const reach = r.range(12, 22);
    tendril(
      d,
      [
        [bx, by],
        [bx + r.range(-2, 4), by + reach * 0.7],
        [bx + reach * 0.4, by + reach * 0.9],
        [bx + reach * 0.75, by + reach * r.range(0.5, 0.8)],
      ],
      r.range(3, 4.5),
      0.4,
      mix(flesh, '#000', 0.2),
    );
  }
  // mandibles
  const head = segs[0];
  tendril(
    d,
    [
      [head.x + head.rx * 0.4, head.ry * 0.5],
      [head.x + head.rx + 4, head.ry * 0.9],
      [head.x + head.rx + 8, head.ry * 0.3],
      [head.x + head.rx + 9, head.ry * 0.05 + 1],
    ],
    3,
    0.3,
    mix(flesh, '#e8d8b0', 0.3),
  );
  // segments rear → front
  for (let i = nSeg - 1; i >= 0; i--) {
    const s = segs[i];
    const sp = ellipsePath(s.x, 0, s.rx, s.ry);
    const g = c.createRadialGradient(s.x + s.rx * 0.25, -s.ry * 0.3, 0, s.x, 0, Math.max(s.rx, s.ry) * 1.1);
    g.addColorStop(0, shade(flesh, 1.35));
    g.addColorStop(0.5, shade(flesh, 0.9));
    g.addColorStop(1, shade(flesh, 0.35));
    c.fillStyle = g;
    c.fill(sp);
    // chitin plate arcs
    c.save();
    c.clip(sp);
    for (let j = 1; j <= 3; j++) {
      c.beginPath();
      c.ellipse(s.x + s.rx * (0.25 * j), 0, s.rx * (1 - 0.15 * j), s.ry * 1.05, 0, Math.PI * 0.55, Math.PI * 1.45);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = d.px(1.1);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(s.x - s.rx, 0);
    c.lineTo(s.x + s.rx, 0);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.stroke();
    c.beginPath();
    c.ellipse(s.x, 0, s.rx * 0.8, s.ry * 0.75, 0, -Math.PI * 0.85, -Math.PI * 0.25);
    c.strokeStyle = 'rgba(255,255,240,0.25)';
    c.lineWidth = d.px(1.4);
    c.stroke();
    c.restore();
    c.lineWidth = d.px(1);
    c.strokeStyle = shade(flesh, 0.18);
    c.stroke(sp);
    // bio spots
    const nsp = r.int(1, 3);
    for (let j = 0; j < nsp; j++) {
      const a = r.range(0.3, 1.3);
      const x = s.x + Math.cos(a) * s.rx * 0.65 - s.rx * 0.2;
      const y = Math.sin(a) * s.ry * 0.7;
      const rad = r.range(0.6, 1.2);
      light(d, x, y, rad, bio, 0.8);
      light(d, x, -y, rad, bio, 0.8);
    }
  }
  // eyes
  const ne = r.int(1, 3);
  for (let i = 0; i < ne; i++) {
    const x = head.x + head.rx * r.range(0.1, 0.6);
    const y = head.ry * r.range(0.25, 0.6);
    for (const sgn of [1, -1]) {
      c.fillStyle = '#0a0508';
      c.beginPath();
      c.arc(x, y * sgn, 1.3, 0, TAU);
      c.fill();
      light(d, x, y * sgn, 0.7, bio, 1);
    }
  }
  // gas-sac drive glow
  engine(d, tail.x - tail.rx * 0.85, 0, tail.ry * 0.35, bio, 1.6);
}

function drawMachine(d: D) {
  const { c, r } = d;
  const metal = mix(d.p, '#5a606a', 0.4);
  const trace = glowCol(d.s, 0.6);
  const core = r.range(-6, 6);
  const R = r.range(12, 16);
  const parts: Path2D[] = [];

  // modules & struts
  const nMod = r.int(1, 2);
  for (let i = 0; i < nMod; i++) {
    const mx = core + r.range(-22, 14);
    const my = r.range(19, 30);
    const ms = r.range(5.5, 9);
    const strut = symPoly([
      [mx + 1.5, R * 0.4],
      [mx + 1.5, my],
      [mx - 1.5, my],
      [mx - 1.5, R * 0.4],
    ]);
    hull(d, strut, shade(metal, 0.7), { H: my });
    const shape = r.int(0, 2);
    for (const sgn of [1, -1]) {
      let path: Path2D;
      if (shape === 0) path = hexPath(mx, my * sgn, ms, Math.PI / 6);
      else if (shape === 1) path = rectPath(mx - ms, my * sgn - ms * 0.7, ms * 2, ms * 1.4, 1);
      else {
        path = new Path2D();
        path.moveTo(mx + ms * 1.4, my * sgn);
        path.lineTo(mx - ms * 0.6, my * sgn + ms);
        path.lineTo(mx - ms, my * sgn);
        path.lineTo(mx - ms * 0.6, my * sgn - ms);
        path.closePath();
      }
      hull(d, path, metal, { H: my + ms, outlinePx: 1.2 });
      parts.push(path);
      light(d, mx, my * sgn, 1, trace, 0.9);
    }
    if (r.chance(0.6)) {
      // gun barrels on modules
      for (const sgn of [1, -1]) {
        const gp = rectPath(mx, my * sgn - 0.9, ms + r.range(6, 12), 1.8);
        hull(d, gp, shade(metal, 0.6), { H: 2, bevel: 0 });
      }
    }
  }
  // rear engine block
  const ebW = r.range(8, 13);
  const eb = rectPath(-40, -ebW, 16 + core + 10, ebW * 2, 1);
  hull(d, eb, shade(metal, 0.85), { H: ebW });
  parts.push(eb);
  const nV = r.int(2, 4);
  const eng = glowCol(d.s, 0.6);
  for (let i = 0; i < nV; i++) {
    const y = -ebW + ((i + 0.5) / nV) * ebW * 2;
    nozzle(d, -40, y, Math.min(2.4, (ebW / nV) * 0.8), '#2a2a2a');
    engine(d, -41, y, Math.min(2.4, (ebW / nV) * 0.8), eng, 2);
  }
  // front
  const fType = r.int(0, 2);
  if (fType === 0) {
    const py = r.range(3, 6);
    for (const sgn of [1, -1]) {
      const pp = rectPath(core, sgn * py - 1.6, 46 - core, 3.2);
      hull(d, pp, metal, { H: py + 2 });
      parts.push(pp);
    }
    light(d, 45, 0, 1.4, trace, 0.8);
  } else if (fType === 1) {
    const fp = symPoly([
      [46, 0],
      [30, 5],
      [core + R * 0.6, R * 0.8],
      [core, R * 0.8],
      [core, 0],
    ]);
    hull(d, fp, metal, { H: R });
    parts.push(fp);
  } else {
    for (let i = 0; i < 3; i++) {
      const bx = core + R * 0.6 + i * 8;
      const bh = R * 0.75 * (1 - i * 0.22);
      const bp = rectPath(bx, -bh, 7, bh * 2, 0.6);
      hull(d, bp, shade(metal, 1 - i * 0.08), { H: bh });
      parts.push(bp);
    }
  }
  // core hex
  const cp = hexPath(core, 0, R, 0);
  hull(d, cp, metal, { H: R, outlinePx: 1.3, gloss: 0.08 });
  parts.push(cp);
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = d.px(1);
  c.stroke(hexPath(core, 0, R * 0.65, 0));
  // circuitry traces (symmetric)
  if (d.k > 0.25) {
    for (const part of parts) {
      c.save();
      c.clip(part);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(trace, 0.75);
      c.fillStyle = rgba(trace, 0.95);
      c.lineWidth = d.px(0.8);
      for (let t = 0; t < 3; t++) {
        let x = r.range(-44, 46);
        let y = r.range(0, 30);
        const pts: [number, number][] = [[x, y]];
        for (let s = 0; s < r.int(2, 4); s++) {
          const dir = r.int(0, 3);
          const len = r.range(3, 9);
          if (dir === 0) x += len;
          else if (dir === 1) x -= len;
          else if (dir === 2) {
            x += len * 0.7;
            y += len * 0.7 * r.pick([1, -1]);
          } else y += len * r.pick([1, -1]);
          pts.push([x, y]);
        }
        for (const sgn of [1, -1]) {
          c.beginPath();
          c.moveTo(pts[0][0], pts[0][1] * sgn);
          for (const p of pts) c.lineTo(p[0], p[1] * sgn);
          c.stroke();
          const e = pts[pts.length - 1];
          c.beginPath();
          c.arc(e[0], e[1] * sgn, d.px(1.1), 0, TAU);
          c.fill();
        }
      }
      c.restore();
    }
  }
  // sensor eye
  c.fillStyle = '#08080a';
  c.beginPath();
  c.arc(core + R * 0.2, 0, R * 0.32, 0, TAU);
  c.fill();
  light(d, core + R * 0.2, 0, R * 0.16, glowCol(d.s, 0.55), 1.1);
}

function drawRaider(d: D) {
  const { c, r } = d;
  const rust = mix(d.p, '#6b4a35', 0.35);
  const base: [number, number][] = [
    [44, 0],
    [32, 5],
    [20, 7],
    [12, r.range(18, 26)],
    [2, r.range(24, 30)],
    [-4, r.range(12, 16)],
    [-22, r.range(12, 16)],
    [-30, r.range(18, 24)],
    [-40, r.range(10, 14)],
    [-36, 0],
  ];
  const top: [number, number][] = base.map(([x, y]) => [x + r.range(-2.5, 2.5), y + r.range(-2, 2)]);
  const bot: [number, number][] = base.map(([x, y]) => [x + r.range(-2.5, 2.5), y + r.range(-2, 2)]);
  // jagged notches
  const hp = new Path2D();
  hp.moveTo(top[0][0], 0);
  for (let i = 1; i < top.length - 1; i++) {
    const [x, y] = top[i];
    hp.lineTo(x, y);
    if (r.chance(0.35)) hp.lineTo(x - r.range(2, 4), y - r.range(1.5, 4));
  }
  hp.lineTo(top[top.length - 1][0], 0);
  for (let i = bot.length - 2; i >= 1; i--) {
    const [x, y] = bot[i];
    if (r.chance(0.35)) hp.lineTo(x - r.range(2, 4), -y + r.range(1.5, 4));
    hp.lineTo(x, -y);
  }
  hp.closePath();

  // ram spikes
  for (let i = 0; i < r.int(1, 3); i++) {
    const y = r.range(-6, 6);
    const sp = polyPath([
      [30, y - 2],
      [52 - Math.abs(y), y + r.range(-1.5, 1.5)],
      [30, y + 2],
    ]);
    hull(d, sp, '#8a8a8a', { H: 6, bevel: 0 });
  }
  // gun on one side (asymmetric)
  const gy = r.pick([1, -1]) * r.range(10, 20);
  const gp = rectPath(-6, gy - 1.4, r.range(30, 42), 2.8, 0.5);
  hull(d, gp, '#55585e', { H: Math.abs(gy) + 2, bevel: 0 });

  hull(d, hp, rust, { H: 26, x0: -40, x1: 44 });
  // salvaged plates
  c.save();
  c.clip(hp);
  const plateCols = [d.s, mix(d.p, '#999', 0.5), '#6a6d70', mix(d.s, '#553', 0.5), '#8a5a3a'];
  for (let i = 0; i < r.int(4, 7); i++) {
    const x = r.range(-34, 30);
    const y = r.range(-24, 24);
    const w = r.range(6, 16);
    const h = r.range(4, 10);
    const col = r.pick(plateCols);
    const pp = polyPath([
      [x, y],
      [x + w, y + r.range(-2, 2)],
      [x + w + r.range(-2, 2), y + h],
      [x + r.range(-2, 2), y + h + r.range(-1, 1)],
    ]);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(col, 1.1));
    g.addColorStop(1, shade(col, 0.6));
    c.fillStyle = g;
    c.fill(pp);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = d.px(0.8);
    c.stroke(pp);
    c.fillStyle = 'rgba(30,25,20,0.8)';
    for (const [rx, ry] of [
      [x + 1, y + 1],
      [x + w - 1, y + 1],
      [x + 1, y + h - 1],
    ]) {
      c.beginPath();
      c.arc(rx, ry, 0.45, 0, TAU);
      c.fill();
    }
  }
  // hazard stripes
  const hy = r.pick([1, -1]) * r.range(14, 22);
  const hx = r.range(-28, 0);
  c.save();
  c.beginPath();
  c.rect(hx, hy - 2.5, 14, 5);
  c.clip();
  c.fillStyle = '#e8b830';
  c.fillRect(hx, hy - 2.5, 14, 5);
  c.fillStyle = '#1a1a1a';
  for (let x = hx - 6; x < hx + 16; x += 3) {
    c.beginPath();
    c.moveTo(x, hy + 2.5);
    c.lineTo(x + 1.5, hy + 2.5);
    c.lineTo(x + 6.5, hy - 2.5);
    c.lineTo(x + 5, hy - 2.5);
    c.closePath();
    c.fill();
  }
  c.restore();
  // scorch
  for (let i = 0; i < r.int(2, 4); i++) {
    const x = r.range(-30, 30);
    const y = r.range(-20, 20);
    const R = r.range(4, 9);
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(10,8,6,0.6)');
    g.addColorStop(1, 'rgba(10,8,6,0)');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
  }
  c.restore();
  grime(d, hp, -40, 44, 28, 60, 0.25);
  c.lineWidth = d.px(1.2);
  c.strokeStyle = shade(rust, 0.2);
  c.stroke(hp);
  // cockpit off-centre
  glass(d, r.range(16, 24), r.range(-2.5, 2.5), r.range(4, 6), r.range(2.2, 3.2), '#ffb070');
  // mismatched engines
  const eng = glowCol('#ff7a30', 0.6);
  const e1 = r.range(3, 4.2);
  const e2 = r.range(1.8, 2.8);
  const ey = r.range(5, 9);
  nozzle(d, -37, ey, e1, '#333');
  nozzle(d, -38, -ey, e2, '#444');
  engine(d, -38, ey, e1, eng, 2.2);
  engine(d, -39, -ey, e2, mix(eng, '#ffd060', 0.4), 1.8);
}

function drawAncient(d: D) {
  const { c, r } = d;
  const pearl = mix(d.p, '#e8e4f0', 0.35);
  const glyphC = glowCol(d.s, 0.68);
  aura(d, 0, 0, 55, glyphC, 0.14);
  const R1 = r.range(36, 41);
  const cx = -42 + R1;
  const R2 = R1 * r.range(0.8, 0.9);
  const off = R1 * r.range(0.3, 0.45);

  const crescent = (cxx: number, R: number, Ri: number, o: number, col: string) => {
    const outer = ellipsePath(cxx, 0, R, R);
    c.save();
    c.clip(outer);
    const p = new Path2D();
    p.rect(-60, -60, 120, 120);
    p.arc(cxx + o, 0, Ri, 0, TAU);
    const g = c.createRadialGradient(cxx - R * 0.4, -R * 0.35, 0, cxx, 0, R * 1.1);
    g.addColorStop(0, shade(col, 1.45));
    g.addColorStop(0.55, shade(col, 0.95));
    g.addColorStop(1, shade(col, 0.4));
    c.fillStyle = g;
    c.fill(p, 'evenodd');
    // edge lines
    c.lineWidth = d.px(1.1);
    c.strokeStyle = shade(col, 0.25);
    c.beginPath();
    c.arc(cxx + o, 0, Ri, 0, TAU);
    c.stroke();
    // inner glow seam
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(glyphC, 0.35);
    c.lineWidth = d.px(1);
    c.beginPath();
    c.arc(cxx + o * 0.5, 0, (R + Ri) / 2 - o * 0.1, Math.PI * 0.55, Math.PI * 1.45);
    c.stroke();
    c.restore();
    // outer outline clipped to outside of inner circle
    c.save();
    const ex = new Path2D();
    ex.rect(-60, -60, 120, 120);
    ex.arc(cxx + o, 0, Ri, 0, TAU);
    c.clip(ex, 'evenodd');
    c.lineWidth = d.px(1.1);
    c.strokeStyle = shade(col, 0.25);
    c.stroke(outer);
    c.restore();
  };
  crescent(cx, R1, R2, off, pearl);
  // central lens body
  const bodyL = r.range(26, 34);
  const bodyW = r.range(5, 8);
  const bx0 = cx - R1 * 0.55;
  const lens = symSmooth([
    [bx0 + bodyL + 14, 0, 1],
    [bx0 + bodyL, bodyW * 0.8],
    [bx0 + bodyL * 0.4, bodyW],
    [bx0, bodyW * 0.6],
    [bx0 - 3, 0],
  ]);
  hull(d, lens, mix(pearl, d.s, 0.15), { H: bodyW, x0: bx0, x1: bx0 + bodyL + 14, gloss: 0.2, bevel: 0.6 });
  if (r.chance(0.5)) {
    const R3 = R1 * 0.45;
    crescent(bx0 + bodyL * 0.6, R3, R3 * 0.82, R3 * 0.4, shade(pearl, 0.9));
  }
  // seam & core
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(glyphC, 0.8);
  c.lineWidth = d.px(0.9);
  c.beginPath();
  c.moveTo(bx0 + 2, 0);
  c.lineTo(bx0 + bodyL + 8, 0);
  c.stroke();
  c.restore();
  light(d, bx0 + bodyL * 0.55, 0, bodyW * 0.45, glyphC, 1);
  // glyphs along crescent
  const midR = (R1 + (R2 - off)) / 2;
  const ng = r.int(2, 4);
  for (let i = 0; i < ng; i++) {
    const a = Math.PI * (0.55 + 0.35 * ((i + 0.5) / ng));
    const gx = cx + Math.cos(a) * midR * 0.98;
    const gy = Math.sin(a) * midR * 0.98;
    glyphPair(d, gx, gy, Math.max(2.4, (R1 - R2 + off) * 0.28), glyphC);
  }
  // soft drives on crescent back
  for (const y of [-R1 * 0.4, R1 * 0.4]) engine(d, cx - Math.sqrt(R1 * R1 - y * y) + 2, y, 2.2, glyphC, 1.6);
}

function drawWarden(d: D) {
  const { c, r } = d;
  const dark = rgbToHsl(...parseColor(d.p))[2] < 0.55;
  const edge = dark ? '#e8e8ee' : '#101014';
  const eye = r.chance(0.7) ? '#ff2a3a' : glowCol(d.s, 0.6);
  const variant = r.int(0, 2);
  let half: P[];
  if (variant === 0) {
    half = [
      [46, 0],
      [-30, r.range(28, 36)],
      [-38, r.range(20, 28)],
      [-30, 0],
    ];
  } else if (variant === 1) {
    half = [
      [46, 0],
      [20, 10],
      [-36, r.range(16, 22)],
      [-36, 0],
    ];
  } else {
    half = [
      [44, 0],
      [8, r.range(22, 28)],
      [-24, r.range(22, 28)],
      [-38, 8],
      [-34, 0],
    ];
  }
  const full = mirrorList(half);
  const p = polyPath(full);
  // facets: upper half lit, lower half shadow
  const H = 36;
  c.save();
  c.clip(p);
  const g1 = c.createLinearGradient(46, -H, -38, 0);
  g1.addColorStop(0, dark ? '#4a4c58' : '#f4f4f8');
  g1.addColorStop(0.5, dark ? '#26272e' : '#d8d9de');
  g1.addColorStop(1, dark ? '#16171c' : '#b8b9c0');
  c.fillStyle = g1;
  c.fillRect(-60, -60, 120, 60);
  const g2 = c.createLinearGradient(46, 0, -38, H);
  g2.addColorStop(0, dark ? '#141519' : '#a8a9b0');
  g2.addColorStop(1, dark ? '#08080a' : '#7a7b82');
  c.fillStyle = g2;
  c.fillRect(-60, 0, 120, 60);
  c.restore();
  // ridge
  c.strokeStyle = rgba(edge, 0.25);
  c.lineWidth = d.px(0.8);
  c.beginPath();
  c.moveTo(half[0][0], 0);
  c.lineTo(half[half.length - 1][0], 0);
  c.stroke();
  // inset outline
  c.save();
  c.translate(2, 0);
  c.scale(0.82, 0.82);
  c.strokeStyle = rgba(edge, 0.35);
  c.lineWidth = d.px(0.8) / 0.82;
  c.stroke(p);
  c.restore();
  c.lineWidth = d.px(1.2);
  c.strokeStyle = dark ? 'rgba(200,200,210,0.7)' : 'rgba(10,10,14,0.9)';
  c.stroke(p);
  // engine slit
  const rx = half[half.length - 1][0];
  c.save();
  c.globalCompositeOperation = 'lighter';
  const sg = c.createLinearGradient(rx - 8, 0, rx + 1, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(1, 'rgba(255,255,255,0.8)');
  c.fillStyle = sg;
  c.fillRect(rx - 8, -6, 9, 12);
  c.restore();
  c.fillStyle = '#ffffff';
  c.fillRect(rx - 0.5, -5, 1.2, 10);
  // eye
  const ex = r.range(8, 20);
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(ex, 0, 4.2, 2.6, 0, 0, TAU);
  c.fill();
  c.save();
  c.globalCompositeOperation = 'lighter';
  const fg = c.createLinearGradient(ex - 18, 0, ex + 18, 0);
  fg.addColorStop(0, rgba(eye, 0));
  fg.addColorStop(0.5, rgba(eye, 0.7));
  fg.addColorStop(1, rgba(eye, 0));
  c.fillStyle = fg;
  c.fillRect(ex - 18, -0.5, 36, 1);
  c.restore();
  light(d, ex, 0, 2, eye, 1.2);
}

function drawMonster(d: D) {
  const { c, r } = d;
  const skin = d.p;
  const bio = glowCol(d.s, 0.6);
  const type = r.int(0, 2);
  let body: Path2D;
  let H = 20;
  let eyeX = 20;
  let eyeY = 6;
  if (type === 0) {
    // manta
    const span = r.range(36, 46);
    const wingX = r.range(-6, 6);
    tendril(
      d,
      [
        [-20, 0],
        [-32, r.range(-2, 2)],
        [-42, r.range(-4, 4)],
        [-55, 0],
      ],
      4,
      0.3,
      shade(skin, 0.7),
      false,
    );
    body = symSmooth([
      [34, 0],
      [30, 7],
      [18, 12],
      [wingX, span],
      [wingX - 10, span - 2],
      [-14, 14],
      [-24, 5],
      [-26, 0],
    ]);
    H = span;
    eyeX = 24;
    eyeY = 8;
    // cephalic horns
    tendril(
      d,
      [
        [30, 6],
        [38, 8],
        [42, 6],
        [44, 3],
      ],
      3,
      0.4,
      shade(skin, 0.8),
    );
  } else if (type === 1) {
    // squid: mantle forward, tentacles trailing
    const nT = r.int(3, 4);
    for (let i = 0; i < nT; i++) {
      const sy = 2 + i * 2.2;
      tendril(
        d,
        [
          [-2, sy],
          [-18, sy + r.range(-6, 10)],
          [-34, sy + r.range(-10, 14)],
          [-r.range(48, 56), sy + r.range(-6, 18)],
        ],
        r.range(2.5, 4),
        0.3,
        mix(skin, '#c080a0', 0.3),
      );
    }
    body = symSmooth([
      [48, 0, 1],
      [36, 6],
      [26, 18],
      [18, 13],
      [6, 13],
      [-6, 9],
      [-8, 0],
    ]);
    H = 18;
    eyeX = 0;
    eyeY = 7;
  } else {
    // serpent: segments with fins & jaws
    const segN = 7;
    for (let i = segN - 1; i >= 0; i--) {
      const t = i / (segN - 1);
      const x = 30 - t * 74;
      const R = 13 * (1 - t * 0.7);
      if (i % 2 === 1) {
        tendril(
          d,
          [
            [x, R * 0.6],
            [x - 3, R + 6],
            [x - 8, R + 9],
            [x - 12, R + 8],
          ],
          3,
          0.3,
          shade(skin, 0.6),
        );
      }
      const sp = ellipsePath(x, 0, R * 1.05, R);
      hull(d, sp, skin, { H: R, bevel: 0.5 });
      c.fillStyle = shade(skin, 0.4, 0.6);
      c.fillRect(x - R * 0.5, -0.6, R, 1.2);
    }
    // jaws
    for (const sgn of [1, -1]) {
      const jp = new Path2D();
      jp.moveTo(36, sgn * 4);
      jp.quadraticCurveTo(48, sgn * 10, 52, sgn * 2);
      jp.quadraticCurveTo(46, sgn * 5, 38, sgn * 1);
      jp.closePath();
      hull(d, jp, mix(skin, '#ddd0b0', 0.5), { H: 10, bevel: 0 });
    }
    body = ellipsePath(34, 0, 12, 10);
    H = 12;
    eyeX = 36;
    eyeY = 5;
  }
  const g = c.createRadialGradient(eyeX - 6, -H * 0.3, 0, 0, 0, H * 1.6);
  g.addColorStop(0, shade(skin, 1.3));
  g.addColorStop(0.5, shade(skin, 0.85));
  g.addColorStop(1, shade(skin, 0.35));
  c.fillStyle = g;
  c.fill(body);
  // skin pattern
  c.save();
  c.clip(body);
  for (let i = 0; i < 40; i++) {
    const x = r.range(-30, 50);
    const y = r.range(0, H);
    const rad = r.range(0.4, 1.8);
    for (const sgn of [1, -1]) {
      c.fillStyle = `rgba(0,0,0,${r.range(0.08, 0.25)})`;
      c.beginPath();
      c.arc(x, y * sgn, rad, 0, TAU);
      c.fill();
    }
  }
  // bioluminescent lines
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(bio, 0.55);
  c.lineWidth = d.px(1.1);
  for (let i = 0; i < r.int(2, 3); i++) {
    const y = r.range(3, H * 0.8);
    const x0 = r.range(-20, 10);
    for (const sgn of [1, -1]) {
      c.beginPath();
      c.moveTo(x0, sgn * y * 0.5);
      c.quadraticCurveTo(x0 + 10, sgn * y, x0 + 22, sgn * y * 0.7);
      c.stroke();
    }
  }
  c.restore();
  c.lineWidth = d.px(1.1);
  c.strokeStyle = shade(skin, 0.18);
  c.stroke(body);
  // spots
  for (let i = 0; i < r.int(3, 6); i++) {
    const x = r.range(-20, 30);
    const y = r.range(2, H * 0.6);
    const rad = r.range(0.5, 1);
    light(d, x, y, rad, bio, 0.8);
    light(d, x, -y, rad, bio, 0.8);
  }
  // eyes
  for (const sgn of [1, -1]) {
    c.fillStyle = '#050304';
    c.beginPath();
    c.ellipse(eyeX, eyeY * sgn, 2.6, 1.8, 0, 0, TAU);
    c.fill();
    light(d, eyeX + 0.4, eyeY * sgn, 1, r.chance(0.5) ? '#ffd040' : bio, 1);
  }
}

function drawDrone(d: D) {
  const { c, r } = d;
  const type = r.int(0, 2);
  const metal = mix(d.p, '#666', 0.3);
  const lc = glowCol(d.s, 0.6);
  const armY = r.range(18, 26);
  // arms
  const arm = symPoly([
    [6, 4],
    [4, armY],
    [-6, armY],
    [-8, 4],
  ]);
  hull(d, arm, shade(metal, 0.7), { H: armY, outlinePx: 1.5 });
  for (const sgn of [1, -1]) {
    const pp = rectPath(-12, sgn * armY - 6, 20, 12, 4);
    hull(d, pp, metal, { H: armY + 6, outlinePx: 1.5 });
  }
  let core: Path2D;
  if (type === 0) {
    core = symPoly([
      [34, 0],
      [0, 18],
      [-22, 0],
    ]);
  } else if (type === 1) {
    core = ellipsePath(2, 0, 20, 18);
  } else {
    core = symPoly([
      [34, 0],
      [-14, 20],
      [-24, 10],
      [-24, 0],
    ]);
  }
  hull(d, core, d.p, { H: 20, outlinePx: 1.5, gloss: 0.1 });
  c.fillStyle = '#0a0a0c';
  c.beginPath();
  c.arc(8, 0, 6, 0, TAU);
  c.fill();
  light(d, 8, 0, 3.5, lc, 1.2);
  engine(d, -22, 0, 5, lc, 1.6);
}

const STYLE_DRAW: Record<ShipStyle, (d: D) => void> = {
  player: drawPlayer,
  mercantile: drawMercantile,
  zealot: drawZealot,
  hive: drawHive,
  machine: drawMachine,
  raider: drawRaider,
  ancient: drawAncient,
  warden: drawWarden,
  monster: drawMonster,
  drone: drawDrone,
};

export function makeShipSprite(o: {
  seed: number;
  style: ShipStyle;
  size: number;
  primary: string;
  secondary: string;
}): HTMLCanvasElement {
  const { cv, d } = setup(o.size, hashSeed(o.seed, o.style), o.primary, o.secondary);
  (STYLE_DRAW[o.style] ?? drawPlayer)(d);
  return cv;
}

// ---------------------------------------------------------------- bosses

function bossLeviathan(d: D) {
  const { c, r } = d;
  const skin = '#2a5a6e';
  const belly = '#5aa0a8';
  const bio = '#7ff0ff';
  // tail flukes
  const fl = symSmooth([
    [-30, 0],
    [-40, 6],
    [-52, 22],
    [-48, 24],
    [-44, 10],
    [-46, 0],
  ]);
  hull(d, fl, shade(skin, 0.8), { H: 24 });
  // pectoral fins
  for (const fx of [14, -10]) {
    const fp = symSmooth([
      [fx + 6, 12],
      [fx - 6, fx > 0 ? 40 : 28],
      [fx - 14, fx > 0 ? 38 : 26],
      [fx - 8, 12],
    ]);
    hull(d, fp, mix(skin, '#1a2a40', 0.3), { H: 40, bevel: 0.5 });
    c.save();
    c.clip(fp);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = d.px(1);
    for (let i = 0; i < 5; i++) {
      for (const sgn of [1, -1]) {
        c.beginPath();
        c.moveTo(fx, sgn * 12);
        c.lineTo(fx - 6 - i * 2, sgn * (fx > 0 ? 40 : 28));
        c.stroke();
      }
    }
    c.restore();
  }
  // body
  const body = symSmooth([
    [50, 0],
    [46, 9],
    [30, 17],
    [8, 19],
    [-14, 15],
    [-30, 7],
    [-36, 0],
  ]);
  hull(d, body, skin, { H: 19, x0: -36, x1: 50, gloss: 0.05 });
  c.save();
  c.clip(body);
  // belly/back stripe & ridged bone plates
  const bg = c.createLinearGradient(0, -6, 0, 6);
  bg.addColorStop(0, rgba(belly, 0));
  bg.addColorStop(0.5, rgba(belly, 0.35));
  bg.addColorStop(1, rgba(belly, 0));
  c.fillStyle = bg;
  c.fillRect(-40, -6, 92, 12);
  for (let x = -28; x < 36; x += 5) {
    const w = 3 + 2 * Math.sin((x + 30) / 20);
    const pp = polyPath([
      [x + 3, 0],
      [x - 1, w],
      [x - 2, 0],
      [x - 1, -w],
    ]);
    c.fillStyle = '#c8c0a8';
    c.fill(pp);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = d.px(0.8);
    c.stroke(pp);
  }
  // barnacles / speckles
  for (let i = 0; i < 90; i++) {
    const x = r.range(-34, 46);
    const y = r.range(5, 18);
    const rad = r.range(0.3, 1.3);
    for (const sgn of [1, -1]) {
      c.fillStyle = `rgba(0,0,0,${r.range(0.1, 0.3)})`;
      c.beginPath();
      c.arc(x, y * sgn, rad, 0, TAU);
      c.fill();
    }
  }
  c.restore();
  // bioluminescent row
  for (let x = -26; x < 40; x += 4) {
    const y = 11 + 4 * Math.sin((x + 26) / 22);
    light(d, x, y, 0.7, bio, 0.9);
    light(d, x, -y, 0.7, bio, 0.9);
  }
  // mouth & baleen glow
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(bio, 0.6);
  c.lineWidth = d.px(1.2);
  for (const sgn of [1, -1]) {
    c.beginPath();
    c.moveTo(50, 0);
    c.quadraticCurveTo(44, sgn * 7, 34, sgn * 9);
    c.stroke();
  }
  c.restore();
  // eyes
  for (const sgn of [1, -1]) {
    c.fillStyle = '#020306';
    c.beginPath();
    c.ellipse(34, sgn * 11.5, 2.2, 1.4, 0, 0, TAU);
    c.fill();
    light(d, 34.5, sgn * 11.5, 0.9, '#ffe080', 1.2);
  }
  // crystal growths
  for (let i = 0; i < 4; i++) {
    const x = r.range(-20, 20);
    const y = r.range(14, 18);
    for (const sgn of [1, -1]) {
      const cp = polyPath([
        [x + 2, sgn * (y - 1)],
        [x - 2, sgn * (y + 4)],
        [x - 3, sgn * y],
      ]);
      hull(d, cp, '#8ad8e8', { H: 20, bevel: 0, outlinePx: 0.8 });
      light(d, x - 1, sgn * (y + 1.5), 0.6, '#a0f8ff', 0.6);
    }
  }
  aura(d, 10, 0, 50, bio, 0.06);
}

function bossDreadnought(d: D) {
  const { c } = d;
  const steel = '#5a616e';
  const red = '#c83a32';
  // flanking hangar wings
  const wing = symPoly([
    [10, 14],
    [-6, 30],
    [-34, 30],
    [-40, 22],
    [-40, 12],
  ]);
  hull(d, wing, shade(steel, 0.75), { H: 30 });
  panels(d, wing, 10, -40, 10, 30, 0.35);
  // hangar bays
  for (let i = 0; i < 3; i++) {
    for (const sgn of [1, -1]) {
      const x = -32 + i * 9;
      c.fillStyle = '#0a0b0e';
      c.fillRect(x, sgn > 0 ? 22 : -27, 6, 5);
      light(d, x + 3, sgn * 24.5, 0.6, '#ffb060', 0.6);
    }
  }
  // main hull
  const body = symPoly([
    [52, 0],
    [40, 6],
    [20, 12],
    [-30, 16],
    [-44, 14],
    [-44, 0],
  ]);
  hull(d, body, steel, { H: 16, x0: -44, x1: 52, outlinePx: 1.3 });
  panels(d, body, 26, -44, 50, 16, 0.35);
  grime(d, body, -44, 52, 16, 120, 0.2);
  // red stripe
  c.save();
  c.clip(body);
  c.fillStyle = shade(red, 0.9);
  c.fillRect(-44, 9, 70, 1.6);
  c.fillRect(-44, -10.6, 70, 1.6);
  c.restore();
  // superstructure tiers
  const tiers: [number, number, number][] = [
    [-30, 22, 9],
    [-22, 8, 6.5],
    [-16, -2, 4],
  ];
  for (const [x0, x1, h] of tiers) {
    const tp = symPoly([
      [x1 + 4, 0],
      [x1, h],
      [x0, h],
      [x0 - 2, 0],
    ]);
    hull(d, tp, shade(steel, 1.12), { H: h, x0, x1 });
  }
  // bridge lights
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(160,220,255,0.9)';
  for (let y = -3; y <= 3; y += 1.5) c.fillRect(-1.5, y - 0.3, 1, 0.6);
  c.restore();
  // turrets
  const turret = (x: number, y: number, R: number) => {
    const bp = rectPath(x, y - R * 0.22, R * 2.4, R * 0.18);
    const bp2 = rectPath(x, y + R * 0.04, R * 2.4, R * 0.18);
    hull(d, bp, '#2c2f36', { H: R, bevel: 0 });
    hull(d, bp2, '#2c2f36', { H: R, bevel: 0 });
    const tp = ellipsePath(x, y, R, R);
    const g = c.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
    g.addColorStop(0, shade(steel, 1.5));
    g.addColorStop(1, shade(steel, 0.5));
    c.fillStyle = g;
    c.fill(tp);
    c.strokeStyle = '#0c0d10';
    c.lineWidth = d.px(1);
    c.stroke(tp);
  };
  turret(30, 0, 4);
  turret(18, 0, 4.2);
  for (const sgn of [1, -1]) {
    turret(4, sgn * 11, 3);
    turret(-12, sgn * 13, 3);
    turret(-24, sgn * 26, 2.5);
  }
  // engines
  for (const y of [-10, -4, 4, 10]) {
    nozzle(d, -45, y, 2.6, '#2a2a2e');
    engine(d, -46, y, 2.8, '#ff9050', 2);
  }
  for (const y of [-24, 24]) {
    nozzle(d, -41, y, 2.4, '#2a2a2e');
    engine(d, -42, y, 2.4, '#ff9050', 1.8);
  }
  light(d, 50, 0, 1, '#ff3030', 1);
}

function bossWardenPrime(d: D) {
  const { c, r } = d;
  const black = '#111217';
  const eye = '#ff2238';
  // broken ring
  c.save();
  c.lineWidth = 3.2;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + 0.12;
    const a1 = a0 + TAU / 6 - 0.24;
    c.strokeStyle = '#d8d8de';
    c.beginPath();
    c.arc(0, 0, 44, a0, a1);
    c.stroke();
    c.strokeStyle = '#0b0b0e';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, 44, a0, a1);
    c.stroke();
    c.lineWidth = 3.2;
  }
  c.restore();
  // satellite shards
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * Math.PI - Math.PI / 2;
    for (const sgn of [1, -1]) {
      const x = Math.cos(a) * 36 - 6;
      const y = Math.sin(a) * 36 * sgn;
      c.save();
      c.translate(x, y);
      c.rotate(sgn * (a * 0.5));
      const sp = polyPath([
        [8, 0],
        [-5, 4],
        [-3, 0],
        [-5, -4],
      ]);
      hull(d, sp, black, { H: 4, outline: 'rgba(220,220,230,0.8)', bevel: 0 });
      c.restore();
    }
  }
  // nested chevrons
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.28;
    const half: P[] = [
      [46 * s, 0],
      [-28 * s, 32 * s],
      [-36 * s, 26 * s],
      [-26 * s, 0],
    ];
    const p = symPoly(half);
    c.save();
    c.clip(p);
    const g = c.createLinearGradient(40, -30, -30, 30);
    g.addColorStop(0, ['#55575f', '#3c3e46', '#2c2d34'][i]);
    g.addColorStop(0.5, '#1c1d22');
    g.addColorStop(1, '#070709');
    c.fillStyle = g;
    c.fillRect(-60, -60, 120, 120);
    c.restore();
    c.lineWidth = d.px(1.2);
    c.strokeStyle = i === 0 ? 'rgba(230,230,240,0.85)' : 'rgba(230,230,240,0.35)';
    c.stroke(p);
  }
  // white seams
  c.strokeStyle = 'rgba(240,240,250,0.5)';
  c.lineWidth = d.px(0.8);
  c.beginPath();
  c.moveTo(46, 0);
  c.lineTo(-26, 0);
  c.stroke();
  // engine slits
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const y of [-14, 0, 14]) {
    const g = c.createLinearGradient(-36, 0, -24, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.7)');
    c.fillStyle = g;
    c.fillRect(-36, y - 3, 12, 6);
  }
  c.restore();
  // giant eye
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(10, 0, 9, 5.5, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(230,230,240,0.6)';
  c.lineWidth = d.px(1);
  c.stroke();
  c.save();
  c.globalCompositeOperation = 'lighter';
  const fg = c.createLinearGradient(-30, 0, 50, 0);
  fg.addColorStop(0, rgba(eye, 0));
  fg.addColorStop(0.5, rgba(eye, 0.6));
  fg.addColorStop(1, rgba(eye, 0));
  c.fillStyle = fg;
  c.fillRect(-30, -0.6, 80, 1.2);
  c.restore();
  light(d, 10, 0, 4.2, eye, 1.4);
  aura(d, 10, 0, 30, eye, 0.12);
  void r;
}

function bossHiveQueen(d: D) {
  const { c, r } = d;
  const flesh = '#6a3a6e';
  const chitin = '#3a2a40';
  const bio = '#a8ff60';
  // wings (translucent)
  for (const [ax, len, spread] of [
    [10, 46, 38],
    [4, 40, 46],
  ] as const) {
    const wp = symSmooth([
      [ax, 6],
      [ax - len * 0.3, spread],
      [ax - len, spread * 0.9],
      [ax - len * 0.8, spread * 0.5],
      [ax - 6, 8],
    ]);
    c.fillStyle = 'rgba(180,220,255,0.12)';
    c.fill(wp);
    c.strokeStyle = 'rgba(200,230,255,0.35)';
    c.lineWidth = d.px(1);
    c.stroke(wp);
    c.save();
    c.clip(wp);
    c.strokeStyle = 'rgba(200,230,255,0.2)';
    for (let i = 0; i < 6; i++) {
      for (const sgn of [1, -1]) {
        c.beginPath();
        c.moveTo(ax, sgn * 7);
        c.lineTo(ax - len * (0.3 + i * 0.12), sgn * spread * (1 - i * 0.05));
        c.stroke();
      }
    }
    c.restore();
  }
  // legs
  for (let i = 0; i < 4; i++) {
    const bx = 14 - i * 7;
    tendril(
      d,
      [
        [bx, 8],
        [bx + 6 - i * 3, 24],
        [bx + 10 - i * 6, 30 + i * 2],
        [bx + 16 - i * 10, 34 + i * 3],
      ],
      3,
      0.5,
      chitin,
    );
  }
  // abdomen
  const ab = ellipsePath(-24, 0, 24, 19);
  hull(d, ab, flesh, { H: 19, x0: -48, x1: 0 });
  c.save();
  c.clip(ab);
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.ellipse(-12 - i * 5, 0, 6, 20, 0, Math.PI * 0.5, Math.PI * 1.5);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = d.px(1.2);
    c.stroke();
  }
  c.restore();
  // egg sacs glowing
  for (let i = 0; i < 9; i++) {
    const x = r.range(-42, -10);
    const y = r.range(3, 15);
    const R = r.range(1.4, 2.6);
    for (const sgn of [1, -1]) {
      c.fillStyle = rgba(mix(bio, '#ffffff', 0.3), 0.35);
      c.beginPath();
      c.arc(x, y * sgn, R, 0, TAU);
      c.fill();
      light(d, x, y * sgn, R * 0.4, bio, 0.7);
    }
  }
  // thorax
  const th = ellipsePath(8, 0, 12, 10);
  hull(d, th, chitin, { H: 10, gloss: 0.15 });
  // head with crown
  const crown = symPoly([
    [26, 6],
    [30, 16],
    [24, 10],
    [20, 15],
    [18, 8],
  ]);
  hull(d, crown, mix(chitin, '#c0a0ff', 0.3), { H: 16 });
  const hd = symSmooth([
    [36, 0],
    [32, 6],
    [24, 9],
    [18, 7],
    [16, 0],
  ]);
  hull(d, hd, chitin, { H: 9, gloss: 0.2 });
  // mandibles
  tendril(
    d,
    [
      [33, 4],
      [42, 9],
      [46, 4],
      [47, 1],
    ],
    3.2,
    0.4,
    '#c8b890',
  );
  // eyes cluster
  for (const [x, y, R] of [
    [28, 3, 1.4],
    [25, 5.5, 1.1],
    [30, 6, 0.9],
    [22, 3, 0.9],
  ] as const) {
    for (const sgn of [1, -1]) {
      c.fillStyle = '#050205';
      c.beginPath();
      c.arc(x, y * sgn, R * 1.2, 0, TAU);
      c.fill();
      light(d, x, y * sgn, R * 0.6, '#ff4060', 1);
    }
  }
  engine(d, -47, 0, 6, bio, 1.4);
}

function bossChoirAvatar(d: D) {
  const { c, r } = d;
  const gold = '#f0c860';
  const white = '#fff6e0';
  aura(d, 0, 0, 58, gold, 0.22);
  // light rays
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const g = c.createLinearGradient(0, 0, Math.cos(a) * 56, Math.sin(a) * 56);
    g.addColorStop(0, 'rgba(255,240,200,0.25)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a - 0.04) * 56, Math.sin(a - 0.04) * 56);
    c.lineTo(Math.cos(a + 0.04) * 56, Math.sin(a + 0.04) * 56);
    c.closePath();
    c.fill();
  }
  c.restore();
  // halo rings with glyphs
  for (const [R, w] of [
    [44, 1.6],
    [36, 0.9],
  ] as const) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(gold, 0.85);
    c.lineWidth = w;
    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.stroke();
    c.restore();
  }
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 12) * TAU;
    glyphPair(d, Math.cos(a) * 40, Math.sin(a) * 40, 3, white);
  }
  // blade wings (seraphic) — 3 pairs
  for (let i = 0; i < 3; i++) {
    const ang = 0.6 + i * 0.6;
    for (const sgn of [1, -1]) {
      c.save();
      c.rotate(sgn * ang);
      const bp = polyPath([
        [8, 0],
        [16, -3],
        [44 - i * 4, 0],
        [16, 3],
      ]);
      const g = c.createLinearGradient(8, -3, 8, 3);
      g.addColorStop(0, shade(gold, 1.5));
      g.addColorStop(0.5, gold);
      g.addColorStop(1, shade(gold, 0.5));
      c.fillStyle = g;
      c.fill(bp);
      c.strokeStyle = 'rgba(80,50,10,0.9)';
      c.lineWidth = d.px(1);
      c.stroke(bp);
      c.restore();
    }
  }
  // forward spear blade
  const sp = symPoly([
    [52, 0],
    [16, 4],
    [10, 0],
  ]);
  hull(d, sp, gold, { H: 4, gloss: 0.3 });
  // core body: faceted diamond
  const core = symPoly([
    [18, 0],
    [0, 12],
    [-16, 0],
  ]);
  hull(d, core, mix(white, gold, 0.3), { H: 12, gloss: 0.3, outline: 'rgba(90,60,10,0.9)' });
  c.save();
  c.clip(core);
  c.fillStyle = 'rgba(120,80,20,0.25)';
  c.beginPath();
  c.moveTo(18, 0);
  c.lineTo(0, 12);
  c.lineTo(0, 0);
  c.fill();
  c.restore();
  light(d, 2, 0, 5, white, 1.5);
  aura(d, 2, 0, 18, white, 0.4);
  void r;
}

export function makeBossSprite(
  id: 'leviathan' | 'dreadnought' | 'warden_prime' | 'hive_queen' | 'choir_avatar',
  size: number,
  seed: number,
): HTMLCanvasElement {
  const { cv, d } = setup(size, hashSeed(seed, id), '#888', '#fff');
  switch (id) {
    case 'leviathan':
      bossLeviathan(d);
      break;
    case 'dreadnought':
      bossDreadnought(d);
      break;
    case 'warden_prime':
      bossWardenPrime(d);
      break;
    case 'hive_queen':
      bossHiveQueen(d);
      break;
    case 'choir_avatar':
      bossChoirAvatar(d);
      break;
  }
  return cv;
}
