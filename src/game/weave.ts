/**
 * The Loom: strands carried by the player and how they weave the next system.
 * SPOILERS: see design/DESIGN.md. Never describe these rules to the owner.
 */
import { RNG, hashSeed } from '../core/rng';
import type { Faction } from './api';
import type { GNode, Hazard, NodeKind, RunState } from './run';
import { factionById, repLabel } from './run';
import { systemName } from './names';
import { broken, narrowsHolder } from './exodus';

export type StrandKind = 'faction' | 'station' | 'haven' | 'planet' | 'derelict' | 'anomaly' | 'scar' | 'wrack';

export interface Strand {
  id: number;
  kind: StrandKind;
  label: string;
  color: string;
  faction?: string; // faction id
  planet?: string; // planet kind
  hazard?: Hazard;
}

export const LOOM_SIZE = 3;

export const STRAND_COLOR: Record<StrandKind, string> = {
  faction: '#ffd36b', station: '#4fe0c8', haven: '#9ef0a0', planet: '#c8b27a', derelict: '#b0a090', anomaly: '#c9a0ff', scar: '#ff9a6a', wrack: '#e8e8ff',
};

export const STRAND_GLYPH: Record<StrandKind, string> = {
  faction: '⚑', station: '⌂', haven: '✚', planet: '◍', derelict: '⚓', anomaly: '✶', scar: '⚠', wrack: '≋',
};

const HAZ_NAME: Record<string, string> = { asteroids: 'an asteroid field', radiation: 'hard radiation', ionstorm: 'ion storms', nebula: 'a blinding nebula' };
const PLANET_NAME: Record<string, string> = { rocky: 'a rocky world', ocean: 'an ocean world', gas: 'a gas giant', ice: 'an ice world', lava: 'a molten world', toxic: 'a toxic world', barren: 'a barren rock', crystal: 'a crystal world' };

/** total jump steps per voyage; the Heart is at step FINAL_STEP */
export const FINAL_STEP = 12;
/** steps at which the exodus squeezes through the Narrows */
export const NARROWS = [4, 8];

/** map a voyage step (0..FINAL_STEP) onto the danger tier (0..finalDepth) the content was written for */
export function tierOf(step: number, finalDepth: number): number {
  return Math.round((step * finalDepth) / FINAL_STEP);
}
/** first step whose tier reaches `tier` */
export function stepForTier(tier: number, finalDepth: number): number {
  for (let s = 0; s <= FINAL_STEP; s++) if (tierOf(s, finalDepth) >= tier) return s;
  return FINAL_STEP;
}

/** thread needed to weave these strands (0 strands = a frayed jump) */
export function weaveCost(run: RunState, strands: Strand[]): number {
  if (strands.length === 0) return 2;
  let c = 2 + strands.length * 2;
  for (const s of strands) if (s.kind === 'station' || s.kind === 'haven') c += 3;
  if (run.relics.includes('navigators_eye')) c -= 1;
  return Math.max(1, c);
}

/** weighted pick of a faction that would plausibly hold space at this depth */
function rollOwner(run: RunState, rng: RNG, step: number, frayed: boolean): Faction | null {
  const opts: { f: Faction | null; w: number }[] = [{ f: null, w: frayed ? 0.6 : 0.8 }];
  for (const f of run.factions.filter((x) => !broken(run, x.id))) {
    const c = run.fcenter?.[f.id] ?? FINAL_STEP / 2;
    const w = f.archetype === 'raider' ? 0.7 : Math.exp(-(((c - step) / 2.6) ** 2)) * (f.archetype === 'ancient' ? 0.8 : 1.3);
    opts.push({ f, w });
  }
  return rng.weighted(opts, (o) => o.w).f;
}

export interface WeaveResult {
  node: GNode;
  lines: string[]; // forecast lines
}

/**
 * Build the next system from the chosen strands. Deterministic for a given run/step/strand set,
 * so the forecast shown in the Loom is exactly what you get.
 */
export function weaveNode(run: RunState, strands: Strand[]): WeaveResult {
  const step = run.step + 1;
  const rng = new RNG(hashSeed(run.seed, 'weave', step, ...strands.map((s) => s.id)));
  const lines: string[] = [];
  const node: GNode = {
    id: run.nodes.length, col: step, row: 0, x: 0, y: 0, name: systemName(rng), kind: 'empty', hazard: 'none', owner: null, links: [], seed: rng.fork(), known: true, visited: false,
    planets: [], extras: [],
  };
  if (step >= FINAL_STEP) {
    node.kind = 'final';
    node.name = 'The Heart';
    lines.push('Every lane ends here. The Heart.');
    return { node, lines };
  }
  if (NARROWS.includes(step)) {
    // every lane converges here; strands cannot steer it, only colour it
    const holder = narrowsHolder(run);
    node.kind = 'narrows';
    node.name = `The ${['First', 'Second', 'Third'][NARROWS.indexOf(step)] ?? ''} Narrows`;
    node.owner = holder?.id ?? null;
    for (const p of strands) if (p.kind === 'planet' && p.planet) node.planets!.push(p.planet);
    const sc = strands.find((s) => s.kind === 'scar');
    if (sc) node.hazard = sc.hazard ?? 'none';
    lines.push('The Narrows: every lane in the Shoal pinches through here. Your strands cannot steer it.');
    lines.push(holder ? `${cap(holder.name)} are strongest, and will hold the passage.` : 'No one is left to hold it.');
    lines.push('The whole exodus will be here. So will the Tide, asking its due.');
    return { node, lines };
  }
  const frayed = strands.length === 0;
  const has = (k: StrandKind) => strands.filter((s) => s.kind === k);
  // owner
  const fs = has('faction');
  const st = [...has('station'), ...has('haven')];
  let owner: Faction | null = null;
  if (fs.length) owner = factionById(run, fs[0].faction ?? null);
  else if (st.length && st[0].faction) owner = factionById(run, st[0].faction);
  else owner = rollOwner(run, rng, step, frayed);
  node.owner = owner?.id ?? null;
  // a second, different faction strand: their ships come too
  const other = fs.find((s) => s.faction && s.faction !== node.owner);
  if (other) node.extras!.push('guest:' + other.faction);
  if (fs.length >= 2 && fs.every((s) => s.faction === fs[0].faction)) node.extras!.push('stronghold');
  // kind
  if (has('station').length) node.kind = 'station';
  else if (has('haven').length) node.kind = 'haven';
  else if (has('derelict').length) node.kind = 'derelict';
  else if (has('anomaly').length) node.kind = 'anomaly';
  else {
    const r = rng.next();
    if (frayed) node.kind = r < 0.38 ? 'hostile' : r < 0.52 ? 'derelict' : r < 0.64 ? 'anomaly' : r < 0.74 ? 'nebula' : r < 0.78 ? 'station' : 'empty';
    else node.kind = r < 0.3 ? 'hostile' : r < 0.4 ? 'nebula' : 'empty';
  }
  if (has('derelict').length && node.kind !== 'derelict') node.extras!.push('derelict');
  if (has('anomaly').length && node.kind !== 'anomaly') node.extras!.push('anomaly');
  // hazard
  const sc = has('scar');
  if (sc.length) node.hazard = sc[0].hazard ?? 'ionstorm';
  else if (node.kind === 'nebula') node.hazard = 'nebula';
  else node.hazard = rng.chance(frayed ? 0.45 : 0.15) ? rng.pick(['asteroids', 'radiation', 'ionstorm', 'asteroids'] as Hazard[]) : 'none';
  if (node.hazard === 'nebula' && node.kind !== 'nebula' && node.kind === 'empty') node.kind = 'nebula';
  if (sc.length) node.extras!.push('scarred');
  for (const p of has('planet')) if (p.planet) node.planets!.push(p.planet);
  if (has('wrack').length) node.extras!.push('wrack');
  // forecast text
  if (frayed) lines.push('Frayed: no strands to steer by. Anything could be waiting.');
  lines.push(owner ? `Held by ${owner.name} (${repLabel(run.rep[owner.id] ?? 0)})` : 'Unclaimed space');
  const KIND_LINE: Partial<Record<NodeKind, string>> = { station: 'A station: trade, repairs, crew.', haven: 'A quiet haven.', derelict: 'Wreckage adrift.', anomaly: 'Strange readings.', hostile: 'Armed patrols.', nebula: 'A nebula: sensors blinded.' };
  if (!frayed && KIND_LINE[node.kind]) lines.push(KIND_LINE[node.kind]!);
  if (!frayed) {
    if (other) lines.push(`${factionById(run, other.faction!)?.short ?? 'Other'} ships will be there too.`);
    if (node.extras!.includes('stronghold')) lines.push(`A ${owner?.short ?? ''} stronghold: more of them, and better guarded.`);
    for (const p of node.planets!) lines.push(`Around ${PLANET_NAME[p] ?? 'a world'} worth surveying.`);
    if (node.extras!.includes('derelict')) lines.push('Some wreckage too.');
    if (node.extras!.includes('anomaly')) lines.push('Something strange, too.');
    if (node.hazard !== 'none') lines.push(`${cap(HAZ_NAME[node.hazard])}${sc.length ? ' — scarred lanes pay better' : ''}.`);
    if (node.extras!.includes('wrack')) lines.push('A pocket of the Tide: rich salvage, and the Tide comes early.');
  } else if (node.hazard !== 'none') lines.push('Something unsettled in the lane.');
  return { node, lines };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

let strandUid = 1;
export function newStrand(run: RunState, s: Omit<Strand, 'id' | 'color'> & { color?: string }): Strand {
  strandUid = Math.max(strandUid, (run.strandUid ?? 0) + 1);
  const id = strandUid++;
  run.strandUid = id;
  return { ...s, id, color: s.color ?? STRAND_COLOR[s.kind] };
}

export const STRAND_HINT: Record<StrandKind, string> = {
  faction: 'their space', station: 'a station', haven: 'a haven', planet: 'that kind of world', derelict: 'wreckage', anomaly: 'something strange', scar: 'a hazard — pays better', wrack: 'a pocket of the Tide',
};

export type StrandSpec = Omit<Strand, 'id' | 'color'> & { color?: string; price: number };

/** a lacemaker's stall: strands spun from lanes they have walked */
export function lacemakerOffers(run: RunState, rng: RNG): StrandSpec[] {
  const out: StrandSpec[] = [];
  const base = 30 + run.depth * 10;
  const alive = run.factions.filter((f) => !broken(run, f.id));
  const kinds = ['rocky', 'ocean', 'gas', 'ice', 'lava', 'toxic', 'barren', 'crystal'];
  const pool: (() => StrandSpec)[] = [
    () => { const f = rng.pick(alive); return { kind: 'faction', label: `${f.short} lane`, faction: f.id, color: f.color, price: base }; },
    () => { const k = rng.pick(kinds); return { kind: 'planet', label: `${k[0].toUpperCase()}${k.slice(1)} world`, planet: k, price: base }; },
    () => { const h = rng.pick(['asteroids', 'radiation', 'ionstorm', 'nebula'] as Hazard[]); return { kind: 'scar', label: { asteroids: 'Rock-scar', radiation: 'Burn-scar', ionstorm: 'Storm-scar', nebula: 'Fog-scar', none: 'Scar' }[h], hazard: h, price: Math.round(base * 0.7) }; },
    () => ({ kind: 'derelict', label: 'Wreck-lane', price: base }),
    () => ({ kind: 'anomaly', label: 'Strange lane', price: base }),
    () => ({ kind: 'haven', label: 'Haven-lane', price: base * 2 }),
  ];
  const picks = rng.shuffle([...pool.keys()]).slice(0, 3);
  for (const i of picks) {
    if (i === 0 && !alive.length) continue;
    out.push(pool[i]());
  }
  return out;
}
