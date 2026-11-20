import { LOOM_SIZE, STRAND_GLYPH } from './weave';
import { drawAnchor, drawAnchorHalo, drawGrafts, drawThread, drawTide } from './render_thread';
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

export const MENU_PALETTE: [string, string, string] = ['#2a1a0c', '#5a3518', '#0f3a38'];
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

  setBackground(seed: number, palette?: [string, string, string]) {
    if (this.bg?.seed === seed) return;
    const pal = palette ?? NEB_PALETTES[seed % NEB_PALETTES.length];
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
    if (!this.bg) this.setBackground(hashSeed('menu'), MENU_PALETTE);
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
      if (!inView(poi.x, poi.y, poi.r * 2 + 60) || poi.erased) continue;
      if (poi.kind === 'anchor') {
        drawAnchor(c, poi, t, z);
        if (poi.discovered && dist(poi.x, poi.y, p.x, p.y) < 1400) {
          c.font = `${13 / z}px "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
          c.textAlign = 'center';
          c.fillStyle = poi.woven ? 'rgba(169,154,128,0.45)' : poi.anchorColor ?? '#ffd36b';
          c.fillText(poi.name, poi.x, poi.y + 64);
        }
        continue;
      }
      drawAnchorHalo(c, poi, t, z);
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
        c.globalAlpha = poi.used && poi.kind !== 'planet' && !(poi.kind === 'station' && poi.site !== 'marker') ? 0.55 : 1;
        c.drawImage(poi.sprite, -sw / 2, -sw / 2);
        c.restore();
      } else if (poi.kind === 'anomaly') {
        drawAnomaly(c, poi.x, poi.y, poi.r * 1.6, t, poi.anomalyKind);
      } else if (poi.kind === 'beacon' || poi.kind === 'distress' || poi.kind === 'finale') {
        drawBeacon(c, poi.x, poi.y, poi.r * (poi.kind === 'finale' ? 1.8 : 1), t, poi.kind === 'distress' ? '#ff6a5a' : poi.kind === 'finale' ? '#ffffff' : '#ffd36b');
      }
      // label
      if (poi.discovered && dist(poi.x, poi.y, p.x, p.y) < 1400) {
        c.font = `${13 / z}px "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = poi.used && !(poi.kind === 'station' && poi.site !== 'marker') ? 'rgba(169,154,128,0.45)' : 'rgba(255,217,152,0.85)';
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
      const col = k.kind === 'credits' ? '#ffd76a' : k.kind === 'repair' ? '#7f7' : k.kind === 'energy' ? '#8cf' : k.kind === 'thread' ? '#bff' : RARITY_COLORS[k.module!.rarity];
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
    drawTide(c, world, vx0, vy0, vx1, vy1, t, z);
    drawThread(c, world, t, z);
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
      c.font = `bold ${tx2.size / Math.sqrt(z)}px "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
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
    if (s.isPlayer) drawGrafts(c, world.run, s.radius, world.t);
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
      const bindable = s.hostile && !s.allied && s.hull <= s.maxHull * world.thread.bindThreshold(s);
      c.fillStyle = s.tethered ? '#9ff' : s.allied ? '#7f7' : bindable ? (Math.sin(world.t * 8) > 0 ? '#bff' : '#f66') : s.hostile ? '#f66' : '#fd6';
      c.fillRect(s.x - w / 2, y, (w * Math.max(0, s.hull)) / s.maxHull, 4);
      if (s.maxShield > 0) {
        c.fillStyle = '#7cf';
        c.fillRect(s.x - w / 2, y - 3, (w * s.shield) / s.maxShield, 2);
      }
      // the bind mark: below this, a loop of thread will hold it
      if (s.hostile && !s.allied) {
        const th = world.thread.bindThreshold(s);
        c.fillStyle = '#bff';
        c.fillRect(s.x - w / 2 + w * th - 1, y - 3, 2, 10);
      }
    }
    if (s.stun > 0 && !s.allied) {
      c.strokeStyle = 'rgba(180,255,255,0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(s.x, s.y, s.radius + 8, world.t * 4, world.t * 4 + 4);
      c.stroke();
    }
    // name tags for elites/neutrals near the cursor
    if (!s.isPlayer && !s.allied && (s.elite || dist(input.worldX, input.worldY, s.x, s.y) < s.radius + 30)) {
      c.font = '11px "Chakra Petch", "Segoe UI", system-ui, sans-serif';
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
        c.font = '11px "Chakra Petch", "Segoe UI", system-ui, sans-serif';
        c.fillStyle = col;
        c.textAlign = 'center';
        c.fillText(label, clamp(ex - Math.cos(a) * 26, 40, this.w - 40), clamp(ey - Math.sin(a) * 18, 14, this.h - 8));
      }
    };
    for (const s of world.ships) if (!s.dead && s.hostile && s.aggro && !s.allied && s.cloak <= 0 && dist(s.x, s.y, world.player.x, world.player.y) < 1600) mark(s.x, s.y, s.boss ? '#ff4060' : '#ff7a6b', s.boss ? 12 : 7);
    for (const poi of world.pois) if (poi.discovered && !poi.used && (poi.site === 'marker' || poi.kind === 'station' || poi.kind === 'distress')) mark(poi.x, poi.y, poi.site === 'marker' ? '#ffd36b' : poi.kind === 'station' ? '#9cf' : '#f86', 8, poi.label);
  }

  // -------------------------------------------------------------------------
  // HUD — "instrument panel" style: bezelled chamfered plates, amber phosphor
  // readouts, teal for shields/energy, gold serif for place names.
  // -------------------------------------------------------------------------
  private chamfer(x: number, y: number, w: number, h: number, cut: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + h - cut);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x, y + h);
    c.lineTo(x, y + cut);
    c.closePath();
  }

  /** a bezelled plate: dark glass inside a worn metal rim */
  private plate(x: number, y: number, w: number, h: number, cut = 10, glow = false) {
    const c = this.ctx;
    this.chamfer(x - 2, y - 2, w + 4, h + 4, cut + 1);
    const rim = c.createLinearGradient(x, y, x + w * 0.4, y + h);
    rim.addColorStop(0, 'rgba(110,90,60,0.95)');
    rim.addColorStop(0.5, 'rgba(43,36,26,0.95)');
    rim.addColorStop(1, 'rgba(76,62,43,0.95)');
    c.fillStyle = rim;
    c.fill();
    this.chamfer(x, y, w, h, cut);
    c.fillStyle = 'rgba(13,11,8,0.88)';
    c.fill();
    c.strokeStyle = glow ? 'rgba(255,190,92,0.85)' : 'rgba(168,116,47,0.55)';
    c.lineWidth = 1;
    c.stroke();
  }

  private txt(s: string, x: number, y: number, color: string, font: string, align: CanvasTextAlign = 'left', glow = 0) {
    const c = this.ctx;
    c.font = font;
    c.textAlign = align;
    c.fillStyle = color;
    if (glow) {
      c.shadowColor = color;
      c.shadowBlur = glow;
    }
    c.fillText(s, x, y);
    c.shadowBlur = 0;
  }

  private drawHud(world: World, dt: number) {
    const c = this.ctx;
    const p = world.player;
    const run = world.run;
    const W = this.w, H = this.h;
    const UI = (sz: number, w = 600) => `${w} ${sz}px "Chakra Petch", "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
    const MONO = (sz: number) => `${sz}px "Share Tech Mono", ui-monospace, monospace`;
    const STORY = (sz: number, w = 600) => `${w} ${sz}px "Cormorant Garamond", Georgia, serif`;
    const AMBER = '#ffbe5c', AMBER_HI = '#ffd998', AMBER_DIM = '#a8742f', TEAL = '#4fe0c8', GOLD = '#e8c27a', RED = '#ff6a4d', DIM = '#a99a80';

    // ---- bottom-left: instrument cluster
    const px = 18, pw = 330, ph = 140, py = H - ph - 18;
    this.plate(px, py, pw, ph, 14);
    const gauge = (gy: number, label: string, frac: number, val: string, col: string, segs: number) => {
      const gx = px + 14, gw = pw - 28;
      this.txt(label, gx, gy, DIM, UI(12, 600));
      this.txt(val, gx + gw, gy, col, MONO(17), 'right');
      const by = gy + 5, bh = 10;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(gx, by, gw, bh);
      const sw = gw / segs;
      const lit = clamp(frac, 0, 1) * segs;
      c.fillStyle = col;
      for (let i = 0; i < segs; i++) {
        const f = clamp(lit - i, 0, 1);
        if (f <= 0) break;
        c.globalAlpha = 0.35 + 0.65 * f;
        c.fillRect(gx + i * sw + 1, by + 1, (sw - 2) * f, bh - 2);
      }
      c.globalAlpha = 1;
      // etched ticks
      c.fillStyle = 'rgba(168,116,47,0.55)';
      for (let i = 0; i <= 4; i++) c.fillRect(gx + (gw * i) / 4 - 0.5, by + bh + 1, 1, 4);
    };
    const hf = p.hull / p.maxHull;
    const hullCol = hf < 0.3 ? (Math.sin(world.t * 8) > 0 ? RED : '#a8402c') : '#ff8a5c';
    gauge(py + 22, 'SHIELD', p.shield / Math.max(1, p.maxShield), `${Math.round(p.shield)}/${Math.round(p.maxShield)}`, TEAL, 24);
    gauge(py + 56, 'HULL', hf, `${Math.max(0, Math.round(p.hull))}/${Math.round(p.maxHull)}`, hullCol, 24);
    gauge(py + 90, 'ENERGY', p.energy / p.maxEnergy, `${Math.round(p.energy)}`, AMBER, 24);
    // ability + afterburner key plates
    const h = hullDef(run.hullId);
    const af = clamp(1 - world.abilityCd / world.abilityMax, 0, 1);
    const kx = px + 14, ky = py + ph - 26, kw = (pw - 28 - 8) / 2;
    const keyPlate = (x: number, key: string, label: string, frac: number, on: boolean, col: string) => {
      this.chamfer(x, ky, kw, 20, 5);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fill();
      c.save();
      this.chamfer(x, ky, kw, 20, 5);
      c.clip();
      c.fillStyle = on ? col : 'rgba(168,116,47,0.35)';
      c.globalAlpha = on ? 0.28 : 1;
      c.fillRect(x, ky, kw * frac, 20);
      c.restore();
      c.globalAlpha = 1;
      this.chamfer(x, ky, kw, 20, 5);
      c.strokeStyle = on ? col : 'rgba(168,116,47,0.5)';
      c.stroke();
      // keycap
      c.fillStyle = on ? col : AMBER_DIM;
      c.font = MONO(12);
      const kwid = c.measureText(key).width + 8;
      c.fillRect(x + 4, ky + 4, kwid, 12);
      this.txt(key, x + 8, ky + 14, '#120e08', MONO(12));
      this.txt(label, x + kwid + 10, ky + 15, on ? AMBER_HI : DIM, UI(13, 600));
    };
    keyPlate(kx, 'SPACE', h.abilityName.toUpperCase(), af, af >= 1, TEAL);
    keyPlate(kx + kw + 8, 'SHIFT', 'BOOST', 1, world.boosting, AMBER);

    // ---- bottom-center: weapon mounts
    const ws = p.weapons;
    // fit the row between the instrument cluster and the right-hand panels; if it can't fit, lift it above them
    const showCard = meta.runs <= 1 && run.depth === 0 && world.arrivalT < 40;
    // the first-run control card prefers the bottom-right corner but moves above the weapon row if they would overlap
    const leftRes = px + pw + 16, rightRes = 18;
    const avail = W - leftRes - rightRes;
    const wph = 54, gap = 12, n = Math.max(1, ws.length);
    let wpw = Math.min(196, (avail - gap * (n - 1)) / n);
    let rowY = H - wph - 18;
    if (wpw < 140) {
      wpw = 170;
      rowY = py - wph - 14;
    }
    const total = n * wpw + gap * (n - 1);
    const wx0 = wpw === 170 && rowY < H - wph - 18 ? W / 2 - total / 2 : clamp(W / 2 - total / 2, leftRes, W - rightRes - total);
    ws.forEach((w, i) => {
      const x = wx0 + i * (wpw + gap), y = rowY;
      const ready = w.ws.def.kind === 'beam' ? 1 : clamp(1 - w.cd / Math.max(0.01, w.ws.cooldown), 0, 1);
      this.plate(x, y, wpw, wph, 10, !!w.beamOn);
      // charge fill
      c.save();
      this.chamfer(x, y, wpw, wph, 10);
      c.clip();
      c.fillStyle = 'rgba(255,168,60,0.12)';
      c.fillRect(x, y + wph - 6, wpw * ready, 6);
      c.fillStyle = AMBER;
      c.fillRect(x, y + wph - 3, wpw * ready, 3);
      c.restore();
      // colour pip for the weapon
      c.fillStyle = w.ws.def.color;
      c.shadowColor = w.ws.def.color;
      c.shadowBlur = 8;
      c.fillRect(x + 12, y + 12, 5, 24);
      c.shadowBlur = 0;
      this.txt(w.ws.def.name.toUpperCase(), x + 26, y + 26, AMBER_HI, UI(15, 600));
      const mouse = ws.length === 1 ? 'L/R MOUSE' : w.group === 0 ? 'L MOUSE' : 'R MOUSE';
      this.txt(mouse, x + 26, y + 43, DIM, MONO(12));
    });

    // ---- top-left: logistics readout
    const lx = 18, ly = 18, lw = 300, lh = 92;
    this.plate(lx, ly, lw, lh, 12);
    const col = (x: number, label: string, val: string, color: string) => {
      this.txt(label, x, ly + 22, DIM, UI(12, 600));
      this.txt(val, x, ly + 48, color, MONO(24), 'left', 8);
    };
    col(lx + 16, 'CREDITS', `${run.credits}`, GOLD);
    const threadLow = run.thread < 6 && Math.sin(world.t * 6) > 0;
    col(lx + 130, 'THREAD', `${Math.floor(run.thread)}/${Math.round(world.stats.maxThread)}`, threadLow ? RED : world.thread.spinning ? '#dff' : TEAL);
    col(lx + 232, 'LEVEL', `${run.level}`, AMBER);
    const xpf = clamp(run.xp / xpForLevel(run.level), 0, 1);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(lx + 16, ly + 64, lw - 32, 6);
    c.fillStyle = '#c9a0ff';
    c.fillRect(lx + 16, ly + 64, (lw - 32) * xpf, 6);
    this.txt('EXPERIENCE', lx + 16, ly + 84, 'rgba(201,160,255,0.75)', UI(10, 600));
    // the Loom: carried strands
    const sy0 = ly + lh + 8;
    this.plate(lx, sy0, lw, 40, 10);
    this.txt('LOOM · M', lx + 14, sy0 + 25, DIM, UI(11, 600));
    for (let i = 0; i < LOOM_SIZE; i++) {
      const s = run.strands[i];
      const bx = lx + 84 + i * 70;
      c.strokeStyle = s ? s.color : 'rgba(168,116,47,0.35)';
      c.lineWidth = 1.5;
      c.strokeRect(bx, sy0 + 8, 62, 24);
      if (s) {
        c.fillStyle = s.color + '30';
        c.fillRect(bx, sy0 + 8, 62, 24);
        this.txt(STRAND_GLYPH[s.kind], bx + 12, sy0 + 26, s.color, UI(15, 600), 'center');
        this.txt(s.label.length > 7 ? s.label.slice(0, 6) + '…' : s.label, bx + 22, sy0 + 25, '#efe6d2', UI(10, 600));
      }
    }
    let ny = sy0 + 40 + 24;
    if (run.skillPoints > 0) {
      const a = 0.78 + 0.22 * Math.sin(world.t * 4);
      c.globalAlpha = a;
      this.txt(`★ ${run.skillPoints} SKILL POINT${run.skillPoints > 1 ? 'S' : ''} · PRESS K`, lx + 4, ny, GOLD, UI(14, 600), 'left', 6);
      c.globalAlpha = 1;
      ny += 22;
    }
    if (run.cargo.length > 0) this.txt(`${run.cargo.length} MODULE${run.cargo.length > 1 ? 'S' : ''} IN CARGO · TAB`, lx + 4, ny, DIM, UI(13, 500));

    // ---- top-center: place name & toasts
    const owner = factionById(run, world.node.owner);
    const bossUp = !!(world.bossShip && !world.bossShip.dead);
    const promptY = Math.min(H * 0.7, py - 52); // stay clear of the instrument cluster's rim
    if (world.arrivalT < 6) {
      const a = clamp(Math.min(world.arrivalT, 6 - world.arrivalT), 0, 1);
      c.globalAlpha = a;
      const shown = Math.min(4, this.toasts.length);
      const toastBottom = (bossUp ? 124 : 88) + Math.max(0, shown - 1) * 34 + 12;
      const ay = Math.max(H * 0.3, toastBottom + 56); // below the toast stack
      this.txt(world.sysName, W / 2, ay, GOLD, STORY(52, 500), 'center', 18);
      const sub = owner ? `${owner.name.replace(/^the /, 'The ')} space · ${repLabel(run.rep[owner.id] ?? 0)}` : world.node.kind === 'final' ? 'The Heart of the Shoal' : 'Unclaimed space';
      this.txt(sub.toUpperCase(), W / 2, ay + 32, owner ? owner.color : DIM, UI(14, 600), 'center');
      c.globalAlpha = 1;
    } else {
      this.txt(`${world.sysName}`, W / 2, 30, 'rgba(232,194,122,0.85)', STORY(24, 500), 'center', 6);
      if (owner) this.txt(owner.short.toUpperCase(), W / 2, 48, owner.color, UI(11, 600), 'center');
    }
    let ty = bossUp ? 124 : 88;
    for (const t of this.toasts) t.t -= dt;
    for (const t of this.toasts.slice(-4)) {
      const a = clamp(t.t, 0, 1);
      c.globalAlpha = a;
      c.font = UI(16, 600);
      const tw = c.measureText(t.text).width + 40;
      this.chamfer(W / 2 - tw / 2, ty - 19, tw, 28, 7);
      c.fillStyle = 'rgba(10,8,5,0.78)';
      c.fill();
      c.strokeStyle = 'rgba(168,116,47,0.45)';
      c.stroke();
      this.txt(t.text, W / 2, ty, t.color, UI(16, 600), 'center');
      ty += 34;
    }
    c.globalAlpha = 1;
    this.toasts = this.toasts.filter((t) => t.t > 0);

    // ---- boss bar
    const b = world.bossShip;
    if (b && !b.dead) {
      const w = Math.max(260, Math.min(640, W - 2 * (18 + 300 + 24)));
      const x = W / 2 - w / 2, y = 64;
      this.plate(x, y, w, 22, 8, true);
      c.fillStyle = '#c8303e';
      c.shadowColor = '#ff4050';
      c.shadowBlur = 10;
      c.fillRect(x + 4, y + 5, (w - 8) * clamp(b.hull / b.maxHull, 0, 1), 12);
      c.shadowBlur = 0;
      if (b.maxShield > 0) {
        c.fillStyle = TEAL;
        c.fillRect(x + 4, y + 18, (w - 8) * clamp(b.shield / b.maxShield, 0, 1), 2);
      }
      this.txt(b.name, W / 2, y - 8, '#ffd0c8', STORY(24, 600), 'center', 10);
    }

    // ---- control card for the first moments of the first run (drawn before the prompt so the prompt stays on top)
    if (showCard) {
      const a = clamp(40 - world.arrivalT, 0, 1);
      c.globalAlpha = a;
      const lines: [string, string][] = [['W / S', 'thrust'], ['A / D', 'strafe'], ['MOUSE', 'aim · click to fire'], ['SHIFT', 'boost'], ['SPACE', 'ship ability'], ['E', 'interact'], ['Q (HOLD)', 'spin thread'], ['M', 'the Loom'], ['TAB · K · J', 'ship · captain · journal'], ['SCROLL', 'zoom'], ['ESC', 'pause']];
      const cw = 300, chh = 20 + lines.length * 22;
      const cx0 = W - cw - 18;
      const overlapsRow = wx0 + total > cx0 && rowY > H - chh - 18 - wph;
      const cy0 = overlapsRow ? rowY - chh - 14 : H - chh - 18;
      this.plate(cx0, cy0, cw, chh, 12);
      lines.forEach(([k, d], i) => {
        const yy = cy0 + 26 + i * 22;
        this.txt(k, cx0 + 112, yy, AMBER, MONO(14), 'right');
        this.txt(d, cx0 + 124, yy, '#efe6d2', UI(14, 500));
      });
      c.globalAlpha = 1;
    }

    // ---- interaction prompt
    if (world.nearest && !world.playerDead) {
      let label = '';
      if (world.nearest.kind === 'poi') {
        const poi = world.nearest.poi;
        const verb = poi.site === 'marker' && poi.kind === 'station' ? 'Approach' : { planet: 'Survey', station: 'Dock at', derelict: 'Board', anomaly: 'Investigate', beacon: 'Approach', distress: 'Answer', asteroid: 'Probe', finale: 'Enter', anchor: 'Loop' }[poi.kind];
        label = `${verb} ${poi.name}`;
      } else label = `Hail ${world.nearest.ship.name}`;
      c.font = UI(17, 600);
      const tw = c.measureText(label).width + 74;
      const x = W / 2 - tw / 2, y = promptY;
      this.plate(x, y, tw, 38, 9, true);
      c.fillStyle = AMBER;
      c.shadowColor = AMBER;
      c.shadowBlur = 10;
      c.fillRect(x + 12, y + 9, 22, 20);
      c.shadowBlur = 0;
      this.txt('E', x + 23, y + 25, '#120e08', MONO(16), 'center');
      this.txt(label, x + 46, y + 25, AMBER_HI, UI(17, 600));
    }

    // ---- jump status
    if (world.jump) {
      const pct = Math.round((world.jump.t / world.jump.total) * 100);
      this.txt(`WEAVING → ${world.jump.node.name.toUpperCase()}  ${pct}%`, W / 2, promptY - 16, TEAL, UI(16, 600), 'center', 8);
      if (world.hasHostilesNear) this.txt('HOSTILES NEARBY · WEAVE SLOWED', W / 2, promptY - 38, RED, UI(13, 600), 'center');
    }

    // ---- the Tide
    const th = world.thread;
    if (th.tideOn && th.tideWarned) {
      const gap = th.tideGap(p.x, p.y);
      const risen = th.tideRisen;
      const close = risen && gap < 900;
      c.globalAlpha = close ? 0.75 + Math.sin(world.t * 8) * 0.25 : 0.55 + Math.sin(world.t * 3) * 0.3;
      const msg = !risen ? '◈ behind you, the Tide is rising' : th.held ? '◈ the Tide waits, as if watching' : gap < 0 ? '◈ YOU ARE IN THE TIDE' : `◈ the Tide · ${Math.round(gap / 10)} lengths behind you`;
      this.txt(msg, W / 2, H - 92, close ? '#ffb0a8' : '#e6e0ff', STORY(20, 500), 'center', 10);
      c.globalAlpha = 1;
    }
    // ---- tethers
    if (th.tethers.length) {
      this.txt(`TOWING ${th.tethers.length}/${th.maxTethers} · HOLD F REEL IN · R CUT LOOSE · OR DRAG INTO THE TIDE`, W / 2, H - 120, '#bff', UI(13, 600), 'center', 6);
    }

    this.drawMinimap(world);

    // ---- death fade / slow motion tint
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
    const R = 96;
    const cx = this.w - R - 26, cy = R + 26;
    const scale = (R - 6) / world.bounds;
    // bezel ring
    const ring = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ring.addColorStop(0, '#6e5a3c');
    ring.addColorStop(0.5, '#2b241a');
    ring.addColorStop(1, '#4c3e2b');
    c.fillStyle = ring;
    c.beginPath();
    c.arc(cx, cy, R + 8, 0, TAU);
    c.fill();
    // screws
    c.fillStyle = '#8a7552';
    for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
      c.beginPath();
      c.arc(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), 2, 0, TAU);
      c.fill();
    }
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    const glass = c.createRadialGradient(cx, cy - R * 0.4, 0, cx, cy, R);
    glass.addColorStop(0, '#1d170e');
    glass.addColorStop(1, '#070604');
    c.fillStyle = glass;
    c.fill();
    c.clip();
    // grid
    c.strokeStyle = 'rgba(255,190,92,0.13)';
    c.lineWidth = 1;
    for (const rr of [R * 0.33, R * 0.66]) {
      c.beginPath();
      c.arc(cx, cy, rr, 0, TAU);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(cx - R, cy);
    c.lineTo(cx + R, cy);
    c.moveTo(cx, cy - R);
    c.lineTo(cx, cy + R);
    c.stroke();
    const p = world.player;
    // the Tide, eating the scope from one side
    const th = world.thread;
    if (th.tideOn && th.tideRisen) {
      const d = th.tideDir, f = th.front * scale;
      const px = -d.y, py = d.x, L = R * 3;
      c.fillStyle = 'rgba(200,200,220,0.28)';
      c.beginPath();
      c.moveTo(cx + d.x * f - px * L, cy + d.y * f - py * L);
      c.lineTo(cx + d.x * f + px * L, cy + d.y * f + py * L);
      c.lineTo(cx + d.x * (f + L) + px * L, cy + d.y * (f + L) + py * L);
      c.lineTo(cx + d.x * (f + L) - px * L, cy + d.y * (f + L) - py * L);
      c.closePath();
      c.fill();
    }
    // anchors still holding a strand
    for (const a of world.pois) {
      if (!a.anchor || a.woven || a.erased || !a.discovered) continue;
      c.strokeStyle = a.anchorColor ?? '#bff';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx + a.x * scale, cy + a.y * scale, 4.5, 0, TAU);
      c.stroke();
    }
    c.strokeStyle = 'rgba(79,224,200,0.22)';
    c.beginPath();
    c.arc(cx + p.x * scale, cy + p.y * scale, world.stats.scanRange * scale, 0, TAU);
    c.stroke();
    if (world.star) {
      c.fillStyle = world.star.color;
      c.shadowColor = world.star.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(cx, cy, 4, 0, TAU);
      c.fill();
      c.shadowBlur = 0;
    }
    for (const poi of world.pois) {
      if (!poi.discovered) continue;
      const x = cx + poi.x * scale, y = cy + poi.y * scale;
      const col = poi.site === 'marker' ? '#e8c27a' : poi.kind === 'station' ? '#4fe0c8' : poi.kind === 'planet' ? '#b8a27a' : poi.kind === 'distress' ? '#ff6a4d' : poi.kind === 'anomaly' ? '#c9a0ff' : '#a99a80';
      c.fillStyle = poi.used && !(poi.kind === 'station' && poi.site !== 'marker') && poi.kind !== 'planet' ? 'rgba(150,140,120,0.35)' : col;
      if (poi.kind === 'station') c.fillRect(x - 3.5, y - 3.5, 7, 7);
      else if (poi.site === 'marker') {
        c.beginPath();
        c.moveTo(x, y - 5);
        c.lineTo(x + 4, y);
        c.lineTo(x, y + 5);
        c.lineTo(x - 4, y);
        c.closePath();
        c.fill();
      } else {
        c.beginPath();
        c.arc(x, y, poi.kind === 'planet' ? 3 : 2.5, 0, TAU);
        c.fill();
      }
      if (poi.used && poi.kind === 'planet') {
        c.strokeStyle = 'rgba(127,227,160,0.6)';
        c.beginPath();
        c.arc(x, y, 5, 0, TAU);
        c.stroke();
      }
    }
    const sr = world.stats.scanRange;
    for (const s of world.ships) {
      if (s.dead || s.isPlayer || s.cloak > 0) continue;
      if (dist(s.x, s.y, p.x, p.y) > sr) continue;
      c.fillStyle = s.allied ? '#7fe3a0' : s.hostile ? '#ff5a4a' : '#ffd998';
      const sz = s.boss ? 6 : 3.5;
      c.fillRect(cx + s.x * scale - sz / 2, cy + s.y * scale - sz / 2, sz, sz);
    }
    c.save();
    c.translate(cx + p.x * scale, cy + p.y * scale);
    c.rotate(p.angle);
    c.fillStyle = '#ffd998';
    c.shadowColor = '#ffbe5c';
    c.shadowBlur = 6;
    c.beginPath();
    c.moveTo(6, 0);
    c.lineTo(-4, 4);
    c.lineTo(-4, -4);
    c.closePath();
    c.fill();
    c.restore();
    c.restore();
    // etched ticks on the rim
    c.strokeStyle = 'rgba(255,190,92,0.5)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const r1 = R + 1, r2 = R + (i % 6 === 0 ? 6 : 3);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      c.stroke();
    }
  }
}
