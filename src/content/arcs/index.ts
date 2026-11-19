import type { ArcDef, EventDef } from '../../game/api';
import { WAKE } from './wake';
import { SILENT_BEACON, SILENT_BEACON_EVENTS } from './silent_beacon';
import { SCHISM, SCHISM_EVENTS } from './schism';
import { THE_HUNT, THE_HUNT_EVENTS } from './the_hunt';
import { HIVE_BLOOM, HIVE_BLOOM_EVENTS } from './hive_bloom';
import { MIRROR_DEBT, MIRROR_DEBT_EVENTS } from './mirror_debt';
import { ORIGIN, ORIGIN_EVENTS } from './origin';
import { SIDES_A, SIDES_A_EVENTS } from './sides_a';
import { SIDES_B, SIDES_B_EVENTS } from './sides_b';

export const ARCS: ArcDef[] = [SILENT_BEACON, SCHISM, THE_HUNT, HIVE_BLOOM, MIRROR_DEBT, ORIGIN, ...SIDES_A, ...SIDES_B];

export const ARC_EVENTS: EventDef[] = [
  WAKE,
  ...SILENT_BEACON_EVENTS,
  ...SCHISM_EVENTS,
  ...THE_HUNT_EVENTS,
  ...HIVE_BLOOM_EVENTS,
  ...MIRROR_DEBT_EVENTS,
  ...ORIGIN_EVENTS,
  ...SIDES_A_EVENTS,
  ...SIDES_B_EVENTS,
];
