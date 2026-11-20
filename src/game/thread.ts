/**
 * Thread: spinning strands, closing loops (bind / harvest / weave anchors), tethers, and the Tide.
 * SPOILERS — see design/DESIGN.md.
 */
import { TAU, clamp, dist, dist2 } from '../core/math';
import { RNG, hashSeed } from '../core/rng';
import { audio } from '../core/audio';
import { key, pressed } from '../core/input';
import type { Ship, POI } from './entities';
import type { World } from './world';
import { LOOM_SIZE, newStrand, type Strand } from './weave';
import { rollModule, moduleName } from './items';
import { lootRarity, systemSeed } from './run';
import { meta, saveMeta, unlockedSet } from './meta';
import { clampRep } from './silhouette';
import { hasGraftFlag } from './grafts';
import { shiftStrength } from './exodus';
import { wrackReturn } from './remnant';

interface Pt {
  x: number;
  y: number;
  t: number;
}

export interface Tether {
  ship: Ship;
  len: number;
}

/** pixels of strand per unit of thread */
const PX_PER_THREAD = 320;
const STRAND_LIFE = 4;
const SAMPLE = 16;
/** most thread a system's rocks will give up */
const ROCK_CAP = 10;

export class ThreadSys {
  w: World;
  trails: Pt[][] = [];
  spinning = false;
  acc = 0; // distance since last thread spent
  tethers: Tether[] = [];
  rockThread = 0;
  flashes: { pts: { x: number; y: number }[]; t: number; color: string }[] = [];
  reelT = 0;
  // Tide
  tideDir: { x: number; y: number };
  tideGrace: number;
  tideOn: boolean;
  tideWarned = false;
  tideRisen = false;
  /** the Tide's own clock: it holds still while something here has locked onto you */
  tideT = 0;
  held = false;
  handsNext = 20;
  handsWaves = 0;
  hinted = new Set<string>();
  unravelSeen = false;

  constructor(w: World) {
    this.w = w;
    const run = w.run;
    const rng = new RNG(hashSeed(systemSeed(run, w.node), 'tide'));
    // the Tide follows you in through the lane you arrived by
    const pa = Math.atan2(w.player.y, w.player.x) + rng.range(-0.5, 0.5);
    this.tideDir = { x: Math.cos(pa), y: Math.sin(pa) };
    const k = w.node.kind;
    let g = k === 'start' ? 300 : k === 'station' || k === 'haven' || k === 'narrows' ? 160 : 110;
    if (w.node.extras?.includes('wrack')) g = 30;
    if (run.relics.includes('warden_key')) g *= 1.5;
    if (run.relics.includes('hollow_idol')) g *= 0.75;
    if (hasGraftFlag(run, 'still')) g *= 1.35;
    g *= 1 - run.resonance * 0.05;
    this.tideGrace = g;
    this.tideOn = k !== 'final';
  }

  get maxTethers() {
    return 2 + (this.w.run.skills['w_tether'] ?? 0);
  }

  bindThreshold(s: Ship): number {
    if (s.boss) return 0;
    const bonus = (this.w.run.skills['g_bind'] ?? 0) * 0.08 + (hasGraftFlag(this.w.run, 'tendril') ? 0.1 : 0);
    return (s.elite ? 0.3 : 0.5) + bonus;
  }

  // -------------------------------------------------------------------------
  // Tide
  // -------------------------------------------------------------------------
  /** signed distance along tideDir beyond which everything is erased */
  get front(): number {
    const b = this.w.bounds + 400;
    const tt = this.tideT - this.tideGrace;
    if (!this.tideOn || tt <= 0) return b + 2000;
    const tc = 288;
    const d = tt < tc ? 18 * tt + 0.125 * tt * tt : 18 * tc + 0.125 * tc * tc + 90 * (tt - tc);
    return b - d;
  }
  /** how far a point is from the Tide (negative = inside it) */
  tideGap(x: number, y: number): number {
    return this.front - (x * this.tideDir.x + y * this.tideDir.y);
  }

  private updateTide(dt: number) {
    const w = this.w;
    if (!this.tideOn || w.playerDead) return;
    // it will not take you while something here has a hold on you (a pending fight, a giant)
    const run = w.run;
    this.held = !!(w.bossShip && !w.bossShip.dead) || run.pending.some((p) => p.nodeId === run.nodeId && !p.cleared);
    if (!this.held) this.tideT += dt;
    const rem = this.tideGrace - this.tideT;
    if (!this.tideWarned && rem < 25) {
      this.tideWarned = true;
      w.hooks.toast('Behind you, the lane is coming apart. The Tide is rising.', '#e0d8ff');
      audio.sfx('warning');
    }
    if (rem > 0) return;
    if (!this.tideRisen) {
      this.tideRisen = true;
      w.hooks.toast('The Tide.', '#ffffff');
      this.spawnWrack();
    }
    // erase whatever it reaches
    for (const s of w.ships) {
      if (s.dead) continue;
      const gap = this.tideGap(s.x, s.y);
      if (gap > s.radius) continue;
      if (s.tethered) {
        this.unravel(s);
        continue;
      }
      if (s.side === 'warden' || s.boss) continue; // its own hands, and things too vast to unmake quickly
      if (s.allied && !s.isPlayer) {
        s.dead = true;
        continue;
      }
      this.w.damage(s, s.maxHull * (s.isPlayer ? 0.12 : 0.2) * dt + 6 * dt, { src: null, fromPlayer: false, beam: true, hazard: true });
      if (s.isPlayer && Math.random() < dt * 2) w.hooks.toast('The Tide is unmaking your hull!', '#f98');
    }
    for (const p of w.pois) {
      if (p.erased || p.kind === 'finale') continue;
      if (this.tideGap(p.x, p.y) < 0) {
        p.erased = true;
        p.used = true;
        w.explosion(p.x, p.y, 30, '#dde');
      }
    }
    for (const r of w.rocks) if (!r.dead && this.tideGap(r.x, r.y) < 0) r.dead = true;
    for (const k of w.pickups) if (!k.dead && this.tideGap(k.x, k.y) < 0) k.dead = true;
    // its hands come out of it
    this.handsNext -= dt;
    if (this.handsNext <= 0) {
      this.handsWaves++;
      this.handsNext = 36;
      const alive = w.ships.filter((s) => s.side === 'warden' && !s.dead).length;
      const n = Math.min(9, 1 + Math.floor(w.run.depth / 2) + this.handsWaves, 12 - alive);
      if (n > 0) {
        const before = new Set(w.ships.map((s) => s.id));
        // the Choir is heavier for every ship ever unravelled into it
        const weight = Number(meta.metaFlags['choir.weight'] ?? 0);
        w.startCombat({ side: 'warden', count: n, strength: (1 + this.handsWaves * 0.12) * (1 + Math.min(0.6, weight * 0.02)) });
        const p = w.player;
        const g = this.tideGap(p.x, p.y);
        // project the player onto the front, then step back out of it
        const qx = p.x + this.tideDir.x * (g + 120), qy = p.y + this.tideDir.y * (g + 120);
        const px = -this.tideDir.y, py = this.tideDir.x;
        let i = 0;
        const familiar = () => {
          const a = familiarArch();
          if (!a) return null;
          const f = w.run.factions.find((x) => x.archetype === a);
          const GENERIC: Record<string, string> = { mercantile: 'traders', zealot: 'pilgrims', hive: 'hive-kin', machine: 'machines', raider: 'raiders', ancient: 'elders', monster: 'lane-beasts' };
          return { species: f?.species ?? GENERIC[a] ?? 'something', color: f?.color ?? '#e0c0ff' };
        };
        for (const s of w.ships) {
          if (before.has(s.id)) continue;
          const off = (i++ - n / 2) * 110;
          s.x = qx + px * off - this.tideDir.x * 160;
          s.y = qy + py * off - this.tideDir.y * 160;
          s.name = 'Choirhand';
          const once = familiar();
          if (once) {
            s.name = `Choirhand (once ${once.species})`;
            s.tint = once.color;
          }
          w.warpInFx(s.x, s.y, s.radius);
        }
        if (this.handsWaves === 1) w.hooks.toast('Something climbs out of the Tide.', '#ffffff');
      }
    }
  }


  spawnWrack() {
    const w = this.w;
    const n = w.node.extras?.includes('wrack') ? 4 : 2;
    const px = -this.tideDir.y, py = this.tideDir.x;
    // seeded, so a reload puts the same wrack in the same places
    const rng = new RNG(hashSeed(systemSeed(w.run, w.node), 'wrack'));
    const b = w.bounds + 400;
    for (let i = 0; i < n; i++) {
      const along = b - 1000 - rng.range(0, 1000);
      const side = rng.range(-0.45, 0.45) * w.bounds;
      let x = this.tideDir.x * along + px * side, y = this.tideDir.y * along + py * side;
      const r = Math.hypot(x, y);
      if (r > w.bounds - 300) {
        x *= (w.bounds - 300) / r;
        y *= (w.bounds - 300) / r;
      }
      const p = w.addAnchor('wrack', 'Tide-wrack', x, y);
      p.anchorColor = '#e8e8ff';
    }
  }

  // -------------------------------------------------------------------------
  // Spinning
  // -------------------------------------------------------------------------
  update(dt: number) {
    const w = this.w;
    const run = w.run;
    const p = w.player;
    const now = w.t;
    this.updateTide(dt);
    // expire old strand points
    // expire old points, but never the newest point of the trail being spun
    this.trails.forEach((tr, i) => {
      const keep = i === this.trails.length - 1 && this.spinning ? 1 : 0;
      while (tr.length > keep && now - tr[0].t > STRAND_LIFE) tr.shift();
    });
    this.trails = this.trails.filter((tr, i) => tr.length > 1 || (i === this.trails.length - 1 && this.spinning));
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter((f) => f.t > 0);
    const want = !w.playerDead && !w.jump && key('q');
    if (want && !this.spinning) {
      if (run.thread < 1) {
        if (pressed('q')) {
          w.hooks.toast('No thread left to spin.', '#f98');
          audio.sfx('error');
        }
      } else {
        this.spinning = true;
        this.trails.push([{ x: p.x, y: p.y, t: now }]);
        audio.sfx('blink', { vol: 0.25, pitch: 1.6 });
      }
    } else if (!want && this.spinning) this.spinning = false;
    if (this.spinning) {
      const tr = this.trails[this.trails.length - 1];
      if (!tr.length) tr.push({ x: p.x, y: p.y, t: now });
      const last = tr[tr.length - 1];
      const d = dist(last.x, last.y, p.x, p.y);
      if (d >= SAMPLE) {
        tr.push({ x: p.x, y: p.y, t: now });
        this.acc += d;
        const per = PX_PER_THREAD * (hasGraftFlag(run, 'tendril') ? 1.4 : 1);
        while (this.acc >= per) {
          this.acc -= per;
          run.thread = Math.max(0, run.thread - 1);
        }
        if (run.thread <= 0) {
          this.spinning = false;
          w.hooks.toast('Your spools run dry.', '#f98');
        }
        this.checkLoop(tr);
      }
    }
    this.updateSnags(dt);
    this.updateTethers(dt);
    this.hints();
  }

  private checkLoop(tr: Pt[]) {
    const n = tr.length;
    if (n < 8) return;
    const a = tr[n - 2], b = tr[n - 1];
    for (let i = 0; i < n - 5; i++) {
      const c = tr[i], d = tr[i + 1];
      const hit = segX(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
      if (!hit) continue;
      const poly = [{ x: hit.x, y: hit.y }, ...tr.slice(i + 1, n - 1).map((q) => ({ x: q.x, y: q.y }))];
      // keep the tail before the crossing so you can keep spinning
      tr.splice(0, n - 1, { x: hit.x, y: hit.y, t: this.w.t });
      if (polyArea(poly) > 2500) this.closeLoop(poly);
      return;
    }
  }

  private closeLoop(poly: { x: number; y: number }[]) {
    const w = this.w;
    const run = w.run;
    this.flashes.push({ pts: poly, t: 0.6, color: '#bff' });
    audio.sfx('arc', { vol: 0.5, pitch: 1.4 });
    let bound = 0, stunned = 0;
    for (const s of w.ships) {
      if (s.dead || s.allied || s.isPlayer || !s.hostile) continue;
      if (!inPoly(s.x, s.y, poly)) continue;
      s.stun = Math.max(s.stun, s.boss ? 0.6 : 1.5);
      stunned++;
      if (!s.boss && s.hull <= s.maxHull * this.bindThreshold(s) && this.tethers.length < this.maxTethers) {
        this.bind(s);
        bound++;
      } else {
        w.damage(s, 6 + run.depth * 2, { src: w.player, fromPlayer: true, aoe: true });
      }
    }
    if (stunned && !bound && !this.hinted.has('thresh')) {
      this.hinted.add('thresh');
      w.hooks.toast('Too strong to bind. Wear them down first — watch the mark on their hull bar.', '#bff');
    } else if (stunned > bound && bound === 0 && this.tethers.length >= this.maxTethers) w.hooks.toast('You cannot tow any more.', '#fa8');
    // anchors
    for (const p of w.pois) {
      if (!p.anchor || p.woven || p.erased) continue;
      if (!inPoly(p.x, p.y, poly)) continue;
      this.weaveAnchor(p);
    }
    // rocks
    let got = 0;
    for (const r of w.rocks) {
      if (r.dead || !inPoly(r.x, r.y, poly)) continue;
      w.breakRock(r);
      if (this.rockThread < ROCK_CAP) {
        const g = r.r > 30 ? 2 : 1;
        const take = Math.min(g, ROCK_CAP - this.rockThread);
        this.rockThread += take;
        got += take;
      }
    }
    if (got) this.gainThread(got, w.player.x, w.player.y - 40);
  }

  gainThread(n: number, x: number, y: number) {
    const run = this.w.run;
    const max = this.w.stats.maxThread;
    const before = run.thread;
    run.thread = Math.max(run.thread, Math.min(max, run.thread + n));
    const g = Math.round(run.thread - before);
    if (g > 0) this.w.text(x, y, `+${g} thread`, '#bff', 14);
    else if (n > 0) this.w.text(x, y, 'spools full', '#9ab', 12);
  }

  weaveAnchor(p: POI) {
    const w = this.w;
    const run = w.run;
    if (run.strands.length >= LOOM_SIZE) {
      w.hooks.toast('Your Loom is full. Open it (M) to let a strand go.', '#fa8');
      audio.sfx('error');
      return;
    }
    let s: Strand | null = null;
    switch (p.anchor) {
      case 'faction':
        if (p.owner) s = newStrand(run, { kind: 'faction', label: `${p.owner.short} lane`, faction: p.owner.id, color: p.owner.color });
        break;
      case 'station':
        s = newStrand(run, { kind: p.anchorHaven ? 'haven' : 'station', label: p.name, faction: p.owner?.id });
        break;
      case 'planet':
        s = newStrand(run, { kind: 'planet', label: p.name, planet: p.planetKind });
        break;
      case 'derelict':
        s = newStrand(run, { kind: 'derelict', label: 'Wreck-lane' });
        break;
      case 'anomaly':
        s = newStrand(run, { kind: 'anomaly', label: 'Strange lane' });
        break;
      case 'scar':
        s = newStrand(run, { kind: 'scar', label: { asteroids: 'Rock-scar', radiation: 'Burn-scar', ionstorm: 'Storm-scar', nebula: 'Fog-scar', none: 'Scar' }[p.hazard ?? 'none'], hazard: p.hazard });
        break;
      case 'wrack':
        s = newStrand(run, { kind: 'wrack', label: 'Tide-wrack' });
        this.gainThread(4, p.x, p.y);
        if (Math.random() < 0.35) {
          const back = wrackReturn(run);
          if (back) w.hooks.toast(`Tangled in the wrack: ${back}. You know it. You lost it in another life.`, '#e8e8ff');
        }
        break;
    }
    if (!s) return;
    p.woven = true;
    run.strands.push(s);
    w.hooks.toast(`Strand taken: ${s.label}. Weave it from the Loom (M).`, s.color);
    audio.sfx('levelup', { vol: 0.35, pitch: 1.5 });
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU;
      w.part(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, -Math.cos(a) * 80, -Math.sin(a) * 80, 0.8, 3, s.color, true, 0.92);
    }
  }

  private updateSnags(dt: number) {
    const w = this.w;
    if (!this.trails.length) return;
    for (const s of w.ships) {
      if (s.dead || s.allied || !s.hostile || s.boss) continue;
      let snag = false;
      outer: for (const tr of this.trails) {
        for (let i = 1; i < tr.length; i++) {
          const a = tr[i - 1], b = tr[i];
          // cheap reject
          if (Math.abs(s.x - a.x) > 120 + s.radius || Math.abs(s.y - a.y) > 120 + s.radius) continue;
          if (segDist2(s.x, s.y, a.x, a.y, b.x, b.y) < (s.radius + 6) ** 2) {
            snag = true;
            break outer;
          }
        }
      }
      if (snag) {
        s.slow = Math.max(s.slow, 0.8);
        w.damage(s, (3 + w.run.depth) * dt, { src: w.player, fromPlayer: true, beam: true, dot: true });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tethers
  // -------------------------------------------------------------------------
  bind(s: Ship) {
    const w = this.w;
    s.tethered = true;
    s.allied = true;
    s.hostile = false;
    s.aggro = false;
    s.target = null;
    s.weapons = [];
    s.hailable = false;
    s.burn = 0;
    s.shield = 0;
    s.maxShield = 0;
    s.tint = '#9ff';
    if (s.group) {
      const g = w.groups.get(s.group);
      g?.members.delete(s.id);
      const gid = s.group;
      s.group = 0;
      w.checkGroup(gid);
    }
    this.tethers.push({ ship: s, len: 150 + s.radius });
    w.hooks.toast(`Bound: ${s.name}. Reel it in (hold F), cut it loose (R), or drag it into the Tide.`, '#bff');
    audio.sfx('missile', { vol: 0.5, pitch: 0.7 });
    w.run.stats.bound = (w.run.stats.bound ?? 0) + 1;
  }

  private updateTethers(dt: number) {
    const w = this.w;
    const p = w.player;
    this.tethers = this.tethers.filter((t) => !t.ship.dead);
    // cut the newest loose
    if (pressed('r') && this.tethers.length) this.release(this.tethers[this.tethers.length - 1]);
    // reel in the nearest
    const reeling = key('f') && this.tethers.length > 0;
    let reelTarget: Tether | null = null;
    if (reeling) {
      let bd = 1e12;
      for (const t of this.tethers) {
        const d = dist2(t.ship.x, t.ship.y, p.x, p.y);
        if (d < bd) {
          bd = d;
          reelTarget = t;
        }
      }
    }
    for (const t of this.tethers) {
      const s = t.ship;
      // a bound hull slowly comes apart
      s.hull -= s.maxHull * 0.008 * dt;
      if (s.hull <= 0) {
        s.dead = true;
        w.explosion(s.x, s.y, s.radius, '#9ff');
        w.hooks.toast(`${s.name} comes apart on the line.`, '#9ab');
        continue;
      }
      if (t === reelTarget) {
        t.len = Math.max(0, t.len - 260 * dt);
        if (dist(s.x, s.y, p.x, p.y) < p.radius + s.radius + 26) {
          this.strip(t);
          continue;
        }
      } else t.len = Math.min(150 + s.radius, t.len + 60 * dt);
      // rope constraint
      const dx = s.x - p.x, dy = s.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      s.vx *= Math.pow(0.55, dt);
      s.vy *= Math.pow(0.55, dt);
      s.angle += 0.4 * dt;
      if (d > t.len) {
        const nx = dx / d, ny = dy / d;
        const ex = d - t.len;
        const ms = p.radius * p.radius, mh = s.radius * s.radius;
        const wh = Math.min(0.3, mh / (ms + mh)); // the hulk tugs, but you stay in charge
        const wp = 1 - wh;
        s.x -= nx * ex * wp;
        s.y -= ny * ex * wp;
        p.x += nx * ex * wh;
        p.y += ny * ex * wh;
        const rv = (s.vx - p.vx) * nx + (s.vy - p.vy) * ny;
        if (rv > 0) {
          s.vx -= nx * rv * wp;
          s.vy -= ny * rv * wp;
          p.vx += nx * rv * wh;
          p.vy += ny * rv * wh;
        }
      }
    }
    this.tethers = this.tethers.filter((t) => !t.ship.dead);
  }

  release(t: Tether) {
    const w = this.w;
    const s = t.ship;
    this.tethers = this.tethers.filter((x) => x !== t);
    s.tethered = false;
    s.allied = false;
    s.hostile = false;
    s.provoked = true; // released for good: not loopable again, and reputation shifts won't turn it
    s.aggro = false;
    s.fleeing = true;
    s.tint = undefined;
    s.stun = 0;
    if (s.faction) {
      clampRep(w.run, s.faction.id, 8);
      shiftStrength(w.run, s.faction.id, 0.3);
      w.run.flags['released.' + s.faction.id] = ((w.run.flags['released.' + s.faction.id] as number) ?? 0) + 1;
      w.hooks.toast(`You cut the ${s.name} loose. The ${s.faction.species} will remember.`, '#9e9');
      w.syncHostility();
    } else w.hooks.toast(`You cut the ${s.name} loose. It drifts away.`, '#9ab');
    w.run.stats.released = (w.run.stats.released ?? 0) + 1;
    audio.sfx('ui_open', { vol: 0.4 });
  }

  private strip(t: Tether) {
    const w = this.w;
    const run = w.run;
    const s = t.ship;
    this.tethers = this.tethers.filter((x) => x !== t);
    s.dead = true;
    w.explosion(s.x, s.y, s.radius * 0.8, '#fc8');
    const rng = new RNG((Math.random() * 1e9) >>> 0);
    const got = w.stripGraft?.(s, rng);
    if (!got) {
      const m = rollModule(rng, { rarity: lootRarity(run, rng, s.elite ? 1 : 0), unlocked: unlockedSet() });
      w.drop(s.x, s.y, 'module', 0, m);
      w.hooks.toast(`Stripped: ${moduleName(m)}`, '#fc8');
    }
    w.drop(s.x, s.y, 'credits', s.credits * 0.5);
    if (s.faction) {
      clampRep(run, s.faction.id, -3);
      shiftStrength(run, s.faction.id, -0.2);
    }
    run.stats.stripped = (run.stats.stripped ?? 0) + 1;
    audio.sfx('explode_small', { vol: 0.5 });
  }

  private unravel(s: Ship) {
    const w = this.w;
    const run = w.run;
    this.tethers = this.tethers.filter((x) => x.ship !== s);
    s.dead = true;
    const g = Math.round(6 + s.radius * 0.2 + run.depth + (s.elite ? 6 : 0));
    this.gainThread(g, w.player.x, w.player.y - 50);
    for (let i = 0; i < 40; i++) w.part(s.x, s.y, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 1.2, 3, '#e8e8ff', true, 0.95);
    run.stats.unravelled = (run.stats.unravelled ?? 0) + 1;
    meta.metaFlags['choir.weight'] = ((meta.metaFlags['choir.weight'] as number) ?? 0) + 1;
    if (s.faction) shiftStrength(run, s.faction.id, -0.3);
    const wa = 'choir.w.' + (s.faction?.archetype ?? (s.side === 'monster' ? 'monster' : 'rogue'));
    meta.metaFlags[wa] = ((meta.metaFlags[wa] as number) ?? 0) + 1;
    saveMeta();
    if (!this.unravelSeen && !run.flags['seen.unravel']) {
      run.flags['seen.unravel'] = true;
      w.hooks.toast('It goes under the Tide. For a moment, it looks back at you.', '#e8e8ff');
    } else w.hooks.toast(`Unravelled: ${s.name}.`, '#e8e8ff');
    this.unravelSeen = true;
    audio.sfx('blink', { vol: 0.5, pitch: 0.6 });
  }

  /** leaving the system: whatever is on the line stays behind */
  dropAll() {
    for (const t of this.tethers) t.ship.dead = true;
    this.tethers = [];
  }

  private hints() {
    const w = this.w;
    if (meta.runs > 3) return;
    if (!this.hinted.has('bind')) {
      for (const s of w.ships) {
        if (s.dead || s.allied || !s.hostile || s.boss) continue;
        if (s.hull <= s.maxHull * this.bindThreshold(s) && dist2(s.x, s.y, w.player.x, w.player.y) < 700 * 700) {
          this.hinted.add('bind');
          w.hooks.toast('That ship is weak enough to bind: hold Q and fly a loop around it.', '#bff');
          break;
        }
      }
    }
    if (!this.hinted.has('anchor') && w.arrivalT > 8) {
      for (const p of w.pois) {
        if (!p.anchor || p.woven || p.erased || !p.discovered) continue;
        if (dist2(p.x, p.y, w.player.x, w.player.y) < 900 * 900) {
          this.hinted.add('anchor');
          if (!meta.metaFlags['hint.anchor']) w.hooks.toast('Loop thread (hold Q) around a beacon, world, or wreck to take its strand — strands decide where you go next.', '#ffd36b');
          meta.metaFlags['hint.anchor'] = true;
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------
function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): { x: number; y: number } | null {
  const rX = bx - ax, rY = by - ay, sX = dx - cx, sY = dy - cy;
  const den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + t * rX, y: ay + t * rY };
}
export function inPoly(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function polyArea(poly: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(s / 2);
}
function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const l = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / l, 0, 1);
  const x = ax + t * vx, y = ay + t * vy;
  return (px - x) ** 2 + (py - y) ** 2;
}

/** the Choir wears the shapes of what was unravelled into it, across every life */
function familiarArch(): string | null {
  const opts: [string, number][] = [];
  for (const [k, v] of Object.entries(meta.metaFlags)) if (k.startsWith('choir.w.')) opts.push([k.slice(8), Number(v)]);
  const tot = opts.reduce((a, [, v]) => a + v, 0);
  if (tot <= 0 || Math.random() > Math.min(0.8, tot * 0.08)) return null;
  let r = Math.random() * tot;
  for (const [a, v] of opts) if ((r -= v) <= 0) return a;
  return null;
}
