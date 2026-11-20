import type { BossId, Faction, Site } from './api';
import type { WeaponStats } from './items';
import type { PlanetKind } from '../art/planets';

export type Role = 'fighter' | 'sniper' | 'swarm' | 'brute' | 'carrier' | 'trader' | 'drone' | 'kamikaze' | 'boss' | 'echo' | 'turret';

export interface WeaponSlot {
  ws: WeaponStats;
  cd: number;
  shots: number; // trigger pulls (for storm)
  group: 0 | 1; // 0 = LMB, 1 = RMB (player)
  beamOn?: boolean;
}

export interface Ship {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  side: string; // 'player' | faction id | 'warden' | 'monster' | 'rogue'
  faction: Faction | null;
  isPlayer: boolean;
  allied: boolean; // fights for the player
  hostile: boolean; // hostile to the player
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  shieldRegen: number;
  shieldDelay: number;
  shieldTimer: number;
  armor: number;
  energy: number;
  maxEnergy: number;
  energyRegen: number;
  thrust: number;
  maxSpeed: number;
  turnRate: number;
  weapons: WeaponSlot[];
  sprite: HTMLCanvasElement;
  role: Role;
  level: number;
  dmgMult: number;
  aim: number; // aim error radians
  contactDmg: number;
  contactCd: number;
  // status
  burn: number; // seconds remaining
  burnDps: number;
  slow: number;
  cloak: number;
  invuln: number;
  reflect: number;
  overdrive: number;
  flash: number;
  shieldFlash: number;
  dead: boolean;
  lifetime: number; // >0 = expires
  // ai
  target: Ship | null;
  aiT: number; // timer for decisions
  orbitDir: number;
  aggro: boolean;
  wanderX: number;
  wanderY: number;
  fleeing: boolean;
  hailed: boolean;
  hailable: boolean;
  group: number; // combat group id, 0 = none
  patrolGroup: number;
  owner: Ship | null; // for drones
  boss: BossId | null;
  bossT: Record<string, number>;
  phase: number;
  xp: number;
  credits: number;
  lootChance: number;
  elite: boolean;
  lastHitByPlayer: boolean;
  provoked: boolean;
  key: string;
  burnFromPlayer: boolean;
  thrusting: number; // for engine fx 0..1
  tint?: string;
  /** stunned by a closing loop: drifts, cannot act */
  stun: number;
  /** bound and towed on a tether */
  tethered?: boolean;
  /** a ship of a feuding faction this one is fighting */
  foe?: Ship | null;
}

export type ProjKind = 'bullet' | 'missile' | 'mine' | 'flak' | 'wave' | 'lance' | 'shrapnel' | 'harpoon' | 'comet' | 'spit';

export interface Proj {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  dmg: number;
  owner: Ship | null;
  fromPlayer: boolean; // player-side (player, allies)
  side: string;
  color: string;
  size: number;
  tags: Set<string>;
  pierce: number;
  hit: Set<number>;
  crit: boolean;
  critChance: number;
  critMult: number;
  turn: number; // seek turn rate
  hp: number; // for missiles (point defense)
  armed: number; // mines
  bounces: number;
  dead: boolean;
}

export interface Pickup {
  kind: 'credits' | 'module' | 'repair' | 'energy' | 'thread';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  module?: import('./items').ModuleInst;
  life: number;
  dead: boolean;
}

export type PoiKind = 'planet' | 'station' | 'derelict' | 'anomaly' | 'beacon' | 'distress' | 'asteroid' | 'finale' | 'anchor';

export interface POI {
  id: number;
  kind: PoiKind;
  name: string;
  x: number;
  y: number;
  r: number;
  sprite: HTMLCanvasElement | null;
  site: Site;
  used: boolean;
  discovered: boolean;
  markerIdx: number; // index into run.markers or -1
  planetKind?: PlanetKind;
  orbit?: { r: number; speed: number; phase: number };
  anomalyKind: number;
  owner: Faction | null;
  hostileStation: boolean;
  label?: string;
  spin: number;
  /** loopable anchor: which strand it yields */
  anchor?: import('./weave').StrandKind;
  anchorHaven?: boolean;
  anchorColor?: string;
  woven?: boolean;
  /** taken by the Tide */
  erased?: boolean;
  hazard?: import('./run').Hazard;
  /** woven-in world: always has something to find */
  rich?: boolean;
}

export interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  rot: number;
  vr: number;
  sprite: HTMLCanvasElement;
  dead: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  add: boolean;
  drag: number;
  grow: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface LineFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  max: number;
  jag: boolean;
}
