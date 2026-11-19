/** Comms-screen alien portraits (bust on a panel with scanlines). Drawn in a 100x100 unit space. */
import { RNG, hashSeed } from '../core/rng';
import { makeCanvas, mix, rgba, shade } from './noise';
import { glowCol } from './ships';

export type PortraitArchetype = 'mercantile' | 'zealot' | 'hive' | 'machine' | 'raider' | 'ancient' | 'human' | 'warden';

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;

interface PD {
  c: Ctx;
  r: RNG;
  p: string;
  s: string;
  glow: string;
  px: number; // units per pixel
}

function radial(c: Ctx, x: number, y: number, R: number, stops: [number, string][]) {
  const g = c.createRadialGradient(x, y, 0, x, y, R);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

function glowDot(c: Ctx, x: number, y: number, R: number, col: string, a = 1) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = radial(c, x, y, R * 3, [
    [0, `rgba(255,255,255,${a})`],
    [0.2, rgba(col, 0.85 * a)],
    [1, rgba(col, 0)],
  ]);
  c.beginPath();
  c.arc(x, y, R * 3, 0, TAU);
  c.fill();
  c.restore();
}

/** fill a path with a lit-from-upper-left radial gradient + outline */
function lit(d: PD, path: Path2D, base: string, cx: number, cy: number, R: number, outline = true) {
  const c = d.c;
  c.fillStyle = radial(c, cx - R * 0.35, cy - R * 0.4, R * 1.5, [
    [0, shade(base, 1.35)],
    [0.45, shade(base, 0.95)],
    [1, shade(base, 0.3)],
  ]);
  c.fill(path);
  // rim light from the right (screen glow)
  c.save();
  c.clip(path);
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = 2.2;
  c.translate(-1.2, 0);
  c.strokeStyle = rgba(d.glow, 0.28);
  c.stroke(path);
  c.restore();
  if (outline) {
    c.lineWidth = 0.8;
    c.strokeStyle = 'rgba(0,0,0,0.75)';
    c.stroke(path);
  }
}

function ell(x: number, y: number, rx: number, ry: number, rot = 0) {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, rot, 0, TAU);
  return p;
}

/** Shoulders/bust base shape */
function shoulders(w: number, top: number, neckW: number): Path2D {
  const p = new Path2D();
  p.moveTo(50 - neckW, top - 6);
  p.lineTo(50 - neckW, top);
  p.bezierCurveTo(50 - w * 0.6, top + 2, 50 - w, top + 8, 50 - w, 104);
  p.lineTo(50 + w, 104);
  p.bezierCurveTo(50 + w, top + 8, 50 + w * 0.6, top + 2, 50 + neckW, top);
  p.lineTo(50 + neckW, top - 6);
  p.closePath();
  return p;
}

function eyePair(d: PD, y: number, dx: number, rx: number, ry: number, iris: string, slant = 0, pupil: 'round' | 'slit' | 'none' = 'round') {
  const c = d.c;
  for (const sgn of [-1, 1]) {
    const x = 50 + sgn * dx;
    const ep = ell(x, y, rx, ry, sgn * slant);
    c.fillStyle = '#f2ece0';
    c.fill(ep);
    c.save();
    c.clip(ep);
    c.fillStyle = radial(c, x, y, ry * 1.1, [
      [0, shade(iris, 1.3)],
      [0.7, iris],
      [1, shade(iris, 0.4)],
    ]);
    c.beginPath();
    c.arc(x, y, ry * 0.95, 0, TAU);
    c.fill();
    c.fillStyle = '#050505';
    c.beginPath();
    if (pupil === 'round') c.arc(x, y, ry * 0.42, 0, TAU);
    else if (pupil === 'slit') c.ellipse(x, y, ry * 0.15, ry * 0.85, 0, 0, TAU);
    c.fill();
    // upper lid shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x - rx, y - ry, rx * 2, ry * 0.45);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.arc(x - ry * 0.3, y - ry * 0.35, Math.max(0.5, ry * 0.18), 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    c.lineWidth = 0.7;
    c.stroke(ep);
  }
}

// ----------------------------------------------------------------- archetypes

function human(d: PD) {
  const { c, r } = d;
  const skin = r.pick(['#f0c8a0', '#d8a878', '#b07850', '#8a5a3a', '#e8b890', '#6a4028']);
  const hair = r.pick(['#1a1210', '#3a2418', '#6a4020', '#b08040', '#d8d0c0', '#802018']);
  // uniform
  const sp = shoulders(42, 80, 8);
  lit(d, sp, d.p, 50, 92, 40);
  // collar & insignia
  c.fillStyle = shade(d.p, 0.6);
  c.beginPath();
  c.moveTo(40, 78);
  c.lineTo(50, 92);
  c.lineTo(60, 78);
  c.lineTo(56, 76);
  c.lineTo(50, 84);
  c.lineTo(44, 76);
  c.closePath();
  c.fill();
  c.fillStyle = d.s;
  c.fillRect(22, 88, 8, 3);
  c.fillRect(70, 88, 8, 3);
  glowDot(d.c, 34, 96, 1, d.glow, 0.8);
  // neck
  const nk = new Path2D();
  nk.rect(43, 64, 14, 18);
  lit(d, nk, shade(skin, 0.8), 50, 70, 10, false);
  // head
  const hw = r.range(14, 17);
  const hh = r.range(19, 22);
  const head = new Path2D();
  head.moveTo(50 - hw, 42);
  head.bezierCurveTo(50 - hw, 22, 50 + hw, 22, 50 + hw, 42);
  head.bezierCurveTo(50 + hw, 56, 50 + hw * 0.5, 42 + hh + 2, 50, 42 + hh + 2);
  head.bezierCurveTo(50 - hw * 0.5, 42 + hh + 2, 50 - hw, 56, 50 - hw, 42);
  head.closePath();
  // hair back
  if (r.chance(0.5)) {
    const hb = ell(50, 40, hw + 3, hh + r.range(0, 8));
    lit(d, hb, hair, 50, 36, 20);
  }
  lit(d, head, skin, 50, 42, 22);
  // ears
  for (const sgn of [-1, 1]) {
    const ep = ell(50 + sgn * hw, 45, 2.4, 4.5);
    lit(d, ep, shade(skin, 0.9), 50 + sgn * hw, 45, 5);
  }
  // hair top
  const style = r.int(0, 3);
  const ht = new Path2D();
  if (style === 0) {
    ht.moveTo(50 - hw - 1, 42);
    ht.bezierCurveTo(50 - hw - 2, 18, 50 + hw + 2, 18, 50 + hw + 1, 42);
    ht.bezierCurveTo(50 + hw * 0.6, 30, 50 - hw * 0.2, 32, 50 - hw - 1, 42);
  } else if (style === 1) {
    ht.moveTo(50 - hw, 36);
    ht.bezierCurveTo(50 - hw, 20, 50 + hw, 20, 50 + hw, 36);
    ht.lineTo(50 + hw * 0.4, 30);
    ht.lineTo(50 - hw * 0.8, 33);
  } else if (style === 2) {
    ht.moveTo(50 - hw - 1, 60);
    ht.bezierCurveTo(50 - hw - 5, 16, 50 + hw + 5, 16, 50 + hw + 1, 60);
    ht.lineTo(50 + hw - 2, 40);
    ht.bezierCurveTo(50 + hw * 0.5, 30, 50 - hw * 0.5, 30, 50 - hw + 2, 40);
  } else {
    ht.moveTo(50 - hw, 33);
    ht.bezierCurveTo(50 - hw, 24, 50 + hw, 24, 50 + hw, 33);
    ht.bezierCurveTo(50, 28, 50, 28, 50 - hw, 33);
  }
  ht.closePath();
  lit(d, ht, hair, 50, 28, 18);
  // features
  eyePair(d, 44, 6.5, 3.2, 1.9, r.pick(['#3a6a9a', '#5a3a20', '#3a7a4a', '#6a6a6a']));
  c.strokeStyle = shade(hair, 0.8, 0.9);
  c.lineWidth = 1.2;
  for (const sgn of [-1, 1]) {
    c.beginPath();
    c.moveTo(50 + sgn * 3.5, 40);
    c.quadraticCurveTo(50 + sgn * 7, 38.5, 50 + sgn * 10.5, 40);
    c.stroke();
  }
  c.strokeStyle = shade(skin, 0.55);
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(50, 45);
  c.lineTo(48.5, 52);
  c.lineTo(51, 52.5);
  c.stroke();
  c.strokeStyle = shade(skin, 0.45);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(45.5, 57);
  c.quadraticCurveTo(50, r.range(57.5, 59), 54.5, 57);
  c.stroke();
  // headset
  if (r.chance(0.6)) {
    c.fillStyle = '#2a2e36';
    c.fillRect(50 + hw - 1, 42, 3, 7);
    c.strokeStyle = '#2a2e36';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(50 + hw + 1, 48);
    c.quadraticCurveTo(50 + hw, 58, 56, 58);
    c.stroke();
    glowDot(c, 50 + hw + 0.5, 44, 0.6, d.glow);
  }
}

function mercantile(d: PD) {
  const { c, r } = d;
  const skin = mix(d.p, r.pick(['#a8c890', '#c8a0d0', '#90b8c8', '#d0b080']), 0.5);
  // extra arms (lower pair)
  for (const sgn of [-1, 1]) {
    const a = new Path2D();
    a.moveTo(50 + sgn * 26, 84);
    a.bezierCurveTo(50 + sgn * 34, 90, 50 + sgn * 22, 98, 50 + sgn * 8, 96);
    a.lineTo(50 + sgn * 8, 92);
    a.bezierCurveTo(50 + sgn * 20, 92, 50 + sgn * 26, 90, 50 + sgn * 22, 84);
    a.closePath();
    lit(d, a, shade(skin, 0.85), 50 + sgn * 20, 90, 12);
  }
  // coat
  const sp = shoulders(38, 76, 7);
  lit(d, sp, shade(d.p, 0.7), 50, 90, 40);
  // vest
  const v = new Path2D();
  v.moveTo(42, 76);
  v.lineTo(50, 102);
  v.lineTo(58, 76);
  v.closePath();
  lit(d, v, d.s, 50, 86, 14);
  c.fillStyle = '#e8d8a0';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(50, 84 + i * 5, 0.9, 0, TAU);
    c.fill();
  }
  // cravat / bow
  const bow = new Path2D();
  bow.moveTo(50, 76);
  bow.lineTo(44, 72);
  bow.lineTo(44, 80);
  bow.closePath();
  bow.moveTo(50, 76);
  bow.lineTo(56, 72);
  bow.lineTo(56, 80);
  bow.closePath();
  lit(d, bow, mix(d.s, '#a02030', 0.6), 50, 76, 8);
  // upper arms with hands clasped (dapper)
  const hands = r.chance(0.6);
  for (const sgn of [-1, 1]) {
    const a = new Path2D();
    a.moveTo(50 + sgn * 34, 82);
    a.bezierCurveTo(50 + sgn * 36, 70, 50 + sgn * 22, 64, 50 + sgn * (hands ? 6 : 16), 66);
    a.lineTo(50 + sgn * (hands ? 6 : 16), 70);
    a.bezierCurveTo(50 + sgn * 20, 70, 50 + sgn * 28, 74, 50 + sgn * 28, 84);
    a.closePath();
    lit(d, a, shade(d.p, 0.8), 50 + sgn * 26, 74, 14);
    // three-fingered hand
    const hx = 50 + sgn * (hands ? 5 : 15);
    for (let f = 0; f < 3; f++) {
      const fp = ell(hx + sgn * -1, 64 + f * 2.4, 3.2, 1.3, sgn * 0.3);
      lit(d, fp, skin, hx, 66, 4);
    }
  }
  // head: bulbous with frills
  const hw = r.range(15, 19);
  const frill = r.int(4, 7);
  for (let i = 0; i < frill; i++) {
    const a = Math.PI + (i / (frill - 1)) * Math.PI;
    const fx = 50 + Math.cos(a) * (hw + 3);
    const fy = 36 + Math.sin(a) * (hw * 0.9 + 3);
    const fp = ell(fx, fy, 3.5, 6, a + Math.PI / 2);
    lit(d, fp, mix(skin, d.s, 0.4), fx, fy, 6);
  }
  const head = ell(50, 38, hw, hw * 0.92);
  lit(d, head, skin, 50, 38, hw);
  // spots
  c.fillStyle = rgba(shade(skin, 0.6), 0.45);
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.arc(50 + r.range(-hw * 0.8, hw * 0.8), 38 + r.range(-hw * 0.8, -hw * 0.3), r.range(0.6, 1.4), 0, TAU);
    c.fill();
  }
  // whisker tendrils
  c.strokeStyle = shade(skin, 0.7);
  c.lineWidth = 1;
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(50 + sgn * 5, 50 + i);
      c.quadraticCurveTo(50 + sgn * 14, 52 + i * 3, 50 + sgn * (18 + i * 2), 58 + i * 3);
      c.stroke();
    }
  }
  eyePair(d, 37, 7, 4.5, 3.6, mix(d.s, '#e0a020', 0.5), 0.15, 'slit');
  // monocle
  if (r.chance(0.7)) {
    c.strokeStyle = '#d8b860';
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(57, 37, 5.4, 0, TAU);
    c.stroke();
    c.fillStyle = 'rgba(200,230,255,0.15)';
    c.fill();
    c.beginPath();
    c.moveTo(61, 41);
    c.quadraticCurveTo(66, 56, 60, 70);
    c.lineWidth = 0.5;
    c.stroke();
  }
  // small beak-like mouth
  c.fillStyle = shade(skin, 0.4);
  c.beginPath();
  c.moveTo(46, 47);
  c.quadraticCurveTo(50, 51, 54, 47);
  c.quadraticCurveTo(50, 48.5, 46, 47);
  c.fill();
  // hat
  if (r.chance(0.5)) {
    const hat = new Path2D();
    hat.rect(40, 12, 20, 12);
    hat.rect(35, 22, 30, 3);
    lit(d, hat, '#22202a', 50, 18, 14);
    c.fillStyle = d.s;
    c.fillRect(40, 20, 20, 2);
  }
}

function zealot(d: PD) {
  const { c, r } = d;
  const robe = d.p;
  const trim = mix(d.s, '#e8c070', 0.4);
  // halo behind
  if (r.chance(0.6)) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(trim, 0.6);
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(50, 38, 27, 0, TAU);
    c.stroke();
    c.lineWidth = 0.6;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      c.beginPath();
      c.moveTo(50 + Math.cos(a) * 28.5, 38 + Math.sin(a) * 28.5);
      c.lineTo(50 + Math.cos(a) * (i % 2 ? 31 : 33), 38 + Math.sin(a) * (i % 2 ? 31 : 33));
      c.stroke();
    }
    c.restore();
  }
  // robe body
  const sp = shoulders(44, 70, 14);
  lit(d, sp, robe, 50, 88, 44);
  // hood
  const hood = new Path2D();
  const peak = r.range(8, 16);
  hood.moveTo(50, peak);
  hood.bezierCurveTo(68, peak + 8, 74, 50, 70, 74);
  hood.lineTo(30, 74);
  hood.bezierCurveTo(26, 50, 32, peak + 8, 50, peak);
  hood.closePath();
  lit(d, hood, robe, 50, 40, 34);
  // hood folds
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 1;
  for (const sgn of [-1, 1]) {
    c.beginPath();
    c.moveTo(50 + sgn * 6, peak + 4);
    c.quadraticCurveTo(50 + sgn * 18, 40, 50 + sgn * 17, 72);
    c.stroke();
  }
  // face void
  const face = new Path2D();
  face.moveTo(50, 26);
  face.bezierCurveTo(62, 28, 63, 50, 58, 62);
  face.quadraticCurveTo(50, 68, 42, 62);
  face.bezierCurveTo(37, 50, 38, 28, 50, 26);
  face.closePath();
  c.fillStyle = radial(c, 50, 48, 22, [
    [0, '#040306'],
    [0.7, '#0a080e'],
    [1, shade(robe, 0.25)],
  ]);
  c.fill(face);
  // eyes
  const ne = r.pick([2, 2, 3]);
  const eyeCol = glowCol(d.s, 0.6);
  if (ne === 3) glowDot(c, 50, 37, 1.1, eyeCol);
  for (const sgn of [-1, 1]) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(eyeCol, 0.9);
    c.beginPath();
    c.ellipse(50 + sgn * 5, 44, 2.6, 0.9, sgn * -0.25, 0, TAU);
    c.fill();
    c.restore();
    glowDot(c, 50 + sgn * 5, 44, 1.2, eyeCol, 0.8);
  }
  // trim along hood edge
  c.strokeStyle = trim;
  c.lineWidth = 1.6;
  c.stroke(face);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(30, 74);
  c.lineTo(70, 74);
  c.stroke();
  // sigil on chest
  c.save();
  c.translate(50, 88);
  c.strokeStyle = trim;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(0, 0, 5, 0, TAU);
  c.moveTo(0, -8);
  c.lineTo(0, 8);
  c.moveTo(-6, -3);
  c.lineTo(6, -3);
  c.stroke();
  c.restore();
  glowDot(c, 50, 88, 1, eyeCol, 0.5);
  // stole
  for (const sgn of [-1, 1]) {
    c.fillStyle = shade(trim, 0.8);
    c.fillRect(50 + sgn * 14 - 2, 76, 4, 30);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 80; y < 104; y += 5) c.fillRect(50 + sgn * 14 - 2, y, 4, 0.8);
  }
}

function hive(d: PD) {
  const { c, r } = d;
  const chitin = d.p;
  const bio = glowCol(d.s, 0.6);
  // segmented neck/thorax
  const sp = shoulders(40, 78, 10);
  lit(d, sp, shade(chitin, 0.75), 50, 92, 40);
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(14 + i * 2, 86 + i * 5);
    c.quadraticCurveTo(50, 80 + i * 5, 86 - i * 2, 86 + i * 5);
    c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const np = ell(50, 66 + i * 5, 10 - i, 3.5);
    lit(d, np, chitin, 50, 66 + i * 5, 10);
  }
  // antennae
  for (const sgn of [-1, 1]) {
    c.strokeStyle = shade(chitin, 0.5);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(50 + sgn * 6, 24);
    const ex = 50 + sgn * r.range(18, 28);
    const ey = r.range(2, 10);
    c.bezierCurveTo(50 + sgn * 8, 10, ex - sgn * 6, ey + 4, ex, ey);
    c.stroke();
    glowDot(c, ex, ey, 0.9, bio, 0.8);
  }
  // head
  const hw = r.range(17, 21);
  const head = new Path2D();
  head.moveTo(50, 18);
  head.bezierCurveTo(50 + hw * 1.1, 18, 50 + hw, 48, 50 + hw * 0.4, 60);
  head.quadraticCurveTo(50, 64, 50 - hw * 0.4, 60);
  head.bezierCurveTo(50 - hw, 48, 50 - hw * 1.1, 18, 50, 18);
  head.closePath();
  lit(d, head, chitin, 50, 36, hw);
  // plates
  c.save();
  c.clip(head);
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(50, 18);
  c.lineTo(50, 34);
  for (const sgn of [-1, 1]) {
    c.moveTo(50, 34);
    c.quadraticCurveTo(50 + sgn * hw * 0.6, 30, 50 + sgn * hw, 38);
  }
  c.stroke();
  c.restore();
  // mandibles
  for (const sgn of [-1, 1]) {
    const m = new Path2D();
    m.moveTo(50 + sgn * 5, 54);
    m.bezierCurveTo(50 + sgn * 14, 58, 50 + sgn * 12, 70, 50 + sgn * 3, 72);
    m.bezierCurveTo(50 + sgn * 8, 66, 50 + sgn * 8, 62, 50 + sgn * 3, 58);
    m.closePath();
    lit(d, m, mix(chitin, '#d8c8a0', 0.4), 50 + sgn * 8, 62, 8);
  }
  // mouth glow
  c.fillStyle = radial(c, 50, 60, 6, [
    [0, rgba(bio, 0.6)],
    [1, rgba(bio, 0)],
  ]);
  c.fillRect(44, 54, 12, 12);
  // many eyes
  const big = r.range(4, 5.5);
  const extra = r.int(2, 4);
  const eyes: [number, number, number][] = [[11, 40, big]];
  for (let i = 0; i < extra; i++) eyes.push([r.range(4, 13), r.range(24, 50), r.range(1.2, 2.6)]);
  for (const [dx, y, R] of eyes) {
    for (const sgn of [-1, 1]) {
      const x = 50 + sgn * dx;
      const ep = ell(x, y, R, R * 0.85);
      c.fillStyle = radial(c, x - R * 0.3, y - R * 0.3, R * 1.2, [
        [0, mix(bio, '#ffffff', 0.4)],
        [0.4, shade(bio, 0.6)],
        [1, '#050805'],
      ]);
      c.fill(ep);
      c.strokeStyle = '#000';
      c.lineWidth = 0.6;
      c.stroke(ep);
      // compound facets
      if (R > 3) {
        c.save();
        c.clip(ep);
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.lineWidth = 0.4;
        for (let k = -R; k < R; k += 1.3) {
          c.beginPath();
          c.moveTo(x + k, y - R);
          c.lineTo(x + k + R, y + R);
          c.moveTo(x - k, y - R);
          c.lineTo(x - k - R, y + R);
          c.stroke();
        }
        c.restore();
      }
      glowDot(c, x - R * 0.2, y - R * 0.2, R * 0.25, bio, 0.6);
    }
  }
}

function machine(d: PD) {
  const { c, r } = d;
  const metal = mix(d.p, '#606a78', 0.5);
  const led = glowCol(d.s, 0.6);
  // cables
  c.lineWidth = 2.4;
  for (let i = 0; i < 5; i++) {
    c.strokeStyle = shade(r.pick(['#303030', '#402020', '#203040', metal]), 0.8);
    const x = 40 + i * 5;
    c.beginPath();
    c.moveTo(x, 60);
    c.bezierCurveTo(x + r.range(-6, 6), 72, x + r.range(-10, 10), 82, x + r.range(-20, 20), 104);
    c.stroke();
  }
  // chassis
  const sp = new Path2D();
  sp.moveTo(12, 104);
  sp.lineTo(16, 82);
  sp.lineTo(32, 76);
  sp.lineTo(68, 76);
  sp.lineTo(84, 82);
  sp.lineTo(88, 104);
  sp.closePath();
  lit(d, sp, shade(metal, 0.8), 50, 90, 40);
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 0.7;
  for (const x of [32, 50, 68]) {
    c.beginPath();
    c.moveTo(x, 76);
    c.lineTo(x + (x - 50) * 0.3, 104);
    c.stroke();
  }
  // LED strip on chest
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    c.fillStyle = rgba(led, r.chance(0.6) ? 0.85 : 0.2);
    c.fillRect(36 + i * 2.8, 86, 2, 1.4);
  }
  c.restore();
  // head plate
  const shape = r.int(0, 2);
  let head: Path2D;
  if (shape === 0) {
    head = new Path2D();
    head.roundRect(28, 16, 44, 44, 6);
  } else if (shape === 1) {
    head = new Path2D();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const x = 50 + Math.cos(a) * 25;
      const y = 38 + Math.sin(a) * 25;
      if (i === 0) head.moveTo(x, y);
      else head.lineTo(x, y);
    }
    head.closePath();
  } else {
    head = new Path2D();
    head.moveTo(30, 18);
    head.lineTo(70, 18);
    head.lineTo(74, 46);
    head.lineTo(60, 62);
    head.lineTo(40, 62);
    head.lineTo(26, 46);
    head.closePath();
  }
  lit(d, head, metal, 50, 38, 28);
  // seams & bolts
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(30, 52);
  c.lineTo(70, 52);
  c.stroke();
  c.fillStyle = shade(metal, 0.5);
  for (const [x, y] of [
    [33, 21],
    [67, 21],
    [33, 56],
    [67, 56],
  ])
    c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  // sensor array
  const layout = r.int(0, 2);
  const lens = (x: number, y: number, R: number) => {
    c.fillStyle = '#0a0b0e';
    c.beginPath();
    c.arc(x, y, R * 1.25, 0, TAU);
    c.fill();
    c.fillStyle = radial(c, x, y, R, [
      [0, mix(led, '#ffffff', 0.5)],
      [0.3, led],
      [0.7, shade(led, 0.35)],
      [1, '#050505'],
    ]);
    c.beginPath();
    c.arc(x, y, R, 0, TAU);
    c.fill();
    c.strokeStyle = shade(metal, 1.2);
    c.lineWidth = 0.6;
    c.beginPath();
    c.arc(x, y, R * 1.25, 0, TAU);
    c.stroke();
    glowDot(c, x, y, R * 0.3, led, 0.8);
  };
  if (layout === 0) {
    lens(50, 36, 8);
    for (const sgn of [-1, 1]) lens(50 + sgn * 14, 30, 2.6);
    lens(50, 48, 1.8);
  } else if (layout === 1) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) lens(38 + i * 12, 30 + j * 11, 3.4);
  } else {
    // visor slit with scanning dot
    c.fillStyle = '#08090c';
    c.fillRect(32, 32, 36, 7);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(led, 0.35);
    c.fillRect(32, 34.5, 36, 2);
    c.restore();
    glowDot(c, r.range(36, 64), 35.5, 2, led, 1);
  }
  // grille mouth
  c.fillStyle = '#121418';
  c.fillRect(42, 54, 16, 4);
  c.fillStyle = shade(metal, 0.7);
  for (let x = 43; x < 58; x += 2) c.fillRect(x, 54, 0.7, 4);
  // antenna
  for (const sgn of r.chance(0.5) ? [-1, 1] : [1]) {
    c.strokeStyle = shade(metal, 0.6);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(50 + sgn * 16, 18);
    c.lineTo(50 + sgn * 20, 4);
    c.stroke();
    glowDot(c, 50 + sgn * 20, 4, 0.9, '#ff4040', 0.9);
  }
}

function raider(d: PD) {
  const { c, r } = d;
  const hide = mix(d.p, r.pick(['#7a8a50', '#8a6a48', '#6a5a70', '#a07858']), 0.55);
  // shoulder armor with spikes
  const sp = shoulders(44, 78, 10);
  lit(d, sp, '#3a3530', 50, 92, 44);
  for (const sgn of [-1, 1]) {
    const pad = ell(50 + sgn * 30, 84, 15, 9, sgn * 0.3);
    lit(d, pad, mix(d.s, '#5a5048', 0.5), 50 + sgn * 30, 84, 14);
    for (let i = 0; i < 3; i++) {
      const sx = 50 + sgn * (22 + i * 7);
      const spk = new Path2D();
      spk.moveTo(sx - 2, 80 - i);
      spk.lineTo(sx + sgn * 2, 68 - i * 2);
      spk.lineTo(sx + 2, 80 - i);
      spk.closePath();
      lit(d, spk, '#b0aaa0', sx, 76, 6);
    }
  }
  // strap & ammo
  c.strokeStyle = '#2a2018';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(30, 80);
  c.lineTo(68, 104);
  c.stroke();
  c.fillStyle = '#c8a040';
  for (let i = 0; i < 5; i++) c.fillRect(36 + i * 6, 82 + i * 3.8, 2, 3);
  // ears (notched)
  for (const sgn of [-1, 1]) {
    const ep = new Path2D();
    ep.moveTo(50 + sgn * 12, 30);
    ep.lineTo(50 + sgn * 28, r.range(8, 16));
    ep.lineTo(50 + sgn * 24, 22);
    ep.lineTo(50 + sgn * 27, 24);
    ep.lineTo(50 + sgn * 16, 38);
    ep.closePath();
    lit(d, ep, shade(hide, 0.85), 50 + sgn * 20, 24, 12);
  }
  // head: muzzle
  const head = new Path2D();
  head.moveTo(50, 20);
  head.bezierCurveTo(66, 20, 70, 38, 66, 48);
  head.bezierCurveTo(64, 56, 60, 66, 50, 68);
  head.bezierCurveTo(40, 66, 36, 56, 34, 48);
  head.bezierCurveTo(30, 38, 34, 20, 50, 20);
  head.closePath();
  lit(d, head, hide, 50, 40, 24);
  // muzzle
  const mz = ell(50, 56, 9, 8);
  lit(d, mz, shade(hide, 1.1), 50, 56, 9, false);
  c.fillStyle = '#1a1210';
  c.beginPath();
  c.ellipse(50, 52, 3, 1.8, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#1a1210';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(42, 61);
  c.quadraticCurveTo(50, 64, 58, 61);
  c.stroke();
  // tusks
  for (const sgn of [-1, 1]) {
    const t = new Path2D();
    t.moveTo(50 + sgn * 6, 62);
    t.quadraticCurveTo(50 + sgn * 9, 56, 50 + sgn * 8, r.range(50, 54));
    t.lineTo(50 + sgn * 5, 61);
    t.closePath();
    lit(d, t, '#e8e0c8', 50 + sgn * 7, 58, 4);
  }
  // eyes: one natural, one cybernetic
  const cyberSide = r.pick([-1, 1]);
  for (const sgn of [-1, 1]) {
    const x = 50 + sgn * 7.5;
    if (sgn === cyberSide) {
      const plate = new Path2D();
      plate.moveTo(x - 6, 36);
      plate.lineTo(x + 6, 36);
      plate.lineTo(x + 5, 46);
      plate.lineTo(x - 5, 46);
      plate.closePath();
      lit(d, plate, '#5a5e66', x, 41, 7);
      c.fillStyle = '#050505';
      c.beginPath();
      c.arc(x, 41, 2.6, 0, TAU);
      c.fill();
      glowDot(c, x, 41, 1.4, '#ff2020', 1);
    } else {
      const ep = ell(x, 41, 3.2, 1.8, sgn * -0.2);
      c.fillStyle = '#e8c040';
      c.fill(ep);
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(x, 41, 0.6, 1.6, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#000';
      c.lineWidth = 0.7;
      c.stroke(ep);
    }
  }
  // scars
  c.strokeStyle = 'rgba(240,200,190,0.55)';
  c.lineWidth = 0.8;
  for (let i = 0; i < r.int(1, 3); i++) {
    const x = r.range(38, 62);
    const y = r.range(26, 50);
    const L = r.range(6, 12);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + L * 0.5, y + L);
    c.stroke();
    for (let k = 1; k < 4; k++) {
      const px = x + (L * 0.5 * k) / 4;
      const py = y + (L * k) / 4;
      c.beginPath();
      c.moveTo(px - 1.2, py + 0.4);
      c.lineTo(px + 1.2, py - 0.4);
      c.stroke();
    }
  }
  // goggles on forehead
  if (r.chance(0.6)) {
    c.fillStyle = '#2a2420';
    c.fillRect(34, 27, 32, 3);
    for (const sgn of [-1, 1]) {
      const g = ell(50 + sgn * 7, 28.5, 5, 3.5);
      lit(d, g, '#4a4440', 50 + sgn * 7, 28.5, 5);
      c.fillStyle = rgba(d.s, 0.7);
      c.beginPath();
      c.ellipse(50 + sgn * 7, 28.5, 3.4, 2.2, 0, 0, TAU);
      c.fill();
    }
  }
}

function ancient(d: PD) {
  const { c, r } = d;
  const skin = mix(d.p, '#c8d0e8', 0.55);
  const glyph = glowCol(d.s, 0.7);
  // aura
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = radial(c, 50, 36, 44, [
    [0, rgba(glyph, 0.25)],
    [1, rgba(glyph, 0)],
  ]);
  c.fillRect(0, 0, 100, 100);
  c.restore();
  // flowing high collar
  const col = new Path2D();
  col.moveTo(16, 104);
  col.bezierCurveTo(18, 80, 26, 64, 34, 58);
  col.lineTo(50, 74);
  col.lineTo(66, 58);
  col.bezierCurveTo(74, 64, 82, 80, 84, 104);
  col.closePath();
  lit(d, col, mix(d.p, '#203050', 0.4), 50, 84, 40);
  c.strokeStyle = rgba(glyph, 0.7);
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(34, 58);
  c.lineTo(50, 74);
  c.lineTo(66, 58);
  c.stroke();
  // long neck
  const nk = new Path2D();
  nk.moveTo(44, 56);
  nk.lineTo(43, 76);
  nk.lineTo(57, 76);
  nk.lineTo(56, 56);
  nk.closePath();
  lit(d, nk, shade(skin, 0.85), 50, 66, 10, false);
  // elongated cranium
  const crown = r.range(2, 10);
  const head = new Path2D();
  head.moveTo(50, crown);
  head.bezierCurveTo(70, crown, 72, 34, 66, 46);
  head.bezierCurveTo(62, 56, 56, 64, 50, 64);
  head.bezierCurveTo(44, 64, 38, 56, 34, 46);
  head.bezierCurveTo(28, 34, 30, crown, 50, crown);
  head.closePath();
  lit(d, head, skin, 50, 30, 30);
  // vast eyes
  const eyeY = r.range(40, 44);
  for (const sgn of [-1, 1]) {
    const x = 50 + sgn * 8.5;
    const ep = new Path2D();
    ep.ellipse(x, eyeY, 7, 4.2, sgn * 0.35, 0, TAU);
    c.fillStyle = radial(c, x, eyeY, 7, [
      [0, '#101830'],
      [1, '#020208'],
    ]);
    c.fill(ep);
    // starlight specks
    c.save();
    c.clip(ep);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(255,255,255,${r.range(0.3, 0.9)})`;
      c.fillRect(x + r.range(-5, 5), eyeY + r.range(-3, 3), 0.5, 0.5);
    }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.ellipse(x - 2, eyeY - 1.6, 1.6, 0.8, sgn * 0.35, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = 0.6;
    c.stroke(ep);
  }
  // tiny mouth
  c.strokeStyle = shade(skin, 0.5);
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(48, 56);
  c.lineTo(52, 56);
  c.stroke();
  // forehead glyphs
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(glyph, 0.9);
  c.lineWidth = 0.8;
  const gy = r.range(18, 24);
  c.beginPath();
  c.arc(50, gy, 3, 0, TAU);
  c.moveTo(50, gy - 6);
  c.lineTo(50, gy + 6);
  for (const sgn of [-1, 1]) {
    c.moveTo(50 + sgn * 6, gy + 2);
    c.lineTo(50 + sgn * 9, gy - 2);
    c.lineTo(50 + sgn * 12, gy + 2);
  }
  c.stroke();
  c.restore();
  glowDot(c, 50, gy, 0.8, glyph, 0.9);
  // cheek marks
  for (const sgn of [-1, 1]) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba(glyph, 0.5);
    for (let i = 0; i < 3; i++) c.fillRect(50 + sgn * (10 + i * 1.6) - 0.4, 49 + i * 1.6, 0.8, 0.8);
    c.restore();
  }
}

function warden(d: PD) {
  const { c, r } = d;
  const dark = r.chance(0.5);
  const eye = r.chance(0.6) ? '#ff2a3a' : glowCol(d.s, 0.6);
  // void cowl
  const sp = shoulders(46, 70, 16);
  c.fillStyle = '#060608';
  c.fill(sp);
  c.strokeStyle = 'rgba(200,200,210,0.25)';
  c.lineWidth = 0.8;
  c.stroke(sp);
  const cowl = new Path2D();
  cowl.moveTo(50, 6);
  cowl.bezierCurveTo(78, 8, 80, 60, 72, 76);
  cowl.lineTo(28, 76);
  cowl.bezierCurveTo(20, 60, 22, 8, 50, 6);
  cowl.closePath();
  c.fillStyle = radial(c, 50, 40, 40, [
    [0, '#14141a'],
    [1, '#030304'],
  ]);
  c.fill(cowl);
  c.stroke(cowl);
  // mask
  const mask = new Path2D();
  mask.moveTo(50, 16);
  mask.bezierCurveTo(66, 16, 68, 40, 64, 52);
  mask.lineTo(50, 70);
  mask.lineTo(36, 52);
  mask.bezierCurveTo(32, 40, 34, 16, 50, 16);
  mask.closePath();
  const mb = dark ? '#1c1d22' : '#e4e4ea';
  c.fillStyle = radial(c, 44, 30, 40, [
    [0, shade(mb, dark ? 2 : 1.1)],
    [0.6, mb],
    [1, shade(mb, dark ? 0.5 : 0.6)],
  ]);
  c.fill(mask);
  c.strokeStyle = dark ? 'rgba(220,220,230,0.6)' : 'rgba(10,10,14,0.8)';
  c.lineWidth = 0.8;
  c.stroke(mask);
  // centre ridge
  c.strokeStyle = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  c.beginPath();
  c.moveTo(50, 16);
  c.lineTo(50, 70);
  c.stroke();
  // single eye slit
  const ey = r.range(36, 42);
  c.fillStyle = '#000';
  c.fillRect(42, ey - 0.8, 16, 1.6);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(30, 0, 70, 0);
  g.addColorStop(0, rgba(eye, 0));
  g.addColorStop(0.5, rgba(eye, 0.9));
  g.addColorStop(1, rgba(eye, 0));
  c.fillStyle = g;
  c.fillRect(30, ey - 0.4, 40, 0.8);
  c.restore();
  glowDot(c, 50, ey, 1.4, eye, 1);
}

const DRAW: Record<PortraitArchetype, (d: PD) => void> = {
  human,
  mercantile,
  zealot,
  hive,
  machine,
  raider,
  ancient,
  warden,
};

export function makePortrait(
  seed: number,
  archetype: PortraitArchetype,
  size: number,
  primary: string,
  secondary: string,
): HTMLCanvasElement {
  const S = Math.max(16, Math.round(size));
  const [cv, c] = makeCanvas(S, S);
  const r = new RNG(hashSeed(seed, archetype, 'portrait'));
  const k = S / 100;
  const glow = glowCol(secondary, 0.6);
  // ---- background panel
  c.fillStyle = radial(c, S * 0.5, S * 0.4, S * 0.8, [
    [0, mix(secondary, '#0a0e18', 0.78)],
    [0.6, mix(secondary, '#05070c', 0.9)],
    [1, '#020306'],
  ]);
  c.fillRect(0, 0, S, S);
  c.save();
  c.scale(k, k);
  // faint grid / backdrop shapes
  c.strokeStyle = rgba(glow, 0.06);
  c.lineWidth = 0.4;
  for (let i = 0; i <= 100; i += 10) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, 100);
    c.moveTo(0, i);
    c.lineTo(100, i);
    c.stroke();
  }
  const d: PD = { c, r, p: primary, s: secondary, glow, px: 1 / k };
  (DRAW[archetype] ?? human)(d);
  c.restore();
  // ---- screen effects: scanlines, vignette, glass sheen, frame
  c.fillStyle = 'rgba(0,0,0,0.22)';
  const step = Math.max(2, Math.round(S / 120));
  for (let y = 0; y < S; y += step * 2) c.fillRect(0, y, S, step);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = rgba(glow, 0.04);
  c.fillRect(0, 0, S, S);
  const sh = c.createLinearGradient(0, 0, S, S);
  sh.addColorStop(0, 'rgba(255,255,255,0.06)');
  sh.addColorStop(0.35, 'rgba(255,255,255,0)');
  c.fillStyle = sh;
  c.fillRect(0, 0, S, S);
  c.restore();
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.75, [
    [0.55, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.7)'],
  ]);
  c.fillRect(0, 0, S, S);
  const fw = Math.max(1, S * 0.012);
  c.strokeStyle = rgba(glow, 0.55);
  c.lineWidth = fw;
  c.strokeRect(fw / 2, fw / 2, S - fw, S - fw);
  // corner brackets
  c.lineWidth = fw * 1.8;
  c.strokeStyle = rgba(glow, 0.85);
  const L = S * 0.08;
  const o = fw * 2;
  for (const [x, y, sx, sy] of [
    [o, o, 1, 1],
    [S - o, o, -1, 1],
    [o, S - o, 1, -1],
    [S - o, S - o, -1, -1],
  ]) {
    c.beginPath();
    c.moveTo(x, y + sy * L);
    c.lineTo(x, y);
    c.lineTo(x + sx * L, y);
    c.stroke();
  }
  return cv;
}
