import { RNG } from '../core/rng';
import type { RelicId } from './api';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
export interface Stats {
  maxHull: number;
  armor: number; // flat damage reduction per hit (min 1 dmg)
  maxShield: number;
  shieldRegen: number; // per second
  shieldDelay: number; // seconds after hit before regen
  maxEnergy: number;
  energyRegen: number;
  thrust: number; // accel px/s^2
  maxSpeed: number;
  damageMult: number;
  fireRateMult: number;
  projSpeedMult: number;
  rangeMult: number;
  critChance: number;
  critMult: number;
  pickupRange: number;
  scanRange: number;
  hullRegen: number; // per second
  boostMult: number; // afterburner strength
  abilityCdMult: number;
  dodge: number; // chance to ignore a projectile
  lifesteal: number; // fraction of damage dealt healed
  shieldDmgMult: number;
  drones: number; // count of combat drones
  pointDefense: number; // shots per second at missiles
  maxThread: number;
  energyCostMult: number;
  luck: number;
  priceMult: number;
  xpMult: number;
}

export function baseStats(): Stats {
  return {
    maxHull: 100, armor: 0, maxShield: 40, shieldRegen: 8, shieldDelay: 2.5, maxEnergy: 100, energyRegen: 28,
    thrust: 520, maxSpeed: 330, damageMult: 1, fireRateMult: 1, projSpeedMult: 1, rangeMult: 1, critChance: 0.05,
    critMult: 2, pickupRange: 140, scanRange: 900, hullRegen: 0, boostMult: 1, abilityCdMult: 1, dodge: 0,
    lifesteal: 0, shieldDmgMult: 1, drones: 0, pointDefense: 0, maxThread: 40, energyCostMult: 1, luck: 0, priceMult: 1, xpMult: 1,
  };
}

export type StatMod = { [K in keyof Stats]?: number };

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
export type WeaponKind = 'bullet' | 'rail' | 'missile' | 'beam' | 'mine' | 'arc' | 'flak' | 'wave' | 'lance';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  desc: string;
  damage: number;
  cooldown: number; // s
  energy: number;
  speed: number; // projectile px/s
  range: number; // px
  spread: number; // radians
  count: number; // projectiles per shot
  color: string;
  size: number;
  sfx: string;
  locked?: boolean; // must be unlocked via Legacy to appear in loot
}

export const WEAPONS: WeaponDef[] = [
  { id: 'pulse', name: 'Pulse Laser', kind: 'bullet', desc: 'Reliable, quick bolts.', damage: 9, cooldown: 0.16, energy: 4, speed: 900, range: 700, spread: 0.03, count: 1, color: '#6cf', size: 3, sfx: 'laser' },
  { id: 'scatter', name: 'Scatter Cannon', kind: 'bullet', desc: 'A fan of pellets. Brutal up close.', damage: 6, cooldown: 0.6, energy: 10, speed: 750, range: 420, spread: 0.45, count: 7, color: '#fc6', size: 2.5, sfx: 'scatter' },
  { id: 'rail', name: 'Rail Driver', kind: 'rail', desc: 'Slow to cycle. Pierces everything in a line.', damage: 48, cooldown: 1.2, energy: 22, speed: 2600, range: 1200, spread: 0, count: 1, color: '#bff', size: 3, sfx: 'rail' },
  { id: 'missile', name: 'Seeker Pod', kind: 'missile', desc: 'Homing missiles that find their own way.', damage: 26, cooldown: 0.9, energy: 14, speed: 430, range: 1100, spread: 0.5, count: 2, color: '#f96', size: 4, sfx: 'missile' },
  { id: 'beam', name: 'Lumen Beam', kind: 'beam', desc: 'A continuous beam. Drinks energy.', damage: 70, cooldown: 0.05, energy: 2.2, speed: 0, range: 520, spread: 0, count: 1, color: '#f6f', size: 4, sfx: 'beam_start' },
  { id: 'flak', name: 'Flak Mortar', kind: 'flak', desc: 'Shells burst into shrapnel at range.', damage: 8, cooldown: 0.75, energy: 12, speed: 620, range: 520, spread: 0.05, count: 1, color: '#fa4', size: 4, sfx: 'flak' },
  { id: 'mine', name: 'Mine Layer', kind: 'mine', desc: 'Leaves a trail of proximity mines.', damage: 45, cooldown: 0.8, energy: 10, speed: 60, range: 9999, spread: 0.3, count: 1, color: '#f44', size: 6, sfx: 'mine', locked: true },
  { id: 'arc', name: 'Arc Emitter', kind: 'arc', desc: 'Lightning that leaps between targets.', damage: 16, cooldown: 0.35, energy: 9, speed: 0, range: 380, spread: 0, count: 1, color: '#9df', size: 2, sfx: 'arc', locked: true },
  { id: 'wave', name: 'Resonance Wave', kind: 'wave', desc: 'Slow, widening rings that pass through ships.', damage: 20, cooldown: 0.7, energy: 14, speed: 340, range: 650, spread: 0, count: 1, color: '#8f8', size: 14, sfx: 'laser_heavy', locked: true },
  { id: 'lance', name: 'Gravity Lance', kind: 'lance', desc: 'Drags whatever it strikes toward you.', damage: 22, cooldown: 0.55, energy: 12, speed: 1100, range: 750, spread: 0, count: 1, color: '#a8f', size: 4, sfx: 'laser_heavy', locked: true },
];

// ---------------------------------------------------------------------------
// Utility modules
// ---------------------------------------------------------------------------
export interface UtilDef {
  id: string;
  name: string;
  desc: string;
  mod: StatMod; // base mods at common rarity
  locked?: boolean;
}

export const UTILS: UtilDef[] = [
  { id: 'shield', name: 'Shield Generator', desc: 'Stronger shields.', mod: { maxShield: 30, shieldRegen: 4 } },
  { id: 'armor', name: 'Ablative Plating', desc: 'Thicker hull.', mod: { maxHull: 35, armor: 1 } },
  { id: 'thruster', name: 'Vector Thrusters', desc: 'Faster and nimbler.', mod: { thrust: 140, maxSpeed: 60 } },
  { id: 'reactor', name: 'Fusion Reactor', desc: 'More energy, faster.', mod: { maxEnergy: 30, energyRegen: 10 } },
  { id: 'targeting', name: 'Targeting Suite', desc: 'Crits and accuracy.', mod: { critChance: 0.08, critMult: 0.3 } },
  { id: 'capacitor', name: 'Weapon Capacitor', desc: 'Harder-hitting weapons.', mod: { damageMult: 0.12 } },
  { id: 'loader', name: 'Autoloader', desc: 'Faster firing.', mod: { fireRateMult: 0.12 } },
  { id: 'nanites', name: 'Repair Nanites', desc: 'Slowly mends the hull.', mod: { hullRegen: 0.8 } },
  { id: 'tractor', name: 'Tractor Array', desc: 'Pulls in salvage from afar.', mod: { pickupRange: 160 } },
  { id: 'scanner', name: 'Deep Scanner', desc: 'See further; know more.', mod: { scanRange: 500 } },
  { id: 'dronebay', name: 'Drone Bay', desc: 'Launches an escort drone.', mod: { drones: 1 } },
  { id: 'pd', name: 'Point Defense', desc: 'Shoots down incoming missiles.', mod: { pointDefense: 2 } },
  { id: 'phase', name: 'Phase Veil', desc: 'Some shots pass harmlessly through.', mod: { dodge: 0.08 }, locked: true },
  { id: 'leech', name: 'Leech Coil', desc: 'Damage dealt repairs the hull.', mod: { lifesteal: 0.03 }, locked: true },
  { id: 'ion', name: 'Ion Inverter', desc: 'Shreds enemy shields.', mod: { shieldDmgMult: 0.4 }, locked: true },
  { id: 'fueltank', name: 'Spindle Rack', desc: 'Hold more thread.', mod: { maxThread: 12 } },
];

// ---------------------------------------------------------------------------
// Affixes
// ---------------------------------------------------------------------------
export interface AffixDef {
  id: string;
  name: string; // prefix for item name
  desc: string;
  slot: 'weapon' | 'utility' | 'any';
  /** weapon-local multipliers */
  w?: { damage?: number; cooldown?: number; energy?: number; speed?: number; range?: number; count?: number; spread?: number };
  /** global stat mods (for utilities, or weapon side effects) */
  mod?: StatMod;
  /** on-hit/special tags interpreted by the combat code */
  tag?: 'pierce' | 'seek' | 'burn' | 'cryo' | 'ion' | 'vamp' | 'volatile' | 'ricochet' | 'split' | 'crit';
}

export const AFFIXES: AffixDef[] = [
  { id: 'heavy', name: 'Heavy', desc: '+35% damage, slower cycle', slot: 'weapon', w: { damage: 1.35, cooldown: 1.15 } },
  { id: 'rapid', name: 'Rapid', desc: '+30% fire rate', slot: 'weapon', w: { cooldown: 0.77 } },
  { id: 'twin', name: 'Twinned', desc: '+1 projectile', slot: 'weapon', w: { count: 1, spread: 1.4 } },
  { id: 'long', name: 'Longshot', desc: '+40% range, faster shots', slot: 'weapon', w: { range: 1.4, speed: 1.25 } },
  { id: 'efficient', name: 'Efficient', desc: '-40% energy cost', slot: 'weapon', w: { energy: 0.6 } },
  { id: 'piercing', name: 'Piercing', desc: 'shots pass through targets', slot: 'weapon', tag: 'pierce' },
  { id: 'seeking', name: 'Seeking', desc: 'shots curve toward enemies', slot: 'weapon', tag: 'seek' },
  { id: 'incendiary', name: 'Incendiary', desc: 'sets targets burning', slot: 'weapon', tag: 'burn' },
  { id: 'cryo', name: 'Cryo', desc: 'slows targets', slot: 'weapon', tag: 'cryo' },
  { id: 'ionized', name: 'Ionized', desc: 'double damage to shields', slot: 'weapon', tag: 'ion' },
  { id: 'vampiric', name: 'Vampiric', desc: 'hits mend your hull', slot: 'weapon', tag: 'vamp' },
  { id: 'volatile', name: 'Volatile', desc: 'kills detonate', slot: 'weapon', tag: 'volatile' },
  { id: 'ricochet', name: 'Ricochet', desc: 'shots bounce to a new target', slot: 'weapon', tag: 'ricochet' },
  { id: 'splitting', name: 'Splitting', desc: 'shots split on impact', slot: 'weapon', tag: 'split' },
  { id: 'keen', name: 'Keen', desc: '+12% crit chance', slot: 'weapon', tag: 'crit' },
  { id: 'hardened', name: 'Hardened', desc: '+20 hull', slot: 'utility', mod: { maxHull: 20 } },
  { id: 'charged', name: 'Charged', desc: '+15 energy', slot: 'utility', mod: { maxEnergy: 15 } },
  { id: 'warded', name: 'Warded', desc: '+15 shield', slot: 'utility', mod: { maxShield: 15 } },
  { id: 'swift', name: 'Swift', desc: '+30 speed', slot: 'utility', mod: { maxSpeed: 30, thrust: 60 } },
  { id: 'lethal', name: 'Lethal', desc: '+6% damage', slot: 'utility', mod: { damageMult: 0.06 } },
  { id: 'quick', name: 'Quickened', desc: '+6% fire rate', slot: 'utility', mod: { fireRateMult: 0.06 } },
  { id: 'restoring', name: 'Restoring', desc: 'faster shield recharge', slot: 'utility', mod: { shieldRegen: 3, shieldDelay: -0.4 } },
  { id: 'focused', name: 'Focused', desc: 'abilities recharge faster', slot: 'utility', mod: { abilityCdMult: -0.1 } },
];

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Exotic', 'Mythic'];
export const RARITY_COLORS = ['#c8d0dc', '#6fe08a', '#5aa8ff', '#c77dff', '#ffb347'];
export const RARITY_MULT = [1, 1.12, 1.25, 1.42, 1.6];
const AFFIX_COUNT = [0, 1, 2, 2, 3];

export interface ModuleInst {
  uid: number;
  slot: 'weapon' | 'utility';
  defId: string;
  rarity: number;
  affixes: string[];
}

let uidCounter = 1;
export function setUidCounter(n: number) {
  uidCounter = Math.max(uidCounter, n);
}
export function nextUid() {
  return uidCounter++;
}

export const weaponDef = (id: string) => WEAPONS.find((w) => w.id === id)!;
export const utilDef = (id: string) => UTILS.find((u) => u.id === id)!;
export const affixDef = (id: string) => AFFIXES.find((a) => a.id === id)!;

export function moduleName(m: ModuleInst): string {
  const base = m.slot === 'weapon' ? weaponDef(m.defId).name : utilDef(m.defId).name;
  const pre = m.affixes.slice(0, 2).map((a) => affixDef(a).name).join(' ');
  return pre ? `${pre} ${base}` : base;
}

export function moduleValue(m: ModuleInst): number {
  return Math.round(40 * Math.pow(2.1, m.rarity) * (1 + m.affixes.length * 0.15));
}

export function rollRarity(rng: RNG, depth: number, luck = 0, min = 0): number {
  const r = rng.next() - luck * 0.05 - depth * 0.035;
  let rar = r < 0.02 ? 4 : r < 0.08 ? 3 : r < 0.25 ? 2 : r < 0.55 ? 1 : 0;
  return Math.max(min, Math.min(4, rar));
}

export function rollModule(rng: RNG, opts: { slot?: 'weapon' | 'utility'; rarity: number; unlocked: Set<string>; defId?: string }): ModuleInst {
  const slot = opts.slot ?? (rng.chance(0.5) ? 'weapon' : 'utility');
  const pool = slot === 'weapon' ? WEAPONS.filter((w) => !w.locked || opts.unlocked.has('mod.' + w.id)) : UTILS.filter((u) => !u.locked || opts.unlocked.has('mod.' + u.id));
  const def = opts.defId ?? rng.pick(pool as { id: string }[]).id;
  const affPool = AFFIXES.filter((a) => a.slot === slot || a.slot === 'any');
  const affixes: string[] = [];
  const n = AFFIX_COUNT[opts.rarity];
  let guard = 0;
  while (affixes.length < n && guard++ < 50) {
    const a = rng.pick(affPool).id;
    if (!affixes.includes(a)) affixes.push(a);
  }
  return { uid: nextUid(), slot, defId: def, rarity: opts.rarity, affixes };
}

/** Computed per-weapon firing stats. */
export interface WeaponStats {
  def: WeaponDef;
  damage: number;
  cooldown: number;
  energy: number;
  speed: number;
  range: number;
  spread: number;
  count: number;
  tags: Set<string>;
  critBonus: number;
}

export function weaponStats(m: ModuleInst): WeaponStats {
  const def = weaponDef(m.defId);
  const rm = RARITY_MULT[m.rarity];
  const s: WeaponStats = { def, damage: def.damage * rm, cooldown: def.cooldown, energy: def.energy, speed: def.speed, range: def.range, spread: def.spread, count: def.count, tags: new Set(), critBonus: 0 };
  for (const aid of m.affixes) {
    const a = affixDef(aid);
    if (a.w) {
      if (a.w.damage) s.damage *= a.w.damage;
      if (a.w.cooldown) s.cooldown *= a.w.cooldown;
      if (a.w.energy) s.energy *= a.w.energy;
      if (a.w.speed) s.speed *= a.w.speed;
      if (a.w.range) s.range *= a.w.range;
      if (a.w.count) s.count += def.kind === 'beam' || def.kind === 'arc' ? 0 : a.w.count;
      if (a.w.spread) s.spread = Math.max(s.spread, 0.08) * a.w.spread;
    }
    if (a.tag === 'crit') s.critBonus += 0.12;
    else if (a.tag) s.tags.add(a.tag);
  }
  return s;
}

export function utilMods(m: ModuleInst): StatMod {
  const def = utilDef(m.defId);
  const rm = RARITY_MULT[m.rarity];
  const out: StatMod = {};
  for (const [k, v] of Object.entries(def.mod)) (out as Record<string, number>)[k] = (v as number) * rm;
  for (const aid of m.affixes) {
    const a = affixDef(aid);
    if (a.mod) for (const [k, v] of Object.entries(a.mod)) (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (v as number);
  }
  return out;
}

export function describeModule(m: ModuleInst): string[] {
  const lines: string[] = [];
  if (m.slot === 'weapon') {
    const s = weaponStats(m);
    lines.push(s.def.desc);
    const dps = s.def.kind === 'beam' ? s.damage : (s.damage * s.count) / s.cooldown;
    lines.push(`Damage ${s.def.kind === 'beam' ? Math.round(s.damage) + '/s' : Math.round(s.damage) + (s.count > 1 ? ` ×${s.count}` : '')} · ${s.def.kind === 'beam' ? 'continuous' : (1 / s.cooldown).toFixed(1) + '/s'} · ≈${Math.round(dps)} dps`);
    lines.push(`Energy ${s.def.kind === 'beam' ? Math.round(s.energy / 0.05) + '/s' : Math.round(s.energy)} · Range ${Math.round(s.range === 9999 ? 0 : s.range) || '—'}`);
  } else {
    lines.push(utilDef(m.defId).desc);
    const mods = utilMods(m);
    lines.push(Object.entries(mods).map(([k, v]) => fmtMod(k, v as number)).join(' · '));
  }
  for (const a of m.affixes) lines.push(`◆ ${affixDef(a).name}: ${affixDef(a).desc}`);
  return lines;
}

const MOD_LABEL: Record<string, [string, boolean]> = {
  maxHull: ['hull', false], armor: ['armor', false], maxShield: ['shield', false], shieldRegen: ['shield regen', false], shieldDelay: ['s shield delay', false],
  maxEnergy: ['energy', false], energyRegen: ['energy regen', false], thrust: ['thrust', false], maxSpeed: ['speed', false], damageMult: ['damage', true],
  fireRateMult: ['fire rate', true], critChance: ['crit chance', true], critMult: ['crit damage', true], pickupRange: ['pickup range', false], scanRange: ['scan range', false],
  hullRegen: ['hull/s', false], drones: ['drone', false], pointDefense: ['point defense', false], dodge: ['evasion', true], lifesteal: ['lifesteal', true],
  shieldDmgMult: ['vs shields', true], abilityCdMult: ['ability cooldown', true], energyCostMult: ['energy cost', true], luck: ['fortune', false], priceMult: ['prices', true], xpMult: ['experience', true], maxThread: ['max thread', false], boostMult: ['boost', true], projSpeedMult: ['shot speed', true], rangeMult: ['range', true],
};
export function fmtMod(k: string, v: number): string {
  const [label, pct] = MOD_LABEL[k] ?? [k, false];
  const val = pct ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : `${v > 0 ? '+' : ''}${Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : Math.round(v)}`;
  return `${val} ${label}`;
}

// ---------------------------------------------------------------------------
// Hulls (ship frames)
// ---------------------------------------------------------------------------
export type AbilityId = 'blink' | 'overdrive' | 'bastion' | 'swarm' | 'cloak' | 'harpoon' | 'echo';

export interface HullDef {
  id: string;
  name: string;
  desc: string;
  weaponSlots: number;
  utilSlots: number;
  mod: StatMod;
  ability: AbilityId;
  abilityName: string;
  abilityDesc: string;
  abilityCd: number;
  size: number;
  colors: [string, string];
  startWeapons: string[];
  startUtils: string[];
}

export const HULLS: HullDef[] = [
  { id: 'skiff', name: 'Skiff', desc: 'A dependable little ship. Nothing to prove.', weaponSlots: 2, utilSlots: 2, mod: {}, ability: 'blink', abilityName: 'Blink', abilityDesc: 'Fold space and reappear toward the cursor.', abilityCd: 5, size: 34, colors: ['#8fb3d9', '#e8eef5'], startWeapons: ['pulse'], startUtils: ['shield'] },
  { id: 'lancer', name: 'Lancer', desc: 'All teeth and no armor.', weaponSlots: 3, utilSlots: 1, mod: { maxHull: -25, maxShield: -10, thrust: 120, maxSpeed: 50 }, ability: 'overdrive', abilityName: 'Overdrive', abilityDesc: 'Weapons fire twice as fast for a few seconds.', abilityCd: 14, size: 32, colors: ['#d96a5a', '#f2d0a0'], startWeapons: ['pulse', 'scatter'], startUtils: [] },
  { id: 'bulwark', name: 'Bulwark', desc: 'Slow, stubborn, and very hard to kill.', weaponSlots: 2, utilSlots: 3, mod: { maxHull: 60, armor: 2, maxShield: 20, thrust: -120, maxSpeed: -60 }, ability: 'bastion', abilityName: 'Bastion', abilityDesc: 'Restore shields and reflect incoming fire briefly.', abilityCd: 16, size: 44, colors: ['#7a8a6a', '#d8d2b0'], startWeapons: ['flak'], startUtils: ['armor', 'shield'] },
  { id: 'weaver', name: 'Weaver', desc: 'A carrier that never flies alone.', weaponSlots: 1, utilSlots: 3, mod: { drones: 2, maxShield: 10 }, ability: 'swarm', abilityName: 'Swarm', abilityDesc: 'Release a cloud of short-lived attack drones.', abilityCd: 15, size: 40, colors: ['#5ab0a0', '#e0f0d0'], startWeapons: ['pulse'], startUtils: ['dronebay'] },
  { id: 'mirage', name: 'Mirage', desc: 'Strike from nowhere.', weaponSlots: 2, utilSlots: 2, mod: { maxHull: -15, critChance: 0.1, critMult: 0.5 }, ability: 'cloak', abilityName: 'Phase Cloak', abilityDesc: 'Vanish. Enemies lose you. Your first shot strikes true.', abilityCd: 12, size: 32, colors: ['#8a6ad9', '#d0c0f5'], startWeapons: ['rail'], startUtils: ['targeting'] },
  { id: 'dredger', name: 'Dredger', desc: 'A salvage tug with a big hook.', weaponSlots: 2, utilSlots: 2, mod: { maxHull: 30, pickupRange: 200, thrust: -40 }, ability: 'harpoon', abilityName: 'Harpoon', abilityDesc: 'Spear a target and reel it in.', abilityCd: 7, size: 42, colors: ['#d9a84a', '#5a5a5a'], startWeapons: ['scatter'], startUtils: ['tractor'] },
  { id: 'hollow', name: 'Hollow', desc: 'It feels like you have flown this before.', weaponSlots: 3, utilSlots: 3, mod: { maxShield: -40, hullRegen: 1.5, maxHull: 20 }, ability: 'echo', abilityName: 'Echo', abilityDesc: 'Call back a past self to fight beside you.', abilityCd: 18, size: 38, colors: ['#e0e0f0', '#40ffd0'], startWeapons: ['pulse', 'missile'], startUtils: ['reactor'] },
];
export const hullDef = (id: string) => HULLS.find((h) => h.id === id)!;

// ---------------------------------------------------------------------------
// Relics
// ---------------------------------------------------------------------------
export const RELICS: Record<RelicId, { name: string; desc: string; mod?: StatMod }> = {
  echo_shard: { name: 'Echo Shard', desc: 'You carry more of yourself into the next life.' },
  mourning_bell: { name: 'Mourning Bell', desc: 'When your shields break, a shockwave rings out.' },
  hungry_coil: { name: 'Hungry Coil', desc: 'Destruction feeds your reactor.' },
  glass_heart: { name: 'Glass Heart', desc: 'Great power. A fragile frame.', mod: { damageMult: 0.4 } },
  navigators_eye: { name: "Navigator's Eye", desc: 'Weaving takes less thread.' },
  saints_tooth: { name: "Saint's Tooth", desc: 'Refuses your death, once in each system.' },
  rust_crown: { name: 'Rust Crown', desc: 'Raiders recognize one of their own.' },
  quiet_engine: { name: 'Quiet Engine', desc: 'You are harder to notice.' },
  gravity_pearl: { name: 'Gravity Pearl', desc: 'Things come to you.', mod: { pickupRange: 400 } },
  twin_comet: { name: 'Twin Comet', desc: 'Every so often, a comet joins your volley.' },
  ledger: { name: 'Ledger of Debts', desc: 'More money, from everything.' },
  thorn_lattice: { name: 'Thorn Lattice', desc: 'Ramming hurts them more than you.' },
  frozen_second: { name: 'Frozen Second', desc: 'Near death, time thickens.' },
  old_map: { name: 'Old Map', desc: 'Deeper spools of thread.', mod: { maxThread: 16 } },
  blood_battery: { name: 'Blood Battery', desc: 'Pain powers the reactor.' },
  pilgrim_lamp: { name: "Pilgrim's Lamp", desc: 'The faithful treat you kindly.' },
  fractal_seed: { name: 'Fractal Seed', desc: 'Kills sometimes shatter into shrapnel.' },
  warden_key: { name: "Warden's Key", desc: 'The Tide is slower to rise.' },
  hollow_idol: { name: 'Hollow Idol', desc: 'Wiser in all things. Something watches.' },
  starlit_compass: { name: 'Starlit Compass', desc: "Every system's secrets, laid bare." },
};
