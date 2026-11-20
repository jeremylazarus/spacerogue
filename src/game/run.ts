import { RNG, hashSeed } from '../core/rng';
import type { Aptitude, Faction, FactionArchetype, Officer, OfficerRole, RelicId } from './api';
import { APTITUDES, RELIC_IDS } from './api';
import { HULLS, RELICS, baseStats, hullDef, nextUid, rollModule, rollRarity, setUidCounter, utilMods, type ModuleInst, type Stats, type StatMod } from './items';
import { SKILLS, skillById, xpForLevel } from './skills';
import { alienName, factionNames, humanName, shipName, systemName } from './names';
import { meta, perk, unlockedSet } from './meta';
import { FINAL_STEP, type Strand } from './weave';
import { HULL_SOCKETS, graftApt, graftsMod, type GraftInst } from './grafts';
import { initExodus, type Ambition } from './exodus';

export type NodeKind = 'start' | 'empty' | 'station' | 'hostile' | 'nebula' | 'derelict' | 'anomaly' | 'haven' | 'final' | 'narrows';
export type Hazard = 'none' | 'nebula' | 'asteroids' | 'radiation' | 'ionstorm';

export interface GNode {
  id: number;
  col: number;
  row: number;
  x: number; // layout 0..1
  y: number;
  name: string;
  kind: NodeKind;
  hazard: Hazard;
  owner: string | null; // faction id
  links: number[]; // ids in next column
  seed: number;
  known: boolean;
  visited: boolean;
  /** planet kinds woven in (first planets take these kinds and are rich) */
  planets?: string[];
  /** extra woven features: 'derelict' | 'anomaly' | 'wrack' | 'scarred' | 'stronghold' | 'guest:<fid>' */
  extras?: string[];
}

export interface Marker {
  /** voyage step at which the site appears (rolls forward if missed) */
  step: number;
  nodeId?: number;
  eventId: string;
  label: string;
  kind: 'beacon' | 'wreck' | 'station' | 'anomaly' | 'planet';
  done: boolean;
}

export interface RunState {
  v: 2;
  seed: number;
  runNumber: number;
  resonance: number;
  hullId: string;
  captain: string;
  shipName: string;
  finalDepth: number;
  /** danger tier 0..finalDepth (what content and scaling read) */
  depth: number;
  /** voyage step 0..FINAL_STEP (one per jump) */
  step: number;
  nodeId: number;
  /** systems visited so far, in order (the last is the current one) */
  nodes: GNode[];
  /** strands carried on the Loom */
  strands: Strand[];
  strandUid: number;
  /** each faction's heartland, as a voyage step */
  fcenter: Record<string, number>;
  hull: number;
  weapons: (ModuleInst | null)[];
  utils: (ModuleInst | null)[];
  cargo: ModuleInst[];
  /** graft sockets on the hull */
  grafts: (GraftInst | null)[];
  /** torn-out grafts waiting to be fitted */
  graftHold: GraftInst[];
  /** exodus: each faction's strength 0..10, and what it wants */
  strength?: Record<string, number>;
  ambitions?: Ambition[];
  relics: RelicId[];
  officers: Officer[];
  credits: number;
  thread: number;
  xp: number;
  level: number;
  skillPoints: number;
  skills: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  rep: Record<string, number>;
  factions: Faction[];
  mainArc: string;
  sideArcs: { id: string; at: number; begun: boolean }[];
  journal: Record<string, string>;
  finaleEvent: string | null;
  markers: Marker[];
  usedEvents: string[];
  stats: { kills: number; systems: number; creditsEarned: number; bosses: number; events: number; killsThisStreak: number; peacefulSystems: number; bound?: number; released?: number; stripped?: number; unravelled?: number };
  log: string[];
  outcome: null | { won: boolean; text: string };
  uidMax: number;
  /** per-system state that must survive save/continue */
  sys: { nodeId: number; used: number[]; arrivalDone: boolean; t: number; saint: boolean; shunt: boolean; frozen: boolean; kills: number; gone?: string[]; hailed?: string[]; waves?: number; next?: number; rock?: number; woven?: number[]; tt?: number; px?: number; py?: number; str?: Record<string, number> };
  /** fights with narrative follow-ups that must survive save/continue */
  pending: { nodeId: number; spec: import('./api').CombatSpec; cleared?: boolean }[];
  peaceful: number;
}

const ARCHS: FactionArchetype[] = ['mercantile', 'zealot', 'hive', 'machine', 'ancient'];
const FACTION_COLORS: Record<FactionArchetype, [string, string][]> = {
  mercantile: [['#d9b45a', '#3a5a8a'], ['#5ac0d9', '#e0d0a0'], ['#e08a4a', '#2a4a5a']],
  zealot: [['#e8e0c8', '#c03a3a'], ['#f0d070', '#6a2a8a'], ['#c8d8f0', '#d0a040']],
  hive: [['#8ad04a', '#4a2a3a'], ['#d0507a', '#3a4a2a'], ['#c0a040', '#5a2a5a']],
  machine: [['#a0b0c0', '#40e0ff'], ['#606870', '#ff6040'], ['#d0d8e0', '#60ff90']],
  raider: [['#b04030', '#303030'], ['#d08030', '#202830'], ['#906050', '#c0c040']],
  ancient: [['#e0e8ff', '#a080ff'], ['#c0f0e0', '#40a0a0'], ['#f0e0f0', '#e0a040']],
};

const ROLES: OfficerRole[] = ['gunner', 'engineer', 'navigator', 'xenologist', 'medic', 'quartermaster', 'spy'];
export const ROLE_APT: Record<OfficerRole, Aptitude> = {
  gunner: 'combat', engineer: 'engineering', navigator: 'navigation', xenologist: 'diplomacy', medic: 'science', quartermaster: 'salvage', spy: 'guile',
};
const TRAITS = ['superstitious', 'greedy', 'kind', 'reckless', 'nervous', 'proud', 'curious', 'grim', 'cheerful', 'pious', 'sardonic', 'loyal', 'secretive', 'gentle'];

export function makeOfficer(rng: RNG, factions: Faction[], role?: OfficerRole, species?: string): Officer {
  const r = role ?? rng.pick(ROLES);
  let name: string, sp: string;
  if (species) {
    const f = factions.find((x) => x.species === species);
    name = f ? alienName(rng, f.archetype) : humanName(rng);
    sp = species;
  } else if (rng.chance(0.55) || factions.length === 0) {
    name = humanName(rng);
    sp = 'human';
  } else {
    const f = rng.pick(factions);
    name = alienName(rng, f.archetype);
    sp = f.species;
  }
  return { id: 'o' + nextUid(), name, role: r, species: sp, trait: rng.pick(TRAITS) };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------
export function createRun(seed: number, hullId: string, resonance: number, mainArc: string, sideArcIds: string[]): RunState {
  const rng = new RNG(seed);
  const hull = hullDef(hullId);
  // factions: always one raider, plus 3-4 others
  const archs = rng.shuffle([...ARCHS]).slice(0, rng.int(3, 4));
  archs.push('raider');
  const factions: Faction[] = archs.map((a, i) => {
    const n = factionNames(new RNG(rng.fork()), a);
    const [c1, c2] = rng.pick(FACTION_COLORS[a]);
    return { id: 'f' + i, archetype: a, ...n, color: c1, color2: c2 };
  });
  const rep: Record<string, number> = {};
  for (const f of factions) {
    const base: Record<FactionArchetype, number> = { mercantile: 15, zealot: -5, hive: -35, machine: 0, raider: -40, ancient: 5 };
    rep[f.id] = base[f.archetype] + rng.int(-10, 10);
  }
  const finalDepth = 7;
  const fcenter: Record<string, number> = {};
  for (const f of factions) fcenter[f.id] = f.archetype === 'ancient' ? rng.range(FINAL_STEP - 3.5, FINAL_STEP - 1) : f.archetype === 'raider' ? FINAL_STEP / 2 : rng.range(1, FINAL_STEP - 2);
  const start: GNode = { id: 0, col: 0, row: 0, x: 0, y: 0, name: systemName(new RNG(rng.fork())), kind: 'start', hazard: 'none', owner: null, links: [], seed: rng.fork(), known: true, visited: false, planets: [], extras: [] };
  const nodes = [start];
  const unlocked = unlockedSet();
  const weapons: (ModuleInst | null)[] = Array(hull.weaponSlots).fill(null);
  const utils: (ModuleInst | null)[] = Array(hull.utilSlots).fill(null);
  hull.startWeapons.forEach((w, i) => (weapons[i] = rollModule(rng, { slot: 'weapon', rarity: 0, unlocked, defId: w })));
  hull.startUtils.forEach((u, i) => (utils[i] = rollModule(rng, { slot: 'utility', rarity: 0, unlocked, defId: u })));
  const cargo: ModuleInst[] = [];
  if (perk('perk.module') > 0) cargo.push(rollModule(rng, { rarity: perk('perk.module') >= 2 ? 2 : 1, unlocked }));
  const run: RunState = {
    v: 2, seed, runNumber: Math.max(1, meta.runs), resonance, hullId, captain: humanName(rng), shipName: shipName(rng), finalDepth, depth: 0, step: 0, nodeId: 0, nodes,
    strands: [], strandUid: 0, fcenter,
    hull: 0, weapons, utils, cargo, grafts: Array(HULL_SOCKETS[hullId] ?? 2).fill(null), graftHold: [], relics: [], officers: [], credits: 80 + perk('perk.credits') * 60, thread: 30 + perk('perk.fuel') * 8, xp: 0, level: 1,
    skillPoints: perk('perk.skill'), skills: {}, flags: {}, rep, factions, mainArc, sideArcs: sideArcIds.map((id) => ({ id, at: rng.int(1, 3), begun: false })),
    journal: {}, finaleEvent: null, markers: [], usedEvents: [],
    stats: { kills: 0, systems: 0, creditsEarned: 0, bosses: 0, events: 0, killsThisStreak: 0, peacefulSystems: 0 }, log: [], outcome: null, uidMax: 0,
    sys: { nodeId: 0, used: [], arrivalDone: false, t: 0, saint: false, shunt: false, frozen: false, kills: 0 }, pending: [], peaceful: 0,
  };
  if (perk('perk.officer') > 0) run.officers.push(makeOfficer(rng, factions));
  if (perk('perk.relic') > 0) run.relics.push(rng.pick(RELIC_IDS.filter((r) => r !== 'echo_shard')));
  // avoid same ship name as last life
  if (meta.lastShips[0] === run.shipName) run.shipName = shipName(rng);
  run.hull = computeStats(run).maxHull;
  initExodus(run, new RNG(rng.fork()));
  return run;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------
function applyMod(s: Stats, m: StatMod, k = 1) {
  for (const [key, v] of Object.entries(m)) (s as unknown as Record<string, number>)[key] += (v as number) * k;
}

export function computeStats(run: RunState): Stats {
  const s = baseStats();
  const h = hullDef(run.hullId);
  applyMod(s, h.mod);
  for (const u of run.utils) if (u) applyMod(s, utilMods(u));
  for (const m of graftsMod(run)) applyMod(s, m);
  for (const [id, rank] of Object.entries(run.skills)) {
    const sk = skillById(id);
    if (sk?.mod && rank > 0) applyMod(s, sk.mod, rank);
  }
  for (const r of run.relics) {
    const m = RELICS[r].mod;
    if (m) applyMod(s, m);
  }
  s.maxHull += perk('perk.hull') * 15;
  s.maxThread += perk('perk.fuel') * 8;
  if (run.relics.includes('glass_heart')) s.maxHull *= 0.7;
  // resonance: player is not weakened; enemies are strengthened elsewhere
  s.maxHull = Math.max(20, Math.round(s.maxHull));
  s.maxShield = Math.max(0, s.maxShield);
  s.maxSpeed = Math.max(140, s.maxSpeed);
  s.thrust = Math.max(220, s.thrust);
  s.energyCostMult = Math.max(0.4, s.energyCostMult);
  s.abilityCdMult = Math.max(0.4, s.abilityCdMult);
  s.priceMult = Math.max(0.5, s.priceMult);
  s.dodge = Math.min(0.5, s.dodge);
  s.armor = Math.max(0, s.armor);
  s.shieldDelay = Math.max(0.6, s.shieldDelay);
  return s;
}

export function hasSkillFlag(run: RunState, flag: string): boolean {
  return SKILLS.some((s) => s.flag === flag && (run.skills[s.id] ?? 0) > 0);
}

export function aptitude(run: RunState, a: Aptitude): number {
  let v = 1;
  for (const [id, rank] of Object.entries(run.skills)) v += (skillById(id)?.apt?.[a] ?? 0) * rank;
  for (const o of run.officers) if (ROLE_APT[o.role] === a) v += 2;
  v += graftApt(run, a);
  if (run.relics.includes('hollow_idol')) v += 1;
  if (a === 'diplomacy' && run.relics.includes('pilgrim_lamp')) v += 1;
  for (const u of run.utils) {
    if (!u) continue;
    if (u.defId === 'scanner' && a === 'science') v += 1;
    if (u.defId === 'tractor' && a === 'salvage') v += 1;
    if (u.defId === 'targeting' && a === 'combat') v += 1;
  }
  return v;
}

export function aptitudes(run: RunState): Record<Aptitude, number> {
  const o = {} as Record<Aptitude, number>;
  for (const a of APTITUDES) o[a] = aptitude(run, a);
  return o;
}

export function gainXp(run: RunState, n: number): number {
  const s = computeStats(run);
  run.xp += Math.round(n * s.xpMult);
  let levels = 0;
  while (run.xp >= xpForLevel(run.level)) {
    run.xp -= xpForLevel(run.level);
    run.level++;
    run.skillPoints++;
    levels++;
  }
  return levels;
}

export function canLearn(run: RunState, id: string): boolean {
  const sk = skillById(id);
  if (run.skillPoints <= 0) return false;
  if ((run.skills[id] ?? 0) >= sk.max) return false;
  if (sk.req && !sk.req.some((r) => (run.skills[r] ?? 0) > 0)) return false;
  return true;
}

export function learn(run: RunState, id: string): boolean {
  if (!canLearn(run, id)) return false;
  const before = computeStats(run);
  run.skills[id] = (run.skills[id] ?? 0) + 1;
  run.skillPoints--;
  const after = computeStats(run);
  if (after.maxHull > before.maxHull) run.hull += after.maxHull - before.maxHull;
  if (id === 'w_envoy') for (const f of run.factions) run.rep[f.id] = Math.min(100, run.rep[f.id] + 15);
  return true;
}

export const nodeById = (run: RunState, id: number) => run.nodes.find((n) => n.id === id)!;
export const currentNode = (run: RunState) => nodeById(run, run.nodeId);
export const factionById = (run: RunState, id: string | null) => (id ? run.factions.find((f) => f.id === id) ?? null : null);

export function lootRarity(run: RunState, rng: RNG, min = 0): number {
  return rollRarity(rng, run.depth, computeStats(run).luck, min);
}

export function serializeRun(run: RunState): string {
  run.uidMax = nextUid();
  return JSON.stringify(run);
}
export function deserializeRun(json: string): RunState | null {
  try {
    const r = JSON.parse(json) as RunState;
    if (r.v !== 2 || !HULLS.some((h) => h.id === r.hullId)) return null;
    setUidCounter(r.uidMax + 1);
    r.sys ??= { nodeId: r.nodeId, used: [], arrivalDone: true, t: 0, saint: false, shunt: false, frozen: false, kills: 0 };
    r.pending ??= [];
    r.peaceful ??= 0;
    r.grafts ??= [];
    r.graftHold ??= [];
    return r;
  } catch {
    return null;
  }
}

export function systemSeed(run: RunState, node: GNode) {
  return hashSeed(run.seed, node.id, node.seed);
}

export function repLabel(v: number): string {
  return v <= -60 ? 'Nemesis' : v <= -30 ? 'Hostile' : v < -10 ? 'Wary' : v <= 10 ? 'Neutral' : v < 30 ? 'Cordial' : v < 60 ? 'Friendly' : 'Allied';
}
export const isHostileRep = (v: number) => v <= -30;
