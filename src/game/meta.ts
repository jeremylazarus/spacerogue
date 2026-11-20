/** Persistent cross-run progression (localStorage). */

export interface MetaSave {
  version: 1;
  echoes: number;
  totalEchoes: number;
  runs: number;
  victories: number;
  maxResonance: number; // highest unlocked difficulty level
  perks: Record<string, number>; // legacy purchases: id -> rank
  deeds: string[];
  codex: string[];
  metaFlags: Record<string, string | number | boolean>;
  life: { kills: number; deaths: number; bestDepth: number; bosses: number; systems: number };
  settings: { master: number; sfx: number; music: number; shake: boolean; damageNumbers: boolean };
  seenCodex: string[];
  lastShips: string[]; // names of previous ships, most recent first
  /** former selves who died in the Shoal and linger in it (SPOILERS) */
  remnants: Remnant[];
  /** crews you cut loose, by archetype: they remember */
  kindred: Record<string, number>;
}

const KEY = 'spacerogue.meta.v1';
const RUN_KEY = 'spacerogue.run.v1';

function fresh(): MetaSave {
  return {
    version: 1, echoes: 0, totalEchoes: 0, runs: 0, victories: 0, maxResonance: 0, perks: {}, deeds: [], codex: [], metaFlags: {},
    life: { kills: 0, deaths: 0, bestDepth: 0, bosses: 0, systems: 0 },
    settings: { master: 0.8, sfx: 0.8, music: 0.55, shake: true, damageNumbers: true },
    seenCodex: [], lastShips: [], remnants: [], kindred: {},
  };
}

export let meta: MetaSave = load();

function load(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const m = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...m, life: { ...f.life, ...m.life }, settings: { ...f.settings, ...m.settings } };
  } catch {
    return fresh();
  }
}

export function saveMeta() {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* storage full or unavailable */
  }
}

export function resetMeta() {
  meta = fresh();
  saveMeta();
  try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ }
}

export function saveRunRaw(json: string) {
  try {
    localStorage.setItem(RUN_KEY, json);
  } catch {
    /* ignore */
  }
}
export function loadRunRaw(): string | null {
  try { return localStorage.getItem(RUN_KEY); } catch { return null; }
}
export function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ }
}

export const perk = (id: string) => meta.perks[id] ?? 0;
export const hasDeed = (id: string) => meta.deeds.includes(id);

// ---------------------------------------------------------------------------
// Legacy shop
// ---------------------------------------------------------------------------
export interface LegacyItem {
  id: string;
  name: string;
  desc: string;
  costs: number[]; // per rank
  group: 'Ships' | 'Arsenal' | 'Inheritance';
  /** hidden from the shop until this deed is earned */
  needsDeed?: string;
}

export const LEGACY: LegacyItem[] = [
  { id: 'hull.lancer', name: 'Lancer', desc: 'A fast, fragile gunship with three weapon mounts.', costs: [60], group: 'Ships' },
  { id: 'hull.bulwark', name: 'Bulwark', desc: 'A slow fortress with heavy armor.', costs: [80], group: 'Ships' },
  { id: 'hull.dredger', name: 'Dredger', desc: 'A sturdy salvage tug with a harpoon.', costs: [100], group: 'Ships' },
  { id: 'hull.weaver', name: 'Weaver', desc: 'A drone carrier.', costs: [130], group: 'Ships' },
  { id: 'hull.mirage', name: 'Mirage', desc: 'A cloaking striker.', costs: [150], group: 'Ships' },
  { id: 'mod.mine', name: 'Mine Layer schematics', desc: 'Mine Layers can now be found.', costs: [45], group: 'Arsenal' },
  { id: 'mod.arc', name: 'Arc Emitter schematics', desc: 'Arc Emitters can now be found.', costs: [65], group: 'Arsenal' },
  { id: 'mod.wave', name: 'Resonance Wave schematics', desc: 'Resonance Waves can now be found.', costs: [70], group: 'Arsenal' },
  { id: 'mod.lance', name: 'Gravity Lance schematics', desc: 'Gravity Lances can now be found.', costs: [85], group: 'Arsenal' },
  { id: 'mod.phase', name: 'Phase Veil schematics', desc: 'Phase Veils can now be found.', costs: [60], group: 'Arsenal' },
  { id: 'mod.ion', name: 'Ion Inverter schematics', desc: 'Ion Inverters can now be found.', costs: [55], group: 'Arsenal' },
  { id: 'mod.leech', name: 'Leech Coil schematics', desc: 'Leech Coils can now be found.', costs: [80], group: 'Arsenal', needsDeed: 'deed.relics3' },
  { id: 'perk.credits', name: 'Hidden Stash', desc: '+60 starting credits per rank.', costs: [25, 50, 90], group: 'Inheritance' },
  { id: 'perk.hull', name: 'Scar Tissue', desc: '+15 max hull per rank.', costs: [40, 80, 130], group: 'Inheritance' },
  { id: 'perk.fuel', name: 'Lane Memory', desc: '+8 starting and max thread per rank.', costs: [40, 90], group: 'Inheritance' },
  { id: 'perk.skill', name: 'Muscle Memory', desc: '+1 starting skill point per rank.', costs: [50, 100, 170], group: 'Inheritance' },
  { id: 'perk.module', name: 'Heirloom', desc: 'Start with an extra module (rank 2: a better one).', costs: [60, 140], group: 'Inheritance' },
  { id: 'perk.officer', name: 'Old Friend', desc: 'Start with an officer aboard.', costs: [120], group: 'Inheritance' },
  { id: 'perk.relic', name: 'Keepsake', desc: 'Start with a random relic.', costs: [220], group: 'Inheritance', needsDeed: 'deed.boss' },
  { id: 'perk.echo', name: 'Resonant Mind', desc: '+10% Echoes earned per rank.', costs: [50, 110, 180], group: 'Inheritance' },
];

/** Deeds: hidden achievements. hint is shown (cryptically) once any deed exists. */
export const DEEDS: { id: string; name: string; hint: string; reward: string; echoes: number }[] = [
  { id: 'deed.depth3', name: 'Past the Shallows', hint: 'Go deeper.', reward: '+25 Echoes', echoes: 25 },
  { id: 'deed.depth6', name: 'Into the Deep', hint: 'Deeper still.', reward: '+50 Echoes', echoes: 50 },
  { id: 'deed.kills100', name: 'Hundred Wrecks', hint: 'Leave a trail of wreckage across your lives.', reward: 'The Lancer, free', echoes: 0 },
  { id: 'deed.boss', name: 'Giant-Killer', hint: 'Fell something enormous.', reward: 'A new inheritance', echoes: 40 },
  { id: 'deed.relics3', name: 'Collector', hint: 'Carry three strange things at once.', reward: 'New schematics', echoes: 20 },
  { id: 'deed.officers4', name: 'Full Table', hint: 'Fill every seat at your table.', reward: '+30 Echoes', echoes: 30 },
  { id: 'deed.win', name: 'The Heart', hint: 'Reach the end of a voyage.', reward: 'Resonance', echoes: 100 },
  { id: 'deed.frag3', name: 'Remembering', hint: 'Recover pieces of a first life.', reward: 'A familiar ship', echoes: 30 },
  { id: 'deed.rich', name: 'Hoard', hint: 'Hold a fortune.', reward: '+30 Echoes', echoes: 30 },
  { id: 'deed.pacifist', name: 'Light Footprint', hint: 'Cross four systems without destroying anything.', reward: '+40 Echoes', echoes: 40 },
  { id: 'deed.level10', name: 'Veteran', hint: 'Grow wise in a single life.', reward: '+40 Echoes', echoes: 40 },
  { id: 'deed.died_early', name: 'Cradle Robbed', hint: 'Fall almost immediately.', reward: '+10 Echoes', echoes: 10 },
];

export function hullUnlocked(id: string): boolean {
  if (id === 'skiff') return true;
  if (id === 'lancer' && hasDeed('deed.kills100')) return true;
  if (id === 'hollow') return hasDeed('deed.frag3');
  return perk('hull.' + id) > 0;
}

export function unlockedSet(): Set<string> {
  const s = new Set<string>();
  for (const [k, v] of Object.entries(meta.perks)) if (v > 0) s.add(k);
  return s;
}

export interface Remnant {
  ship: string;
  captain: string;
  hullId: string;
  depth: number;
  /** their best weapon at death (module instance JSON) */
  weapon: unknown;
  killerArch: string | null;
  killerName: string | null;
  run: number;
}
