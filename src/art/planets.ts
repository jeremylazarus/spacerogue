/** Procedural celestial bodies, stations, asteroids, derelicts and animated markers. */
import { RNG, hashSeed } from '../core/rng';
import { Noise2D, clamp, makeCanvas, mix, parseColor, rgba, shade, smoothstep, hslToRgb } from './noise';
import {
  aura,
  ellipsePath,
  glowCol,
  glyphPair,
  hexPath,
  hull,
  light,
  makeShipSprite,
  panels,
  rectPath,
  setup,
  symPoly,
  tendril,
  type D,
  type ShipStyle,
} from './ships';

export type PlanetKind = 'rocky' | 'ocean' | 'gas' | 'ice' | 'lava' | 'toxic' | 'barren' | 'crystal';

const TAU = Math.PI * 2;
type RGB = [number, number, number];
type Stops = [number, RGB][];

function ramp(stops: Stops, t: number, out: Float32Array, o = 0) {
  if (t <= stops[0][0]) {
    out[o] = stops[0][1][0];
    out[o + 1] = stops[0][1][1];
    out[o + 2] = stops[0][1][2];
    return;
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const f = (t - t0) / (t1 - t0);
      out[o] = a[0] + (b[0] - a[0]) * f;
      out[o + 1] = a[1] + (b[1] - a[1]) * f;
      out[o + 2] = a[2] + (b[2] - a[2]) * f;
      return;
    }
  }
  const l = stops[stops.length - 1][1];
  out[o] = l[0];
  out[o + 1] = l[1];
  out[o + 2] = l[2];
}

const hsl = (h: number, s: number, l: number): RGB => hslToRgb(h, s, l);

interface Crater {
  u: number;
  v: number;
  r: number;
}

// ------------------------------------------------------------------ planets

export function makePlanet(seed: number, kind: PlanetKind, radius: number): HTMLCanvasElement {
  const rng = new RNG(hashSeed(seed, kind, 'planet'));
  const nz = new Noise2D(rng.fork());
  const nz2 = new Noise2D(rng.fork());
  const R = Math.max(4, radius);
  const hasRings = kind === 'gas' ? rng.chance(0.45) : kind === 'ice' || kind === 'barren' ? rng.chance(0.08) : false;
  const S = Math.ceil(R * (hasRings ? 4.4 : 2.6));
  const [cv, ctx] = makeCanvas(S, S);
  const C = S / 2;
  const hue = rng.range(0, 360);
  const hv = rng.range(-25, 25);

  // palettes
  let stops: Stops = [];
  let atmo = '#8ab8ff';
  let atmoStrength = 0.6;
  let freq = rng.range(2.2, 3.2);
  let cloud = false;
  const craters: Crater[] = [];
  switch (kind) {
    case 'rocky': {
      const h0 = rng.pick([18, 28, 35, 10, 90]) + hv * 0.4;
      stops = [
        [0, hsl(h0, 0.35, 0.16)],
        [0.4, hsl(h0 + 5, 0.4, 0.32)],
        [0.55, hsl(h0 + 12, 0.35, 0.45)],
        [0.7, hsl(h0 - 6, 0.25, 0.55)],
        [1, hsl(h0, 0.1, 0.78)],
      ];
      atmo = rng.chance(0.5) ? '#ffb880' : '#a8c8ff';
      atmoStrength = 0.4;
      for (let i = 0; i < 10; i++) craters.push({ u: rng.range(-1.6, 1.6), v: rng.range(-1.3, 1.3), r: rng.range(0.04, 0.16) });
      break;
    }
    case 'ocean': {
      const oh = 205 + hv;
      stops = [
        [0, hsl(oh + 10, 0.7, 0.12)],
        [0.5, hsl(oh, 0.65, 0.3)],
        [0.56, hsl(oh - 15, 0.55, 0.48)],
        [0.58, hsl(45, 0.4, 0.6)],
        [0.62, hsl(100 + hv, 0.35, 0.33)],
        [0.75, hsl(80 + hv, 0.3, 0.28)],
        [0.85, hsl(30, 0.2, 0.4)],
        [1, hsl(0, 0, 0.9)],
      ];
      atmo = '#6ab8ff';
      atmoStrength = 0.9;
      cloud = true;
      break;
    }
    case 'gas': {
      const a = hsl(hue, rng.range(0.3, 0.6), 0.55);
      const b = hsl(hue + rng.range(15, 50), rng.range(0.3, 0.6), 0.35);
      const c2 = hsl(hue - rng.range(10, 40), 0.25, 0.75);
      const d2 = hsl(hue + 180 * rng.range(0, 0.3), 0.4, 0.45);
      stops = [
        [0, b],
        [0.25, a],
        [0.45, c2],
        [0.6, d2],
        [0.8, a],
        [1, c2],
      ];
      atmo = `rgb(${c2.join(',')})`;
      atmoStrength = 0.7;
      freq = 1;
      break;
    }
    case 'ice': {
      stops = [
        [0, hsl(205 + hv, 0.5, 0.45)],
        [0.45, hsl(200 + hv, 0.4, 0.7)],
        [0.7, hsl(195, 0.3, 0.85)],
        [1, hsl(190, 0.2, 0.96)],
      ];
      atmo = '#cfefff';
      atmoStrength = 0.5;
      break;
    }
    case 'lava': {
      stops = [
        [0, hsl(10, 0.2, 0.06)],
        [0.5, hsl(15, 0.15, 0.14)],
        [1, hsl(20, 0.1, 0.3)],
      ];
      atmo = '#ff6a30';
      atmoStrength = 0.55;
      break;
    }
    case 'toxic': {
      const th = 75 + hv * 0.8;
      stops = [
        [0, hsl(th + 20, 0.5, 0.15)],
        [0.35, hsl(th, 0.55, 0.32)],
        [0.6, hsl(th - 15, 0.6, 0.45)],
        [0.8, hsl(th - 25, 0.55, 0.58)],
        [1, hsl(th + 40, 0.4, 0.4)],
      ];
      atmo = '#c8ff60';
      atmoStrength = 0.85;
      break;
    }
    case 'barren': {
      const g = rng.range(0.3, 0.5);
      stops = [
        [0, hsl(hue, 0.06, g * 0.4)],
        [0.5, hsl(hue, 0.07, g)],
        [1, hsl(hue, 0.05, g * 1.6)],
      ];
      atmo = '#aaaaaa';
      atmoStrength = 0.12;
      for (let i = 0; i < 26; i++)
        craters.push({ u: rng.range(-1.6, 1.6), v: rng.range(-1.4, 1.4), r: rng.range(0.03, 0.22) * (rng.chance(0.2) ? 1.6 : 1) });
      break;
    }
    case 'crystal': {
      const ch = rng.pick([280, 190, 320, 160]) + hv;
      stops = [
        [0, hsl(ch, 0.5, 0.15)],
        [0.5, hsl(ch + 20, 0.55, 0.38)],
        [1, hsl(ch - 20, 0.6, 0.75)],
      ];
      atmo = `rgb(${hsl(ch, 0.8, 0.75).join(',')})`;
      atmoStrength = 0.6;
      break;
    }
  }
  const atmoRGB = parseColor(atmo);

  // voronoi seeds for crystal
  const cells: [number, number, number][] = [];
  if (kind === 'crystal') for (let i = 0; i < 70; i++) cells.push([rng.range(-1.7, 1.7), rng.range(-1.6, 1.6), rng.next()]);
  // gas storm
  const storm = kind === 'gas' && rng.chance(0.6) ? { u: rng.range(-0.8, 0.8), v: rng.range(-0.6, 0.6), r: rng.range(0.12, 0.25) } : null;
  const bandFreq = rng.range(5, 11);
  const tilt = rng.range(-0.25, 0.25);
  const cT = Math.cos(tilt);
  const sT = Math.sin(tilt);

  // light direction (upper-left, towards viewer)
  let lx = -0.55;
  let ly = -0.45;
  let lz = 0.7;
  const ll = Math.hypot(lx, ly, lz);
  lx /= ll;
  ly /= ll;
  lz /= ll;

  const img = ctx.createImageData(S, S);
  const data = img.data;
  const col = new Float32Array(3);
  const R2 = R * R;
  const x0 = Math.floor(C - R - 1);
  const x1 = Math.ceil(C + R + 1);
  for (let py = x0; py < x1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = px + 0.5 - C;
      const dy = py + 0.5 - C;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const nx = dx / R;
      const ny = dy / R;
      const nzv = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // rotated sphere coords for tilt
      const rx = nx * cT - ny * sT;
      const ry = nx * sT + ny * cT;
      const u = Math.atan2(rx, nzv);
      const v = Math.asin(clamp(ry, -1, 1));
      const su = u * freq;
      const sv = v * freq;
      let h = 0;
      let er = 0;
      let eg = 0;
      let eb = 0;
      let spec = 0;
      let bump = 0;
      switch (kind) {
        case 'rocky':
        case 'barren': {
          h = nz.fbm(su + 10, sv + 10, 5);
          if (kind === 'rocky') h = h * 0.7 + nz2.ridged(su * 1.3, sv * 1.3, 4) * 0.45 - 0.1;
          for (const cr of craters) {
            const cd = Math.hypot(u - cr.u, v - cr.v) / cr.r;
            if (cd < 1.25) {
              if (cd < 1) h -= (1 - cd * cd) * 0.18;
              else h += (1.25 - cd) * 0.5;
              bump += cd < 1 ? (u - cr.u) * 0.6 : 0;
            }
          }
          ramp(stops, clamp(h, 0, 1), col);
          break;
        }
        case 'ocean': {
          h = nz.fbm(su, sv, 6) * 1.05 - 0.02;
          const lat = Math.abs(v);
          if (lat > 0.9 && lat > 1.15 - nz2.noise(su * 2, sv * 2) * 0.25) h = 1;
          ramp(stops, clamp(h, 0, 1), col);
          if (h < 0.56) spec = 1;
          break;
        }
        case 'gas': {
          const w = nz.fbm(su * 1.5, sv * 4, 5);
          let b = v * bandFreq + w * 3.2 + nz2.fbm(su * 0.6, sv * 8, 3) * 1.2;
          if (storm) {
            const sd = Math.hypot((u - storm.u) / 1.7, v - storm.v) / storm.r;
            if (sd < 1.6) {
              const sw = Math.max(0, 1 - sd / 1.6);
              b += Math.sin(sd * 6 + Math.atan2(v - storm.v, u - storm.u)) * sw * 1.4;
              if (sd < 1) b = b * (1 - sw) + (0.15 * bandFreq) * sw;
            }
          }
          const t = (Math.sin(b) * 0.5 + 0.5) * 0.85 + nz.noise(su * 6, sv * 20) * 0.15;
          ramp(stops, t, col);
          break;
        }
        case 'ice': {
          h = nz.fbm(su, sv, 5);
          const crack = nz2.ridged(su * 1.6, sv * 1.6, 4);
          ramp(stops, h, col);
          if (crack > 0.82) {
            const k = (crack - 0.82) / 0.18;
            col[0] *= 1 - k * 0.45;
            col[1] *= 1 - k * 0.3;
            col[2] *= 1 - k * 0.1;
          }
          spec = 0.5;
          break;
        }
        case 'lava': {
          h = nz.fbm(su, sv, 5);
          ramp(stops, h, col);
          const crack = nz2.ridged(su * 1.4 + h, sv * 1.4, 5);
          const k = smoothstep(0.72, 0.95, crack) + smoothstep(0.3, 0.2, h) * 0.9;
          er = 255 * k * 1.1;
          eg = 120 * k * k;
          eb = 30 * k * k * k;
          break;
        }
        case 'toxic': {
          const q = nz.fbm(su * 0.7 + 20, sv * 1.2, 3);
          const w = nz.fbm(su * 0.9 + q * 1.8, sv * 1.6 + q * 1.5, 4);
          h = w;
          ramp(stops, clamp((w - 0.3) * 1.8, 0, 1), col);
          break;
        }
        case 'crystal': {
          let best = 9;
          let second = 9;
          let id = 0;
          for (const cl of cells) {
            const dd = (u - cl[0]) * (u - cl[0]) + (v - cl[1]) * (v - cl[1]);
            if (dd < best) {
              second = best;
              best = dd;
              id = cl[2];
            } else if (dd < second) second = dd;
          }
          h = id * 0.8 + nz.noise(su * 3, sv * 3) * 0.2;
          ramp(stops, h, col);
          const edge = Math.sqrt(second) - Math.sqrt(best);
          if (edge < 0.025) {
            const k = 1 - edge / 0.025;
            er = atmoRGB[0] * k * 0.9;
            eg = atmoRGB[1] * k * 0.9;
            eb = atmoRGB[2] * k * 0.9;
          }
          bump = (id - 0.5) * 0.5;
          spec = id > 0.75 ? 1 : 0.2;
          break;
        }
      }
      // lighting
      let sx = nx + bump * 0.3;
      let sy = ny;
      let sz = nzv;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      const ndl = sx * lx + sy * ly + sz * lz;
      const diff = smoothstep(-0.15, 0.6, ndl) * 0.92 + 0.04;
      let r = col[0] * diff;
      let g = col[1] * diff;
      let b = col[2] * diff;
      // clouds
      if (cloud || kind === 'toxic') {
        const q = nz2.noise(su * 0.8 + 50, sv * 0.8);
        const cv2 = nz2.fbm(su * 1.3 + 30 + q * 1.4, sv * 2.2 + q * 1.1, 4);
        const ca = kind === 'toxic' ? smoothstep(0.5, 0.75, cv2) * 0.5 : smoothstep(0.48, 0.72, cv2) * 0.85;
        const cc = kind === 'toxic' ? 0.85 : 1;
        r = r * (1 - ca) + 245 * cc * diff * ca;
        g = g * (1 - ca) + 248 * cc * diff * ca;
        b = b * (1 - ca) + 255 * (kind === 'toxic' ? 0.55 : 1) * diff * ca;
        spec *= 1 - ca;
      }
      // specular
      if (spec > 0 && ndl > 0) {
        const hz = lz + 1;
        const hl = Math.hypot(lx, ly, hz);
        const ndh = Math.max(0, (sx * lx + sy * ly + sz * hz) / hl);
        const sp = Math.pow(ndh, 40) * spec * 160;
        r += sp;
        g += sp;
        b += sp;
      }
      // atmosphere rim (fresnel), brighter on lit side
      const fres = Math.pow(1 - nzv, 2.4) * atmoStrength;
      const litRim = smoothstep(-0.35, 0.5, nx * lx + ny * ly + 0.2);
      r += (atmoRGB[0] - r) * fres * litRim;
      g += (atmoRGB[1] - g) * fres * litRim;
      b += (atmoRGB[2] - b) * fres * litRim;
      // emissive (shows on night side)
      r += er;
      g += eg;
      b += eb;
      // antialiased edge
      const edge = clamp(R - Math.sqrt(d2), 0, 1);
      const i = (py * S + px) * 4;
      data[i] = r > 255 ? 255 : r;
      data[i + 1] = g > 255 ? 255 : g;
      data[i + 2] = b > 255 ? 255 : b;
      data[i + 3] = 255 * edge;
    }
  }
  ctx.putImageData(img, 0, 0);

  // rings
  const ringTilt = rng.range(-0.5, 0.5);
  const squash = rng.range(0.18, 0.35);
  const ringIn = R * rng.range(1.25, 1.45);
  const ringOut = R * rng.range(1.75, 2.1);
  const ringBands: [number, number][] = [];
  if (hasRings) {
    const n = 50;
    for (let i = 0; i < n; i++) ringBands.push([ringIn + ((ringOut - ringIn) * i) / n, rng.next() * rng.next()]);
  }
  const ringCol = rng.chance(0.5) ? parseColor('#e8d8b8') : (stops[2]?.[1] ?? [200, 200, 200]);
  const drawRings = (front: boolean) => {
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(ringTilt);
    ctx.scale(1, squash);
    ctx.beginPath();
    if (front) ctx.rect(-S, 0, S * 2, S);
    else ctx.rect(-S, -S, S * 2, S);
    ctx.clip();
    const w = (ringOut - ringIn) / ringBands.length + 0.5;
    for (const [rr, a] of ringBands) {
      ctx.strokeStyle = `rgba(${ringCol[0] | 0},${ringCol[1] | 0},${ringCol[2] | 0},${0.12 + a * 0.75})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.stroke();
    }
    // planet shadow on the rings (towards bottom-right, away from light)
    ctx.globalCompositeOperation = 'source-atop';
    const sg = ctx.createLinearGradient(-ringOut, 0, ringOut, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    sg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = sg;
    ctx.fillRect(-S, -S, S * 2, S * 2);
    ctx.restore();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  if (hasRings) drawRings(false);
  // outer atmosphere halo
  const hg = ctx.createRadialGradient(C - R * 0.08, C - R * 0.06, R * 0.9, C, C, R * (1.08 + atmoStrength * 0.12));
  hg.addColorStop(0, rgba(atmo, 0.55 * atmoStrength + 0.05));
  hg.addColorStop(0.35, rgba(atmo, 0.25 * atmoStrength));
  hg.addColorStop(1, rgba(atmo, 0));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(C, C, R * 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (hasRings) drawRings(true);
  return cv;
}

// ------------------------------------------------------------------ star

export function makeStar(color: string, radius: number): HTMLCanvasElement {
  const R = Math.max(2, radius);
  const S = Math.ceil(R * 6);
  const [cv, c] = makeCanvas(S, S);
  const C = S / 2;
  const col = glowCol(color, 0.6);
  c.globalCompositeOperation = 'lighter';
  // wide glow
  let g = c.createRadialGradient(C, C, R * 0.5, C, C, S / 2);
  g.addColorStop(0, rgba(col, 0.55));
  g.addColorStop(0.2, rgba(col, 0.22));
  g.addColorStop(0.5, rgba(col, 0.06));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  // corona streamers
  const rng = new RNG(hashSeed(color, radius));
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, TAU);
    const L = R * rng.range(1.4, 2.8);
    const w = rng.range(0.08, 0.2);
    c.save();
    c.translate(C, C);
    c.rotate(a);
    const sg = c.createLinearGradient(R * 0.8, 0, L, 0);
    sg.addColorStop(0, rgba(col, 0.25));
    sg.addColorStop(1, rgba(col, 0));
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(R * 0.8, -R * w);
    c.quadraticCurveTo(L * 0.6, -R * w * 0.3, L, 0);
    c.quadraticCurveTo(L * 0.6, R * w * 0.3, R * 0.8, R * w);
    c.fill();
    c.restore();
  }
  // diffraction spikes
  for (const a of [0, Math.PI / 2]) {
    c.save();
    c.translate(C, C);
    c.rotate(a + 0.3);
    const lg = c.createLinearGradient(-S / 2, 0, S / 2, 0);
    lg.addColorStop(0, rgba(col, 0));
    lg.addColorStop(0.5, rgba('#ffffff', 0.35));
    lg.addColorStop(1, rgba(col, 0));
    c.fillStyle = lg;
    c.fillRect(-S / 2, -Math.max(0.6, R * 0.03), S, Math.max(1.2, R * 0.06));
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  // photosphere with limb darkening
  g = c.createRadialGradient(C, C, 0, C, C, R);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, mix(col, '#ffffff', 0.75));
  g.addColorStop(0.9, mix(col, '#ffffff', 0.3));
  g.addColorStop(1, shade(col, 0.95));
  c.fillStyle = g;
  c.beginPath();
  c.arc(C, C, R, 0, TAU);
  c.fill();
  // granulation
  if (R > 10) {
    c.save();
    c.beginPath();
    c.arc(C, C, R, 0, TAU);
    c.clip();
    for (let i = 0; i < R * 3; i++) {
      const a = rng.range(0, TAU);
      const d = Math.sqrt(rng.next()) * R;
      c.fillStyle = rng.chance(0.5) ? rgba(shade(col, 0.8), 0.12) : 'rgba(255,255,255,0.12)';
      c.beginPath();
      c.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, R * rng.range(0.03, 0.08), 0, TAU);
      c.fill();
    }
    c.restore();
  }
  // bright inner glow over disc edge
  c.globalCompositeOperation = 'lighter';
  g = c.createRadialGradient(C, C, R * 0.85, C, C, R * 1.35);
  g.addColorStop(0, rgba(col, 0.6));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(C, C, R * 1.35, 0, TAU);
  c.fill();
  return cv;
}

// ------------------------------------------------------------------ station

const STATION_COLS: Record<string, [string, string]> = {
  neutral: ['#8a96a8', '#7fd0ff'],
  mercantile: ['#a89070', '#ffb050'],
  zealot: ['#d8d0c0', '#ffd070'],
  hive: ['#6a4a70', '#a8ff60'],
  machine: ['#5a6470', '#ff4040'],
  raider: ['#7a5a48', '#ff7a30'],
  ancient: ['#c8c4e0', '#a0f0ff'],
  warden: ['#18191e', '#ff2a3a'],
  player: ['#8a96a8', '#7fd0ff'],
  human: ['#8a96a8', '#7fd0ff'],
};

export function makeStation(seed: number, style: string, size: number): HTMLCanvasElement {
  const [base, accent] = STATION_COLS[style] ?? STATION_COLS.neutral;
  const { cv, d } = setup(size, hashSeed(seed, style, 'station'), base, accent);
  const { c, r } = d;
  const glow = glowCol(accent, 0.62);
  if (style === 'hive') {
    stationHive(d, glow);
    return cv;
  }
  if (style === 'ancient') aura(d, 0, 0, 56, glow, 0.12);

  const ringR = r.range(30, 40);
  const ringW = r.range(4, 7);
  const nSpokes = style === 'machine' ? 6 : style === 'zealot' ? 4 : r.pick([3, 4, 6]);
  const rot = r.range(0, TAU);
  const hubR = r.range(9, 14);

  // solar panel arms (behind)
  if (style !== 'warden' && style !== 'ancient' && r.chance(0.7)) {
    const na = r.pick([2, 4]);
    for (let i = 0; i < na; i++) {
      const a = rot + Math.PI / na + (i / na) * TAU;
      c.save();
      c.rotate(a);
      c.fillStyle = shade(base, 0.5);
      c.fillRect(ringR, -1, 16, 2);
      for (let j = 0; j < 2; j++) {
        const x = ringR + 4 + j * 7;
        const pp = rectPath(x, -9, 6, 18, 0.3);
        const g = c.createLinearGradient(x, -9, x + 6, 9);
        g.addColorStop(0, '#2a4a8a');
        g.addColorStop(0.5, '#4a7ad0');
        g.addColorStop(1, '#16284a');
        c.fillStyle = g;
        c.fill(pp);
        c.strokeStyle = 'rgba(150,200,255,0.35)';
        c.lineWidth = d.px(0.6);
        for (let k = 1; k < 4; k++) {
          c.beginPath();
          c.moveTo(x, -9 + k * 4.5);
          c.lineTo(x + 6, -9 + k * 4.5);
          c.stroke();
        }
        c.strokeStyle = '#0a1020';
        c.lineWidth = d.px(0.9);
        c.stroke(pp);
      }
      c.restore();
    }
  }
  // spokes
  for (let i = 0; i < nSpokes; i++) {
    const a = rot + (i / nSpokes) * TAU;
    c.save();
    c.rotate(a);
    const sp = rectPath(hubR - 1, -1.8, ringR - hubR, 3.6, 0.5);
    hull(d, sp, shade(base, 0.8), { H: 2, bevel: 0.5 });
    c.restore();
  }
  // ring
  if (style === 'machine') {
    const hp = hexPath(0, 0, ringR + ringW / 2, rot);
    const hi = hexPath(0, 0, ringR - ringW / 2, rot);
    const p = new Path2D();
    p.addPath(hp);
    p.addPath(hi);
    c.save();
    c.fillStyle = shade(base, 1);
    c.fill(p, 'evenodd');
    c.strokeStyle = shade(base, 0.25);
    c.lineWidth = d.px(1.1);
    c.stroke(p);
    c.restore();
  } else {
    // torus shading: radial gradient across ring width
    const g = c.createRadialGradient(-ringR * 0.15, -ringR * 0.15, ringR - ringW, 0, 0, ringR + ringW);
    g.addColorStop(0, shade(base, 0.55));
    g.addColorStop(0.45, shade(base, 1.25));
    g.addColorStop(1, shade(base, 0.45));
    c.strokeStyle = g;
    c.lineWidth = ringW;
    c.beginPath();
    c.arc(0, 0, ringR, 0, TAU);
    c.stroke();
    c.strokeStyle = shade(base, 0.22);
    c.lineWidth = d.px(1);
    for (const rr of [ringR - ringW / 2, ringR + ringW / 2]) {
      c.beginPath();
      c.arc(0, 0, rr, 0, TAU);
      c.stroke();
    }
    // segment lines + windows
    const segs = Math.round(ringR * 0.9);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (i % 3 === 0) {
        c.strokeStyle = 'rgba(0,0,0,0.4)';
        c.lineWidth = d.px(0.8);
        c.beginPath();
        c.moveTo(ca * (ringR - ringW / 2), sa * (ringR - ringW / 2));
        c.lineTo(ca * (ringR + ringW / 2), sa * (ringR + ringW / 2));
        c.stroke();
      } else if (r.chance(0.6)) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = style === 'warden' ? rgba(glow, 0.6) : 'rgba(255,225,160,0.75)';
        c.beginPath();
        c.arc(ca * ringR, sa * ringR, d.px(0.9), 0, TAU);
        c.fill();
        c.restore();
      }
    }
  }
  if (style === 'ancient') {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + (i / 5) * 0.7);
      glyphPair(d, Math.cos(a) * (ringR + ringW + 3), Math.sin(a) * (ringR + ringW + 3), 3, glow);
    }
  }
  // modules on ring
  const nMods = r.int(2, 5);
  for (let i = 0; i < nMods; i++) {
    const a = rot + ((i + 0.5) / nMods) * TAU + r.range(-0.2, 0.2);
    c.save();
    c.rotate(a);
    const kind = r.int(0, 2);
    if (style === 'zealot') {
      const sp = symPoly([
        [ringR + 20, 0],
        [ringR + 4, 3.5],
        [ringR - 2, 3.5],
        [ringR - 2, 0],
      ]);
      hull(d, sp, mix(base, accent, 0.3), { H: 4 });
      light(d, ringR + 18, 0, 0.8, glow);
    } else if (style === 'mercantile' || kind === 0) {
      // cargo/dock block
      const mp = rectPath(ringR + 2, -5, r.range(8, 12), 10, 1);
      hull(d, mp, mix(base, accent, style === 'mercantile' ? 0.35 : 0.1), { H: 5 });
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 3; k++) c.fillRect(ringR + 4 + k * 3, -5, d.px(0.8), 10);
      light(d, ringR + 12, 0, 0.8, glow);
    } else if (kind === 1) {
      const mp = ellipsePath(ringR + 6, 0, 6, 6);
      hull(d, mp, base, { H: 6 });
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.arc(ringR + 6, 0, 3, 0, TAU);
      c.stroke();
    } else {
      // docking arm
      const mp = rectPath(ringR + 2, -1.6, 14, 3.2, 0.5);
      hull(d, mp, shade(base, 0.8), { H: 2 });
      const hp = rectPath(ringR + 14, -4, 4, 8, 1);
      hull(d, hp, base, { H: 4 });
      light(d, ringR + 18, -3, 0.7, '#ff5050');
      light(d, ringR + 18, 3, 0.7, '#50ff80');
    }
    c.restore();
  }
  if (style === 'raider') {
    // patchwork scrap bolted on
    for (let i = 0; i < 6; i++) {
      const a = r.range(0, TAU);
      const rr = r.range(hubR, ringR + 4);
      c.save();
      c.rotate(a);
      const pp = rectPath(rr, -r.range(2, 5), r.range(4, 9), r.range(4, 8), 0.4);
      hull(d, pp, r.pick(['#6a6d70', '#8a5a3a', '#5a4a40', accent]), { H: 5, bevel: 0.3 });
      c.restore();
    }
  }
  // hub
  let hubPath: Path2D;
  if (style === 'machine') hubPath = hexPath(0, 0, hubR, rot);
  else if (style === 'warden') hubPath = symPoly([[hubR * 1.4, 0], [-hubR, hubR], [-hubR * 0.6, 0]]);
  else hubPath = ellipsePath(0, 0, hubR, hubR);
  hull(d, hubPath, shade(base, 1.05), { H: hubR, gloss: 0.1 });
  panels(d, hubPath, 5, -hubR, hubR, hubR, 0.3);
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = d.px(1);
  c.beginPath();
  c.arc(0, 0, hubR * 0.55, 0, TAU);
  c.stroke();
  if (style === 'zealot') {
    // cross/spire crest
    c.fillStyle = shade(accent, 1.1);
    c.fillRect(-hubR * 0.9, -1, hubR * 1.8, 2);
    c.fillRect(-1, -hubR * 0.9, 2, hubR * 1.8);
  }
  light(d, 0, 0, hubR * 0.25, glow, 1);
  // beacon lights around hub
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    light(d, Math.cos(a) * hubR * 0.8, Math.sin(a) * hubR * 0.8, 0.5, glow, 0.7);
  }
  return cv;
}

function stationHive(d: D, glow: string) {
  const { c, r } = d;
  const flesh = d.p;
  // tendrils radiating
  for (let i = 0; i < 7; i++) {
    const a = r.range(0, TAU);
    const L = r.range(30, 50);
    c.save();
    c.rotate(a);
    tendril(
      d,
      [
        [8, 0],
        [L * 0.3, r.range(-10, 10)],
        [L * 0.6, r.range(-10, 10)],
        [L, r.range(-6, 6)],
      ],
      r.range(3, 6),
      0.4,
      shade(flesh, 0.8),
      false,
    );
    c.restore();
  }
  // blobs
  const blobs: [number, number, number][] = [[0, 0, 18]];
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, TAU);
    const dd = r.range(12, 30);
    blobs.push([Math.cos(a) * dd, Math.sin(a) * dd, r.range(6, 13)]);
  }
  blobs.sort((a, b) => a[2] - b[2]);
  for (const [x, y, R] of blobs) {
    const p = ellipsePath(x, y, R, R * r.range(0.8, 1));
    const g = c.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
    g.addColorStop(0, shade(flesh, 1.4));
    g.addColorStop(0.6, shade(flesh, 0.85));
    g.addColorStop(1, shade(flesh, 0.35));
    c.fillStyle = g;
    c.fill(p);
    c.strokeStyle = shade(flesh, 0.2);
    c.lineWidth = d.px(1);
    c.stroke(p);
    // pores
    for (let k = 0; k < 3; k++) {
      const a = r.range(0, TAU);
      light(d, x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, R * 0.08, glow, 0.8);
    }
  }
  light(d, 0, 0, 4, glow, 1);
}

// ------------------------------------------------------------------ asteroid

export function makeAsteroid(seed: number, radius: number): HTMLCanvasElement {
  const R = Math.max(3, radius);
  const S = Math.ceil(R * 2.4);
  const [cv, ctx] = makeCanvas(S, S);
  const C = S / 2;
  const rng = new RNG(hashSeed(seed, 'asteroid'));
  const nz = new Noise2D(rng.fork());
  const shapeN = new Noise2D(rng.fork());
  const elong = rng.range(0.7, 1);
  const rot = rng.range(0, TAU);
  const h0 = rng.pick([25, 30, 20, 210, 0]);
  const sat = rng.range(0.05, 0.22);
  const lum = rng.range(0.3, 0.48);
  const base = hslToRgb(h0, sat, lum);
  const craters: [number, number, number][] = [];
  for (let i = 0; i < rng.int(3, 9); i++) craters.push([rng.range(-0.7, 0.7), rng.range(-0.7, 0.7), rng.range(0.08, 0.28)]);
  const shapeR = (a: number) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    return 0.72 + shapeN.fbm(ca * 1.3 + 5, sa * 1.3 + 5, 4) * 0.42;
  };
  // precompute radius table
  const T = 256;
  const tab = new Float32Array(T + 1);
  for (let i = 0; i <= T; i++) tab[i] = shapeR((i / T) * TAU);
  const img = ctx.createImageData(S, S);
  const data = img.data;
  let lx = -0.6;
  let ly = -0.5;
  let lz = 0.62;
  const ll = Math.hypot(lx, ly, lz);
  lx /= ll;
  ly /= ll;
  lz /= ll;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const hgt = (x: number, y: number) => {
    let h = nz.fbm(x * 3 + 7, y * 3 + 7, 4) * 0.25;
    for (const [cx, cy, rr] of craters) {
      const dd = Math.hypot(x - cx, y - cy) / rr;
      if (dd < 1) h -= (1 - dd * dd) * 0.15;
      else if (dd < 1.3) h += (1.3 - dd) * 0.12;
    }
    return h;
  };
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const dx = (px + 0.5 - C) / R;
      const dy = (py + 0.5 - C) / R;
      // rotate & stretch into shape space
      const qx = (dx * cr + dy * sr) / 1;
      const qy = (-dx * sr + dy * cr) / elong;
      const a = Math.atan2(qy, qx);
      const sR = tab[Math.floor(((a + Math.PI) / TAU) * T) % (T + 1)];
      const dist = Math.hypot(qx, qy);
      if (dist > sR) continue;
      const t = dist / sR;
      const nzv = Math.sqrt(Math.max(0.0001, 1 - t * t));
      // normal approx: radial + noise gradient
      const e = 0.02;
      const h = hgt(qx, qy);
      const gx = (hgt(qx + e, qy) - h) / e;
      const gy = (hgt(qx, qy + e) - h) / e;
      let nx = (dx / sR) * 0.9 - gx * 0.25;
      let ny = (dy / sR) * 0.9 - gy * 0.25;
      let nzz = nzv;
      const nl = Math.hypot(nx, ny, nzz);
      nx /= nl;
      ny /= nl;
      nzz /= nl;
      const ndl = nx * lx + ny * ly + nzz * lz;
      const diff = Math.max(0, ndl) * 0.95 + 0.05;
      const tone = 0.75 + h * 1.6 + (nz.noise(qx * 14, qy * 14) - 0.5) * 0.25;
      const i = (py * S + px) * 4;
      data[i] = clamp(base[0] * tone * diff * 1.3, 0, 255);
      data[i + 1] = clamp(base[1] * tone * diff * 1.3, 0, 255);
      data[i + 2] = clamp(base[2] * tone * diff * 1.3, 0, 255);
      data[i + 3] = 255 * clamp((sR - dist) * R, 0, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ derelict

export function makeDerelict(seed: number, size: number): HTMLCanvasElement {
  const rng = new RNG(hashSeed(seed, 'derelict'));
  const style = rng.pick<ShipStyle>(['mercantile', 'player', 'machine', 'zealot', 'raider', 'mercantile']);
  const hue = rng.range(0, 360);
  const p = `hsl(${hue},${rng.range(5, 15)}%,${rng.range(22, 32)}%)`;
  const s = `hsl(${hue + 30},10%,30%)`;
  const ship = makeShipSprite({ seed: rng.fork(), style, size, primary: p, secondary: s });
  const S = ship.width;
  const [cv, c] = makeCanvas(S, S);
  const C = S / 2;
  // slight random rotation to look adrift
  c.translate(C, C);
  c.rotate(rng.range(-0.25, 0.25));
  c.translate(-C, -C);
  // desaturate & darken
  c.filter = 'grayscale(0.7) brightness(0.6) contrast(1.1)';
  c.drawImage(ship, 0, 0);
  c.filter = 'none';
  c.setTransform(1, 0, 0, 1, 0, 0);
  const k = size / 100;
  // kill engine glows: darken the rear region
  c.globalCompositeOperation = 'source-atop';
  const rg = c.createLinearGradient(C - 60 * k, 0, C - 30 * k, 0);
  rg.addColorStop(0, 'rgba(8,8,10,0.9)');
  rg.addColorStop(1, 'rgba(8,8,10,0)');
  c.fillStyle = rg;
  c.fillRect(0, 0, S, S);
  // scorch marks
  for (let i = 0; i < rng.int(4, 8); i++) {
    const x = C + rng.range(-35, 35) * k;
    const y = C + rng.range(-25, 25) * k;
    const R = rng.range(6, 16) * k;
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(5,4,3,0.85)');
    g.addColorStop(0.6, 'rgba(20,12,6,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
  }
  // torn edges: cut jagged bites
  c.globalCompositeOperation = 'destination-out';
  const cuts = rng.int(2, 4);
  for (let i = 0; i < cuts; i++) {
    const a = rng.range(0, TAU);
    const cx = C + Math.cos(a) * rng.range(25, 45) * k;
    const cy = C + Math.sin(a) * rng.range(15, 35) * k;
    const R = rng.range(8, 18) * k;
    c.beginPath();
    const n = 14;
    for (let j = 0; j < n; j++) {
      const aa = (j / n) * TAU;
      const rr = R * (j % 2 ? rng.range(0.4, 0.7) : rng.range(0.9, 1.3));
      const x = cx + Math.cos(aa) * rr;
      const y = cy + Math.sin(aa) * rr;
      if (j === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
  }
  // hull breach holes
  for (let i = 0; i < rng.int(1, 3); i++) {
    const x = C + rng.range(-25, 25) * k;
    const y = C + rng.range(-12, 12) * k;
    const R = rng.range(2, 5) * k;
    c.beginPath();
    for (let j = 0; j < 10; j++) {
      const aa = (j / 10) * TAU;
      const rr = R * rng.range(0.5, 1.2);
      if (j === 0) c.moveTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
      else c.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
    }
    c.closePath();
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // debris
  for (let i = 0; i < rng.int(4, 9); i++) {
    const x = C + rng.range(-50, 50) * k;
    const y = C + rng.range(-50, 50) * k;
    const sz = rng.range(1, 3.5) * k;
    c.save();
    c.translate(x, y);
    c.rotate(rng.range(0, TAU));
    c.fillStyle = `rgba(${rng.int(40, 80)},${rng.int(40, 75)},${rng.int(40, 75)},0.9)`;
    c.beginPath();
    c.moveTo(sz, 0);
    c.lineTo(-sz * 0.6, sz * rng.range(0.4, 0.9));
    c.lineTo(-sz * 0.4, -sz * rng.range(0.4, 0.9));
    c.closePath();
    c.fill();
    c.restore();
  }
  // embers / faint emergency lights
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rng.int(1, 4); i++) {
    const x = C + rng.range(-25, 25) * k;
    const y = C + rng.range(-15, 15) * k;
    const R = Math.max(1.5, rng.range(1, 2.5) * k);
    const col = rng.chance(0.6) ? '#ff6a20' : '#ff2020';
    const g = c.createRadialGradient(x, y, 0, x, y, R * 2.5);
    g.addColorStop(0, rgba(col, 0.8));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(x - R * 2.5, y - R * 2.5, R * 5, R * 5);
  }
  return cv;
}

// ------------------------------------------------------------------ animated markers

const ANOM_COLS: [string, string][] = [
  ['#9a5cff', '#40c8ff'],
  ['#40fff0', '#ffffff'],
  ['#ff5ca8', '#ffb040'],
  ['#80ff70', '#30a0ff'],
];

export function drawAnomaly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, kind: number): void {
  const k = ((kind % 4) + 4) % 4;
  const [c1, c2] = ANOM_COLS[k];
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  // shared soft glow
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
  g.addColorStop(0, rgba(c1, 0.35 * pulse));
  g.addColorStop(0.5, rgba(c1, 0.12 * pulse));
  g.addColorStop(1, rgba(c1, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.4, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  if (k === 0) {
    // vortex: spiral arms
    for (let arm = 0; arm < 4; arm++) {
      const base = t * 0.9 + (arm / 4) * TAU;
      ctx.strokeStyle = rgba(arm % 2 ? c2 : c1, 0.55);
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const f = i / 20;
        const a = base + f * 3.2;
        const rr = r * (1 - f) * 1.05;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.35);
    cg.addColorStop(0, 'rgba(0,0,0,0.95)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, TAU);
    ctx.fill();
  } else if (k === 1) {
    // rift: jagged vertical tear
    const n = 9;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const yy = (f - 0.5) * r * 1.9;
      const w = Math.sin(f * Math.PI) * r * 0.22 * (0.8 + 0.2 * Math.sin(t * 3 + i * 1.7));
      pts.push([Math.sin(i * 2.3 + t * 1.3) * r * 0.08, yy]);
      pts.push([w, yy]);
    }
    for (const [lw, a, col] of [
      [r * 0.3, 0.15, c1],
      [r * 0.12, 0.5, c1],
      [r * 0.04, 0.95, c2],
    ] as const) {
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = Math.max(1, lw);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [ox, yy] = pts[i * 2];
        if (i === 0) ctx.moveTo(ox, yy);
        else ctx.lineTo(ox, yy);
      }
      ctx.stroke();
    }
    // sparks drifting out
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.6 + i / 6) % 1;
      const sy = Math.sin(i * 12.9) * r * 0.8;
      const sx = (i % 2 ? 1 : -1) * ph * r * 0.9;
      ctx.fillStyle = rgba(c2, 1 - ph);
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  } else if (k === 2) {
    // gravitational pulse: expanding rings
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.45 + i / 4) % 1;
      ctx.strokeStyle = rgba(i % 2 ? c2 : c1, (1 - ph) * 0.7);
      ctx.lineWidth = Math.max(1, r * 0.05 * (1 - ph));
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.15 + ph * 0.95), 0, TAU);
      ctx.stroke();
    }
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
    cg.addColorStop(0, 'rgba(255,255,255,0.9)');
    cg.addColorStop(0.4, rgba(c1, 0.6 * pulse));
    cg.addColorStop(1, rgba(c1, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
  } else {
    // crystalline shards orbiting
    for (let i = 0; i < 7; i++) {
      const a = t * (0.3 + (i % 3) * 0.12) * (i % 2 ? 1 : -1) + i * 0.9;
      const rr = r * (0.35 + ((i * 37) % 10) / 16);
      ctx.save();
      ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.rotate(a * 2);
      const s = r * (0.1 + ((i * 13) % 5) / 40);
      ctx.fillStyle = rgba(i % 2 ? c1 : c2, 0.45);
      ctx.strokeStyle = rgba('#ffffff', 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s * 1.4, 0);
      ctx.lineTo(0, s * 0.5);
      ctx.lineTo(-s * 1.4, 0);
      ctx.lineTo(0, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = rgba(c1, 0.3 * pulse);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  // expanding signal rings
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i / 3) % 1;
    ctx.strokeStyle = rgba(color, (1 - ph) * (1 - ph) * 0.8);
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.2 + ph * 0.9), 0, TAU);
    ctx.stroke();
  }
  // rotating ticks
  ctx.rotate(t * 0.8);
  ctx.strokeStyle = rgba(color, 0.6);
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, a, a + 0.6);
    ctx.stroke();
  }
  ctx.rotate(-t * 0.8);
  // core blink
  const blink = 0.55 + 0.45 * Math.max(0, Math.sin(t * 5));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
  g.addColorStop(0, `rgba(255,255,255,${blink})`);
  g.addColorStop(0.35, rgba(color, 0.8 * blink));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}
