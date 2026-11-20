/**
 * The exodus: every faction is fleeing the Tide toward the Heart. Strength, ambitions, feuds,
 * and how the Narrows resolve them. SPOILERS — design/DESIGN.md.
 */
import { RNG, hashSeed } from '../core/rng';
import type { Faction, FactionArchetype } from './api';
import type { RunState } from './run';
import { NARROWS } from './weave';

export type AmbitionKind = 'hold' | 'crush' | 'reach' | 'shelter';
export interface Ambition {
  fid: string;
  kind: AmbitionKind;
  /** rival faction for 'crush' */
  target?: string;
  /** null = unresolved, true = achieved, false = failed */
  done: boolean | null;
}

/** archetype pairs that will fight each other on sight */
const FEUDS: [FactionArchetype, FactionArchetype][] = [
  ['zealot', 'machine'], ['hive', 'zealot'], ['hive', 'mercantile'], ['raider', 'mercantile'], ['raider', 'zealot'], ['machine', 'hive'], ['raider', 'machine'], ['ancient', 'hive'],
];

export function atWar(a: Faction | null, b: Faction | null): boolean {
  if (!a || !b || a.id === b.id) return false;
  return FEUDS.some(([x, y]) => (x === a.archetype && y === b.archetype) || (y === a.archetype && x === b.archetype));
}

const BASE_STR: Record<FactionArchetype, number> = { mercantile: 6, zealot: 5, hive: 6, machine: 5, raider: 6, ancient: 4 };

export function initExodus(run: RunState, rng: RNG) {
  run.strength = {};
  run.ambitions = [];
  for (const f of run.factions) {
    run.strength[f.id] = BASE_STR[f.archetype] + rng.range(-1, 1);
    const rivals = run.factions.filter((g) => atWar(f, g));
    const kinds: AmbitionKind[] = ['hold', 'reach', 'shelter'];
    if (rivals.length) kinds.push('crush', 'crush');
    const kind = rng.pick(kinds);
    run.ambitions.push({ fid: f.id, kind, target: kind === 'crush' ? rng.pick(rivals).id : undefined, done: null });
  }
}

export function strengthOf(run: RunState, fid: string): number {
  return run.strength?.[fid] ?? 5;
}

export function shiftStrength(run: RunState, fid: string, d: number) {
  if (!run.strength) return;
  run.strength[fid] = Math.max(0, Math.min(10, (run.strength[fid] ?? 5) + d));
}

export const broken = (run: RunState, fid: string) => strengthOf(run, fid) < 0.5;

export function ambitionText(run: RunState, a: Ambition): string {
  const f = run.factions.find((x) => x.id === a.fid);
  const t = a.target ? run.factions.find((x) => x.id === a.target) : null;
  const n = f?.short ?? '?';
  switch (a.kind) {
    case 'hold':
      return `The ${n} mean to hold the Narrows and charge the rest for passage.`;
    case 'crush':
      return `The ${n} want ${t ? t.name : 'their rivals'} broken before the Heart.`;
    case 'reach':
      return `The ${n} want to reach the Heart in strength.`;
    case 'shelter':
      return `The ${n} are trying to get their people through alive — they will need friends.`;
  }
}

/** a sentence of lane-chatter after a clash between two flotillas */
function clashLine(rng: RNG, a: Faction, b: Faction, aWon: boolean): string {
  const w = aWon ? a : b, l = aWon ? b : a;
  return rng.pick([
    `Lane-chatter: ${w.short} and ${l.short} flotillas clashed in the lanes behind you. The ${l.species} came off worse.`,
    `Wreckage on the lane-wind: the ${w.species} have mauled a ${l.short} convoy.`,
    `A ${l.short} distress call cuts off mid-word. ${w.short} ships were on the same lane.`,
  ]);
}

/**
 * One turn of the exodus, run as the player arrives in a new system.
 * Returns lines of news for the player.
 */
export function advanceExodus(run: RunState): string[] {
  if (!run.strength) return [];
  const rng = new RNG(hashSeed(run.seed, 'exodus', run.step));
  const news: string[] = [];
  const alive = run.factions.filter((f) => !broken(run, f.id));
  // the Tide takes stragglers from everyone
  for (const f of alive) shiftStrength(run, f.id, -0.12);
  // feuding flotillas meet
  const pairs: [Faction, Faction][] = [];
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) if (atWar(alive[i], alive[j])) pairs.push([alive[i], alive[j]]);
  if (pairs.length && rng.chance(0.55)) {
    const [a, b] = rng.pick(pairs);
    const sa = strengthOf(run, a.id), sb = strengthOf(run, b.id);
    const aWon = rng.chance(sa / (sa + sb || 1));
    shiftStrength(run, aWon ? b.id : a.id, -0.6);
    shiftStrength(run, aWon ? a.id : b.id, -0.15);
    news.push(clashLine(rng, a, b, aWon));
  }
  for (const f of run.factions) {
    if (broken(run, f.id) && !run.flags['broken.' + f.id]) {
      run.flags['broken.' + f.id] = true;
      news.push(`${f.name.replace(/^the /, 'The ')} ${f.name.startsWith('the ') ? 'are' : 'is'} broken. What is left of them scatters into the lanes.`);
    }
  }
  // crush ambitions can be settled early
  for (const a of run.ambitions ?? []) if (a.kind === 'crush' && a.done === null && a.target && broken(run, a.target)) a.done = true;
  return news;
}

/** who holds a Narrows: the strongest faction still standing */
export function narrowsHolder(run: RunState): Faction | null {
  let best: Faction | null = null;
  for (const f of run.factions) if (!broken(run, f.id) && (!best || strengthOf(run, f.id) > strengthOf(run, best.id))) best = f;
  return best;
}

/** settle what the Narrows decides */
export function resolveNarrows(run: RunState, holderId: string | null): string[] {
  const out: string[] = [];
  const holder = run.factions.find((f) => f.id === holderId) ?? narrowsHolder(run);
  if (holder) {
    shiftStrength(run, holder.id, 0.8);
    out.push(`${cap(holder.name)} hold the Narrows.`);
  }
  for (const a of run.ambitions ?? []) {
    if (a.done !== null) continue;
    if (a.kind === 'hold') {
      // holding any Narrows will do; only the last one can make it fail
      if (holder?.id === a.fid) a.done = true;
      else if (run.step >= NARROWS[NARROWS.length - 1]) a.done = false;
      else shiftStrength(run, a.fid, -0.2);
    }
  }
  return out;
}

/** at the Heart: who made it, and whose ambitions came true */
export function heartEpilogue(run: RunState): string {
  if (!run.strength) return '';
  const arrived = run.factions.filter((f) => strengthOf(run, f.id) >= 3);
  for (const a of run.ambitions ?? []) {
    if (a.done !== null) continue;
    if (a.kind === 'reach') a.done = strengthOf(run, a.fid) >= 5;
    else if (a.kind === 'shelter') a.done = strengthOf(run, a.fid) >= 2 && (run.rep[a.fid] ?? 0) >= 30;
    else if (a.kind === 'crush') a.done = !!a.target && strengthOf(run, a.target) < 1.5;
  }
  const won = (run.ambitions ?? []).filter((a) => a.done).map((a) => run.factions.find((f) => f.id === a.fid)?.short).filter(Boolean);
  const parts: string[] = [];
  if (arrived.length === 0) parts.push('No one else made it. The Heart is very quiet.');
  else parts.push(`Behind you, out of the closing lanes, come ${list(arrived.map((f) => f.name))}.`);
  if (won.length) parts.push(`The ${list(won as string[])} got what they came for.`);
  return parts.join(' ');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
}
