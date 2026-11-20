import { RNG } from '../core/rng';
import { TAU, angDiff, clamp, dist, dist2, leadAngle, turnToward } from '../core/math';
import { input, key, pressed } from '../core/input';
import { audio, type Sfx } from '../core/audio';
import type { BossId, CombatSpec, Faction, FactionArchetype } from './api';
import { hullDef, moduleName, rollModule, weaponStats, type ModuleInst, type Stats, type WeaponStats } from './items';
import { computeStats, factionById, hasSkillFlag, isHostileRep, lootRarity, systemSeed, type GNode, type RunState } from './run';
import { unlockedSet, meta } from './meta';
import type { FloatText, LineFx, Particle, Pickup, POI, Proj, ProjKind, Rock, Role, Ship, WeaponSlot } from './entities';
import { makeBossSprite, makeShipSprite, type ShipStyle } from '../art/ships';
import { makeAsteroid, makeDerelict, makePlanet, makeStar, makeStation, type PlanetKind } from '../art/planets';
import { hashSeed } from '../core/rng';
import { systemName as genSysName, planetName } from './names';

export interface WorldHooks {
  toast(msg: string, color?: string): void;
  poi(p: POI): void;
  dock(p: POI): void;
  hail(s: Ship): void;
  death(): void;
  jumped(nodeId: number): void;
  combatWon(afterVictory: string | undefined): void;
  groupCleared(afterVictory: string | undefined): void;
  levelUp(levels: number): void;
  xp(n: number): void;
  bossKilled(id: BossId): void;
  playerKill(s: Ship): void;
}

interface CombatGroup {
  afterVictory?: string;
  members: Set<number>;
  boss: boolean;
}

const spriteCache = new Map<string, HTMLCanvasElement>();
function cachedSprite(key: string, make: () => HTMLCanvasElement) {
  let s = spriteCache.get(key);
  if (!s) {
    s = make();
    spriteCache.set(key, s);
    if (spriteCache.size > 400) spriteCache.delete(spriteCache.keys().next().value!);
  }
  return s;
}

export function playerSprite(hullId: string): HTMLCanvasElement {
  const h = hullDef(hullId);
  return cachedSprite('p:' + hullId, () => makeShipSprite({ seed: hashSeed('hull', hullId), style: 'player', size: h.size, primary: h.colors[0], secondary: h.colors[1] }));
}

const ARCH_STYLE: Record<FactionArchetype, ShipStyle> = { mercantile: 'mercantile', zealot: 'zealot', hive: 'hive', machine: 'machine', raider: 'raider', ancient: 'ancient' };

interface RoleT {
  hull: number;
  shield: number;
  speed: number;
  thrust: number;
  size: number;
  turn: number;
  contact: number;
  xp: number;
  credits: number;
}
const ROLE_T: Record<Role, RoleT> = {
  fighter: { hull: 46, shield: 16, speed: 270, thrust: 420, size: 30, turn: 3.6, contact: 0, xp: 12, credits: 10 },
  sniper: { hull: 38, shield: 22, speed: 230, thrust: 340, size: 32, turn: 2.6, contact: 0, xp: 14, credits: 12 },
  swarm: { hull: 18, shield: 0, speed: 360, thrust: 700, size: 20, turn: 5, contact: 9, xp: 6, credits: 4 },
  brute: { hull: 110, shield: 30, speed: 190, thrust: 260, size: 46, turn: 1.8, contact: 12, xp: 24, credits: 22 },
  carrier: { hull: 150, shield: 40, speed: 140, thrust: 180, size: 60, turn: 1.2, contact: 0, xp: 34, credits: 34 },
  trader: { hull: 90, shield: 30, speed: 200, thrust: 260, size: 48, turn: 1.6, contact: 0, xp: 10, credits: 60 },
  drone: { hull: 26, shield: 0, speed: 380, thrust: 900, size: 16, turn: 6, contact: 0, xp: 3, credits: 2 },
  kamikaze: { hull: 30, shield: 0, speed: 380, thrust: 650, size: 24, turn: 3.2, contact: 45, xp: 8, credits: 6 },
  boss: { hull: 1500, shield: 300, speed: 150, thrust: 160, size: 200, turn: 0.9, contact: 25, xp: 400, credits: 400 },
  echo: { hull: 120, shield: 0, speed: 340, thrust: 700, size: 34, turn: 5, contact: 0, xp: 0, credits: 0 },
  turret: { hull: 200, shield: 60, speed: 0, thrust: 0, size: 50, turn: 2, contact: 0, xp: 30, credits: 40 },
};

const ROLE_MIX: Record<FactionArchetype | 'warden' | 'monster' | 'rogue', [Role, number][]> = {
  mercantile: [['fighter', 4], ['sniper', 2], ['brute', 1]],
  zealot: [['fighter', 3], ['brute', 2], ['kamikaze', 2]],
  hive: [['swarm', 5], ['fighter', 2], ['carrier', 1]],
  machine: [['sniper', 3], ['fighter', 3], ['carrier', 1]],
  raider: [['fighter', 4], ['brute', 2], ['sniper', 1], ['kamikaze', 1]],
  ancient: [['sniper', 2], ['brute', 2]],
  warden: [['fighter', 3], ['sniper', 2]],
  monster: [['swarm', 5], ['brute', 2]],
  rogue: [['fighter', 3], ['sniper', 1], ['brute', 1]],
};

const ARCH_WEAPONS: Record<string, Partial<Record<Role, string[]>>> = {
  mercantile: { fighter: ['pulse'], sniper: ['rail', 'missile'], brute: ['flak'], trader: ['pulse'], carrier: ['missile'] },
  zealot: { fighter: ['pulse', 'beam'], brute: ['beam', 'flak'], kamikaze: [], carrier: ['wave'] },
  hive: { swarm: [], fighter: ['spit'], carrier: ['spit'], brute: ['spit'] },
  machine: { fighter: ['pulse', 'arc'], sniper: ['rail'], carrier: ['arc'], brute: ['beam'] },
  raider: { fighter: ['scatter', 'pulse'], brute: ['flak', 'scatter'], sniper: ['missile', 'rail'], kamikaze: [] },
  ancient: { sniper: ['lance', 'wave'], brute: ['wave', 'beam'], fighter: ['wave'] },
  warden: { fighter: ['pulse'], sniper: ['rail'] },
  monster: { swarm: [], brute: ['spit'] },
  rogue: { fighter: ['pulse', 'scatter'], sniper: ['rail'], brute: ['flak'] },
};

let shipIdCounter = 1;

export class World {
  run: RunState;
  node: GNode;
  hooks: WorldHooks;
  rng: RNG;
  stats!: Stats;
  t = 0;
  ships: Ship[] = [];
  projs: Proj[] = [];
  pickups: Pickup[] = [];
  pois: POI[] = [];
  rocks: Rock[] = [];
  parts: Particle[] = [];
  texts: FloatText[] = [];
  lines: LineFx[] = [];
  beams: { x1: number; y1: number; x2: number; y2: number; color: string; w: number }[] = [];
  strikes: { x: number; y: number; r: number; t: number; max: number }[] = [];
  player!: Ship;
  star: { x: number; y: number; r: number; color: string; sprite: HTMLCanvasElement } | null = null;
  bounds = 4300;
  gravityWells: { x: number; y: number; r: number; str: number }[] = [];
  wardenTime: number;
  wardenWarned = false;
  wardenWaves = 0;
  wardenNext = 0;
  jump: { target: number; t: number; total: number } | null = null;
  groups = new Map<number, CombatGroup>();
  groupCounter = 1;
  shake = 0;
  slowmo = 0;
  timeScale = 1;
  saintUsed = false;
  shuntUsed = false;
  frozenUsed = false;
  abilityCd = 0;
  abilityMax = 5;
  boosting = false;
  pdTimer = 0;
  stormCounter = 0;
  cometCounter = 0;
  ionTimer = 15;
  dronesRespawn = 0;
  killsHere = 0;
  playerDead = false;
  frameDt = 1 / 60;
  pendingWins: { t: number; ev: string | undefined }[] = [];
  deathTimer = 0;
  nearest: { kind: 'poi'; poi: POI } | { kind: 'ship'; ship: Ship } | null = null;
  bossShip: Ship | null = null;
  hazardTint = '';
  arrivalT = 0;
  sysName: string;
  owner: Faction | null;
  hasHostilesNear = false;

  constructor(run: RunState, hooks: WorldHooks) {
    this.run = run;
    this.hooks = hooks;
    this.node = run.nodes.find((n) => n.id === run.nodeId)!;
    this.rng = new RNG(systemSeed(run, this.node));
    this.sysName = this.node.name;
    this.owner = factionById(run, this.node.owner);
    const nav = 0;
    this.wardenTime = (this.node.kind === 'start' ? 300 : 220) + nav;
    this.build();
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  private build() {
    const run = this.run;
    const rng = this.rng;
    const node = this.node;
    void genSysName;
    // star
    const starColors = ['#ffd27a', '#fff2d0', '#ff9a6a', '#9ac8ff', '#ff6a5a', '#e0f0ff'];
    if (node.kind !== 'final' || true) {
      const sc = rng.pick(starColors);
      const sr = rng.range(110, 210);
      this.star = { x: 0, y: 0, r: sr, color: sc, sprite: makeStar(sc, sr) };
    }
    // planets
    const kinds: PlanetKind[] = ['rocky', 'ocean', 'gas', 'ice', 'lava', 'toxic', 'barren', 'crystal'];
    const np = node.kind === 'final' ? 2 : rng.int(2, 5);
    let orbitR = 800;
    for (let i = 0; i < np; i++) {
      orbitR += rng.range(450, 800);
      const kind = rng.pick(kinds);
      const r = kind === 'gas' ? rng.range(110, 170) : rng.range(50, 100);
      const p = this.addPoi('planet', planetName(rng, node.name, i), r, 'planet', orbitR, rng.range(0, TAU));
      p.planetKind = kind;
      p.sprite = makePlanet(rng.fork(), kind, r);
      p.discovered = true;
      p.orbit!.speed = rng.range(0.004, 0.012) * (rng.chance(0.5) ? 1 : -1) * (1600 / orbitR);
    }
    this.bounds = Math.max(3600, orbitR + 900);
    const owner = this.owner;
    // stations
    if (node.kind === 'station' || node.kind === 'haven') {
      const st = this.addPoi('station', `${owner ? owner.short : genSysName(rng)} ${rng.pick(['Station', 'Exchange', 'Hold', 'Spire', 'Waypoint', 'Rest'])}`, 70, 'station', rng.range(1200, this.bounds - 700), rng.range(0, TAU));
      st.owner = node.kind === 'haven' ? null : owner;
      st.sprite = makeStation(rng.fork(), node.kind === 'haven' ? 'neutral' : owner?.archetype ?? 'neutral', 150);
      st.discovered = true;
      st.orbit!.speed *= 0.4;
      if (node.kind === 'haven') st.name = `${genSysName(rng)} Haven`;
    }
    // misc POIs
    const add = (kind: 'derelict' | 'anomaly' | 'distress' | 'asteroid', n: number) => {
      for (let i = 0; i < n; i++) {
        const site = kind;
        const nm = kind === 'derelict' ? `Wreck of the ${genSysName(rng)}` : kind === 'anomaly' ? rng.pick(['Spatial Anomaly', 'Unknown Phenomenon', 'Distortion', 'Lane Scar', 'Whisper Point']) : kind === 'distress' ? 'Distress Beacon' : 'Large Asteroid';
        const p = this.addPoi(kind, nm, kind === 'asteroid' ? 60 : 50, site, rng.range(900, this.bounds - 400), rng.range(0, TAU), true);
        if (kind === 'derelict') p.sprite = makeDerelict(rng.fork(), rng.range(70, 120));
        if (kind === 'asteroid') p.sprite = makeAsteroid(rng.fork(), 60);
        p.anomalyKind = rng.int(0, 3);
      }
    };
    if (node.kind === 'derelict') add('derelict', rng.int(2, 3));
    else if (rng.chance(0.3)) add('derelict', 1);
    if (node.kind === 'anomaly') add('anomaly', rng.int(1, 2));
    else if (rng.chance(0.18)) add('anomaly', 1);
    if (rng.chance(0.25) && node.kind !== 'final' && node.kind !== 'start') add('distress', 1);
    // hazards
    if (node.hazard === 'asteroids' || rng.chance(0.25)) {
      const ringR = rng.range(1400, this.bounds - 600);
      const n = node.hazard === 'asteroids' ? 70 : 30;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU);
        const rr = ringR + rng.range(-260, 260);
        const r = rng.range(14, 46);
        this.rocks.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: rng.range(-8, 8), vy: rng.range(-8, 8), r, hp: r * 2.2, rot: rng.range(0, TAU), vr: rng.range(-0.5, 0.5), sprite: cachedSprite('rock' + (i % 12) + ':' + Math.round(r / 8), () => makeAsteroid(hashSeed('rock', i % 12, Math.round(r / 8)), Math.round(r / 8) * 8 + 6)), dead: false });
      }
      if (rng.chance(0.6)) add('asteroid', 1);
    }
    if (node.kind === 'anomaly') {
      const an = this.pois.find((p) => p.kind === 'anomaly');
      if (an && an.anomalyKind === 0) this.gravityWells.push({ x: an.x, y: an.y, r: 1000, str: 140 });
    }
    // markers
    run.markers.forEach((m, idx) => {
      if (m.nodeId !== node.id || m.done) return;
      const kind = m.kind === 'planet' ? 'beacon' : m.kind === 'wreck' ? 'derelict' : m.kind === 'station' ? 'station' : m.kind === 'anomaly' ? 'anomaly' : 'beacon';
      const p = this.addPoi(kind as 'beacon', m.label, kind === 'station' ? 70 : 50, 'marker', rng.range(1000, this.bounds - 600), rng.range(0, TAU), true);
      p.markerIdx = idx;
      p.label = m.label;
      p.discovered = true;
      if (kind === 'derelict') p.sprite = makeDerelict(rng.fork(), 110);
      if (kind === 'station') p.sprite = makeStation(rng.fork(), 'neutral', 140);
    });
    // finale
    if (node.kind === 'final') {
      const p = this.addPoi('finale', 'The Heart', 90, 'marker', 1500, rng.range(0, TAU), true);
      p.discovered = true;
      p.label = 'The Heart';
    }
    // player
    const ang = rng.range(0, TAU);
    const pr = this.bounds - 500;
    this.player = this.makePlayer(Math.cos(ang) * pr, Math.sin(ang) * pr);
    this.player.angle = ang + Math.PI;
    this.ships.push(this.player);
    this.refreshPlayer(true);
    this.spawnDrones();
    // populate NPCs
    this.populate();
    // hazards tint & wardens
    if (node.hazard === 'nebula') this.hazardTint = 'rgba(120,80,160,0.10)';
    if (node.hazard === 'radiation') this.hazardTint = 'rgba(160,200,60,0.06)';
    if (node.hazard === 'ionstorm') this.hazardTint = 'rgba(80,140,255,0.06)';
    let wt = this.wardenTime;
    if (run.relics.includes('warden_key')) wt *= 1.5;
    if (run.relics.includes('hollow_idol')) wt *= 0.75;
    wt *= 1 - run.resonance * 0.05;
    this.wardenTime = wt;
    // restore per-system state after a save/continue
    if (run.sys.nodeId === node.id) {
      for (const p of this.pois) if (run.sys.used.includes(p.id)) p.used = true;
      this.arrivalT = run.sys.t;
      this.wardenWarned = this.wardenTime - this.arrivalT < 30;
      this.saintUsed = run.sys.saint;
      this.shuntUsed = run.sys.shunt;
      this.frozenUsed = run.sys.frozen;
      this.killsHere = run.sys.kills;
    } else {
      run.sys = { nodeId: node.id, used: [], arrivalDone: false, t: 0, saint: false, shunt: false, frozen: false, kills: 0 };
    }
  }

  /** copy transient per-system state into the run so saves capture it */
  syncSys() {
    const s = this.run.sys;
    s.t = this.arrivalT;
    s.saint = this.saintUsed;
    s.shunt = this.shuntUsed;
    s.frozen = this.frozenUsed;
    s.kills = this.killsHere;
    s.used = this.pois.filter((p) => p.used).map((p) => p.id);
  }

  /** re-evaluate hostility of faction ships after reputation or relic changes */
  syncHostility() {
    for (const s of this.ships) {
      if (s.dead || s.allied || !s.faction || s.provoked || s.group) continue;
      const h = this.hostileByRep(s.faction) && s.role !== 'trader';
      if (h !== s.hostile) {
        s.hostile = h;
        if (!h) {
          s.aggro = false;
          s.target = null;
        }
      }
    }
  }

  hostileByRep(f: Faction): boolean {
    const rep = this.run.rep[f.id] ?? 0;
    if (f.archetype === 'raider' && this.run.relics.includes('rust_crown')) return rep <= -70;
    if (f.archetype === 'zealot' && this.run.relics.includes('pilgrim_lamp')) return rep <= -60;
    return isHostileRep(rep);
  }

  private addPoi(kind: POI['kind'], name: string, r: number, site: POI['site'], orbitR: number, phase: number, still = false): POI {
    const p: POI = {
      id: this.pois.length + 1, kind, name, x: Math.cos(phase) * orbitR, y: Math.sin(phase) * orbitR, r, sprite: null, site, used: false, discovered: false,
      markerIdx: -1, orbit: still ? undefined : { r: orbitR, speed: 0.01, phase }, anomalyKind: 0, owner: null, hostileStation: false, spin: 0,
    };
    this.pois.push(p);
    return p;
  }

  private populate() {
    const rng = this.rng;
    const node = this.node;
    const run = this.run;
    const depth = run.depth;
    if (node.kind === 'start' || node.kind === 'final') {
      const friendly = this.owner ?? run.factions.find((f) => f.archetype === 'mercantile') ?? run.factions.find((f) => f.archetype === 'machine') ?? null;
      if (node.kind === 'start' && friendly) this.spawnPatrol(friendly, 'trader', 1, false);
      return;
    }
    const raider = run.factions.find((f) => f.archetype === 'raider')!;
    const owner = this.owner;
    if (node.kind === 'hostile') {
      const side = owner && owner.archetype !== 'mercantile' && rng.chance(0.6) ? owner : raider;
      const groups = rng.int(2, 3);
      for (let g = 0; g < groups; g++) this.spawnPatrol(side, null, rng.int(2, 3) + Math.floor(depth / 3), true);
    } else if (node.kind === 'haven') {
      this.spawnPatrol(owner, 'trader', rng.int(1, 2), false);
    } else {
      if (owner) {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) this.spawnPatrol(owner, rng.chance(owner.archetype === 'mercantile' ? 0.6 : 0.25) ? 'trader' : null, rng.int(1, 3), false);
      }
      if (rng.chance(0.4 + depth * 0.05)) this.spawnPatrol(raider, null, rng.int(2, 3) + Math.floor(depth / 3), false);
      if (rng.chance(0.15)) this.spawnPatrol(null, null, rng.int(3, 6), true, 'monster');
    }
    if (node.kind === 'derelict' && rng.chance(0.5)) this.spawnPatrol(null, 'turret', rng.int(1, 2), true, 'rogue');
  }

  private spawnPatrol(f: Faction | null, role: Role | null, n: number, forceHostile: boolean, special?: 'warden' | 'monster' | 'rogue', tries = 0): void {
    const rng = this.rng;
    const a = rng.range(0, TAU);
    const r = rng.range(900, this.bounds - 800);
    const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
    // don't spawn right on top of the player
    if (tries < 8 && dist(cx, cy, this.player.x, this.player.y) < 1300) return this.spawnPatrol(f, role, n, forceHostile, special, tries + 1);
    const pg = this.groupCounter++;
    for (let i = 0; i < n; i++) {
      const s = this.makeEnemy({ faction: f, special, role: role ?? undefined, x: cx + rng.range(-150, 150), y: cy + rng.range(-150, 150) });
      s.patrolGroup = pg;
      if (forceHostile) s.hostile = true;
      if (s.role === 'turret') {
        const d = this.pois.find((p) => p.kind === 'derelict');
        if (d) {
          s.x = d.x + rng.range(-200, 200);
          s.y = d.y + rng.range(-200, 200);
        }
      }
      this.ships.push(s);
    }
  }

  makePlayer(x: number, y: number): Ship {
    const h = hullDef(this.run.hullId);
    const s = this.blankShip(x, y, h.size / 2, 'player', null, playerSprite(h.id), 'fighter');
    s.isPlayer = true;
    s.allied = true;
    s.hostile = false;
    s.name = this.run.shipName;
    return s;
  }

  blankShip(x: number, y: number, radius: number, side: string, faction: Faction | null, sprite: HTMLCanvasElement, role: Role): Ship {
    return {
      id: shipIdCounter++, name: '', x, y, vx: 0, vy: 0, angle: 0, radius, side, faction, isPlayer: false, allied: false, hostile: false,
      hull: 50, maxHull: 50, shield: 0, maxShield: 0, shieldRegen: 0, shieldDelay: 3, shieldTimer: 0, armor: 0, energy: 100, maxEnergy: 100, energyRegen: 30,
      thrust: 400, maxSpeed: 250, turnRate: 4, weapons: [], sprite, role, level: 0, dmgMult: 1, aim: 0.1, contactDmg: 0, contactCd: 0,
      burn: 0, burnDps: 0, slow: 0, cloak: 0, invuln: 0, reflect: 0, overdrive: 0, flash: 0, shieldFlash: 0, dead: false, lifetime: 0,
      target: null, aiT: 0, orbitDir: Math.random() < 0.5 ? 1 : -1, aggro: false, wanderX: x, wanderY: y, fleeing: false, hailed: false, hailable: false,
      group: 0, patrolGroup: 0, owner: null, boss: null, bossT: {}, phase: 0, xp: 0, credits: 0, lootChance: 0, elite: false, lastHitByPlayer: false, provoked: false, burnFromPlayer: false, thrusting: 0,
    };
  }

  /** Refresh the player's ship from run loadout/skills. */
  refreshPlayer(fill = false) {
    const st = (this.stats = computeStats(this.run));
    const p = this.player;
    const oldMax = p.maxHull;
    p.maxHull = st.maxHull;
    if (fill) p.hull = Math.min(this.run.hull, st.maxHull);
    void oldMax; // raising max hull never heals (prevents re-equip repair loops)
    p.hull = Math.min(p.hull, st.maxHull);
    p.maxShield = st.maxShield;
    if (fill) p.shield = st.maxShield;
    p.shield = Math.min(p.shield, st.maxShield);
    p.shieldRegen = st.shieldRegen;
    p.shieldDelay = st.shieldDelay;
    p.armor = st.armor;
    p.maxEnergy = st.maxEnergy;
    if (fill) p.energy = st.maxEnergy;
    p.energyRegen = st.energyRegen;
    p.thrust = st.thrust;
    p.maxSpeed = st.maxSpeed;
    p.turnRate = 9;
    p.weapons = [];
    this.run.weapons.forEach((m, i) => {
      if (!m) return;
      const ws = weaponStats(m);
      ws.damage *= st.damageMult;
      ws.cooldown /= st.fireRateMult;
      ws.speed *= st.projSpeedMult;
      ws.range *= st.rangeMult;
      ws.energy *= st.energyCostMult;
      p.weapons.push({ ws, cd: 0, shots: 0, group: (i % 2) as 0 | 1 });
    });
    const h = hullDef(this.run.hullId);
    this.abilityMax = h.abilityCd * st.abilityCdMult;
  }

  spawnDrones() {
    const want = Math.round(this.stats.drones);
    const have = this.ships.filter((s) => s.role === 'drone' && s.allied && !s.dead && s.lifetime === 0).length;
    for (let i = have; i < want; i++) this.ships.push(this.makeDrone(0));
  }

  makeDrone(lifetime: number): Ship {
    const p = this.player;
    const sp = cachedSprite('drone:player', () => makeShipSprite({ seed: 7, style: 'drone', size: 16, primary: '#9fd0ff', secondary: '#ffffff' }));
    const d = this.blankShip(p.x + this.rng.range(-40, 40), p.y + this.rng.range(-40, 40), 8, 'player', null, sp, 'drone');
    const t = ROLE_T.drone;
    d.allied = true;
    d.maxHull = d.hull = 40 + this.run.depth * 8;
    d.maxSpeed = t.speed + 60;
    d.thrust = t.thrust;
    d.turnRate = t.turn;
    d.owner = p;
    d.lifetime = lifetime;
    d.orbitDir = this.rng.chance(0.5) ? 1 : -1;
    const m: ModuleInst = { uid: 0, slot: 'weapon', defId: 'pulse', rarity: 0, affixes: [] };
    const ws = weaponStats(m);
    ws.damage *= (0.55 + this.run.depth * 0.08) * (hasSkillFlag(this.run, 'dronedmg') ? 1.5 : 1);
    ws.cooldown = 0.45;
    ws.range = 500;
    d.weapons = [{ ws, cd: Math.random(), shots: 0, group: 0 }];
    return d;
  }

  enemyLevel(): number {
    return this.run.depth + this.run.resonance * 0.8;
  }

  makeEnemy(o: { faction: Faction | null; special?: 'warden' | 'monster' | 'rogue'; role?: Role; x: number; y: number; strength?: number; elite?: boolean }): Ship {
    const rng = this.rng;
    const arch: string = o.special ?? o.faction?.archetype ?? 'rogue';
    const role: Role = o.role ?? rng.weighted(ROLE_MIX[arch as keyof typeof ROLE_MIX], (x) => x[1])[0];
    const T = ROLE_T[role];
    const lvl = this.enemyLevel();
    const str = o.strength ?? 1;
    const hpMult = (1 + 0.24 * lvl) * str * (o.special === 'warden' ? 1.3 : 1) * (arch === 'ancient' ? 1.8 : 1);
    const style: ShipStyle = o.special === 'warden' ? 'warden' : o.special === 'monster' ? 'monster' : role === 'drone' ? 'drone' : o.faction ? ARCH_STYLE[o.faction.archetype] : 'raider';
    const c1 = o.special === 'warden' ? '#e8e8f0' : o.special === 'monster' ? '#a05070' : o.faction?.color ?? '#888';
    const c2 = o.special === 'warden' ? '#202028' : o.special === 'monster' ? '#e0a040' : o.faction?.color2 ?? '#444';
    const size = T.size * (arch === 'ancient' ? 1.25 : 1);
    const variant = rng.int(0, 2);
    const sprite = cachedSprite(`${style}:${role}:${c1}:${variant}:${o.faction?.id ?? arch}`, () => makeShipSprite({ seed: hashSeed(style, role, variant, o.faction?.name ?? arch), style, size, primary: c1, secondary: c2 }));
    const s = this.blankShip(o.x, o.y, size / 2, o.special ?? o.faction?.id ?? 'rogue', o.faction, sprite, role);
    s.name = o.faction ? `${o.faction.short} ${roleName(role)}` : o.special === 'warden' ? 'Warden' : o.special === 'monster' ? 'Lane-beast' : `Rogue ${roleName(role)}`;
    s.maxHull = s.hull = T.hull * hpMult;
    s.maxShield = s.shield = T.shield * hpMult;
    s.shieldRegen = s.maxShield * 0.08;
    s.maxSpeed = T.speed * (1 + lvl * 0.02);
    s.thrust = T.thrust;
    s.turnRate = T.turn;
    s.level = lvl;
    s.dmgMult = (0.7 + 0.11 * lvl) * (o.special === 'warden' ? 1.2 : 1) * Math.sqrt(str);
    s.aim = Math.max(0.03, 0.16 - lvl * 0.012);
    s.contactDmg = T.contact * (1 + lvl * 0.15);
    s.xp = T.xp * (1 + lvl * 0.25);
    s.credits = T.credits * (1 + lvl * 0.3);
    s.lootChance = role === 'carrier' || role === 'brute' ? 0.14 : role === 'trader' ? 0.3 : 0.06;
    s.armor = role === 'brute' ? 1 + lvl * 0.3 : 0;
    if (o.elite || (lvl >= 2 && rng.chance(0.05 + lvl * 0.01))) this.makeElite(s);
    const wlist = ARCH_WEAPONS[arch]?.[role] ?? ['pulse'];
    if (wlist.length) s.weapons.push(this.enemyWeapon(rng.pick(wlist), s));
    if (role === 'brute' && wlist.length > 1 && rng.chance(0.5)) s.weapons.push(this.enemyWeapon(rng.pick(wlist), s));
    if (role === 'trader') s.hailable = true;
    else s.hailable = !!o.faction && rng.chance(0.85);
    if (o.special) s.hailable = false;
    // hostility by reputation
    if (o.faction) s.hostile = this.hostileByRep(o.faction) && role !== 'trader';
    else s.hostile = true;
    return s;
  }

  makeElite(s: Ship) {
    s.elite = true;
    s.maxHull = s.hull = s.maxHull * 2.2;
    s.maxShield = s.shield = s.maxShield * 1.8 + 20;
    s.dmgMult *= 1.3;
    s.xp *= 2.5;
    s.credits *= 2.5;
    s.lootChance = 0.6;
    s.name = 'Elite ' + s.name;
    s.tint = '#ffcf5a';
  }

  enemyWeapon(id: string, s: Ship): WeaponSlot {
    if (id === 'spit') {
      const ws = weaponStats({ uid: 0, slot: 'weapon', defId: 'pulse', rarity: 0, affixes: [] });
      ws.damage = 10 * s.dmgMult;
      ws.cooldown = 1.1;
      ws.speed = 420;
      ws.range = 520;
      ws.count = 3;
      ws.spread = 0.3;
      ws.tags.add('cryo');
      ws.def = { ...ws.def, color: '#9f6', size: 5, sfx: 'scatter', kind: 'bullet' };
      (ws as WeaponStats & { spit?: boolean }).spit = true;
      return { ws, cd: Math.random() * 2, shots: 0, group: 0 };
    }
    const ws = weaponStats({ uid: 0, slot: 'weapon', defId: id, rarity: 0, affixes: [] });
    const k = ws.def.kind;
    ws.damage *= s.dmgMult * (k === 'beam' ? 0.35 : k === 'rail' ? 0.55 : 0.65);
    ws.cooldown *= k === 'beam' ? 1 : ws.def.id === 'scatter' ? 1.8 : 1.9;
    ws.speed *= 0.75;
    if (k === 'bullet' && ws.count > 3) ws.count = 5;
    if (k === 'beam') ws.range *= 0.8;
    return { ws, cd: 0.5 + Math.random() * 1.5, shots: 0, group: 0 };
  }

  // -------------------------------------------------------------------------
  // Combat spawning (events)
  // -------------------------------------------------------------------------
  startCombat(spec: CombatSpec, hailedShip?: Ship | null) {
    const rng = this.rng;
    const f = factionById(this.run, spec.side) ;
    const special = !f ? (['warden', 'monster', 'rogue'].includes(spec.side) ? (spec.side as 'warden' | 'monster' | 'rogue') : 'rogue') : undefined;
    const gid = this.groupCounter++;
    const g: CombatGroup = { afterVictory: spec.afterVictory, members: new Set(), boss: !!spec.boss };
    this.groups.set(gid, g);
    let count = spec.count ?? clamp(2 + Math.floor(this.run.depth / 2) + rng.int(0, 1), 2, 6);
    // a hailed ship's group joins the fight first
    if (hailedShip && !hailedShip.dead && hailedShip.faction && f && hailedShip.faction.id === f.id) {
      for (const s of this.ships) {
        if (s.dead || s.patrolGroup !== hailedShip.patrolGroup || s.allied) continue;
        s.hostile = true;
        s.aggro = true;
        s.group = gid;
        g.members.add(s.id);
        count--;
      }
    }
    const p = this.player;
    if (spec.boss) {
      const a = rng.range(0, TAU);
      const b = this.makeBoss(spec.boss, p.x + Math.cos(a) * 900, p.y + Math.sin(a) * 900, spec.strength ?? 1, f);
      b.group = gid;
      g.members.add(b.id);
      this.ships.push(b);
      this.bossShip = b;
      audio.sfx('boss_roar');
      audio.setMood('boss');
      this.shake = Math.max(this.shake, 14);
      count = spec.count ?? 0;
    }
    const a0 = rng.range(0, TAU);
    for (let i = 0; i < count; i++) {
      const a = a0 + rng.range(-0.8, 0.8);
      const r = rng.range(700, 950);
      const s = this.makeEnemy({ faction: f, special, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, strength: spec.strength });
      s.hostile = true;
      s.aggro = true;
      s.group = gid;
      s.hailable = false;
      g.members.add(s.id);
      this.ships.push(s);
      this.warpInFx(s.x, s.y, s.radius);
    }
    if (spec.announce) this.hooks.toast(spec.announce, '#ff8a7a');
    if (g.members.size === 0) {
      this.groups.delete(gid);
      this.hooks.groupCleared(spec.afterVictory);
      this.hooks.combatWon(spec.afterVictory);
    } else if (!spec.boss) audio.setMood('combat');
  }

  makeBoss(id: BossId, x: number, y: number, strength: number, f: Faction | null): Ship {
    const sizes: Record<BossId, number> = { leviathan: 260, dreadnought: 230, warden_prime: 130, hive_queen: 240, choir_avatar: 170, mirror: hullDef(this.run.hullId).size * 1.4 };
    const size = sizes[id];
    const sprite = id === 'mirror' ? playerSprite(this.run.hullId) : cachedSprite('boss:' + id, () => makeBossSprite(id as Exclude<BossId, 'mirror'>, size, hashSeed('boss', id)));
    const s = this.blankShip(x, y, size * 0.42, id === 'warden_prime' ? 'warden' : f?.id ?? 'monster', f, sprite, 'boss');
    const lvl = this.enemyLevel();
    const hp = { leviathan: 2600, dreadnought: 2300, warden_prime: 1700, hive_queen: 2200, choir_avatar: 2800, mirror: 1500 }[id] * (1 + lvl * 0.12) * strength;
    s.name = { leviathan: 'The Leviathan', dreadnought: f ? `${f.short} Dreadnought` : 'Dreadnought', warden_prime: 'Warden Prime', hive_queen: f ? `Queen of ${f.name.replace(/^the /, 'the ')}` : 'The Hive Queen', choir_avatar: 'The Choir', mirror: this.run.shipName + '?' }[id];
    s.boss = id;
    s.maxHull = s.hull = hp;
    s.maxShield = s.shield = id === 'leviathan' || id === 'hive_queen' ? 0 : hp * 0.2;
    s.shieldRegen = s.maxShield * 0.03;
    s.maxSpeed = { leviathan: 120, dreadnought: 90, warden_prime: 300, hive_queen: 70, choir_avatar: 200, mirror: 330 }[id];
    s.thrust = s.maxSpeed * 1.6;
    s.turnRate = id === 'warden_prime' || id === 'mirror' ? 4 : 0.8;
    s.dmgMult = (0.8 + 0.1 * lvl) * Math.sqrt(strength);
    s.hostile = true;
    s.aggro = true;
    s.contactDmg = id === 'leviathan' ? 40 : 20;
    s.xp = 500;
    s.credits = 500;
    s.lootChance = 1;
    s.armor = 2;
    s.aim = 0.04;
    if (id === 'mirror') {
      s.tint = '#ff3a6a';
      for (const w of this.player.weapons) {
        const ws = { ...w.ws, tags: new Set(w.ws.tags) };
        ws.damage *= 0.55 * s.dmgMult;
        ws.cooldown *= 1.6;
        s.weapons.push({ ws, cd: 1, shots: 0, group: 0 });
      }
      if (s.weapons.length === 0) s.weapons.push(this.enemyWeapon('pulse', s));
    } else if (id === 'dreadnought') {
      s.weapons.push(this.enemyWeapon('flak', s), this.enemyWeapon('missile', s));
    } else if (id === 'warden_prime') {
      s.weapons.push(this.enemyWeapon('rail', s), this.enemyWeapon('pulse', s));
    }
    return s;
  }

  warpInFx(x: number, y: number, r: number) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TAU;
      const sp = 80 + Math.random() * 200;
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, 3 + r * 0.05, '#bde', true, 0.92);
    }
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(rawDt: number) {
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      this.timeScale = 0.35;
    } else this.timeScale = 1;
    const dt = Math.min(rawDt, 1 / 30) * this.timeScale;
    this.frameDt = dt;
    this.t += dt;
    this.arrivalT += dt;
    // delayed narrative follow-ups run on world time so they can't leak into another system
    for (const w of this.pendingWins) w.t -= dt;
    const due = this.pendingWins.filter((w) => w.t <= 0);
    if (due.length) {
      this.pendingWins = this.pendingWins.filter((w) => w.t > 0);
      for (const w of due) this.hooks.combatWon(w.ev);
    }
    this.shake = Math.max(0, this.shake - rawDt * 30);
    // orbits
    for (const p of this.pois) {
      if (p.orbit) {
        p.orbit.phase += p.orbit.speed * dt;
        p.x = Math.cos(p.orbit.phase) * p.orbit.r;
        p.y = Math.sin(p.orbit.phase) * p.orbit.r;
      }
      p.spin += dt * 0.05;
    }
    if (!this.playerDead) this.updatePlayerControl(dt);
    else {
      this.deathTimer -= rawDt;
      if (this.deathTimer <= 0 && this.deathTimer > -100) {
        this.deathTimer = -1000;
        this.hooks.death();
      }
    }
    for (const s of this.ships) if (!s.dead && !s.isPlayer) this.updateAI(s, dt);
    for (const s of this.ships) if (!s.dead) this.updateShip(s, dt);
    this.collideShips(dt);
    this.updateProjs(dt);
    this.updatePickups(dt);
    this.updateRocks(dt);
    this.updateHazards(dt);
    this.updateFx(dt);
    this.updateWardens(dt);
    this.updateJump(rawDt);
    // cleanup
    if (this.ships.some((s) => s.dead)) this.ships = this.ships.filter((s) => !s.dead);
    if (this.projs.some((p) => p.dead)) this.projs = this.projs.filter((p) => !p.dead);
    if (this.pickups.some((p) => p.dead)) this.pickups = this.pickups.filter((p) => !p.dead);
    if (this.rocks.some((r) => r.dead)) this.rocks = this.rocks.filter((r) => !r.dead);
    // drone respawn
    this.dronesRespawn -= dt;
    if (this.dronesRespawn <= 0) {
      this.dronesRespawn = 20;
      this.spawnDrones();
    }
    // discovery & interaction target
    const p = this.player;
    const sr = this.stats.scanRange * (this.node.hazard === 'nebula' ? 0.6 : 1);
    for (const poi of this.pois) if (!poi.discovered && (dist2(poi.x, poi.y, p.x, p.y) < sr * sr || this.run.relics.includes('starlit_compass'))) {
      poi.discovered = true;
      if (poi.kind !== 'planet') this.hooks.toast(`Sensors: ${poi.name}`, '#9cf');
    }
    this.nearest = null;
    let bd = 1e18;
    for (const poi of this.pois) {
      if (poi.used && poi.kind !== 'station') continue;
      const d = dist2(poi.x, poi.y, p.x, p.y);
      const rr = poi.r + 150;
      if (d < rr * rr && d < bd) {
        bd = d;
        this.nearest = { kind: 'poi', poi };
      }
    }
    if (!this.nearest) {
      for (const s of this.ships) {
        if (s.dead || !s.hailable || s.hailed || s.aggro || s.allied || !s.faction) continue;
        const d = dist2(s.x, s.y, p.x, p.y);
        if (d < 420 * 420 && d < bd) {
          bd = d;
          this.nearest = { kind: 'ship', ship: s };
        }
      }
    }
    // music mood
    if (!this.bossShip || this.bossShip.dead) {
      const engaged = this.ships.some((s) => s.hostile && s.aggro && !s.dead && dist2(s.x, s.y, p.x, p.y) < 1400 * 1400);
      this.hasHostilesNear = engaged;
      audio.setMood(engaged ? 'combat' : this.wardenWarned ? 'tense' : 'calm');
    }
  }

  private updatePlayerControl(dt: number) {
    const p = this.player;
    const st = this.stats;
    let ax = 0, ay = 0;
    if (key('w') || key('ArrowUp')) ay -= 1;
    if (key('s') || key('ArrowDown')) ay += 1;
    if (key('a') || key('ArrowLeft')) ax -= 1;
    if (key('d') || key('ArrowRight')) ax += 1;
    const len = Math.hypot(ax, ay);
    this.boosting = key('Shift') && p.energy > 2 && len > 0;
    let thrust = p.thrust * (p.slow > 0 ? 0.6 : 1);
    let maxSp = p.maxSpeed * (p.slow > 0 ? 0.6 : 1);
    if (this.boosting) {
      thrust *= 2.2 * st.boostMult;
      maxSp *= 1.55 + (st.boostMult - 1) * 0.5;
      p.energy -= 32 * dt;
      if (Math.random() < 0.6) {
        const a = p.angle + Math.PI + (Math.random() - 0.5) * 0.4;
        this.part(p.x - Math.cos(p.angle) * p.radius, p.y - Math.sin(p.angle) * p.radius, Math.cos(a) * 260 + p.vx, Math.sin(a) * 260 + p.vy, 0.35, 4, '#9cf', true, 0.9);
      }
    }
    if (len > 0) {
      p.vx += (ax / len) * thrust * dt;
      p.vy += (ay / len) * thrust * dt;
      p.thrusting = this.boosting ? 1 : 0.6;
    } else {
      // gentle space-brake so it feels controllable
      p.vx *= Math.pow(0.35, dt);
      p.vy *= Math.pow(0.35, dt);
      p.thrusting = 0;
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSp) {
      const k = Math.max(maxSp / sp, 1 - dt * 3);
      p.vx *= k;
      p.vy *= k;
    }
    audio.setThrust(p.thrusting * (this.boosting ? 1 : 0.5));
    // aim
    const aimA = Math.atan2(input.worldY - p.y, input.worldX - p.x);
    p.angle = turnToward(p.angle, aimA, p.turnRate * dt);
    // fire
    const fire0 = input.lmb && !input.blocked;
    const fire1 = input.rmb && !input.blocked;
    const overcharge = hasSkillFlag(this.run, 'overcharge') && p.shield <= 0.5;
    for (const w of p.weapons) {
      const want = w.group === 0 ? fire0 : fire1;
      const single = p.weapons.length === 1 && (fire0 || fire1);
      w.beamOn = false;
      if (!(want || single)) continue;
      if (w.ws.def.kind === 'beam') {
        // continuous: energy and damage scale with real frame time
        const cost = (w.ws.energy * dt) / w.ws.def.cooldown;
        if (p.energy < cost) continue;
        p.energy -= cost;
        this.fireWeapon(p, w, aimA);
        continue;
      }
      if (w.cd > 0) continue;
      if (p.energy < w.ws.energy) continue;
      p.energy -= w.ws.energy;
      let cd = w.ws.cooldown;
      if (p.overdrive > 0) cd *= 0.5;
      if (overcharge) cd /= 1.3;
      w.cd = cd;
      this.fireWeapon(p, w, aimA);
    }
    // ability
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    if (pressed(' ') && this.abilityCd <= 0) this.useAbility();
    // interact
    if (pressed('e') && this.nearest) {
      if (this.nearest.kind === 'poi') {
        const poi = this.nearest.poi;
        if (poi.kind === 'station') {
          if (poi.hostileStation || (poi.owner && isHostileRep(this.run.rep[poi.owner.id] ?? 0))) {
            this.hooks.toast('Docking clearance denied.', '#f88');
            audio.sfx('error');
          } else this.hooks.dock(poi);
        } else {
          audio.sfx('scan');
          this.hooks.poi(poi);
        }
      } else {
        audio.sfx('ui_open');
        this.hooks.hail(this.nearest.ship);
      }
    }
    // point defense
    if (st.pointDefense > 0) {
      this.pdTimer -= dt;
      if (this.pdTimer <= 0) {
        let best: Proj | null = null;
        let bd = 280 * 280;
        for (const pr of this.projs) {
          if (pr.fromPlayer || pr.kind !== 'missile') continue;
          const d = dist2(pr.x, pr.y, p.x, p.y);
          if (d < bd) {
            bd = d;
            best = pr;
          }
        }
        if (best) {
          best.dead = true;
          this.pdTimer = 1 / st.pointDefense;
          this.line(p.x, p.y, best.x, best.y, '#cff', 1.5, 0.12, false);
          this.explosion(best.x, best.y, 10, '#fc8');
        }
      }
    }
    // regen & stats sync
    if (st.hullRegen > 0 && p.hull < p.maxHull) p.hull = Math.min(p.maxHull, p.hull + st.hullRegen * dt);
    if (this.run.relics.includes('blood_battery') && p.hull < p.maxHull * 0.5) p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * 0.5 * dt);
    this.run.hull = p.hull;
  }

  useAbility() {
    const p = this.player;
    const h = hullDef(this.run.hullId);
    this.abilityCd = this.abilityMax;
    switch (h.ability) {
      case 'blink': {
        const a = Math.atan2(input.worldY - p.y, input.worldX - p.x);
        const d = Math.min(380, dist(p.x, p.y, input.worldX, input.worldY));
        this.warpInFx(p.x, p.y, 20);
        p.x += Math.cos(a) * d;
        p.y += Math.sin(a) * d;
        p.invuln = 0.3;
        this.warpInFx(p.x, p.y, 20);
        audio.sfx('blink');
        break;
      }
      case 'overdrive':
        p.overdrive = 5;
        audio.sfx('ability');
        break;
      case 'bastion':
        p.shield = p.maxShield;
        p.reflect = 2.5;
        p.shieldFlash = 1;
        audio.sfx('ability');
        break;
      case 'swarm':
        for (let i = 0; i < 5; i++) this.ships.push(this.makeDrone(10));
        audio.sfx('ability');
        break;
      case 'cloak':
        p.cloak = 5;
        for (const s of this.ships) if (s.target === p) s.target = null;
        audio.sfx('ability');
        break;
      case 'harpoon': {
        const a = p.angle;
        this.spawnProj(p, 'harpoon', p.x, p.y, a, 1300, 30 * this.stats.damageMult * (1 + this.run.depth * 0.15), 0.8, '#fd8', 5, new Set(['pull']), 0, 0);
        audio.sfx('missile');
        break;
      }
      case 'echo': {
        const e = this.makeEcho();
        this.ships.push(e);
        audio.sfx('blink');
        break;
      }
    }
  }

  makeEcho(): Ship {
    const p = this.player;
    const e = this.blankShip(p.x - Math.cos(p.angle) * 60, p.y - Math.sin(p.angle) * 60, p.radius, 'player', null, p.sprite, 'echo');
    e.allied = true;
    e.lifetime = 9;
    e.maxHull = e.hull = p.maxHull * 0.6;
    e.maxSpeed = p.maxSpeed;
    e.thrust = p.thrust * 1.2;
    e.turnRate = 6;
    e.owner = p;
    e.tint = '#40ffd0';
    e.weapons = p.weapons.map((w) => ({ ws: { ...w.ws, damage: w.ws.damage * 0.7, energy: 0 }, cd: 0.3, shots: 0, group: 0 }));
    this.warpInFx(e.x, e.y, 20);
    return e;
  }

  // -------------------------------------------------------------------------
  // Firing
  // -------------------------------------------------------------------------
  fireWeapon(s: Ship, w: WeaponSlot, aim: number) {
    const ws = w.ws;
    const fromPlayer = s.allied;
    const isPlayer = s.isPlayer;
    let critChance = 0, critMult = 2;
    if (fromPlayer) {
      critChance = this.stats.critChance + ws.critBonus;
      critMult = this.stats.critMult;
    }
    if (ws.def.kind === 'beam') {
      // continuous weapon: fired every frame, no shot counters (storm/comet)
      w.beamOn = true;
      if (isPlayer && s.cloak > 0) s.cloak = 0;
      this.fireBeam(s, ws, aim, critChance, critMult);
      return;
    }
    w.shots++;
    let forceCrit = false;
    if (isPlayer && s.cloak > 0) {
      forceCrit = true;
      s.cloak = 0;
    }
    const mx = s.x + Math.cos(s.angle) * s.radius * 0.8;
    const my = s.y + Math.sin(s.angle) * s.radius * 0.8;
    const vol = isPlayer ? 0.55 : 0.25;
    const pan = clamp((s.x - this.player.x) / 900, -1, 1);
    const k = ws.def.kind;
    audio.sfx(ws.def.sfx as Sfx, { vol: isPlayer ? vol : vol * this.falloff(s), pan, pitch: isPlayer ? 1 : 0.85 + Math.random() * 0.2 });
    const volleys = isPlayer && hasSkillFlag(this.run, 'storm') && w.shots % 10 === 0 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      if (k === 'rail') {
        this.fireRail(s, ws, aim, critChance, critMult, forceCrit);
        continue;
      }
      if (k === 'arc') {
        this.fireArc(s, ws, critChance, critMult);
        continue;
      }
      const n = ws.count;
      for (let i = 0; i < n; i++) {
        const off = n > 1 ? (i / (n - 1) - 0.5) * ws.spread : 0;
        const jitter = (Math.random() - 0.5) * (n > 1 ? ws.spread * 0.15 : ws.spread) + (isPlayer ? 0 : (Math.random() - 0.5) * s.aim);
        const a = aim + off + jitter;
        const kind: ProjKind = k === 'missile' ? 'missile' : k === 'mine' ? 'mine' : k === 'flak' ? 'flak' : k === 'wave' ? 'wave' : k === 'lance' ? 'lance' : (ws as WeaponStats & { spit?: boolean }).spit ? 'spit' : 'bullet';
        const speed = kind === 'mine' ? 40 : ws.speed * (kind === 'bullet' ? 0.95 + Math.random() * 0.1 : 1);
        const life = kind === 'mine' ? 18 : ws.range / Math.max(1, ws.speed);
        const pr = this.spawnProj(s, kind, mx, my, kind === 'mine' ? s.angle + Math.PI + off : a, speed, ws.damage, life, ws.def.color, ws.def.size, ws.tags, critChance, critMult);
        if (forceCrit) pr.crit = true;
        if (kind === 'missile') {
          pr.turn = 3.2;
          pr.hp = 1;
          const sa = s.angle + (i % 2 ? 1 : -1) * 0.9;
          pr.vx = Math.cos(sa) * speed * 0.6 + s.vx;
          pr.vy = Math.sin(sa) * speed * 0.6 + s.vy;
        }
      }
    }
    // twin comet relic
    if (isPlayer && this.run.relics.includes('twin_comet')) {
      this.cometCounter++;
      if (this.cometCounter >= 8) {
        this.cometCounter = 0;
        const pr = this.spawnProj(s, 'comet', mx, my, aim, 700, 40 * this.stats.damageMult * (1 + this.run.depth * 0.2), 2, '#fff6c0', 7, new Set(['seek']), critChance, critMult);
        pr.turn = 4;
      }
    }
  }

  falloff(s: Ship) {
    const d = dist(s.x, s.y, this.player.x, this.player.y);
    return clamp(1 - d / 1600, 0, 1);
  }

  spawnProj(s: Ship | null, kind: ProjKind, x: number, y: number, a: number, speed: number, dmg: number, life: number, color: string, size: number, tags: Set<string>, critChance: number, critMult: number): Proj {
    const fromPlayer = s ? s.allied : false;
    const p: Proj = {
      kind, x, y, vx: Math.cos(a) * speed + (s ? s.vx * 0.3 : 0), vy: Math.sin(a) * speed + (s ? s.vy * 0.3 : 0), life, maxLife: life, dmg, owner: s, fromPlayer, side: s?.side ?? 'none',
      color, size, tags, pierce: tags.has('pierce') ? 2 : 0, hit: new Set(), crit: false, critChance, critMult, turn: tags.has('seek') ? 1.6 : 0, hp: 0, armed: kind === 'mine' ? 0.6 : 0,
      bounces: tags.has('ricochet') ? 1 : 0, dead: false,
    };
    if (kind === 'wave') p.pierce = 999;
    this.projs.push(p);
    return p;
  }

  private canHit(src: Ship | null, fromPlayer: boolean, t: Ship): boolean {
    if (t.dead || t === src) return false;
    if (fromPlayer) return !t.allied;
    // enemy projectiles hit player & allies; also other factions that are hostile to them? keep simple
    if (t.allied) return true;
    return false;
  }

  private fireBeam(s: Ship, ws: WeaponStats, aim: number, cc: number, cm: number) {
    const fromPlayer = s.allied;
    const dt = this.frameDt * (s.overdrive > 0 ? 1.6 : 1);
    const x1 = s.x + Math.cos(s.angle) * s.radius * 0.8, y1 = s.y + Math.sin(s.angle) * s.radius * 0.8;
    const a = s.isPlayer ? aim : s.angle;
    const dx = Math.cos(a), dy = Math.sin(a);
    let best: Ship | null = null;
    let bt = ws.range;
    for (const t of this.ships) {
      if (!this.canHit(s, fromPlayer, t)) continue;
      const tx = t.x - x1, ty = t.y - y1;
      const along = tx * dx + ty * dy;
      if (along < 0 || along > bt) continue;
      const perp = Math.abs(tx * dy - ty * dx);
      if (perp < t.radius) {
        bt = along;
        best = t;
      }
    }
    for (const r of this.rocks) {
      const tx = r.x - x1, ty = r.y - y1;
      const along = tx * dx + ty * dy;
      if (along < 0 || along > bt) continue;
      if (Math.abs(tx * dy - ty * dx) < r.r) {
        bt = along;
        best = null;
        r.hp -= ws.damage * dt * 2;
        if (r.hp <= 0) this.breakRock(r);
      }
    }
    const x2 = x1 + dx * bt, y2 = y1 + dy * bt;
    this.beams.push({ x1, y1, x2, y2, color: ws.def.color, w: ws.def.size });
    if (best) {
      const crit = Math.random() < cc * dt * 4;
      this.damage(best, ws.damage * dt * (crit ? cm : 1), { src: s, fromPlayer, ion: ws.tags.has('ion'), tags: ws.tags, x: x2, y: y2, beam: true });
      if (Math.random() < 0.5) this.part(x2, y2, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0.25, 3, ws.def.color, true, 0.9);
    }
  }

  private fireRail(s: Ship, ws: WeaponStats, aim: number, cc: number, cm: number, forceCrit: boolean) {
    const fromPlayer = s.allied;
    const a = aim + (s.isPlayer ? 0 : (Math.random() - 0.5) * s.aim * 0.5);
    const x1 = s.x + Math.cos(a) * s.radius, y1 = s.y + Math.sin(a) * s.radius;
    const dx = Math.cos(a), dy = Math.sin(a);
    const x2 = x1 + dx * ws.range, y2 = y1 + dy * ws.range;
    for (const t of this.ships) {
      if (!this.canHit(s, fromPlayer, t)) continue;
      const tx = t.x - x1, ty = t.y - y1;
      const along = tx * dx + ty * dy;
      if (along < 0 || along > ws.range) continue;
      if (Math.abs(tx * dy - ty * dx) < t.radius + 6) {
        const crit = forceCrit || Math.random() < cc;
        this.damage(t, ws.damage * (crit ? cm : 1), { src: s, fromPlayer, ion: ws.tags.has('ion'), crit, tags: ws.tags, x: t.x, y: t.y });
      }
    }
    for (const r of this.rocks) {
      const tx = r.x - x1, ty = r.y - y1;
      const along = tx * dx + ty * dy;
      if (along > 0 && along < ws.range && Math.abs(tx * dy - ty * dx) < r.r) {
        r.hp -= ws.damage;
        if (r.hp <= 0) this.breakRock(r);
      }
    }
    this.line(x1, y1, x2, y2, ws.def.color, 3, 0.25, false);
    this.line(x1, y1, x2, y2, '#fff', 1, 0.15, false);
    if (s.isPlayer) this.shake = Math.max(this.shake, 3);
  }

  private fireArc(s: Ship, ws: WeaponStats, cc: number, cm: number) {
    const fromPlayer = s.allied;
    const hit = new Set<number>();
    let from = { x: s.x + Math.cos(s.angle) * s.radius, y: s.y + Math.sin(s.angle) * s.radius };
    let range = ws.range;
    let dmg = ws.damage;
    for (let jump = 0; jump < 4; jump++) {
      let best: Ship | null = null;
      let bd = range * range;
      for (const t of this.ships) {
        if (!this.canHit(s, fromPlayer, t) || hit.has(t.id)) continue;
        if (jump === 0) {
          const a = Math.atan2(t.y - s.y, t.x - s.x);
          if (Math.abs(angDiff(s.angle, a)) > 0.9) continue;
        }
        const d = dist2(from.x, from.y, t.x, t.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (!best) {
        if (jump === 0) {
          const a = s.angle + (Math.random() - 0.5) * 0.6;
          this.line(from.x, from.y, from.x + Math.cos(a) * range * 0.6, from.y + Math.sin(a) * range * 0.6, ws.def.color, 2, 0.1, true);
        }
        break;
      }
      hit.add(best.id);
      this.line(from.x, from.y, best.x, best.y, ws.def.color, 2.5, 0.14, true);
      const crit = Math.random() < cc;
      this.damage(best, dmg * (crit ? cm : 1), { src: s, fromPlayer, ion: ws.tags.has('ion'), crit, tags: ws.tags, x: best.x, y: best.y });
      from = { x: best.x, y: best.y };
      range = 230;
      dmg *= 0.75;
    }
  }

  // -------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------
  damage(t: Ship, amt: number, o: { src: Ship | null; fromPlayer: boolean; ion?: boolean; crit?: boolean; tags?: Set<string>; x?: number; y?: number; beam?: boolean; aoe?: boolean; hazard?: boolean; dot?: boolean }): number {
    if (t.dead || t.invuln > 0 || amt <= 0) return 0;
    const run = this.run;
    if (t.isPlayer && !o.beam && !o.aoe && this.stats.dodge > 0 && Math.random() < this.stats.dodge) {
      this.text(t.x, t.y - t.radius, 'miss', '#9cf', 13);
      return 0;
    }
    if (o.fromPlayer && hasSkillFlag(run, 'exec') && t.hull < t.maxHull * 0.3) amt *= 1.5;
    if (o.fromPlayer && t.slow > 0 && o.tags?.has('cryo')) amt *= 1.1;
    let remaining = amt;
    const shieldMult = (o.ion ? 2 : 1) * (o.fromPlayer ? this.stats.shieldDmgMult : 1);
    const hadShield = t.shield > 0.5;
    if (t.shield > 0) {
      const sd = remaining * shieldMult;
      const absorbed = Math.min(t.shield, sd);
      t.shield -= absorbed;
      remaining -= absorbed / shieldMult;
      t.shieldFlash = 1;
    }
    let hullDmg = 0;
    if (remaining > 0.01) {
      hullDmg = o.beam ? Math.max(remaining * 0.3, remaining - t.armor * (1 / 60) * 4) : Math.max(1, remaining - t.armor);
      t.hull -= hullDmg;
      t.flash = 0.12;
    }
    t.shieldTimer = t.shieldDelay;
    const total = amt;
    if (!t.allied && o.fromPlayer) {
      t.lastHitByPlayer = true;
      if (!t.hostile || !t.aggro) this.provoke(t);
    }
    if (o.tags && o.fromPlayer !== undefined) {
      if (o.tags.has('burn')) {
        t.burn = 3;
        t.burnFromPlayer = o.fromPlayer;
        t.burnDps = Math.max(t.burnDps, amt * (o.beam ? 2 : 0.3));
      }
      if (o.tags.has('cryo')) t.slow = 2;
      if (o.tags.has('vamp') && o.src?.isPlayer) this.player.hull = Math.min(this.player.maxHull, this.player.hull + total * 0.08);
    }
    if (o.fromPlayer && this.stats.lifesteal > 0) this.player.hull = Math.min(this.player.maxHull, this.player.hull + total * this.stats.lifesteal);
    // feedback
    if (meta.settings.damageNumbers && !o.beam) {
      const col = t.isPlayer || t.allied ? '#ff6a6a' : o.crit ? '#ffd24a' : hullDmg > 0 ? '#fff' : '#8cf';
      this.text(t.x + (Math.random() - 0.5) * 20, t.y - t.radius, `${Math.round(total)}${o.crit ? '!' : ''}`, col, o.crit ? 17 : 12);
    }
    if (!o.beam) {
      const pan = clamp((t.x - this.player.x) / 900, -1, 1);
      if (t.isPlayer) {
        audio.sfx(hadShield && hullDmg === 0 ? 'hit_shield' : 'hit_player', { vol: 0.6 });
        this.shake = Math.max(this.shake, hullDmg > 0 ? 6 : 3);
      } else audio.sfx(hadShield && hullDmg === 0 ? 'hit_shield' : 'hit', { vol: 0.25 * this.falloff(t) + 0.05, pan });
    }
    // shield break
    if (hadShield && t.shield <= 0.5) {
      if (t.isPlayer) {
        audio.sfx('shield_break');
        if (run.relics.includes('mourning_bell') || hasSkillFlag(run, 'overload')) this.shockwave(t.x, t.y, 280, 30 + run.depth * 10 + t.maxShield * 0.5, true);
      }
    }
    // player-specific saves
    if (t.isPlayer) {
      if (!this.shuntUsed && hasSkillFlag(run, 'shunt') && t.hull < t.maxHull * 0.25 && t.hull > 0) {
        this.shuntUsed = true;
        t.shield = t.maxShield;
        t.shieldFlash = 1;
        this.hooks.toast('Emergency shunt!', '#8cf');
      }
      if (!this.frozenUsed && run.relics.includes('frozen_second') && t.hull < t.maxHull * 0.3 && t.hull > 0) {
        this.frozenUsed = true;
        this.slowmo = 3;
        this.hooks.toast('Time thickens…', '#cdf');
      }
      if (t.hull <= 0 && !this.saintUsed && run.relics.includes('saints_tooth')) {
        this.saintUsed = true;
        t.hull = 1;
        t.invuln = 1.5;
        this.hooks.toast("The Saint's Tooth refuses your death.", '#ffd');
      }
    }
    if (t.hull <= 0) this.kill(t, o.src, o);
    return total;
  }

  /** a non-hostile ship (or its group) turns on the player */
  provoke(t: Ship) {
    const wasHostile = t.hostile;
    t.hostile = true;
    t.provoked = true;
    t.aggro = true;
    t.hailable = false;
    t.fleeing = t.role === 'trader';
    if (!wasHostile && t.faction) {
      this.run.rep[t.faction.id] = clamp((this.run.rep[t.faction.id] ?? 0) - 12, -100, 100);
      this.hooks.toast(`${t.faction.short} ships turn on you.`, '#f88');
      for (const s of this.ships) {
        if (s.dead || s.allied || s === t || s.faction?.id !== t.faction.id) continue;
        if (dist2(s.x, s.y, t.x, t.y) < 1500 * 1500) {
          s.hostile = true;
          s.provoked = true;
          s.aggro = true;
          s.hailable = false;
          if (s.role === 'trader') s.fleeing = true;
        }
      }
    }
  }

  shockwave(x: number, y: number, r: number, dmg: number, fromPlayer: boolean) {
    for (const s of this.ships) {
      if (s.dead) continue;
      if (fromPlayer ? s.allied : !s.allied) continue;
      const d = dist(x, y, s.x, s.y);
      if (d < r + s.radius) {
        this.damage(s, dmg * (1 - (d / (r + s.radius)) * 0.5), { src: fromPlayer ? this.player : null, fromPlayer, aoe: true });
        const a = Math.atan2(s.y - y, s.x - x);
        s.vx += Math.cos(a) * 300;
        s.vy += Math.sin(a) * 300;
      }
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      this.part(x, y, Math.cos(a) * r * 2, Math.sin(a) * r * 2, 0.4, 4, fromPlayer ? '#9df' : '#f96', true, 0.9);
    }
    this.shake = Math.max(this.shake, 8);
    audio.sfx('explode_small', { vol: 0.6 });
  }

  kill(t: Ship, _src: Ship | null, o: { fromPlayer: boolean; tags?: Set<string> }) {
    if (t.dead) return;
    if (t.isPlayer) {
      t.dead = false;
      t.hull = 0;
      if (!this.playerDead) {
        this.playerDead = true;
        this.deathTimer = 2.2;
        this.explosion(t.x, t.y, 60, '#fc6');
        this.explosion(t.x, t.y, 30, '#fff');
        this.shake = 25;
        audio.sfx('explode_big');
        audio.setMood('death');
        this.jump = null;
      }
      return;
    }
    t.dead = true;
    const big = t.radius > 30 || t.boss;
    this.explosion(t.x, t.y, t.radius * (t.boss ? 3 : 1.4), t.boss ? '#fff' : '#fb6');
    audio.sfx(big ? 'explode_big' : 'explode_small', { vol: 0.3 + this.falloff(t) * 0.5, pan: clamp((t.x - this.player.x) / 900, -1, 1) });
    if (big) this.shake = Math.max(this.shake, t.boss ? 30 : 6);
    // group bookkeeping
    if (t.group) {
      const g = this.groups.get(t.group);
      if (g) {
        g.members.delete(t.id);
        this.checkGroup(t.group);
      }
    }
    if (t.allied) return;
    const byPlayer = o.fromPlayer || t.lastHitByPlayer;
    if (!byPlayer) return;
    const run = this.run;
    run.stats.kills++;
    this.killsHere++;
    meta.life.kills++;
    this.hooks.playerKill(t);
    // rep
    if (t.faction) {
      run.rep[t.faction.id] = clamp((run.rep[t.faction.id] ?? 0) - (t.role === 'trader' ? 10 : 4), -100, 100);
      if (t.faction.archetype === 'raider') for (const f of run.factions) if (f.archetype === 'mercantile') run.rep[f.id] = clamp(run.rep[f.id] + 2, -100, 100);
    }
    // xp
    this.hooks.xp(t.xp);
    // volatile
    if (o.tags?.has('volatile')) this.shockwave(t.x, t.y, 120, 25 + run.depth * 6, true);
    if (run.relics.includes('hungry_coil')) this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 18);
    if (run.relics.includes('fractal_seed') && Math.random() < 0.35) {
      for (let i = 0; i < 8; i++) this.spawnProj(this.player, 'shrapnel', t.x, t.y, (i / 8) * TAU, 600, 12 + run.depth * 3, 0.5, '#cfa', 2.5, new Set(), 0, 2);
    }
    // drops
    const credits = t.credits * (0.7 + Math.random() * 0.6);
    const n = Math.min(8, Math.max(1, Math.round(credits / 10)));
    for (let i = 0; i < n; i++) this.drop(t.x, t.y, 'credits', credits / n);
    if (Math.random() < 0.1) this.drop(t.x, t.y, 'repair', 12 + run.depth * 3);
    if (Math.random() < 0.08) this.drop(t.x, t.y, 'energy', 40);
    if (Math.random() < (t.boss ? 0 : 0.03)) this.drop(t.x, t.y, 'fuel', 1);
    if (Math.random() < t.lootChance) {
      const rng = new RNG((Math.random() * 1e9) >>> 0);
      const m = rollModule(rng, { rarity: lootRarity(run, rng, t.boss ? 3 : t.elite ? 1 : 0), unlocked: unlockedSet() });
      this.drop(t.x, t.y, 'module', 0, m);
      if (t.boss) {
        const m2 = rollModule(rng, { rarity: lootRarity(run, rng, 2), unlocked: unlockedSet() });
        this.drop(t.x, t.y, 'module', 0, m2);
      }
    }
    if (t.boss) {
      run.stats.bosses++;
      meta.life.bosses++;
      this.bossShip = null;
      this.slowmo = 1.2;
      this.hooks.bossKilled(t.boss);
      // kill remaining minions
      for (const s of this.ships) if (!s.allied && s.group === t.group && !s.dead && s !== t) s.lifetime = 0.5 + Math.random();
    }
  }

  checkGroup(gid: number) {
    const g = this.groups.get(gid);
    if (!g) return;
    for (const id of g.members) {
      const s = this.ships.find((x) => x.id === id);
      if (!s || s.dead) g.members.delete(id);
    }
    if (g.members.size === 0) {
      this.groups.delete(gid);
      this.hooks.groupCleared(g.afterVictory);
      this.pendingWins.push({ t: 0.9, ev: g.afterVictory });
    }
  }

  drop(x: number, y: number, kind: Pickup['kind'], value: number, module?: ModuleInst) {
    const a = Math.random() * TAU;
    const sp = 60 + Math.random() * 140;
    this.pickups.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, value, module, life: kind === 'module' ? 90 : 30, dead: false });
  }

  // -------------------------------------------------------------------------
  // AI
  // -------------------------------------------------------------------------
  private updateAI(s: Ship, dt: number) {
    const p = this.player;
    s.aiT -= dt;
    if (s.lifetime > 0) {
      s.lifetime -= dt;
      if (s.lifetime <= 0) {
        if (s.allied) {
          s.dead = true;
          this.warpInFx(s.x, s.y, 8);
        } else this.kill(s, null, { fromPlayer: false });
        return;
      }
    }
    if (s.boss) return this.updateBoss(s, dt);
    if (s.role === 'turret') {
      s.vx = s.vy = 0;
    }
    // allied: drones & echoes
    if (s.allied) {
      const owner = s.owner ?? p;
      let tgt: Ship | null = null;
      let bd = (s.role === 'echo' ? 900 : 650) ** 2;
      for (const e of this.ships) {
        if (e.dead || e.allied || !e.hostile || !e.aggro) continue;
        const d = dist2(e.x, e.y, s.x, s.y);
        if (d < bd) {
          bd = d;
          tgt = e;
        }
      }
      s.target = tgt;
      const t = this.t * (s.role === 'echo' ? 0.8 : 1.4) * s.orbitDir + s.id;
      const orbitR = s.role === 'echo' ? 120 : 80 + (s.id % 3) * 20;
      let gx = owner.x + Math.cos(t) * orbitR, gy = owner.y + Math.sin(t) * orbitR;
      if (tgt && s.role === 'echo') {
        const a = Math.atan2(s.y - tgt.y, s.x - tgt.x) + 0.6 * s.orbitDir;
        gx = tgt.x + Math.cos(a) * 260;
        gy = tgt.y + Math.sin(a) * 260;
      }
      this.steer(s, gx, gy, dt, 1);
      if (tgt) this.aimAndFire(s, tgt, dt);
      else s.angle = turnToward(s.angle, Math.atan2(s.vy, s.vx), s.turnRate * dt);
      return;
    }
    // detection
    const detect = 900 * (this.run.relics.includes('quiet_engine') ? 0.6 : 1) * (this.node.hazard === 'nebula' ? 0.6 : 1);
    const visible = p.cloak <= 0 && !this.playerDead;
    if (s.hostile && !s.aggro && visible && dist2(s.x, s.y, p.x, p.y) < detect * detect) {
      s.aggro = true;
      // alert patrol mates
      for (const o of this.ships) if (o.patrolGroup === s.patrolGroup && o.hostile) o.aggro = true;
    }
    if (s.hostile && s.aggro && !s.fleeing) {
      // pick target: player or nearest ally
      if (s.aiT <= 0) {
        s.aiT = 0.5 + Math.random() * 0.5;
        let tgt: Ship | null = visible ? p : null;
        let bd = tgt ? dist2(s.x, s.y, p.x, p.y) : 1e12;
        for (const a of this.ships) {
          if (a.dead || !a.allied || a.isPlayer) continue;
          const d = dist2(s.x, s.y, a.x, a.y) * 1.8;
          if (d < bd) {
            bd = d;
            tgt = a;
          }
        }
        s.target = tgt;
        if (bd > 2600 * 2600) s.aggro = false; // lost
      }
      const tgt = s.target;
      if (!tgt || tgt.dead) {
        this.wander(s, dt);
        return;
      }
      this.combatMove(s, tgt, dt);
      return;
    }
    if (s.fleeing) {
      const a = Math.atan2(s.y - p.y, s.x - p.x);
      this.steer(s, s.x + Math.cos(a) * 500, s.y + Math.sin(a) * 500, dt, 1);
      s.angle = turnToward(s.angle, Math.atan2(s.vy, s.vx), s.turnRate * dt);
      if (dist2(s.x, s.y, p.x, p.y) > 2500 * 2500) {
        s.dead = true; // escaped
        if (s.group) this.checkGroup(s.group);
      }
      return;
    }
    this.wander(s, dt);
  }

  private wander(s: Ship, dt: number) {
    if (s.role === 'turret') return;
    if (dist2(s.x, s.y, s.wanderX, s.wanderY) < 200 * 200 || s.aiT < -12) {
      s.aiT = 0;
      const poi = this.pois.length && Math.random() < 0.6 ? this.pois[Math.floor(Math.random() * this.pois.length)] : null;
      if (poi) {
        s.wanderX = poi.x + (Math.random() - 0.5) * 500;
        s.wanderY = poi.y + (Math.random() - 0.5) * 500;
      } else {
        const a = Math.random() * TAU, r = Math.random() * (this.bounds - 600);
        s.wanderX = Math.cos(a) * r;
        s.wanderY = Math.sin(a) * r;
      }
    }
    this.steer(s, s.wanderX, s.wanderY, dt, 0.45);
    s.angle = turnToward(s.angle, Math.atan2(s.vy, s.vx), s.turnRate * dt);
  }

  private combatMove(s: Ship, t: Ship, dt: number) {
    const d = dist(s.x, s.y, t.x, t.y);
    const toT = Math.atan2(t.y - s.y, t.x - s.x);
    let gx = t.x, gy = t.y;
    const orbit = (r: number, swing = 0.5) => {
      const a = toT + Math.PI + s.orbitDir * swing;
      gx = t.x + Math.cos(a) * r;
      gy = t.y + Math.sin(a) * r;
    };
    switch (s.role) {
      case 'fighter':
        orbit(300, 0.7);
        break;
      case 'sniper':
        orbit(650, 0.35);
        break;
      case 'brute':
        orbit(180, 0.3);
        break;
      case 'carrier':
        orbit(700, 0.2);
        if (s.aiT <= 0.05 && Math.random() < dt * 0.4) {
          const n = this.ships.filter((x) => x.owner === s && !x.dead).length;
          if (n < 4) {
            const dr = this.makeEnemy({ faction: s.faction, special: s.side === 'monster' ? 'monster' : undefined, role: s.faction?.archetype === 'hive' ? 'swarm' : 'drone', x: s.x, y: s.y });
            dr.hostile = dr.aggro = true;
            dr.owner = s;
            dr.group = s.group;
            dr.xp *= 0.3;
            dr.credits *= 0.2;
            if (s.group) this.groups.get(s.group)?.members.add(dr.id);
            this.ships.push(dr);
          }
        }
        break;
      case 'swarm':
      case 'kamikaze':
      case 'drone': {
        // dive through the target then loop back
        const lead = 0.25;
        gx = t.x + t.vx * lead;
        gy = t.y + t.vy * lead;
        if (s.role === 'drone') orbit(160, 1.2);
        break;
      }
      case 'trader':
        s.fleeing = true;
        break;
      case 'turret':
        gx = s.x;
        gy = s.y;
        break;
    }
    if (s.role !== 'turret') this.steer(s, gx, gy, dt, 1);
    if (s.weapons.length) this.aimAndFire(s, t, dt, d);
    else s.angle = turnToward(s.angle, Math.atan2(s.vy, s.vx), s.turnRate * dt);
  }

  private aimAndFire(s: Ship, t: Ship, dt: number, d = dist(s.x, s.y, t.x, t.y)) {
    const w0 = s.weapons[0];
    const speed = w0?.ws.speed || 900;
    const aim = w0 && (w0.ws.def.kind === 'bullet' || w0.ws.def.kind === 'flak') ? leadAngle(s.x, s.y, t.x, t.y, t.vx, t.vy, speed, s.vx * 0.3, s.vy * 0.3) : Math.atan2(t.y - s.y, t.x - s.x);
    s.angle = turnToward(s.angle, aim, s.turnRate * dt);
    for (const w of s.weapons) {
      if (w.cd > 0) continue;
      if (d > w.ws.range * 0.95) continue;
      if (Math.abs(angDiff(s.angle, aim)) > (w.ws.def.kind === 'missile' ? 1 : 0.25)) continue;
      if (s.allied && s.energy < w.ws.energy && s.role !== 'drone' && s.role !== 'echo') continue;
      w.cd = w.ws.cooldown * (s.slow > 0 ? 1.4 : 1);
      if (w.ws.def.kind === 'beam') {
        w.cd = 0;
        // enemy beams fire in bursts
        s.bossT.beam = (s.bossT.beam ?? 0) + dt;
        if (s.bossT.beam % 3 > 1.6) continue;
      }
      this.fireWeapon(s, w, s.angle);
    }
  }

  private steer(s: Ship, gx: number, gy: number, dt: number, throttle: number) {
    const dx = gx - s.x, dy = gy - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxSp = s.maxSpeed * throttle * (s.slow > 0 ? 0.55 : 1);
    const want = Math.min(maxSp, d * 1.5);
    const dvx = (dx / d) * want - s.vx, dvy = (dy / d) * want - s.vy;
    const dl = Math.hypot(dvx, dvy) || 1;
    const acc = Math.min(s.thrust * dt, dl);
    s.vx += (dvx / dl) * acc;
    s.vy += (dvy / dl) * acc;
    s.thrusting = clamp(dl / 200, 0, 1) * throttle;
    // avoid star
    if (this.star) {
      const sd = dist(s.x, s.y, this.star.x, this.star.y);
      if (sd < this.star.r * 2.2) {
        s.vx += ((s.x - this.star.x) / sd) * 600 * dt;
        s.vy += ((s.y - this.star.y) / sd) * 600 * dt;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bosses
  // -------------------------------------------------------------------------
  private updateBoss(s: Ship, dt: number) {
    const p = this.player;
    const T = s.bossT;
    const tick = (k: string, every: number) => {
      T[k] = (T[k] ?? every * Math.random()) - dt;
      if (T[k] <= 0) {
        T[k] = every * (s.phase >= 1 ? 0.75 : 1) * (s.phase >= 2 ? 0.8 : 1);
        return true;
      }
      return false;
    };
    const frac = s.hull / s.maxHull;
    const newPhase = frac < 0.33 ? 2 : frac < 0.66 ? 1 : 0;
    if (newPhase > s.phase) {
      s.phase = newPhase;
      this.shake = 16;
      audio.sfx('boss_roar');
      this.shockwave(s.x, s.y, 300, 20, false);
    }
    const d = dist(s.x, s.y, p.x, p.y);
    const toP = Math.atan2(p.y - s.y, p.x - s.x);
    const dmg = (base: number) => base * s.dmgMult;
    const radial = (n: number, speed: number, dm: number, color: string, off = 0, kind: ProjKind = 'bullet', size = 6) => {
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        this.spawnProj(s, kind, s.x + Math.cos(a) * s.radius * 0.7, s.y + Math.sin(a) * s.radius * 0.7, a, speed, dmg(dm), 3.5, color, size, new Set(), 0, 2);
      }
      audio.sfx('flak', { vol: 0.4 });
    };
    const aimed = (n: number, spread: number, speed: number, dm: number, color: string) => {
      for (let i = 0; i < n; i++) {
        const a = toP + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
        this.spawnProj(s, 'bullet', s.x + Math.cos(a) * s.radius * 0.8, s.y + Math.sin(a) * s.radius * 0.8, a, speed, dmg(dm), 2.5, color, 5, new Set(), 0, 2);
      }
      audio.sfx('laser_heavy', { vol: 0.4 });
    };
    const spawn = (role: Role, n: number, special?: 'monster' | 'warden') => {
      const cur = this.ships.filter((x) => x.owner === s && !x.dead).length;
      for (let i = 0; i < Math.min(n, 10 - cur); i++) {
        const a = Math.random() * TAU;
        const e = this.makeEnemy({ faction: special ? null : s.faction, special, role, x: s.x + Math.cos(a) * s.radius, y: s.y + Math.sin(a) * s.radius });
        e.hostile = e.aggro = true;
        e.owner = s;
        e.group = s.group;
        e.xp *= 0.3;
        e.credits *= 0.3;
        e.lootChance = 0;
        this.groups.get(s.group)?.members.add(e.id);
        this.ships.push(e);
      }
    };
    switch (s.boss) {
      case 'leviathan': {
        this.steer(s, p.x, p.y, dt, d > 500 ? 1 : 0.4);
        s.angle = turnToward(s.angle, toP, s.turnRate * dt);
        if (tick('brood', 7)) spawn('swarm', 3 + s.phase, 'monster');
        if (tick('spit', 3)) aimed(5 + s.phase * 2, 0.8, 380, 12, '#9f6');
        if (s.phase >= 1 && tick('ring', 6)) radial(18 + s.phase * 6, 260, 10, '#cf8', this.t);
        if (s.phase >= 2 && tick('lunge', 5)) {
          s.vx += Math.cos(toP) * 700;
          s.vy += Math.sin(toP) * 700;
        }
        break;
      }
      case 'dreadnought': {
        const a = toP + Math.PI + 0.4;
        this.steer(s, p.x + Math.cos(a) * 550, p.y + Math.sin(a) * 550, dt, 0.8);
        s.angle = turnToward(s.angle, toP, s.turnRate * dt);
        if (tick('turrets', 1.4)) aimed(3, 0.25, 520, 11, '#fd8');
        for (const w of s.weapons) if (w.cd <= 0 && d < 900) {
          w.cd = w.ws.cooldown;
          this.fireWeapon(s, w, toP);
        }
        // sweeping beam
        T.sweep = (T.sweep ?? 6) - dt;
        if (T.sweep < 0) {
          const sweepA = (T.sweepA ?? toP - 1) + dt * 0.7;
          T.sweepA = sweepA;
          const bw = { ...s.weapons[0].ws, damage: dmg(55), range: 1100, def: { ...s.weapons[0].ws.def, color: '#f55', size: 7 } };
          s.angle = sweepA;
          this.fireBeam(s, bw as WeaponStats, sweepA, 0, 2);
          if (T.sweep < -2.6) {
            T.sweep = 7 - s.phase;
            T.sweepA = toP - 1.2;
          }
        } else T.sweepA = toP - 1.2;
        if (s.phase >= 1 && tick('wing', 10)) spawn('fighter', 2 + s.phase);
        break;
      }
      case 'warden_prime': {
        const a = toP + Math.PI + s.orbitDir * 0.9;
        this.steer(s, p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420, dt, 1);
        s.angle = turnToward(s.angle, toP, s.turnRate * dt);
        for (const w of s.weapons) if (w.cd <= 0 && d < w.ws.range) {
          w.cd = w.ws.cooldown * 0.8;
          this.fireWeapon(s, w, toP);
        }
        if (tick('blink', 5)) {
          this.warpInFx(s.x, s.y, 30);
          const ba = Math.random() * TAU;
          s.x = p.x + Math.cos(ba) * 450;
          s.y = p.y + Math.sin(ba) * 450;
          this.warpInFx(s.x, s.y, 30);
          s.orbitDir *= -1;
          audio.sfx('blink', { vol: 0.6 });
          if (s.phase >= 1) radial(12 + s.phase * 4, 300, 10, '#eef', Math.random());
        }
        if (tick('call', 12)) spawn('fighter', 1 + s.phase, 'warden');
        break;
      }
      case 'hive_queen': {
        this.steer(s, p.x, p.y, dt, d > 700 ? 0.6 : 0);
        s.angle = turnToward(s.angle, toP, s.turnRate * dt);
        if (tick('brood', 3.5)) spawn('swarm', 2 + s.phase, s.faction ? undefined : 'monster');
        if (tick('acid', 2.2)) aimed(7, 1.2, 330, 10, '#bf4');
        if (s.phase >= 1 && tick('bloom', 7)) radial(24, 200, 9, '#ef8', this.t, 'spit' as ProjKind, 7);
        break;
      }
      case 'choir_avatar': {
        const a = this.t * 0.4;
        this.steer(s, p.x + Math.cos(a) * 500, p.y + Math.sin(a) * 500, dt, 0.7);
        s.angle += dt * 0.5;
        if (tick('spiral', 0.12)) {
          T.spin = (T.spin ?? 0) + 0.37;
          const arms = 3 + s.phase;
          for (let i = 0; i < arms; i++) {
            const aa = T.spin + (i / arms) * TAU;
            this.spawnProj(s, 'bullet', s.x, s.y, aa, 220 + s.phase * 40, dmg(8), 4, '#e8d8ff', 5, new Set(), 0, 2);
          }
        }
        if (tick('wave', 5)) {
          for (let i = 0; i < 3; i++) this.spawnProj(s, 'wave', s.x, s.y, toP + (i - 1) * 0.5, 260, dmg(18), 3, '#fff', 16, new Set(), 0, 2);
          audio.sfx('laser_heavy', { vol: 0.5 });
        }
        if (s.phase >= 1 && tick('echoes', 11)) {
          for (let i = 0; i < 1 + s.phase; i++) {
            const m = this.makeBoss('mirror', s.x + (Math.random() - 0.5) * 300, s.y + (Math.random() - 0.5) * 300, 0.18, null);
            m.boss = null;
            m.role = 'fighter';
            m.owner = s;
            m.group = s.group;
            m.xp = 20;
            m.credits = 10;
            m.lootChance = 0;
            m.tint = '#c8b8ff';
            m.name = 'Echo';
            this.groups.get(s.group)?.members.add(m.id);
            this.ships.push(m);
          }
        }
        if (s.phase >= 2 && tick('blink', 6)) {
          const ba = Math.random() * TAU;
          s.x = p.x + Math.cos(ba) * 520;
          s.y = p.y + Math.sin(ba) * 520;
          this.warpInFx(s.x, s.y, 50);
        }
        break;
      }
      case 'mirror': {
        const a = toP + Math.PI + s.orbitDir * 0.8;
        this.steer(s, p.x + Math.cos(a) * 340, p.y + Math.sin(a) * 340, dt, 1);
        const aim = leadAngle(s.x, s.y, p.x, p.y, p.vx, p.vy, s.weapons[0]?.ws.speed || 900);
        s.angle = turnToward(s.angle, aim, s.turnRate * dt);
        for (const w of s.weapons) if (w.cd <= 0 && d < w.ws.range && Math.abs(angDiff(s.angle, aim)) < 0.3) {
          w.cd = w.ws.cooldown;
          this.fireWeapon(s, w, s.angle);
        }
        if (tick('blink', 4)) {
          this.warpInFx(s.x, s.y, 20);
          const ba = toP + Math.PI + (Math.random() - 0.5) * 2;
          s.x = p.x + Math.cos(ba) * 380;
          s.y = p.y + Math.sin(ba) * 380;
          s.orbitDir *= -1;
          this.warpInFx(s.x, s.y, 20);
          audio.sfx('blink', { vol: 0.5 });
        }
        if (s.phase >= 1 && tick('mirrorshot', 3)) aimed(5, 0.6, 600, 10, '#f6a');
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Physics
  // -------------------------------------------------------------------------
  private updateShip(s: Ship, dt: number) {
    for (const w of s.weapons) w.cd = Math.max(0, w.cd - dt);
    if (!s.isPlayer && s.role !== 'boss') {
      const sp = Math.hypot(s.vx, s.vy);
      const max = s.maxSpeed * 1.3;
      if (sp > max) {
        s.vx *= max / sp;
        s.vy *= max / sp;
      }
    }
    if (s.boss) {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > s.maxSpeed * 3) {
        s.vx *= 0.97;
        s.vy *= 0.97;
      }
    }
    // gravity wells
    for (const g of this.gravityWells) {
      const d = dist(s.x, s.y, g.x, g.y);
      if (d < g.r && d > 10) {
        const f = g.str * (1 - d / g.r) * dt;
        s.vx += ((g.x - s.x) / d) * f;
        s.vy += ((g.y - s.y) / d) * f;
      }
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // bounds
    const r = Math.hypot(s.x, s.y);
    if (r > this.bounds) {
      s.vx -= (s.x / r) * 500 * dt;
      s.vy -= (s.y / r) * 500 * dt;
    }
    // star heat
    if (this.star) {
      const d = dist(s.x, s.y, this.star.x, this.star.y);
      if (d < this.star.r * 1.5 && s.isPlayer) {
        this.damage(s, 25 * dt, { src: null, fromPlayer: false, beam: true });
        if (Math.random() < 0.1) this.hooks.toast('Hull overheating!', '#fa6');
      }
    }
    // regen
    if (s.shieldTimer > 0) s.shieldTimer -= dt;
    else if (s.shield < s.maxShield) {
      const rad = s.isPlayer && this.node.hazard === 'radiation' ? 0.5 : 1;
      s.shield = Math.min(s.maxShield, s.shield + s.shieldRegen * rad * dt);
    }
    if (s.energy < s.maxEnergy) s.energy = Math.min(s.maxEnergy, s.energy + s.energyRegen * dt * (s.isPlayer && this.boosting ? 0 : 1));
    // status
    if (s.burn > 0) {
      s.burn -= dt;
      // route through the damage pipeline so armor, relics and death-saves apply
      this.damage(s, s.burnDps * dt, { src: s.burnFromPlayer ? this.player : null, fromPlayer: s.burnFromPlayer, beam: true, dot: true });
      if (Math.random() < 0.3) this.part(s.x + (Math.random() - 0.5) * s.radius, s.y + (Math.random() - 0.5) * s.radius, 0, -20, 0.5, 4, '#f84', true, 0.95);
    }
    if (s.slow > 0) s.slow -= dt;
    if (s.cloak > 0) s.cloak -= dt;
    if (s.invuln > 0) s.invuln -= dt;
    if (s.reflect > 0) s.reflect -= dt;
    if (s.overdrive > 0) s.overdrive -= dt;
    if (s.flash > 0) s.flash -= dt;
    if (s.shieldFlash > 0) s.shieldFlash -= dt * 3;
    if (s.contactCd > 0) s.contactCd -= dt;
    // engine particles
    if (s.thrusting > 0.1 && Math.random() < 0.5 + s.thrusting * 0.5 && s.radius < 80) {
      const a = s.angle + Math.PI + (Math.random() - 0.5) * 0.5;
      const ex = s.x - Math.cos(s.angle) * s.radius * 0.9, ey = s.y - Math.sin(s.angle) * s.radius * 0.9;
      const col = s.isPlayer ? '#8cf' : s.side === 'warden' ? '#fff' : s.faction?.color2 ?? '#fa8';
      this.part(ex, ey, Math.cos(a) * 120 + s.vx * 0.5, Math.sin(a) * 120 + s.vy * 0.5, 0.25 + Math.random() * 0.2, 2 + s.radius * 0.08, col, true, 0.9);
    }
  }

  private collideShips(dt: number) {
    const ships = this.ships;
    const ram = hasSkillFlag(this.run, 'ram');
    const thorn = this.run.relics.includes('thorn_lattice');
    for (let i = 0; i < ships.length; i++) {
      const a = ships[i];
      if (a.dead) continue;
      for (let j = i + 1; j < ships.length; j++) {
        const b = ships[j];
        if (b.dead) continue;
        if (a.allied && b.allied) continue;
        const rr = a.radius + b.radius;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = rr - d;
        const ma = a.radius * a.radius, mb = b.radius * b.radius;
        const tot = ma + mb;
        a.x -= nx * overlap * (mb / tot);
        a.y -= ny * overlap * (mb / tot);
        b.x += nx * overlap * (ma / tot);
        b.y += ny * overlap * (ma / tot);
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const imp = (-1.6 * rv) / tot;
          a.vx -= imp * mb * nx;
          a.vy -= imp * mb * ny;
          b.vx += imp * ma * nx;
          b.vy += imp * ma * ny;
        }
        // contact damage between player-side and hostile
        const pair: [Ship, Ship][] = [[a, b], [b, a]];
        for (const [x, y] of pair) {
          if (!x.allied || y.allied) continue;
          // x is player-side, y is enemy
          const speed = Math.abs(rv);
          if (y.contactDmg > 0 && y.contactCd <= 0 && y.hostile) {
            y.contactCd = 0.6;
            this.damage(x, y.contactDmg * (ram ? 0.4 : 1) * (thorn ? 0.6 : 1), { src: y, fromPlayer: false, aoe: true });
            if (y.role === 'kamikaze') this.kill(y, x, { fromPlayer: true });
          }
          if ((ram || thorn) && x.isPlayer && speed > 80 && y.contactCd <= 0.3) {
            this.damage(y, (speed * 0.12 + 10) * (ram ? 2 : 1) * (thorn ? 1.5 : 1) * (1 + this.run.depth * 0.15), { src: x, fromPlayer: true, aoe: true });
          } else if (x.isPlayer && speed > 250 && !y.boss) {
            this.damage(x, speed * 0.02, { src: y, fromPlayer: false, aoe: true });
          }
        }
      }
    }
    // ships vs rocks
    for (const s of ships) {
      if (s.dead) continue;
      for (const r of this.rocks) {
        const rr = s.radius + r.r;
        const dx = s.x - r.x, dy = s.y - r.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        s.x = r.x + nx * rr;
        s.y = r.y + ny * rr;
        const rv = s.vx * nx + s.vy * ny;
        if (rv < 0) {
          s.vx -= 1.5 * rv * nx;
          s.vy -= 1.5 * rv * ny;
          r.vx += rv * nx * 0.1;
          r.vy += rv * ny * 0.1;
          if (s.isPlayer && -rv > 150) this.damage(s, -rv * 0.03, { src: null, fromPlayer: false, aoe: true });
        }
      }
    }
    void dt;
  }

  private updateProjs(dt: number) {
    const projs = this.projs;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.dead) continue;
      p.life -= dt;
      if (p.kind === 'mine') {
        p.vx *= Math.pow(0.3, dt);
        p.vy *= Math.pow(0.3, dt);
        p.armed -= dt;
      }
      if (p.kind === 'wave') p.size = Math.min(70, p.size + dt * 50);
      // homing
      if (p.turn > 0) {
        let best: Ship | null = null;
        let bd = 700 * 700;
        for (const s of this.ships) {
          if (!this.canHit(p.owner, p.fromPlayer, s)) continue;
          if (!p.fromPlayer && !s.allied) continue;
          if (p.fromPlayer && !s.hostile) continue;
          const d = dist2(s.x, s.y, p.x, p.y);
          if (d < bd) {
            bd = d;
            best = s;
          }
        }
        if (best) {
          const sp = Math.hypot(p.vx, p.vy);
          const cur = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(best.y - p.y, best.x - p.x);
          const na = turnToward(cur, want, p.turn * dt);
          const targetSp = p.kind === 'missile' ? Math.min(sp + 600 * dt, 520) : sp;
          p.vx = Math.cos(na) * targetSp;
          p.vy = Math.sin(na) * targetSp;
        }
        if (p.kind === 'missile' && Math.random() < 0.6) this.part(p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, 0.3, 2.5, '#fb8', true, 0.9);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'comet' && Math.random() < 0.8) this.part(p.x, p.y, 0, 0, 0.4, 5, '#ffe9a0', true, 0.9);
      if (p.life <= 0) {
        p.dead = true;
        if (p.kind === 'flak') this.burst(p);
        if (p.kind === 'mine') this.explodeMine(p);
        continue;
      }
      // collisions
      if (p.kind === 'mine') {
        if (p.armed > 0) continue;
        for (const s of this.ships) {
          if (!this.canHit(p.owner, p.fromPlayer, s)) continue;
          if (dist2(s.x, s.y, p.x, p.y) < (s.radius + 60) ** 2) {
            p.dead = true;
            this.explodeMine(p);
            break;
          }
        }
        continue;
      }
      for (const s of this.ships) {
        if (!this.canHit(p.owner, p.fromPlayer, s)) continue;
        if (p.hit.has(s.id)) continue;
        const rr = s.radius + p.size;
        if (dist2(s.x, s.y, p.x, p.y) > rr * rr) continue;
        // reflect
        if (s.isPlayer && s.reflect > 0 && !p.fromPlayer) {
          p.fromPlayer = true;
          p.owner = s;
          p.vx = -p.vx;
          p.vy = -p.vy;
          p.dmg *= 1.5;
          p.hit.clear();
          s.shieldFlash = 1;
          break;
        }
        p.hit.add(s.id);
        const crit = p.crit || Math.random() < p.critChance;
        const dealt = this.damage(s, p.dmg * (crit ? p.critMult : 1), { src: p.owner, fromPlayer: p.fromPlayer, ion: p.tags.has('ion'), crit, tags: p.tags, x: p.x, y: p.y });
        this.spark(p.x, p.y, p.color, crit ? 10 : 5);
        if ((p.tags.has('pull') || p.kind === 'lance') && p.owner && !s.boss) {
          const a = Math.atan2(p.owner.y - s.y, p.owner.x - s.x);
          const str = p.kind === 'harpoon' ? 900 : 380;
          const k = 30 / Math.max(15, s.radius);
          s.vx += Math.cos(a) * str * k;
          s.vy += Math.sin(a) * str * k;
          if (p.kind === 'harpoon') {
            s.slow = 1.5;
            this.line(p.owner.x, p.owner.y, s.x, s.y, '#fd8', 2, 0.4, false);
          }
        }
        if (p.tags.has('split') && p.kind !== 'shrapnel') {
          const a0 = Math.atan2(p.vy, p.vx);
          for (let k = -1; k <= 1; k++) this.spawnProj(p.owner, 'shrapnel', p.x, p.y, a0 + k * 0.5, 600, p.dmg * 0.4, 0.4, p.color, 2, new Set(), p.critChance, p.critMult).hit.add(s.id);
        }
        if (p.kind === 'flak') {
          p.dead = true;
          this.burst(p);
          break;
        }
        if (p.bounces > 0) {
          p.bounces--;
          let best: Ship | null = null;
          let bd = 450 * 450;
          for (const o of this.ships) {
            if (o === s || !this.canHit(p.owner, p.fromPlayer, o) || p.hit.has(o.id)) continue;
            const d = dist2(o.x, o.y, p.x, p.y);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (best) {
            const sp = Math.hypot(p.vx, p.vy);
            const a = Math.atan2(best.y - p.y, best.x - p.x);
            p.vx = Math.cos(a) * sp;
            p.vy = Math.sin(a) * sp;
            p.life = p.maxLife;
            break;
          }
        }
        if (p.pierce > 0) {
          p.pierce--;
          continue;
        }
        void dealt;
        p.dead = true;
        break;
      }
      if (p.dead) continue;
      // rocks
      for (const r of this.rocks) {
        if (dist2(r.x, r.y, p.x, p.y) < (r.r + p.size) ** 2) {
          r.hp -= p.dmg;
          this.spark(p.x, p.y, '#ccb', 4);
          if (r.hp <= 0) this.breakRock(r);
          if (p.kind !== 'wave') {
            p.dead = true;
            if (p.kind === 'flak') this.burst(p);
          }
          break;
        }
      }
    }
  }

  private burst(p: Proj) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + Math.random() * 0.3;
      this.spawnProj(p.owner, 'shrapnel', p.x, p.y, a, 420 + Math.random() * 120, p.dmg * 0.7, 0.35, p.color, 2, p.tags, p.critChance, p.critMult).fromPlayer = p.fromPlayer;
    }
    this.explosion(p.x, p.y, 16, p.color);
  }

  private explodeMine(p: Proj) {
    const r = 110;
    for (const s of this.ships) {
      if (!this.canHit(p.owner, p.fromPlayer, s)) continue;
      const d = dist(s.x, s.y, p.x, p.y);
      if (d < r + s.radius) this.damage(s, p.dmg, { src: p.owner, fromPlayer: p.fromPlayer, aoe: true, tags: p.tags });
    }
    this.explosion(p.x, p.y, 40, '#f86');
    audio.sfx('explode_small', { vol: 0.4 });
  }

  breakRock(r: Rock) {
    if (r.dead) return;
    r.dead = true;
    this.explosion(r.x, r.y, r.r * 0.8, '#bba');
    for (let i = 0; i < 10; i++) this.part(r.x, r.y, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0.8, 3, '#998', false, 0.95);
    const salvage = 1 + (this.run.skills['e_salvage'] ?? 0) * 0.5;
    if (Math.random() < 0.5 * salvage) this.drop(r.x, r.y, 'credits', (3 + r.r * 0.15) * (1 + this.run.depth * 0.2));
    if (r.r > 30) {
      for (let i = 0; i < 2; i++) {
        const nr = r.r * 0.55;
        this.rocks.push({ ...r, x: r.x + (Math.random() - 0.5) * r.r, y: r.y + (Math.random() - 0.5) * r.r, vx: r.vx + (Math.random() - 0.5) * 60, vy: r.vy + (Math.random() - 0.5) * 60, r: nr, hp: nr * 2, dead: false });
      }
    }
    audio.sfx('explode_small', { vol: 0.2 });
  }

  private updateRocks(dt: number) {
    for (const r of this.rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vr * dt;
      r.vx *= Math.pow(0.9, dt);
      r.vy *= Math.pow(0.9, dt);
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    const range = this.stats.pickupRange;
    for (const k of this.pickups) {
      k.life -= dt;
      if (k.life <= 0) {
        k.dead = true;
        continue;
      }
      const d = dist(k.x, k.y, p.x, p.y);
      if (d < range && !this.playerDead) {
        const pull = 900 * (1 - d / range) + 200;
        k.vx += ((p.x - k.x) / d) * pull * dt;
        k.vy += ((p.y - k.y) / d) * pull * dt;
      }
      k.vx *= Math.pow(0.15, dt);
      k.vy *= Math.pow(0.15, dt);
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (d < p.radius + 14 && !this.playerDead) this.collect(k);
    }
  }

  collect(k: Pickup) {
    const run = this.run;
    const p = this.player;
    switch (k.kind) {
      case 'credits': {
        const v = Math.max(1, Math.round(k.value * (run.relics.includes('ledger') ? 1.15 : 1)));
        run.credits += v;
        run.stats.creditsEarned += v;
        this.text(p.x, p.y - 30, `+${v}¢`, '#ffd76a', 12);
        audio.sfx('credits', { vol: 0.35 });
        break;
      }
      case 'repair':
        p.hull = Math.min(p.maxHull, p.hull + k.value);
        this.text(p.x, p.y - 30, `+${Math.round(k.value)} hull`, '#7f7', 12);
        audio.sfx('pickup', { vol: 0.5 });
        break;
      case 'energy':
        p.energy = p.maxEnergy;
        p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.3);
        audio.sfx('pickup', { vol: 0.5 });
        break;
      case 'fuel':
        if (run.fuel >= this.stats.maxFuel) return;
        run.fuel = Math.min(this.stats.maxFuel, run.fuel + k.value);
        this.text(p.x, p.y - 30, `+${k.value} fuel`, '#8ef', 13);
        audio.sfx('pickup');
        break;
      case 'module':
        if (run.cargo.length >= 12) {
          if (k.life % 5 < 0.05) this.hooks.toast('Cargo hold full', '#fa8');
          return;
        }
        run.cargo.push(k.module!);
        this.hooks.toast(`Salvaged: ${moduleName(k.module!)}`, ['#c8d0dc', '#6fe08a', '#5aa8ff', '#c77dff', '#ffb347'][k.module!.rarity]);
        audio.sfx('pickup', { pitch: 1.3 });
        break;
    }
    k.dead = true;
  }

  private updateHazards(dt: number) {
    if (this.node.hazard === 'ionstorm') {
      this.ionTimer -= dt;
      if (this.ionTimer <= 0) {
        this.ionTimer = 4 + Math.random() * 6;
        const p = this.player;
        this.strikes.push({ x: p.x + (Math.random() - 0.5) * 900 + p.vx * 0.8, y: p.y + (Math.random() - 0.5) * 900 + p.vy * 0.8, r: 140, t: 1.4, max: 1.4 });
      }
    }
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t <= 0 && s.t > -100) {
        s.t = -1000;
        for (const sh of this.ships) if (!sh.dead && dist(sh.x, sh.y, s.x, s.y) < s.r + sh.radius) {
          this.damage(sh, 22 + this.run.depth * 5, { src: null, fromPlayer: false, aoe: true, hazard: true });
          sh.energy *= 0.4;
        }
        for (let i = 0; i < 4; i++) this.line(s.x + (Math.random() - 0.5) * 60, s.y - 700, s.x, s.y, '#bdf', 3, 0.3, true);
        this.explosion(s.x, s.y, 50, '#bdf');
        audio.sfx('arc', { vol: 0.7 * this.falloff({ x: s.x, y: s.y } as Ship) + 0.1 });
      }
    }
    this.strikes = this.strikes.filter((s) => s.t > -100);
  }

  private updateWardens(dt: number) {
    if (this.node.kind === 'final' || this.playerDead) return;
    const remaining = this.wardenTime - this.arrivalT;
    if (!this.wardenWarned && remaining < 30) {
      this.wardenWarned = true;
      this.hooks.toast('The lane grows restless. Something is coming.', '#e0d8ff');
      audio.sfx('warning');
    }
    if (remaining <= 0) {
      this.wardenNext -= dt;
      if (this.wardenNext <= 0) {
        this.wardenWaves++;
        this.wardenNext = 40;
        const alive = this.ships.filter((s) => s.side === 'warden' && !s.dead).length;
        const n = Math.min(9, 2 + Math.floor(this.run.depth / 2) + this.wardenWaves, 14 - alive);
        if (n > 0) this.startCombat({ side: 'warden', count: n, strength: 1 + this.wardenWaves * 0.15 });
        if (this.wardenWaves === 1) this.hooks.toast('Wardens.', '#ffffff');
      }
    }
  }

  private updateJump(dt: number) {
    if (!this.jump || this.playerDead) return;
    const hostileNear = this.ships.some((s) => s.hostile && s.aggro && !s.dead && dist2(s.x, s.y, this.player.x, this.player.y) < 1000 * 1000);
    this.jump.t += dt * (hostileNear ? 0.5 : 1);
    if (Math.random() < 0.5) {
      const p = this.player;
      const a = Math.random() * TAU;
      const r = 80 + Math.random() * 80;
      this.part(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, -Math.cos(a) * r * 2, -Math.sin(a) * r * 2, 0.4, 2, '#cdf', true, 0.95);
    }
    if (this.jump.t >= this.jump.total) {
      const target = this.jump.target;
      this.jump = null;
      audio.sfx('jump');
      this.hooks.jumped(target);
    }
  }

  startJump(target: number) {
    const total = hasSkillFlag(this.run, 'drift') ? 1.8 : 3;
    this.jump = { target, t: 0, total };
    audio.sfx('jump_charge');
  }

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------
  part(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, add: boolean, drag: number, grow = 0) {
    if (this.parts.length > 2500) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, add, drag, grow });
  }
  spark(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 220;
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.15 + Math.random() * 0.2, 2, color, true, 0.85);
    }
  }
  explosion(x: number, y: number, r: number, color: string) {
    const n = Math.min(60, 10 + r);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = Math.random() * r * 5;
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + Math.random() * 0.6, 2 + Math.random() * r * 0.15, Math.random() < 0.3 ? '#fff' : color, true, 0.88);
    }
    for (let i = 0; i < n / 3; i++) {
      const a = Math.random() * TAU;
      const sp = Math.random() * r * 1.5;
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + Math.random() * 1.2, r * 0.25, 'rgba(80,70,70,0.5)', false, 0.94, r * 0.6);
    }
    this.part(x, y, 0, 0, 0.18, r * 1.2, '#fff', true, 1, -r * 4);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, width: number, life: number, jag: boolean) {
    this.lines.push({ x1, y1, x2, y2, color, width, life, max: life, jag });
  }
  text(x: number, y: number, text: string, color: string, size: number) {
    if (this.texts.length > 120) this.texts.shift();
    this.texts.push({ x, y, text, color, life: 0.9, size });
  }
  private updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k;
      p.vy *= k;
      p.size = Math.max(0.1, p.size + p.grow * dt);
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 40 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const l of this.lines) l.life -= dt;
    this.lines = this.lines.filter((l) => l.life > 0);
  }
}

function roleName(r: Role): string {
  return { fighter: 'Fighter', sniper: 'Lancer', swarm: 'Swarmer', brute: 'Warship', carrier: 'Carrier', trader: 'Trader', drone: 'Drone', kamikaze: 'Zealot', boss: 'Flagship', echo: 'Echo', turret: 'Sentry' }[r];
}
