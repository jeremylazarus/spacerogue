import type { CodexEntry, EventDef } from '../../game/api';
import { ANOMALY_EVENTS } from './anomalies';
import { ARRIVAL_EVENTS } from './arrivals';
import { ASTEROID_EVENTS } from './asteroids';
import { DERELICT_EVENTS } from './derelicts';
import { DISTRESS_EVENTS } from './distress';
import { HAIL_EVENTS } from './hails';
import { PLANET_EVENTS } from './planets';
import { STATION_EVENTS } from './stations';
import { withMemory } from './util';

export const EVENTS: EventDef[] = [
  ...PLANET_EVENTS,
  ...DERELICT_EVENTS,
  ...ANOMALY_EVENTS,
  ...HAIL_EVENTS,
  ...STATION_EVENTS,
  ...DISTRESS_EVENTS,
  ...ASTEROID_EVENTS,
  ...ARRIVAL_EVENTS,
].map(withMemory);

export const EVENT_CODEX: CodexEntry[] = [
  {
    id: 'lore.choir',
    category: 'The Shoal',
    title: 'The Singing in the Lanes',
    body:
      'Every spacer in the Shoal has heard it: a chord beneath the hyperspace static, sustained and patient. Most call it superstition. Zealots call it the Song. Machines log it as an unclassified signal of improbable complexity. Hives say only that it is "loud" and "sad." Listen long enough and the chord resolves into voices. Thousands. Some of them say names.',
  },
  {
    id: 'lore.choir_moss',
    category: 'Xenobiology',
    title: 'Humming Moss',
    body:
      'A lichen-like organism found on quiet worlds. It does not produce sound; it resonates with ambient hyperspace static and amplifies it. Spectral analysis of the hum reveals compressed human-range voices holding a single pitch. The moss is harmless. Researchers who study it tend to request transfers.',
  },
  {
    id: 'lore.tide',
    category: 'The Shoal',
    title: 'The Tide',
    body:
      'The Shoal exhales. Lanes behind a traveller fold shut; systems once left fade from every scope. Old inscriptions treat this as weather. Navigators treat it as a rule: you can only go deeper. Nobody alive has seen a lane reopen.',
  },
  {
    id: 'lore.ledger',
    category: 'Wayfarers',
    title: 'The Ledgers',
    body:
      'Across the Shoal, in places that should not share anything, the same kind of book appears: a ledger of ships and captains, written in many hands. Some entries repeat. Some captains appear dozens of times, each under a different name, each in the same handwriting.',
  },
  {
    id: 'lore.echoes',
    category: 'Wayfarers',
    title: 'Echoes',
    body:
      'Wayfarers wake in cradle-pods with nothing but fragments. Yet they recognize hulls they never flew, voices they never heard, and their hands know controls before their minds do. Whatever brings them back does not bring them back clean. It brings back echoes.',
  },
  {
    id: 'lore.wardens',
    category: 'The Shoal',
    title: 'The Wardens',
    body:
      'Faceless ships with no heat signature and no engines anyone can find. They come for those who stay too long in one place. Their victims are not destroyed so much as smoothed: names scrubbed, weapons folded, as though corrected. The pattern of erasure is regular enough to be a signature.',
  },
  {
    id: 'lore.mimic',
    category: 'Xenobiology',
    title: 'Hull Mimics',
    body:
      'Ambush predators that grow skin in the shape of ships and broadcast lures learned from previous prey. Tell-tales: perfect condition, open airlocks, offers of free cargo, and a faint thermal pulse that is not a reactor. Rule of thumb: nothing in the Shoal is free.',
  },
  {
    id: 'lore.ancients',
    category: 'Peoples',
    title: 'The Elders',
    body:
      'Reclusive species older than the lanes themselves. They speak slowly, ask questions, and keep things: memories, mostly, which they accept as payment and never explain. They seem to remember the first Wayfarer. They do not volunteer what they remember.',
  },
  {
    id: 'lore.perseverance',
    category: 'History',
    title: 'The Perseverance',
    body:
      'A colony ship lost centuries ago with four thousand aboard. Its beacon promised to wait for rescue as long as it took. Its people did more than wait: they lived, for generations, inside the hull. Some say they were finally answered.',
  },
];
