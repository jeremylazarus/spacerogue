/**
 * CONTENT API — the contract between the engine and narrative content
 * (events, storylines/arcs, codex). Content files import ONLY from this file
 * (and '../core/rng' for the RNG type). The engine implements EventCtx.
 *
 * SPOILER NOTE: this project's owner plays the game blind. Never surface this
 * content in commit messages or chat.
 */
import type { RNG } from '../core/rng';

// ---------------------------------------------------------------------------
// World vocabulary
// ---------------------------------------------------------------------------

/** Aptitudes drive event skill checks. Sources: captain skills, officers, relics, modules. Typical range 0..6. */
export type Aptitude =
  | 'combat' // threats, intimidation, tactical reads
  | 'science' // scanning, anomalies, xenobiology, physics weirdness
  | 'engineering' // repairs, hacking machines, jury-rigging
  | 'diplomacy' // talking to aliens, negotiation, xenolinguistics
  | 'guile' // lying, smuggling, stealth, cons
  | 'salvage' // stripping wrecks, mining, finding value in junk
  | 'navigation'; // routes, hazards, hyperspace lore

export const APTITUDES: Aptitude[] = ['combat', 'science', 'engineering', 'diplomacy', 'guile', 'salvage', 'navigation'];

/**
 * Faction archetypes. Each run generates 4-5 factions with procedural names from these.
 * - mercantile: traders/guilds; pragmatic, money talks.
 * - zealot: theocratic pilgrims; faith, purity, prophecy; hostile to "the faithless" unless respected.
 * - hive: collective organisms; alien, hungry, communicate in strange ways; hard to reason with.
 * - machine: synthetic intelligences; logical, curious, trade in information; cold.
 * - raider: pirate clans; honor among thieves, tribute, bravado.
 * - ancient: rare, reclusive elder species; cryptic; enormous power; tests.
 * Always present each run: one 'raider' faction. Others vary.
 */
export type FactionArchetype = 'mercantile' | 'zealot' | 'hive' | 'machine' | 'raider' | 'ancient';

export interface Faction {
  id: string; // stable within a run, e.g. 'f2'
  archetype: FactionArchetype;
  /** Full polity name, e.g. "the Velisande Concord" (lowercase 'the' included when natural) */
  name: string;
  /** Short name / adjective, e.g. "Velisande" */
  short: string;
  /** Species/plural demonym, e.g. "Velisandi" */
  species: string;
  /** A named leader with title, e.g. "Matriarch Oonae" */
  leader: string;
  color: string;
  color2: string;
}

/** Special combat sides besides generated factions. */
export type SpecialSide = 'warden' | 'monster' | 'rogue';
// warden: enforcers that come for those who linger (lore: tied to the Tide/Choir; mysterious)
// monster: space fauna / horrors (no faction, no reputation)
// rogue: unaffiliated mercenaries/derelict automated defenses

export type OfficerRole = 'gunner' | 'engineer' | 'navigator' | 'xenologist' | 'medic' | 'quartermaster' | 'spy';
/** Each officer gives +2 to an aptitude: gunner→combat, engineer→engineering, navigator→navigation,
 * xenologist→diplomacy, medic→science, quartermaster→salvage, spy→guile. */
export interface Officer {
  id: string;
  name: string;
  role: OfficerRole;
  species: string;
  /** one-word personality trait, e.g. 'superstitious', 'greedy', 'kind', 'reckless' */
  trait: string;
}

/** Where an event can fire. */
export type Site =
  | 'planet' // player scans/lands on a planet
  | 'station' // "Visit the concourse" at a docked station
  | 'derelict' // board a wreck/drifting hulk
  | 'anomaly' // investigate a spatial anomaly
  | 'hail' // player hails a non-hostile ship (ctx.faction = that ship's faction)
  | 'arrival' // fires on entering a system (use sparingly, low weight)
  | 'distress' // a distress beacon POI
  | 'asteroid' // probing a large asteroid / rock field
  | 'marker'; // only via placeMarker (arc-specific); never randomly chosen

export type BossId =
  | 'leviathan' // vast space-beast; spawns brood
  | 'dreadnought' // warship bristling with turrets and a sweeping beam
  | 'warden_prime' // the warden commander
  | 'hive_queen' // hive mothership; endless drones
  | 'choir_avatar' // the deepest mystery
  | 'mirror'; // a twisted copy of the player's own ship

export interface CombatSpec {
  /** faction id (e.g. ctx.faction.id) or a special side */
  side: string | SpecialSide;
  /** number of ships; default scales with depth (~2-5) */
  count?: number;
  /** strength multiplier, default 1 (0.6 = weak, 1.5 = tough) */
  strength?: number;
  boss?: BossId;
  /** event id to fire when all spawned enemies are destroyed */
  afterVictory?: string;
  /** label shown to the player as a toast when combat starts */
  announce?: string;
}

export interface ItemQuery {
  slot?: 'weapon' | 'utility';
  /** 0 common, 1 uncommon, 2 rare, 3 exotic, 4 relic-grade */
  rarity?: number;
  /** if rarity omitted, rolls with this minimum */
  minRarity?: number;
}

/**
 * Relics: passive artifacts with odd effects. Content may grant specific ones by id.
 * The engine implements the effects. Names below are display names.
 */
export const RELIC_IDS = [
  'echo_shard', // "Echo Shard" — you carry more of yourself into the next life
  'mourning_bell', // "Mourning Bell" — when shields break, a shockwave rings out
  'hungry_coil', // "Hungry Coil" — destruction feeds your reactor
  'glass_heart', // "Glass Heart" — great power, fragile frame
  'navigators_eye', // "Navigator's Eye" — see further down the lanes
  'saints_tooth', // "Saint's Tooth" — refuses death, once per system
  'rust_crown', // "Rust Crown" — raiders recognize you as one of their own
  'quiet_engine', // "Quiet Engine" — harder to notice
  'gravity_pearl', // "Gravity Pearl" — things come to you
  'twin_comet', // "Twin Comet" — every so often, a comet joins your volley
  'ledger', // "Ledger of Debts" — more money from everything
  'thorn_lattice', // "Thorn Lattice" — ramming hurts them more than you
  'frozen_second', // "Frozen Second" — near death, time thickens
  'old_map', // "Old Map" — bigger fuel reserves
  'blood_battery', // "Blood Battery" — pain powers the reactor
  'pilgrim_lamp', // "Pilgrim's Lamp" — the faithful treat you kindly
  'fractal_seed', // "Fractal Seed" — kills sometimes shatter into shrapnel
  'warden_key', // "Warden's Key" — the enforcers are slower to come
  'hollow_idol', // "Hollow Idol" — wiser in all things, but something watches
  'starlit_compass', // "Starlit Compass" — every system's secrets laid bare
] as const;
export type RelicId = (typeof RELIC_IDS)[number];

// ---------------------------------------------------------------------------
// Event context — the engine implements this
// ---------------------------------------------------------------------------

export interface EventCtx {
  /** Deterministic RNG for this event instance. */
  rng: RNG;
  /** Current depth (galaxy column), 0..finalDepth. finalDepth is usually 7. */
  depth: number;
  finalDepth: number;
  /** Context faction: owner of the current system, or the hailed ship's faction. May be null in unclaimed space. */
  faction: Faction | null;
  /** All factions this run */
  factions: Faction[];
  /** Name of the current system and current POI (planet/station/etc.) */
  systemName: string;
  poiName: string;
  captainName: string;
  shipName: string;

  // --- reading state -------------------------------------------------------
  credits: number;
  fuel: number;
  hull: number; // current hull points
  maxHull: number;
  officers: Officer[];
  /** effective aptitude level (0..~8) */
  apt(a: Aptitude): number;
  /** officer of a given role, if aboard */
  officer(role?: OfficerRole): Officer | null;
  /** reputation with a faction, -100..100. <-30 hostile, >30 friendly */
  rep(factionId: string): number;
  hasRelic(id: RelicId): boolean;
  /** run-scoped flags (strings/numbers/booleans). undefined if unset */
  flag(name: string): string | number | boolean | undefined;
  setFlag(name: string, value: string | number | boolean): void;
  /** META flags persist across runs forever (for cross-run continuity). */
  metaFlag(name: string): string | number | boolean | undefined;
  setMetaFlag(name: string, value: string | number | boolean): void;
  /** number of times the player has started a run (1 on the first ever run) */
  runNumber: number;
  hasCodex(id: string): boolean;
  /** first faction matching archetype, or null */
  factionOf(archetype: FactionArchetype): Faction | null;

  /**
   * Skill check: returns true/false. Success chance = clamp(0.35 + 0.15*(apt - difficulty), 0.05, 0.95).
   * difficulty ~ 0 (easy) .. 5 (very hard). Automatically appends "[Science check: success]" style line.
   */
  check(a: Aptitude, difficulty: number): boolean;
  /** pure chance roll (no aptitude) */
  chance(p: number): boolean;

  // --- effects (each appends a visible outcome line automatically) --------
  gainCredits(n: number): void;
  loseCredits(n: number): void; // clamps at 0
  gainFuel(n: number): void;
  loseFuel(n: number): void;
  damageHull(n: number): void; // cannot kill outright; leaves at least 1 hull
  repairHull(n: number): void;
  gainXp(n: number): void; // typical: 10-60
  /** grants a ship module into cargo. Returns its display name. */
  giveItem(q?: ItemQuery): string;
  /** grants a relic (random unowned if id omitted). Returns display name, or null if none left. */
  giveRelic(id?: RelicId): string | null;
  /** removes a random cargo module, if any. Returns its name or null. */
  loseItem(): string | null;
  changeRep(factionId: string, delta: number): void; // typical ±5..±30
  /** generate and add a new officer (random role if omitted). Returns them. Max 4 aboard; returns null if full. */
  addOfficer(role?: OfficerRole, species?: string, name?: string): Officer | null; // pass name for story characters
  removeOfficer(id: string, reason?: string): void;
  /** reveal galaxy map node types up to n columns ahead */
  revealMap(columns: number): void;
  /** unlock a codex entry (persists across runs) */
  unlockCodex(id: string): void;
  /** queue a fight that starts when the event window closes */
  combat(spec: CombatSpec): void;
  /**
   * Place an arc site in a future system `colOffset` columns ahead (>=1), chosen among nodes reachable
   * from the current node. When the player flies to that POI and interacts, event `eventId` fires.
   * label: short map label, e.g. "Signal source". Returns false if impossible (e.g. past the end).
   */
  placeMarker(opts: { colOffset: number; eventId: string; label: string; kind?: 'beacon' | 'wreck' | 'station' | 'anomaly' | 'planet' }): boolean;
  /** Set the narrative objective text shown in the journal for an arc (replaces previous). '' clears. */
  journal(arcId: string, text: string): void;
  /** Main arcs: set which event fires at the finale site in the final system. */
  setFinale(eventId: string): void;
  /** End the run in victory, with an epilogue paragraph. */
  victory(epilogue: string): void;
  /** Queue another event to fire immediately after this one closes. */
  chain(eventId: string): void;
  /** Append an arbitrary italic narration line to the outcome area. */
  note(text: string): void;
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

/**
 * Text templates (replaced at display time) usable in ANY text/label string:
 *   {F}    faction full name ("the Velisande Concord")   — falls back to "the locals"
 *   {Fs}   faction short name ("Velisande")
 *   {Fsp}  species ("Velisandi")
 *   {Fl}   faction leader ("Matriarch Oonae")
 *   {sys}  current system name
 *   {poi}  current POI name
 *   {cap}  captain name
 *   {ship} ship name
 *   {off}  name of a random officer aboard (or "your first mate" if none)
 *   {off:engineer} etc — name of officer with that role (or "your crew")
 * For anything else, use a function returning a string.
 */
export type Text = string | ((ctx: EventCtx) => string);

export interface ChoiceDef {
  label: Text;
  /**
   * Requirements; if unmet the choice is shown greyed with the requirement visible
   * (e.g. "[Diplomacy 3]") unless hideIfUnmet.
   */
  req?: {
    apt?: Partial<Record<Aptitude, number>>;
    credits?: number;
    fuel?: number;
    officer?: OfficerRole;
    relic?: RelicId;
  };
  hideIfUnmet?: boolean;
  /** if returns false the choice is not shown at all */
  visible?: (ctx: EventCtx) => boolean;
  /**
   * Perform effects. Return the id of the next node, or undefined to end the event
   * (an end screen shows outcome lines with a "Continue" button).
   * Requirements with credits/fuel are NOT auto-deducted; deduct them yourself.
   */
  run?: (ctx: EventCtx) => string | void;
  /** shorthand when there are no effects: go straight to this node */
  next?: string;
}

export interface EventNode {
  text: Text;
  /** effects applied when entering the node (before choices are shown) */
  enter?: (ctx: EventCtx) => void;
  /** if empty/omitted the node is terminal: a single "Continue" ends the event */
  choices?: ChoiceDef[];
}

export interface EventDef {
  id: string; // globally unique, kebab or snake case
  /** Sites where this can randomly fire. Use ['marker'] for arc-only events. */
  sites: Site[];
  /** title shown at top of the dialog */
  title: Text;
  weight?: number; // default 1
  minDepth?: number;
  maxDepth?: number;
  /** only once per run (default false) */
  unique?: boolean;
  /** restrict to systems owned by these archetypes (or hails from them) */
  archetypes?: FactionArchetype[];
  condition?: (ctx: EventCtx) => boolean;
  /** portrait to show: 'faction' shows the context faction's alien; 'none' default */
  portrait?: 'faction' | 'none' | 'officer';
  start: string; // starting node id
  nodes: Record<string, EventNode>;
}

// ---------------------------------------------------------------------------
// Storyline arcs
// ---------------------------------------------------------------------------

export interface MetaView {
  runNumber: number;
  hasCodex(id: string): boolean;
  codexCount(prefix?: string): number;
  metaFlag(name: string): string | number | boolean | undefined;
  victories: number;
}

export interface ArcDef {
  id: string;
  /** journal heading */
  title: string;
  /**
   * main: exactly one main arc per run; it drives the finale (must call ctx.setFinale at some point,
   * ideally in begin()). side arcs: 0-2 per run, optional threads.
   */
  kind: 'main' | 'side';
  weight?: number;
  /** eligibility at run start (e.g. needs codex fragments from previous runs) */
  eligible?: (meta: MetaView) => boolean;
  /**
   * Called once when the arc activates. Main arcs activate at depth 0 on arrival (after the intro);
   * side arcs activate at the depth given by `activateAt` (default random 1-3) on system arrival.
   * Typically: place the first marker, write a journal line, maybe chain an intro event.
   */
  begin(ctx: EventCtx): void;
  activateAt?: number;
}

export interface CodexEntry {
  id: string; // e.g. 'lore.tide.1', 'frag.origin.3'
  /** category heading in the codex screen */
  category: string;
  title: string;
  body: string;
}
