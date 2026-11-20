/** World-space drawing for thread, tethers, anchors and the Tide. */
import { TAU } from '../core/math';
import type { World } from './world';
import type { POI } from './entities';
import { STRAND_GLYPH } from './weave';
import { graftDef } from './grafts';
import type { RunState } from './run';

type C = CanvasRenderingContext2D;

export function drawAnchor(c: C, p: POI, t: number, z: number) {
  const col = p.anchorColor ?? '#ffd36b';
  const woven = p.woven || p.erased;
  c.save();
  c.translate(p.x, p.y);
  c.globalAlpha = woven ? 0.25 : 1;
  c.strokeStyle = col;
  c.lineWidth = 2;
  // a slowly turning knot: three overlapping loops
  for (let i = 0; i < 3; i++) {
    const a = t * 0.6 + (i * TAU) / 3;
    c.beginPath();
    c.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 22, 10, a, 0, TAU);
    c.stroke();
  }
  if (!woven) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = col;
    c.globalAlpha = 0.12 + Math.sin(t * 2 + p.id) * 0.05;
    c.beginPath();
    c.arc(0, 0, 46, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  c.globalAlpha = woven ? 0.3 : 0.9;
  c.fillStyle = col;
  c.font = `${16}px system-ui`;
  c.textAlign = 'center';
  c.fillText(p.anchor ? STRAND_GLYPH[p.anchor] : '?', 0, 6);
  c.restore();
  void z;
}

/** small ring on loopable things that still have a strand to give */
export function drawAnchorHalo(c: C, p: POI, t: number, z: number) {
  if (!p.anchor || p.woven || p.erased || p.kind === 'anchor') return;
  c.save();
  c.strokeStyle = 'rgba(190,255,255,0.22)';
  c.lineWidth = 1.5 / z;
  c.setLineDash([6 / z, 10 / z]);
  c.lineDashOffset = -t * 20;
  c.beginPath();
  c.arc(p.x, p.y, p.r + 40, 0, TAU);
  c.stroke();
  c.restore();
}

export function drawTide(c: C, w: World, vx0: number, vy0: number, vx1: number, vy1: number, t: number, z: number) {
  const th = w.thread;
  if (!th.tideOn) return;
  const f = th.front;
  const d = th.tideDir;
  const px = -d.y, py = d.x;
  const R = Math.max(vx1 - vx0, vy1 - vy0) * 2 + w.bounds * 2;
  // the front line centre nearest the camera
  const cx = (vx0 + vx1) / 2, cy = (vy0 + vy1) / 2;
  const along = cx * px + cy * py;
  const ox = d.x * f + px * along, oy = d.y * f + py * along;
  // warn about what is about to go
  for (const p of w.pois) {
    if (p.erased || p.kind === 'finale') continue;
    const gap = th.tideGap(p.x, p.y);
    if (gap < 900 && gap > 0) {
      c.strokeStyle = `rgba(255,120,110,${0.35 + 0.3 * Math.sin(t * 6)})`;
      c.lineWidth = 2 / z;
      c.beginPath();
      c.arc(p.x, p.y, p.r + 30, 0, TAU);
      c.stroke();
    }
  }
  if (f > w.bounds + 1500) return;
  c.save();
  c.globalCompositeOperation = 'source-over';
  // the erased side: a colourless static where space used to be
  c.beginPath();
  c.moveTo(ox - px * R, oy - py * R);
  c.lineTo(ox + px * R, oy + py * R);
  c.lineTo(ox + px * R + d.x * R, oy + py * R + d.y * R);
  c.lineTo(ox - px * R + d.x * R, oy - py * R + d.y * R);
  c.closePath();
  c.fillStyle = 'rgba(26,26,34,0.93)';
  c.fill();
  const pat = c.createPattern(staticTex(), 'repeat');
  if (pat) {
    pat.setTransform(new DOMMatrix().translate((t * 37) % 256, (t * 23) % 256).scale(2));
    c.globalAlpha = 0.55;
    c.fillStyle = pat;
    c.fill();
    c.globalAlpha = 1;
  }
  // shimmering edge
  c.globalCompositeOperation = 'lighter';
  const span = (vx1 - vx0 + vy1 - vy0) * 0.75;
  for (let k = 0; k < 3; k++) {
    c.strokeStyle = k === 0 ? 'rgba(235,235,255,0.75)' : k === 1 ? 'rgba(170,180,255,0.25)' : 'rgba(255,255,255,0.10)';
    c.lineWidth = (k === 0 ? 3 : k === 1 ? 14 : 44) / z;
    c.beginPath();
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const s = -span + (2 * span * i) / steps;
      const wob = Math.sin(s * 0.01 + t * (1.5 + k)) * 18 + Math.sin(s * 0.003 - t) * 30;
      const x = ox + px * s + d.x * wob, y = oy + py * s + d.y * wob;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}

/** worn grafts, drawn onto the player's hull in ship-local space (nose points +x) */
export function drawGrafts(c: C, run: RunState, r: number, t: number) {
  const gs = run.grafts ?? [];
  // sockets spread along the flanks and tail
  const spots: [number, number, number][] = [[-0.2, -0.85, -1.2], [-0.2, 0.85, 1.2], [-0.9, 0, Math.PI], [0.5, 0, 0]];
  gs.forEach((g, i) => {
    if (!g) return;
    const [fx, fy, rot] = spots[i % spots.length];
    const arch = graftDef(g.id).arch;
    c.save();
    c.translate(fx * r, fy * r);
    c.rotate(rot);
    c.fillStyle = g.color;
    c.strokeStyle = g.color2;
    c.lineWidth = 1.5;
    const k = r * 0.38;
    c.beginPath();
    switch (arch) {
      case 'hive': // a pulsing sac
        c.ellipse(k * 0.3, 0, k * (0.75 + Math.sin(t * 3 + i) * 0.08), k * 0.55, 0, 0, TAU);
        break;
      case 'machine': // a lattice block
        c.rect(0, -k * 0.5, k, k);
        c.moveTo(0, 0);
        c.lineTo(k, 0);
        c.moveTo(k / 2, -k * 0.5);
        c.lineTo(k / 2, k * 0.5);
        break;
      case 'zealot': // a little halo
        c.arc(k * 0.5, 0, k * 0.5, 0, TAU);
        break;
      case 'raider': // a spike
        c.moveTo(0, -k * 0.35);
        c.lineTo(k * 1.4, 0);
        c.lineTo(0, k * 0.35);
        c.closePath();
        break;
      case 'ancient': // a crystal shard
        c.moveTo(0, 0);
        c.lineTo(k * 0.6, -k * 0.6);
        c.lineTo(k * 1.3, 0);
        c.lineTo(k * 0.6, k * 0.6);
        c.closePath();
        break;
      case 'mercantile': // a pod
        c.roundRect(0, -k * 0.4, k * 1.1, k * 0.8, k * 0.35);
        break;
      default: // a tendril
        c.moveTo(0, 0);
        c.quadraticCurveTo(k * 0.7, Math.sin(t * 4 + i) * k * 0.6, k * 1.4, 0);
        c.lineWidth = 3;
        c.stroke();
        c.restore();
        return;
    }
    if (arch === 'zealot') {
      c.lineWidth = 2.5;
      c.strokeStyle = g.color;
      c.stroke();
    } else {
      c.fill();
      c.stroke();
    }
    c.restore();
  });
}

let tex: HTMLCanvasElement | null = null;
function staticTex(): HTMLCanvasElement {
  if (tex) return tex;
  tex = document.createElement('canvas');
  tex.width = tex.height = 128;
  const g = tex.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    const on = v > 0.9 ? 255 : v > 0.75 ? 120 : 0;
    img.data[i] = img.data[i + 1] = on;
    img.data[i + 2] = Math.min(255, on + 20);
    img.data[i + 3] = on ? 60 + Math.random() * 120 : 0;
  }
  g.putImageData(img, 0, 0);
  // faint horizontal tears
  g.fillStyle = 'rgba(220,220,255,0.18)';
  for (let i = 0; i < 6; i++) g.fillRect(0, Math.random() * 128, 128, 1);
  return tex;
}

export function drawThread(c: C, w: World, t: number, z: number) {
  const th = w.thread;
  const now = w.t;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalCompositeOperation = 'lighter';
  for (const tr of th.trails) {
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const age = (now - b.t) / 4;
      const al = Math.max(0, 1 - age);
      c.strokeStyle = `rgba(170,255,255,${0.15 * al})`;
      c.lineWidth = 9 / Math.max(0.6, z);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.strokeStyle = `rgba(220,255,255,${0.85 * al})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  }
  // closing-loop flashes
  for (const f of th.flashes) {
    c.strokeStyle = `rgba(200,255,255,${f.t / 0.6})`;
    c.lineWidth = 5;
    c.beginPath();
    f.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.closePath();
    c.stroke();
    c.fillStyle = `rgba(150,255,255,${0.12 * (f.t / 0.6)})`;
    c.fill();
  }
  // tethers: a sagging rope with a soft glow
  const p = w.player;
  for (const te of th.tethers) {
    const s = te.ship;
    const dx = s.x - p.x, dy = s.y - p.y;
    const d = Math.hypot(dx, dy);
    const slack = Math.max(0, te.len - d) * 0.5;
    const mx = (p.x + s.x) / 2 - (dy / (d || 1)) * slack, my = (p.y + s.y) / 2 + (dx / (d || 1)) * slack;
    c.strokeStyle = 'rgba(160,255,255,0.25)';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(mx, my, s.x, s.y);
    c.stroke();
    c.strokeStyle = 'rgba(220,255,255,0.9)';
    c.lineWidth = 1.8;
    c.stroke();
  }
  c.restore();
  void t;
}
