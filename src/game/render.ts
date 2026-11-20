import { TAU, clamp, dist } from '../core/math';
import { input } from '../core/input';
import { hashSeed } from '../core/rng';
import { makeNebula, makeStarLayer } from '../art/background';
import { drawAnomaly, drawBeacon } from '../art/planets';
import type { World } from './world';
import type { Ship } from './entities';
import { hullDef, RARITY_COLORS } from './items';
import { factionById, repLabel } from './run';
import { xpForLevel } from './skills';
import { meta } from './meta';

const NEB_PALETTES: [string, string, string][] = [
  ['#2a1b4a', '#7a2a5a', '#1a4a6a'],
  ['#0f2a3a', '#2a6a7a', '#4a2a6a'],
  ['#3a1a1a', '#7a3a2a', '#2a1a4a'],
  ['#102a1a', '#2a5a4a', '#5a4a1a'],
  ['#1a1a3a', '#3a3a8a', '#7a2a6a'],
  ['#2a2a10', '#6a5a2a', '#1a3a5a'],
];

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  camX = 0;
  camY = 0;
  zoom = 1;
  targetZoom = 1;
  private bg: { neb: HTMLCanvasElement; stars: HTMLCanvasElement[]; seed: number } | null = null;
  toasts: { text: string; color: string; t: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  setBackground(seed: number) {
    if (this.bg?.seed === seed) return;
    const pal = NEB_PALETTES[seed % NEB_PALETTES.length];
    this.bg = {
      seed,
      neb: makeNebula(seed, 1600, 1600, pal),
      stars: [makeStarLayer(seed + 1, 1024, 1024, 0.9, 0.55), makeStarLayer(seed + 2, 1024, 1024, 0.45, 0.8), makeStarLayer(seed + 3, 1024, 1024, 0.15, 1)],
    };
  }

  toast(text: string, color = '#dde') {
    if (this.toasts.some((t) => t.text === text && t.t > 2)) return;
    this.toasts.push({ text, color, t: 4 });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  /** Draw only the background (menus). */
  drawBackdrop(t: number) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#03040a';
    c.fillRect(0, 0, this.w, this.h);
    if (!this.bg) this.setBackground(hashSeed('menu'));
    this.drawBg(t * 20, t * 6);
  }

  private drawBg(cx: number, cy: number) {
    const c = this.ctx;
    const bg = this.bg!;
    // nebula: very slow parallax, scaled to cover
    const nw = Math.max(this.w, this.h) * 1.6;
    const nx = -((cx * 0.03) % nw) - nw * 0.2;
    const ny = -((cy * 0.03) % nw) - nw * 0.2;
    c.globalAlpha = 0.9;
    c.drawImage(bg.neb, nx, ny, nw, nw);
    c.globalAlpha = 1;
    const speeds = [0.08, 0.18, 0.35];
    bg.stars.forEach((layer, i) => {
      const s = speeds[i];
      const tw = layer.width;
      const ox = (((-cx * s) % tw) + tw) % tw;
      const oy = (((-cy * s) % tw) + tw) % tw;
      for (let x = ox - tw; x < this.w; x += tw) for (let y = oy - tw; y < this.h; y += tw) c.drawImage(layer, x, y);
    });
  }

  render(world: World, rawDt: number) {
    const c = this.ctx;
    const p = world.player;
    // camera: follow with lead toward the mouse
    const mx = input.mouseX - this.w / 2, my = input.mouseY - this.h / 2;
    if (input.wheel) this.targetZoom = clamp(this.targetZoom * (input.wheel > 0 ? 0.9 : 1.1), 0.45, 1.4);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, rawDt * 6);
    const lead = 0.22;
    const tx = p.x + (mx * lead) / this.zoom, ty = p.y + (my * lead) / this.zoom;
    this.camX += (tx - this.camX) * Math.min(1, rawDt * 7);
    this.camY += (ty - this.camY) * Math.min(1, rawDt * 7);
    const shake = meta.settings.shake ? world.shake : 0;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    const z = this.zoom;
    // mouse to world
    input.worldX = this.camX + mx / z;
    input.worldY = this.camY + my / z;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, this.w, this.h);
    this.drawBg(this.camX, this.camY);
    if (world.hazardTint) {
      c.fillStyle = world.hazardTint;
      c.fillRect(0, 0, this.w, this.h);
    }
    // world transform
    c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.w / 2 - this.camX * z + sx), this.dpr * (this.h / 2 - this.camY * z + sy));
    const vx0 = this.camX - this.w / 2 / z - 300, vx1 = this.camX + this.w / 2 / z + 300;
    const vy0 = this.camY - this.h / 2 / z - 300, vy1 = this.camY + this.h / 2 / z + 300;
    const inView = (x: number, y: number, r: number) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
    const t = world.t;

    // boundary ring
    c.strokeStyle = 'rgba(160,180,255,0.07)';
    c.lineWidth = 3 / z;
    c.setLineDash([30, 30]);
    c.beginPath();
    c.arc(0, 0, world.bounds, 0, TAU);
    c.stroke();
    c.setLineDash([]);
    // orbits
    c.strokeStyle = 'rgba(150,170,220,0.06)';
    c.lineWidth = 1.5 / z;
    for (const poi of world.pois) if (poi.orbit && poi.kind === 'planet') {
      c.beginPath();
      c.arc(0, 0, poi.orbit.r, 0, TAU);
      c.stroke();
    }
    // gravity wells
    for (const g of world.gravityWells) {
      const grd = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grd.addColorStop(0, 'rgba(0,0,0,0.6)');
      grd.addColorStop(0.3, 'rgba(60,20,90,0.15)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grd;
      c.beginPath();
      c.arc(g.x, g.y, g.r, 0, TAU);
      c.fill();
    }
    // star
    if (world.star && inView(world.star.x, world.star.y, world.star.r * 3)) {
      const s = world.star;
      const sw = s.sprite.width;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(s.sprite, s.x - sw / 2, s.y - sw / 2);
      c.globalCompositeOperation = 'source-over';
    }
    // POIs
    for (const poi of world.pois) {
      if (!inView(poi.x, poi.y, poi.r * 2)) continue;
      if (poi.sprite) {
        const sw = poi.sprite.width;
        c.save();
        c.translate(poi.x, poi.y);
        if (poi.kind === 'station') c.rotate(poi.spin);
        if (poi.kind === 'derelict') c.rotate(poi.spin * 0.6 + poi.id);
        if (poi.kind === 'planet' && world.star) {
          // light from the star: rotate sprite so its lit side faces the star (sprite lit from upper-left)
          const a = Math.atan2(world.star.y - poi.y, world.star.x - poi.x);
          c.rotate(a + Math.PI * 0.75);
        }
        c.globalAlpha = poi.used && poi.kind !== 'planet' && poi.kind !== 'station' ? 0.55 : 1;
        c.drawImage(poi.sprite, -sw / 2, -sw / 2);
        c.restore();
      } else if (poi.kind === 'anomaly') {
        drawAnomaly(c, poi.x, poi.y, poi.r * 1.6, t, poi.anomalyKind);
      } else if (poi.kind === 'beacon' || poi.kind === 'distress' || poi.kind === 'finale') {
        drawBeacon(c, poi.x, poi.y, poi.r * (poi.kind === 'finale' ? 1.8 : 1), t, poi.kind === 'distress' ? '#ff6a5a' : poi.kind === 'finale' ? '#ffffff' : '#ffd36b');
      }
      // label
      if (poi.discovered && dist(poi.x, poi.y, p.x, p.y) < 1400) {
        c.font = `${13 / z}px "Segoe UI", system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = poi.used && poi.kind !== 'station' ? 'rgba(180,190,210,0.4)' : 'rgba(210,225,255,0.8)';
        c.fillText(poi.name, poi.x, poi.y + poi.r + 22 / z);
      }
    }
    // rocks
    for (const r of world.rocks) {
      if (!inView(r.x, r.y, r.r)) continue;
      c.save();
      c.translate(r.x, r.y);
      c.rotate(r.rot);
      const k = (r.r * 2.2) / r.sprite.width;
      c.scale(k, k);
      c.drawImage(r.sprite, -r.sprite.width / 2, -r.sprite.height / 2);
      c.restore();
    }
    // pickups
    for (const k of world.pickups) {
      if (!inView(k.x, k.y, 20)) continue;
      const pulse = 1 + Math.sin(t * 6 + k.x) * 0.2;
      const col = k.kind === 'credits' ? '#ffd76a' : k.kind === 'repair' ? '#7f7' : k.kind === 'energy' ? '#8cf' : k.kind === 'fuel' ? '#8ef' : RARITY_COLORS[k.module!.rarity];
      c.globalCompositeOperation = 'lighter';
      const sz = k.kind === 'module' ? 9 : k.kind === 'credits' ? 3.5 : 6;
      c.fillStyle = col;
      c.globalAlpha = 0.12;
      c.beginPath();
      c.arc(k.x, k.y, sz * 3 * pulse, 0, TAU);
      c.fill();
      c.globalAlpha = 0.25;
      c.beginPath();
      c.arc(k.x, k.y, sz * 1.8 * pulse, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = col;
      if (k.kind === 'module') {
        c.save();
        c.translate(k.x, k.y);
        c.rotate(t * 1.5);
        c.fillRect(-5, -5, 10, 10);
        c.restore();
      } else if (k.kind === 'repair') {
        c.fillRect(k.x - 5, k.y - 1.5, 10, 3);
        c.fillRect(k.x - 1.5, k.y - 5, 3, 10);
      } else {
        c.beginPath();
        c.arc(k.x, k.y, sz * 0.7, 0, TAU);
        c.fill();
      }
    }
    // ion strikes telegraph
    for (const s of world.strikes) {
      if (s.t <= 0) continue;
      const f = 1 - s.t / s.max;
      c.strokeStyle = `rgba(150,190,255,${0.3 + f * 0.6})`;
      c.lineWidth = 2 / z;
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU);
      c.stroke();
      c.fillStyle = `rgba(120,170,255,${f * 0.18})`;
      c.beginPath();
      c.arc(s.x, s.y, s.r * f, 0, TAU);
      c.fill();
    }
    // ships
    for (const s of world.ships) if (!s.dead && inView(s.x, s.y, s.radius * 2) && !(s.isPlayer && world.playerDead)) this.drawShip(s, world);
    // projectiles
    c.globalCompositeOperation = 'lighter';
    for (const pr of world.projs) {
      if (!inView(pr.x, pr.y, 40)) continue;
      const a = Math.atan2(pr.vy, pr.vx);
      if (pr.kind === 'wave') {
        c.strokeStyle = pr.color;
        c.globalAlpha = clamp(pr.life / pr.maxLife + 0.2, 0, 1);
        c.lineWidth = 4;
        c.beginPath();
        c.arc(pr.x, pr.y, pr.size, a - 0.9, a + 0.9);
        c.stroke();
        c.globalAlpha = 1;
        continue;
      }
      if (pr.kind === 'mine') {
        const blink = pr.armed <= 0 && Math.sin(t * 10) > 0;
        c.fillStyle = blink ? '#f44' : '#844';
        c.beginPath();
        c.arc(pr.x, pr.y, 6, 0, TAU);
        c.fill();
        continue;
      }
      const len = pr.kind === 'bullet' || pr.kind === 'shrapnel' ? Math.min(26, Math.hypot(pr.vx, pr.vy) * 0.022) : pr.size * 2;
      // two-segment tail (cheaper than a per-projectile gradient)
      const ca = Math.cos(a), sa = Math.sin(a);
      c.strokeStyle = pr.color;
      c.lineCap = 'round';
      c.lineWidth = pr.size * (pr.fromPlayer ? 1 : 1.3);
      c.globalAlpha = 0.3;
      c.beginPath();
      c.moveTo(pr.x - ca * len, pr.y - sa * len);
      c.lineTo(pr.x - ca * len * 0.5, pr.y - sa * len * 0.5);
      c.stroke();
      c.globalAlpha = 0.85;
      c.beginPath();
      c.moveTo(pr.x - ca * len * 0.5, pr.y - sa * len * 0.5);
      c.lineTo(pr.x, pr.y);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(pr.x, pr.y, pr.size * 0.5, 0, TAU);
      c.fill();
      if (!pr.fromPlayer) {
        // enemy shots get a halo for readability
        c.fillStyle = pr.color;
        c.globalAlpha = 0.25;
        c.beginPath();
        c.arc(pr.x, pr.y, pr.size * 2.2, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
      }
    }
    // beams
    for (const b of world.beams) {
      c.lineCap = 'round';
      c.strokeStyle = b.color;
      c.globalAlpha = 0.35;
      c.lineWidth = b.w * 3;
      c.beginPath();
      c.moveTo(b.x1, b.y1);
      c.lineTo(b.x2, b.y2);
      c.stroke();
      c.globalAlpha = 1;
      c.lineWidth = b.w * 0.6;
      c.strokeStyle = '#fff';
      c.stroke();
    }
    world.beams.length = 0;
    // line fx
    for (const l of world.lines) {
      c.strokeStyle = l.color;
      c.globalAlpha = clamp(l.life / l.max, 0, 1);
      c.lineWidth = l.width;
      c.beginPath();
      c.moveTo(l.x1, l.y1);
      if (l.jag) {
        const n = 6;
        for (let i = 1; i < n; i++) {
          const f = i / n;
          c.lineTo(l.x1 + (l.x2 - l.x1) * f + (Math.random() - 0.5) * 24, l.y1 + (l.y2 - l.y1) * f + (Math.random() - 0.5) * 24);
        }
      }
      c.lineTo(l.x2, l.y2);
      c.stroke();
    }
    c.globalAlpha = 1;
    // particles
    for (const pt of world.parts) {
      if (!inView(pt.x, pt.y, pt.size)) continue;
      const a = clamp(pt.life / pt.max, 0, 1);
      c.globalCompositeOperation = pt.add ? 'lighter' : 'source-over';
      c.globalAlpha = a;
      c.fillStyle = pt.color;
      c.beginPath();
      c.arc(pt.x, pt.y, pt.size, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // floating texts
    c.textAlign = 'center';
    for (const tx2 of world.texts) {
      c.globalAlpha = clamp(tx2.life * 1.5, 0, 1);
      c.font = `bold ${tx2.size / Math.sqrt(z)}px "Segoe UI", system-ui, sans-serif`;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillText(tx2.text, tx2.x + 1, tx2.y + 1);
      c.fillStyle = tx2.color;
      c.fillText(tx2.text, tx2.x, tx2.y);
    }
    c.globalAlpha = 1;
    // jump spool ring
    if (world.jump) {
      const f = world.jump.t / world.jump.total;
      c.strokeStyle = 'rgba(200,220,255,0.8)';
      c.lineWidth = 3 / z;
      c.beginPath();
      c.arc(p.x, p.y, p.radius + 30, -Math.PI / 2, -Math.PI / 2 + f * TAU);
      c.stroke();
    }

    // screen space HUD
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawOffscreen(world);
    this.drawHud(world, rawDt);
  }

  private drawShip(s: Ship, world: World) {
    const c = this.ctx;
    c.save();
    c.translate(s.x, s.y);
    // shield bubble
    if (s.maxShield > 0 && s.shield > 0.5 && (s.shieldFlash > 0 || s.isPlayer)) {
      const a = (s.isPlayer ? 0.08 : 0) + Math.max(0, s.shieldFlash) * 0.35;
      c.strokeStyle = `rgba(120,200,255,${a + 0.05})`;
      c.fillStyle = `rgba(120,200,255,${a * 0.4})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, s.radius * 1.35 + 4, 0, TAU);
      c.fill();
      c.stroke();
    }
    if (s.reflect > 0) {
      c.strokeStyle = `rgba(255,240,180,${0.5 + Math.sin(world.t * 20) * 0.3})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, s.radius * 1.5 + 6, 0, TAU);
      c.stroke();
    }
    c.rotate(s.angle);
    let alpha = 1;
    if (s.cloak > 0) alpha = s.isPlayer ? 0.3 : 0.05;
    if (s.lifetime > 0 && s.lifetime < 1.5) alpha *= 0.4 + 0.6 * Math.abs(Math.sin(world.t * 12));
    if (s.role === 'echo') alpha *= 0.65;
    c.globalAlpha = alpha;
    const sw = s.sprite.width, sh = s.sprite.height;
    const scale = s.boss === 'mirror' ? 1.4 : 1;
    c.scale(scale, scale);
    c.drawImage(s.sprite, -sw / 2, -sh / 2);
    if (s.flash > 0 || s.tint) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = s.flash > 0 ? 0.6 : 0.25 * alpha;
      // tint overlay via a cheap glow
      c.fillStyle = s.flash > 0 ? '#fff' : s.tint!;
      c.beginPath();
      c.arc(0, 0, s.radius * 0.7, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    c.globalAlpha = 1;
    // health bars for damaged non-player ships
    if (!s.isPlayer && !s.boss && (s.hull < s.maxHull || s.shield < s.maxShield - 1) && s.cloak <= 0) {
      const w = Math.max(28, s.radius * 1.6);
      const y = s.y - s.radius - 12;
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(s.x - w / 2, y, w, 4);
      c.fillStyle = s.allied ? '#7f7' : s.hostile ? '#f66' : '#fd6';
      c.fillRect(s.x - w / 2, y, (w * Math.max(0, s.hull)) / s.maxHull, 4);
      if (s.maxShield > 0) {
        c.fillStyle = '#7cf';
        c.fillRect(s.x - w / 2, y - 3, (w * s.shield) / s.maxShield, 2);
      }
    }
    // name tags for elites/neutrals near the cursor
    if (!s.isPlayer && !s.allied && (s.elite || dist(input.worldX, input.worldY, s.x, s.y) < s.radius + 30)) {
      c.font = '11px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = s.elite ? '#ffcf5a' : s.hostile ? '#f99' : '#dde';
      c.fillText(s.name + (s.hostile ? '' : s.hailable && !s.hailed ? ' · neutral' : ''), s.x, s.y + s.radius + 18);
    }
  }

  private drawOffscreen(world: World) {
    const c = this.ctx;
    const z = this.zoom;
    const cx = this.w / 2, cy = this.h / 2;
    const mark = (x: number, y: number, col: string, size: number, label?: string) => {
      const sx = cx + (x - this.camX) * z, sy = cy + (y - this.camY) * z;
      if (sx > 0 && sx < this.w && sy > 0 && sy < this.h) return;
      const a = Math.atan2(sy - cy, sx - cx);
      const m = 26;
      const ex = clamp(cx + Math.cos(a) * 2000, m, this.w - m);
      const ey = clamp(cy + Math.sin(a) * 2000, m, this.h - m);
      c.save();
      c.translate(ex, ey);
      c.rotate(a);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(size, 0);
      c.lineTo(-size * 0.7, size * 0.6);
      c.lineTo(-size * 0.7, -size * 0.6);
      c.closePath();
      c.fill();
      c.restore();
      if (label) {
        c.font = '11px "Segoe UI", system-ui, sans-serif';
        c.fillStyle = col;
        c.textAlign = 'center';
        c.fillText(label, clamp(ex - Math.cos(a) * 26, 40, this.w - 40), clamp(ey - Math.sin(a) * 18, 14, this.h - 8));
      }
    };
    for (const s of world.ships) if (!s.dead && s.hostile && s.aggro && !s.allied && s.cloak <= 0 && dist(s.x, s.y, world.player.x, world.player.y) < 1600) mark(s.x, s.y, s.boss ? '#ff4060' : '#ff7a6b', s.boss ? 12 : 7);
    for (const poi of world.pois) if (poi.discovered && !poi.used && (poi.site === 'marker' || poi.kind === 'station' || poi.kind === 'distress')) mark(poi.x, poi.y, poi.site === 'marker' ? '#ffd36b' : poi.kind === 'station' ? '#9cf' : '#f86', 8, poi.label);
  }

  private drawHud(world: World, dt: number) {
    const c = this.ctx;
    const p = world.player;
    const run = world.run;
    const W = this.w, H = this.h;
    const font = (sz: number, bold = false) => `${bold ? '600 ' : ''}${sz}px "Segoe UI", system-ui, sans-serif`;
    // ---- bottom-left: bars
    const bx = 22, by = H - 92, bw = 260;
    const bar = (y: number, frac: number, col: string, label: string, val: string, h = 12) => {
      c.fillStyle = 'rgba(10,14,28,0.7)';
      c.fillRect(bx, y, bw, h);
      c.fillStyle = col;
      c.fillRect(bx, y, bw * clamp(frac, 0, 1), h);
      c.strokeStyle = 'rgba(200,220,255,0.25)';
      c.lineWidth = 1;
      c.strokeRect(bx + 0.5, y + 0.5, bw - 1, h - 1);
      c.font = font(10, true);
      c.fillStyle = 'rgba(230,240,255,0.9)';
      c.textAlign = 'left';
      c.fillText(label, bx + 5, y + h - 2.5);
      c.textAlign = 'right';
      c.fillText(val, bx + bw - 5, y + h - 2.5);
    };
    bar(by, p.shield / Math.max(1, p.maxShield), '#3d8fd9', 'SHIELD', `${Math.round(p.shield)}/${Math.round(p.maxShield)}`);
    const hf = p.hull / p.maxHull;
    bar(by + 16, hf, hf < 0.3 ? (Math.sin(world.t * 8) > 0 ? '#e04a3a' : '#a03028') : '#c8574a', 'HULL', `${Math.max(0, Math.round(p.hull))}/${Math.round(p.maxHull)}`, 14);
    bar(by + 34, p.energy / p.maxEnergy, '#d9b84a', 'ENERGY', `${Math.round(p.energy)}`, 9);
    // ability
    const h = hullDef(run.hullId);
    const ax = bx, ay = by + 50;
    const af = 1 - world.abilityCd / world.abilityMax;
    c.fillStyle = 'rgba(10,14,28,0.7)';
    c.fillRect(ax, ay, 124, 26);
    c.fillStyle = af >= 1 ? 'rgba(120,220,180,0.35)' : 'rgba(120,160,220,0.2)';
    c.fillRect(ax, ay, 124 * af, 26);
    c.strokeStyle = af >= 1 ? 'rgba(140,255,200,0.7)' : 'rgba(200,220,255,0.25)';
    c.strokeRect(ax + 0.5, ay + 0.5, 123, 25);
    c.font = font(11, true);
    c.textAlign = 'left';
    c.fillStyle = '#e8f0ff';
    c.fillText(`SPACE  ${h.abilityName}`, ax + 7, ay + 17);
    c.fillStyle = 'rgba(10,14,28,0.7)';
    c.fillRect(ax + 132, ay, 128, 26);
    c.strokeStyle = world.boosting ? 'rgba(140,200,255,0.8)' : 'rgba(200,220,255,0.25)';
    c.strokeRect(ax + 132.5, ay + 0.5, 127, 25);
    c.fillStyle = '#e8f0ff';
    c.fillText('SHIFT  Afterburner', ax + 139, ay + 17);

    // ---- bottom-center: weapons
    const ws = p.weapons;
    const wx0 = W / 2 - (ws.length * 150) / 2;
    ws.forEach((w, i) => {
      const x = wx0 + i * 150, y = H - 50;
      c.fillStyle = 'rgba(10,14,28,0.7)';
      c.fillRect(x, y, 140, 32);
      const f = w.ws.def.kind === 'beam' ? 1 : 1 - w.cd / Math.max(0.01, w.ws.cooldown);
      c.fillStyle = 'rgba(120,180,255,0.18)';
      c.fillRect(x, y, 140 * clamp(f, 0, 1), 32);
      c.strokeStyle = w.beamOn ? '#f8f' : 'rgba(200,220,255,0.25)';
      c.strokeRect(x + 0.5, y + 0.5, 139, 31);
      c.fillStyle = w.ws.def.color;
      c.fillRect(x + 6, y + 6, 4, 20);
      c.font = font(11, true);
      c.textAlign = 'left';
      c.fillStyle = '#e8f0ff';
      c.fillText(w.ws.def.name, x + 16, y + 14);
      c.font = font(10);
      c.fillStyle = 'rgba(200,215,240,0.7)';
      c.fillText(ws.length === 1 ? 'LMB / RMB' : w.group === 0 ? 'Left mouse' : 'Right mouse', x + 16, y + 27);
    });

    // ---- top-left: resources
    c.textAlign = 'left';
    c.font = font(14, true);
    c.fillStyle = '#ffd76a';
    c.fillText(`¢ ${run.credits}`, 22, 30);
    c.fillStyle = run.fuel <= 1 ? (Math.sin(world.t * 6) > 0 ? '#f86' : '#a54') : '#8ef';
    c.fillText(`⛽ ${run.fuel}/${world.stats.maxFuel}`, 110, 30);
    c.fillStyle = '#d8c8ff';
    c.fillText(`Lv ${run.level}`, 200, 30);
    const xpf = run.xp / xpForLevel(run.level);
    c.fillStyle = 'rgba(10,14,28,0.7)';
    c.fillRect(22, 38, 220, 4);
    c.fillStyle = '#a88cff';
    c.fillRect(22, 38, 220 * xpf, 4);
    if (run.skillPoints > 0) {
      c.font = font(12, true);
      c.fillStyle = Math.sin(world.t * 4) > 0 ? '#ffe08a' : '#d0b060';
      c.fillText(`★ ${run.skillPoints} skill point${run.skillPoints > 1 ? 's' : ''} — press K`, 22, 60);
    }
    const unequipped = run.cargo.length;
    if (unequipped > 0) {
      c.font = font(11);
      c.fillStyle = 'rgba(200,215,240,0.7)';
      c.fillText(`${unequipped} module${unequipped > 1 ? 's' : ''} in cargo — Tab`, 22, run.skillPoints > 0 ? 78 : 60);
    }

    // ---- top-center: system name & toasts
    c.textAlign = 'center';
    const owner = factionById(run, world.node.owner);
    if (world.arrivalT < 6) {
      const a = clamp(Math.min(world.arrivalT, 6 - world.arrivalT), 0, 1);
      c.globalAlpha = a;
      c.font = font(30, true);
      c.fillStyle = '#eef2ff';
      c.fillText(world.sysName, W / 2, H * 0.22);
      c.font = font(14);
      c.fillStyle = owner ? owner.color : '#aab';
      c.fillText(owner ? `${owner.name.replace(/^the /, 'The ')} space · ${repLabel(run.rep[owner.id] ?? 0)}` : world.node.kind === 'final' ? 'The Heart of the Shoal' : 'Unclaimed space', W / 2, H * 0.22 + 26);
      c.globalAlpha = 1;
    } else {
      c.font = font(12);
      c.fillStyle = 'rgba(210,220,245,0.6)';
      c.fillText(`${world.sysName}${owner ? ' · ' + owner.short : ''}`, W / 2, 22);
    }
    let ty = 50;
    for (const t of this.toasts) {
      t.t -= dt;
      c.globalAlpha = clamp(t.t, 0, 1);
      c.font = font(14, true);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillText(t.text, W / 2 + 1, ty + 1);
      c.fillStyle = t.color;
      c.fillText(t.text, W / 2, ty);
      ty += 22;
    }
    c.globalAlpha = 1;
    this.toasts = this.toasts.filter((t) => t.t > 0);

    // boss bar
    const b = world.bossShip;
    if (b && !b.dead) {
      const w = Math.min(600, W * 0.6);
      const x = W / 2 - w / 2, y = 70;
      c.fillStyle = 'rgba(10,6,12,0.8)';
      c.fillRect(x, y, w, 12);
      c.fillStyle = '#d0304a';
      c.fillRect(x, y, (w * b.hull) / b.maxHull, 12);
      if (b.maxShield > 0) {
        c.fillStyle = '#5ab0ff';
        c.fillRect(x, y - 4, (w * b.shield) / b.maxShield, 3);
      }
      c.font = font(13, true);
      c.fillStyle = '#ffd0d8';
      c.fillText(b.name, W / 2, y - 8);
    }

    // interaction prompt
    if (world.nearest && !world.playerDead) {
      let label = '';
      if (world.nearest.kind === 'poi') {
        const poi = world.nearest.poi;
        const verb = poi.site === 'marker' && poi.kind === 'station' ? 'Approach' : { planet: 'Survey', station: 'Dock at', derelict: 'Board', anomaly: 'Investigate', beacon: 'Approach', distress: 'Answer', asteroid: 'Probe', finale: 'Enter' }[poi.kind];
        label = `${verb} ${poi.name}`;
      } else label = `Hail ${world.nearest.ship.name}`;
      c.font = font(15, true);
      const tw = c.measureText(label).width + 60;
      c.fillStyle = 'rgba(10,14,28,0.75)';
      c.fillRect(W / 2 - tw / 2, H * 0.68, tw, 30);
      c.strokeStyle = 'rgba(160,200,255,0.5)';
      c.strokeRect(W / 2 - tw / 2 + 0.5, H * 0.68 + 0.5, tw - 1, 29);
      c.fillStyle = '#fff';
      c.fillText(`[E]  ${label}`, W / 2, H * 0.68 + 20);
    }

    // jump status
    if (world.jump) {
      c.font = font(14, true);
      c.fillStyle = '#cfe0ff';
      const tgt = run.nodes.find((n) => n.id === world.jump!.target)!;
      c.fillText(`Spooling jump drive → ${tgt.name}  ${Math.round((world.jump.t / world.jump.total) * 100)}%${world.hasHostilesNear ? '  (hostiles nearby: slowed)' : ''}`, W / 2, H * 0.68 - 16);
    }

    // warden unease
    if (world.wardenWarned && world.node.kind !== 'final') {
      const rem = world.wardenTime - world.arrivalT;
      c.font = font(12, true);
      c.fillStyle = rem > 0 ? `rgba(230,220,255,${0.5 + Math.sin(world.t * 3) * 0.3})` : 'rgba(255,255,255,0.8)';
      c.fillText(rem > 0 ? '◈ the lane is restless' : '◈ they are here', W / 2, H - 70);
    }

    this.drawMinimap(world);

    // control hints for the first moments of the first run
    if (meta.runs <= 1 && run.depth === 0 && world.arrivalT < 40) {
      c.font = font(13);
      c.fillStyle = `rgba(220,230,255,${clamp(40 - world.arrivalT, 0, 1) * 0.75})`;
      c.textAlign = 'right';
      const lines = ['W/S  thrust · A/D  strafe', 'Mouse  aim · click to fire', 'Shift  afterburner · Space  ship ability', 'E  interact · M  star map', 'Tab  ship · K  captain · J  journal', 'Scroll  zoom · Esc  pause'];
      lines.forEach((l, i) => c.fillText(l, W - 22, H - 130 + i * 19));
    }

    // death fade
    if (world.playerDead) {
      c.fillStyle = `rgba(0,0,0,${clamp(1 - world.deathTimer / 2.2, 0, 0.85)})`;
      c.fillRect(0, 0, W, H);
    }
    if (world.slowmo > 0) {
      c.fillStyle = 'rgba(120,160,255,0.06)';
      c.fillRect(0, 0, W, H);
    }
  }

  private drawMinimap(world: World) {
    const c = this.ctx;
    const R = 92;
    const cx = this.w - R - 20, cy = R + 20;
    const scale = R / world.bounds;
    c.save();
    c.fillStyle = 'rgba(6,10,22,0.72)';
    c.strokeStyle = 'rgba(160,190,255,0.3)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.fill();
    c.stroke();
    c.clip();
    // scan range ring
    const p = world.player;
    c.strokeStyle = 'rgba(120,200,255,0.12)';
    c.beginPath();
    c.arc(cx + p.x * scale, cy + p.y * scale, world.stats.scanRange * scale, 0, TAU);
    c.stroke();
    if (world.star) {
      c.fillStyle = world.star.color;
      c.beginPath();
      c.arc(cx, cy, 3.5, 0, TAU);
      c.fill();
    }
    for (const poi of world.pois) {
      if (!poi.discovered) continue;
      const x = cx + poi.x * scale, y = cy + poi.y * scale;
      const col = poi.site === 'marker' ? '#ffd36b' : poi.kind === 'station' ? '#9cf' : poi.kind === 'planet' ? '#8a9ab8' : poi.kind === 'distress' ? '#f86' : poi.kind === 'anomaly' ? '#c9f' : '#bba';
      c.fillStyle = poi.used && poi.kind !== 'station' && poi.kind !== 'planet' ? 'rgba(150,150,160,0.4)' : col;
      if (poi.kind === 'station') c.fillRect(x - 3, y - 3, 6, 6);
      else {
        c.beginPath();
        c.arc(x, y, poi.kind === 'planet' ? 2.5 : 2.2, 0, TAU);
        c.fill();
      }
      if (poi.used && poi.kind === 'planet') {
        c.strokeStyle = 'rgba(150,200,150,0.5)';
        c.beginPath();
        c.arc(x, y, 4, 0, TAU);
        c.stroke();
      }
    }
    const sr = world.stats.scanRange;
    for (const s of world.ships) {
      if (s.dead || s.isPlayer || s.cloak > 0) continue;
      if (dist(s.x, s.y, p.x, p.y) > sr) continue;
      c.fillStyle = s.allied ? '#7f7' : s.hostile ? '#f55' : '#fd6';
      c.fillRect(cx + s.x * scale - 1.5, cy + s.y * scale - 1.5, s.boss ? 5 : 3, s.boss ? 5 : 3);
    }
    c.save();
    c.translate(cx + p.x * scale, cy + p.y * scale);
    c.rotate(p.angle);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(-3, 3);
    c.lineTo(-3, -3);
    c.closePath();
    c.fill();
    c.restore();
    c.restore();
  }
}
