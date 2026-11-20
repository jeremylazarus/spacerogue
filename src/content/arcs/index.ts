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
import { LAST_WEAVER, LAST_WEAVER_EVENTS } from './last_weaver';
import { NARROWS_TRUCE, NARROWS_TRUCE_EVENTS } from './narrows_truce';
import { TIDEWALKER, TIDEWALKER_EVENTS } from './tidewalker';

export const ARCS: ArcDef[] = [
  SILENT_BEACON,
  SCHISM,
  THE_HUNT,
  HIVE_BLOOM,
  MIRROR_DEBT,
  ORIGIN,
  LAST_WEAVER,
  ...SIDES_A,
  ...SIDES_B,
  NARROWS_TRUCE,
  TIDEWALKER,
];

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
  ...LAST_WEAVER_EVENTS,
  ...NARROWS_TRUCE_EVENTS,
  ...TIDEWALKER_EVENTS,
];
