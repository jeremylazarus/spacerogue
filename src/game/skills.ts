import type { Aptitude } from './api';
import type { StatMod } from './items';

export type TreeId = 'gunnery' | 'engineering' | 'wayfinding';
export interface SkillNode {
  id: string;
  tree: TreeId;
  name: string;
  desc: string;
  max: number;
  req?: string[]; // any one of these at rank >= 1
  col: number; // layout column 0..2
  row: number; // layout row 0..4
  mod?: StatMod; // per rank
  apt?: Partial<Record<Aptitude, number>>; // per rank
  flag?: string; // special behaviour key (rank >= 1)
}

export const TREES: { id: TreeId; name: string; color: string; blurb: string }[] = [
  { id: 'gunnery', name: 'Gunnery', color: '#ff7a6b', blurb: 'The art of making things stop.' },
  { id: 'engineering', name: 'Engineering', color: '#6bb8ff', blurb: 'Keeping the ship in one piece.' },
  { id: 'wayfinding', name: 'Wayfinding', color: '#ffd36b', blurb: 'Reading the lanes, and the people in them.' },
];

export const SKILLS: SkillNode[] = [
  // Gunnery
  { id: 'g_dmg', tree: 'gunnery', name: 'Steady Hands', desc: '+6% weapon damage per rank.', max: 3, col: 1, row: 0, mod: { damageMult: 0.06 } },
  { id: 'g_combat', tree: 'gunnery', name: 'Tactician', desc: '+1 Combat aptitude per rank.', max: 2, col: 0, row: 0, apt: { combat: 1 } },
  { id: 'g_range', tree: 'gunnery', name: 'Long Barrels', desc: '+10% range and shot speed per rank.', max: 2, col: 2, row: 0, mod: { rangeMult: 0.1, projSpeedMult: 0.1 } },
  { id: 'g_rate', tree: 'gunnery', name: 'Trigger Discipline', desc: '+6% fire rate per rank.', max: 3, req: ['g_dmg'], col: 1, row: 1, mod: { fireRateMult: 0.06 } },
  { id: 'g_crit', tree: 'gunnery', name: 'Weak Points', desc: '+5% critical chance per rank.', max: 3, req: ['g_dmg', 'g_range'], col: 2, row: 1, mod: { critChance: 0.05 } },
  { id: 'g_energy', tree: 'gunnery', name: 'Cold Barrels', desc: 'Weapons cost 8% less energy per rank.', max: 2, req: ['g_combat', 'g_dmg'], col: 0, row: 1, mod: { energyCostMult: -0.08 } },
  { id: 'g_ram', tree: 'gunnery', name: 'Ram Plating', desc: 'Collisions tear into enemies instead of you.', max: 1, req: ['g_energy'], col: 0, row: 2, flag: 'ram' },
  { id: 'g_overcharge', tree: 'gunnery', name: 'Overcharge', desc: 'While your shields are down, weapons fire 30% faster.', max: 1, req: ['g_rate'], col: 1, row: 2, flag: 'overcharge' },
  { id: 'g_crit2', tree: 'gunnery', name: 'Killing Blow', desc: '+40% critical damage per rank.', max: 2, req: ['g_crit'], col: 2, row: 2, mod: { critMult: 0.4 } },
  { id: 'g_exec', tree: 'gunnery', name: 'Executioner', desc: '+50% damage against badly damaged targets.', max: 1, req: ['g_crit2', 'g_overcharge'], col: 1, row: 3, flag: 'exec' },
  { id: 'g_storm', tree: 'gunnery', name: 'Storm of Steel', desc: 'Every 10th trigger pull of each weapon fires an extra volley.', max: 1, req: ['g_exec', 'g_ram'], col: 1, row: 4, flag: 'storm' },
  // Engineering
  { id: 'e_hull', tree: 'engineering', name: 'Reinforced Frame', desc: '+15 hull per rank.', max: 3, col: 0, row: 0, mod: { maxHull: 15 } },
  { id: 'e_shield', tree: 'engineering', name: 'Shield Tuning', desc: '+10 shield and faster recharge per rank.', max: 3, col: 1, row: 0, mod: { maxShield: 10, shieldRegen: 1.5 } },
  { id: 'e_eng', tree: 'engineering', name: 'Tinkerer', desc: '+1 Engineering aptitude per rank.', max: 2, col: 2, row: 0, apt: { engineering: 1 } },
  { id: 'e_armor', tree: 'engineering', name: 'Layered Armor', desc: '+1 armor per rank (reduces every hit).', max: 2, req: ['e_hull'], col: 0, row: 1, mod: { armor: 1 } },
  { id: 'e_energy', tree: 'engineering', name: 'Power Routing', desc: '+15 energy and +4 energy regen per rank.', max: 3, req: ['e_shield'], col: 1, row: 1, mod: { maxEnergy: 15, energyRegen: 4 } },
  { id: 'e_salvage', tree: 'engineering', name: 'Scrapper', desc: '+1 Salvage aptitude per rank. Wrecks give up more.', max: 2, req: ['e_eng'], col: 2, row: 1, apt: { salvage: 1 } },
  { id: 'e_regen', tree: 'engineering', name: 'Self-Repair', desc: 'Hull slowly mends: +0.4/s per rank.', max: 2, req: ['e_armor'], col: 0, row: 2, mod: { hullRegen: 0.4 } },
  { id: 'e_ability', tree: 'engineering', name: 'Capacitor Bank', desc: 'Ship ability recharges 12% faster per rank.', max: 2, req: ['e_energy'], col: 1, row: 2, mod: { abilityCdMult: -0.12 } },
  { id: 'e_drone', tree: 'engineering', name: 'Drone Wright', desc: 'An escort drone joins you.', max: 1, req: ['e_salvage'], col: 2, row: 2, mod: { drones: 1 } },
  { id: 'e_shunt', tree: 'engineering', name: 'Emergency Shunt', desc: 'Once per system, near death, shields flash back to full.', max: 1, req: ['e_regen', 'e_ability'], col: 0, row: 3, flag: 'shunt' },
  { id: 'e_pd', tree: 'engineering', name: 'Flak Screen', desc: 'Point defense against missiles. Drones hit harder.', max: 1, req: ['e_drone', 'e_ability'], col: 2, row: 3, mod: { pointDefense: 2 }, flag: 'dronedmg' },
  { id: 'e_overload', tree: 'engineering', name: 'Overload', desc: 'When your shields break, they detonate outward.', max: 1, req: ['e_shunt', 'e_pd'], col: 1, row: 4, flag: 'overload' },
  // Wayfinding
  { id: 'w_speed', tree: 'wayfinding', name: 'Light Touch', desc: '+20 speed and +35 thrust per rank.', max: 3, col: 0, row: 0, mod: { maxSpeed: 20, thrust: 35 } },
  { id: 'w_diplo', tree: 'wayfinding', name: 'Silver Tongue', desc: '+1 Diplomacy aptitude per rank.', max: 2, col: 1, row: 0, apt: { diplomacy: 1 } },
  { id: 'w_sci', tree: 'wayfinding', name: 'Curious Mind', desc: '+1 Science aptitude per rank.', max: 2, col: 2, row: 0, apt: { science: 1 } },
  { id: 'w_nav', tree: 'wayfinding', name: 'Lane Sense', desc: '+1 Navigation aptitude and +1 max fuel per rank.', max: 2, req: ['w_speed'], col: 0, row: 1, apt: { navigation: 1 }, mod: { maxFuel: 1 } },
  { id: 'w_guile', tree: 'wayfinding', name: "Smuggler's Grin", desc: '+1 Guile aptitude per rank.', max: 2, req: ['w_diplo'], col: 1, row: 1, apt: { guile: 1 } },
  { id: 'w_scan', tree: 'wayfinding', name: 'Wide Eyes', desc: 'Much longer scanner range. Learn 15% faster.', max: 1, req: ['w_sci'], col: 2, row: 1, mod: { scanRange: 400, xpMult: 0.15 } },
  { id: 'w_boost', tree: 'wayfinding', name: 'Slipstream', desc: 'Afterburner is 25% stronger per rank.', max: 2, req: ['w_nav'], col: 0, row: 2, mod: { boostMult: 0.25 } },
  { id: 'w_trade', tree: 'wayfinding', name: 'Haggler', desc: 'Prices 10% kinder per rank.', max: 2, req: ['w_guile'], col: 1, row: 2, mod: { priceMult: -0.1 } },
  { id: 'w_luck', tree: 'wayfinding', name: 'Fortune', desc: 'Salvage tends to be finer.', max: 2, req: ['w_scan'], col: 2, row: 2, mod: { luck: 1 } },
  { id: 'w_dodge', tree: 'wayfinding', name: 'Ghost Pilot', desc: '+6% chance for shots to miss you per rank.', max: 2, req: ['w_boost'], col: 0, row: 3, mod: { dodge: 0.06 } },
  { id: 'w_envoy', tree: 'wayfinding', name: 'Envoy', desc: 'Factions start warmer toward you. +1 Diplomacy and Guile.', max: 1, req: ['w_trade', 'w_luck'], col: 2, row: 3, apt: { diplomacy: 1, guile: 1 }, flag: 'envoy' },
  { id: 'w_drift', tree: 'wayfinding', name: 'Lane Drifter', desc: 'Jumps spool faster. Sometimes, lanes give back fuel.', max: 1, req: ['w_dodge', 'w_envoy'], col: 1, row: 4, flag: 'drift' },
];

export const skillById = (id: string) => SKILLS.find((s) => s.id === id)!;

/** xp needed to go from `level` to level+1 */
export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.35));
}
