import { RNG } from '../core/rng';
import type { FactionArchetype } from './api';

interface Phon {
  on: string[]; // onsets
  nu: string[]; // nuclei
  co: string[]; // codas
  syl: [number, number];
  apos?: number; // chance of apostrophe join
}

const PHON: Record<FactionArchetype | 'neutral', Phon> = {
  mercantile: { on: ['v', 'l', 's', 'th', 'm', 'n', 'r', 'c', 'h', 'qu', 'b', 'd'], nu: ['e', 'a', 'i', 'ae', 'o', 'ia', 'ei'], co: ['', '', 'n', 'l', 's', 'nd', 'r', 'th'], syl: [2, 3] },
  zealot: { on: ['s', 'x', 'th', 'or', 'v', 'z', 'm', 'h', 'aur', 'c'], nu: ['a', 'o', 'u', 'ae', 'io', 'au'], co: ['', 'm', 'n', 'th', 'x', 'r', 'l', 'el'], syl: [2, 3] },
  hive: { on: ['k', 'z', 'x', 'tch', 'kk', 'q', 'sk', 'zz', 'ch', 'v'], nu: ['i', 'a', 'u', 'ee', 'aa', 'y'], co: ['k', 'x', 'th', 'zz', 'r', '', 'ch'], syl: [1, 3], apos: 0.45 },
  machine: { on: ['k', 't', 'd', 'v', 'x', 'r', 'n', 'z', 'p'], nu: ['o', 'e', 'a', 'i', 'u'], co: ['n', 'x', 'r', 't', 'k', 'd', ''], syl: [2, 2] },
  raider: { on: ['gr', 'k', 'br', 'dr', 'sk', 'v', 'r', 'g', 'z', 'm', 't'], nu: ['a', 'o', 'u', 'e', 'ar', 'or'], co: ['g', 'k', 'rk', 'sh', 'nd', 'z', 'x', 'r', 'll'], syl: [1, 2] },
  ancient: { on: ['y', 'w', 'l', 'h', 'n', 'el', 'is', 'sh', 'v'], nu: ['aa', 'ae', 'io', 'ua', 'e', 'i', 'ou', 'yo'], co: ['', '', 'l', 'n', 'th', 'r'], syl: [2, 3] },
  neutral: { on: ['k', 't', 'l', 'm', 'v', 's', 'r', 'n', 'd', 'b', 'c', 'h', 'p', 'g', 'z', 'th', 'tr', 'st'], nu: ['a', 'e', 'i', 'o', 'u', 'ae', 'y', 'ei', 'ou'], co: ['', '', 'n', 'r', 's', 'l', 'x', 'th', 'nd', 'm'], syl: [2, 3] },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function word(rng: RNG, style: FactionArchetype | 'neutral' = 'neutral', syl?: number): string {
  const p = PHON[style];
  const n = syl ?? rng.int(p.syl[0], p.syl[1]);
  let w = '';
  for (let i = 0; i < n; i++) {
    if (i > 0 && p.apos && rng.chance(p.apos * 0.5)) w += "'";
    w += rng.pick(p.on) + rng.pick(p.nu);
    if (i === n - 1 || rng.chance(0.3)) w += rng.pick(p.co);
  }
  w = w.replace(/(.)\1\1+/g, '$1$1').replace(/^'+|'+$/g, '');
  if (w.length < 3) w += rng.pick(p.nu) + rng.pick(p.co.filter((c) => c));
  return cap(w);
}

const POLITY: Record<FactionArchetype, string[]> = {
  mercantile: ['Concord', 'Exchange', 'Compact', 'Guildry', 'Syndicate', 'Combine', 'Mercy'],
  zealot: ['Choir-Faithful', 'Ascendancy', 'Pilgrimage', 'Litany', 'Sanctum', 'Covenant', 'Vigil'],
  hive: ['Bloom', 'Brood', 'Swarm', 'Chorus', 'Nest', 'Mass', 'Gathering'],
  machine: ['Lattice', 'Array', 'Consensus', 'Index', 'Protocol', 'Assembly', 'Engine'],
  raider: ['Clans', 'Reavers', 'Freehold', 'Blackflag', 'Tusks', 'Wake', 'Fleet'],
  ancient: ['Elders', 'Remnant', 'Patience', 'Watchers', 'Long Dream', 'Old Ones', 'Stillness'],
};
const LEADER: Record<FactionArchetype, string[]> = {
  mercantile: ['Factor', 'Matriarch', 'Chief Auditor', 'Magnate', 'Broker-Prime'],
  zealot: ['Hierarch', 'Saint', 'Cantor', 'Prophet', 'Abbess'],
  hive: ['the Mother-Voice', 'the Eldest Hunger', 'the Queen-Mind', 'the First Bud'],
  machine: ['Arbiter', 'Prime Node', 'Coordinator', 'Instance'],
  raider: ['Warlord', 'Captain-King', 'Boss', 'Old', 'Admiral'],
  ancient: ['the Rememberer', 'the One Who Waits', 'Elder', 'the Keeper'],
};
const SPECIES_SUFFIX: Record<FactionArchetype, string[]> = {
  mercantile: ['i', 'ans', 'ese', 'ari'],
  zealot: ['ites', 'ae', 'ians', 'im'],
  hive: ['', "'ka", 'ix', 'ra'],
  machine: ['-units', 'ics', 'oids', ''],
  raider: ['s', 'ers', 'ok', 'kin'],
  ancient: ['ai', 'ell', 'ou', 'ae'],
};

export interface FactionNames {
  name: string;
  short: string;
  species: string;
  leader: string;
}

export function factionNames(rng: RNG, arch: FactionArchetype): FactionNames {
  const root = word(rng, arch);
  const polity = rng.pick(POLITY[arch]);
  let species = root.replace(/[aeiouy]+$/i, '') + rng.pick(SPECIES_SUFFIX[arch]);
  if (species.length < 4) species = root + 's';
  const name = arch === 'machine' && rng.chance(0.5) ? `the ${root}-${rng.int(2, 99)} ${polity}` : `the ${root} ${polity}`;
  let leader = rng.pick(LEADER[arch]);
  if (!leader.startsWith('the ')) leader += ' ' + (arch === 'machine' ? `${word(rng, 'machine', 1).toUpperCase()}-${rng.int(1, 9)}` : word(rng, arch, 2));
  return { name, short: root, species, leader };
}

export function systemName(rng: RNG): string {
  const r = rng.next();
  if (r < 0.15) return `${word(rng, 'neutral', 2)} ${rng.pick(['Prime', 'Minor', 'Reach', 'Deep', 'Drift', 'Knot', 'Gate', 'Crossing'])}`;
  if (r < 0.3) return `${rng.pick(['Kappa', 'Tau', 'Sigma', 'Rho', 'Eta', 'Theta', 'Omicron', 'Zeta'])} ${word(rng, 'neutral', 2)}`;
  if (r < 0.4) return `${word(rng, 'neutral', 2)}'s ${rng.pick(['Rest', 'Folly', 'Lament', 'Hollow', 'Wake', 'Ember', 'Grave'])}`;
  return word(rng, 'neutral');
}

export function planetName(rng: RNG, sys: string, i: number): string {
  if (rng.chance(0.55)) return `${sys} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i] ?? i + 1}`;
  return word(rng, 'neutral');
}

const FIRST = ['Ilse', 'Doran', 'Mika', 'Tevo', 'Asha', 'Bram', 'Quill', 'Sena', 'Rook', 'Yara', 'Oskar', 'Wren', 'Juno', 'Cass', 'Nell', 'Pike', 'Sable', 'Ivo', 'Lark', 'Hollis', 'Rue', 'Tamsin', 'Edda', 'Kit'];
const LAST = ['Varga', 'Okoye', 'Lindqvist', 'Marr', 'Teller', 'Quan', 'Ashgrove', 'Petrov', 'Reyes', 'Hale', 'Moreau', 'Strand', 'Ibarra', 'Voss', 'Kade', 'Thorne', 'Sato', 'Bellweather'];

export function humanName(rng: RNG): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}
export function alienName(rng: RNG, arch: FactionArchetype): string {
  if (arch === 'machine') return `${word(rng, 'machine', 1).toUpperCase()}-${rng.int(10, 999)}`;
  if (arch === 'hive') return `${word(rng, 'hive', 2)}`;
  return `${word(rng, arch, 2)}${rng.chance(0.4) ? ' ' + word(rng, arch, 1) : ''}`;
}

const SHIP_A = ['Patient', 'Errant', 'Lantern', 'Second', 'Quiet', 'Last', 'Unfinished', 'Borrowed', 'Saltwater', 'Wandering', 'Stubborn', 'Grey', 'Ninth', 'Hollow', 'Bright'];
const SHIP_B = ['Heron', 'Promise', 'Ember', 'Verse', 'Moth', 'Anchor', 'Hymn', 'Thread', 'Margin', 'Compass', 'Kestrel', 'Reverie', 'Harrow', 'Lantern', 'Wake'];
export function shipName(rng: RNG): string {
  return `${rng.pick(SHIP_A)} ${rng.pick(SHIP_B)}`;
}
