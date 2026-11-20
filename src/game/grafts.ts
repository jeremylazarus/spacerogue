/**
 * Grafts: parts torn from bound ships and worn on your own hull. Each carries its makers' scent,
 * and every faction reads the silhouette you assemble. SPOILERS — design/DESIGN.md.
 */
import type { Aptitude, Faction, FactionArchetype } from './api';
import type { StatMod } from './items';
import type { RunState } from './run';

export type GraftArch = FactionArchetype | 'monster';

export interface GraftDef {
  id: string;
  arch: GraftArch;
  name: string;
  desc: string;
  mod?: StatMod;
  apt?: Partial<Record<Aptitude, number>>;
  /** behaviour key read by the engine */
  flag?: string;
}

export const GRAFTS: GraftDef[] = [
  { id: 'cargo_wing', arch: 'mercantile', name: 'Cargo Wing', desc: 'Credits you pick up are worth a quarter more. A little slower.', mod: { maxSpeed: -25 }, flag: 'cargo' },
  { id: 'appraiser', arch: 'mercantile', name: "Appraiser's Eye", desc: 'Better prices everywhere. Thinner shields.', mod: { priceMult: -0.15, maxShield: -10 }, apt: { guile: 1 } },
  { id: 'halo_lamp', arch: 'zealot', name: 'Halo-Lamp', desc: 'Shields mend sooner and faster. The reactor runs cooler.', mod: { shieldRegen: 5, shieldDelay: -0.6, energyRegen: -5 } },
  { id: 'pyre_censer', arch: 'zealot', name: 'Pyre Censer', desc: 'Every shot you fire sets its target burning. The hull scorches too.', mod: { maxHull: -15 }, flag: 'pyre' },
  { id: 'spit_gland', arch: 'hive', name: 'Spit Gland', desc: 'Spits slowing bile at the nearest enemy, all on its own.', flag: 'spit' },
  { id: 'regrowth_sac', arch: 'hive', name: 'Regrowth Sac', desc: 'The hull grows back. Shields resent it.', mod: { hullRegen: 1.1, maxShield: -15 } },
  { id: 'arc_lattice', arch: 'machine', name: 'Arc Lattice', desc: 'Kills discharge lightning into nearby enemies. Drinks a little energy.', mod: { maxEnergy: -15 }, flag: 'arc' },
  { id: 'logic_core', arch: 'machine', name: 'Logic Core', desc: 'Sharper engineering and science; abilities recharge faster. Talks less kindly.', mod: { abilityCdMult: -0.15 }, apt: { engineering: 1, science: 1, diplomacy: -1 } },
  { id: 'trophy_ram', arch: 'raider', name: 'Trophy Ram', desc: 'Collisions tear into them instead of you. Plating, but less shield.', mod: { armor: 1, maxShield: -10 }, flag: 'ram' },
  { id: 'skull_rack', arch: 'raider', name: 'Skull Rack', desc: 'Kills patch the hull. Hits harder. Not good company.', mod: { damageMult: 0.08 }, apt: { combat: 1, diplomacy: -1 }, flag: 'skulls' },
  { id: 'lens_shard', arch: 'ancient', name: 'Lens Shard', desc: 'Shots fly much further and faster. Weapons cycle a little slower.', mod: { rangeMult: 0.4, projSpeedMult: 0.2, fireRateMult: -0.08 } },
  { id: 'still_heart', arch: 'ancient', name: 'Still Heart', desc: 'The Tide is slower to find you, and abilities come back sooner. Smaller spools.', mod: { abilityCdMult: -0.15, maxThread: -8 }, flag: 'still' },
  { id: 'lane_tendril', arch: 'monster', name: 'Lane Tendril', desc: 'Spinning costs less thread; loops hold stronger ships. A thinner hull.', mod: { maxHull: -10 }, flag: 'tendril' },
  { id: 'brood_pouch', arch: 'monster', name: 'Brood Pouch', desc: 'Something small lives in it, and fights for you. You learn a little slower.', mod: { drones: 1, xpMult: -0.1 } },
];

export const graftDef = (id: string) => GRAFTS.find((g) => g.id === id)!;

export interface GraftInst {
  id: string;
  /** colours of the faction it came from (for the silhouette) */
  color: string;
  color2: string;
  /** source faction id ('' for beasts) */
  from: string;
}

export const HULL_SOCKETS: Record<string, number> = { skiff: 2, lancer: 2, bulwark: 3, weaver: 3, mirage: 2, dredger: 4, hollow: 3 };
export const GRAFT_HOLD = 4;

export function installed(run: RunState): GraftInst[] {
  return (run.grafts ?? []).filter((g): g is GraftInst => !!g);
}

export function hasGraftFlag(run: RunState, flag: string): boolean {
  return installed(run).some((g) => graftDef(g.id).flag === flag);
}

/** count of installed grafts per archetype */
export function scent(run: RunState): Partial<Record<GraftArch, number>> {
  const s: Partial<Record<GraftArch, number>> = {};
  for (const g of installed(run)) {
    const a = graftDef(g.id).arch;
    s[a] = (s[a] ?? 0) + 1;
  }
  return s;
}

/** how a faction reads the parts you wear: an adjustment on top of reputation, and why */
export function silhouette(run: RunState, f: Faction): { mod: number; why: string } {
  const sc = scent(run);
  const total = Object.values(sc).reduce((a, b) => a + (b ?? 0), 0);
  if (total === 0) return { mod: 0, why: '' };
  const own = sc[f.archetype as GraftArch] ?? 0;
  const others = total - own;
  const kinds = Object.keys(sc).length;
  switch (f.archetype) {
    case 'hive':
      return { mod: total * 6 + own * 6, why: own ? 'you carry their flesh: to them, you are becoming kin' : 'being worn is an honour to them' };
    case 'machine':
      return { mod: -own * 18 + others * 4, why: own ? 'you wear their dead, and they have counted every part' : 'they are curious about what you have bolted on' };
    case 'zealot':
      return { mod: -total * 8, why: 'they see a profaned hull' };
    case 'raider':
      return { mod: others * 6 - own * 20, why: own ? 'you wear their own crews as trophies' : 'they respect the trophies you carry' };
    case 'mercantile':
      return { mod: 0, why: 'they only see what your parts would fetch' };
    case 'ancient':
      if (kinds === 1) return { mod: 12, why: 'they respect a hull that has chosen one voice' };
      return { mod: -(kinds - 1) * 8, why: 'too many voices on one hull offends them' };
  }
  return { mod: 0, why: '' };
}

/** reputation as it actually counts: what you did, plus what you wear */
export function attitude(run: RunState, f: Faction): number {
  return Math.max(-100, Math.min(100, (run.rep[f.id] ?? 0) + silhouette(run, f).mod));
}

export function graftsMod(run: RunState): StatMod[] {
  return installed(run).map((g) => graftDef(g.id).mod ?? {});
}

export function graftApt(run: RunState, a: Aptitude): number {
  let v = 0;
  for (const g of installed(run)) v += graftDef(g.id).apt?.[a] ?? 0;
  return v;
}

export const GRAFT_ARCH_LABEL: Record<GraftArch, string> = { mercantile: 'Trader', zealot: 'Pilgrim', hive: 'Hive', machine: 'Machine', raider: 'Raider', ancient: 'Elder', monster: 'Lane-beast' };
