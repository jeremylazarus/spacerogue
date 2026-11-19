/**
 * Shared helpers for storyline arcs. Content-only; imports nothing but the content API.
 */
import type { ChoiceDef, EventCtx, EventNode, Faction, FactionArchetype, Text } from '../../game/api';

/** Resolve a Text to a string. */
export function txt(t: Text, ctx: EventCtx): string {
  return typeof t === 'function' ? t(ctx) : t;
}

const NOBODY: Faction = {
  id: '',
  archetype: 'mercantile',
  name: 'the locals',
  short: 'local',
  species: 'locals',
  leader: 'the Harbourmaster',
  color: '#8899aa',
  color2: '#445566',
};

/** First faction matching the archetype preference list, skipping excluded ids; never null. */
export function pickFaction(ctx: EventCtx, prefs: FactionArchetype[], exclude: string[] = []): Faction {
  for (const a of prefs) {
    const f = ctx.factions.find((x) => x.archetype === a && !exclude.includes(x.id));
    if (f) return f;
  }
  return ctx.factions.find((x) => !exclude.includes(x.id)) ?? ctx.factions[0] ?? NOBODY;
}

/** Remember a faction for an arc under a flag key. */
export function bindFaction(ctx: EventCtx, key: string, f: Faction): Faction {
  ctx.setFlag(key, f.id);
  return f;
}

/** Look up the faction stored under a flag key (falls back sensibly). */
export function factionAt(ctx: EventCtx, key: string, prefs: FactionArchetype[] = ['mercantile']): Faction {
  const id = ctx.flag(key);
  const f = ctx.factions.find((x) => x.id === id);
  return f ?? pickFaction(ctx, prefs);
}

/** changeRep that tolerates the fallback faction. */
export function rep(ctx: EventCtx, f: Faction, delta: number): void {
  if (f.id) ctx.changeRep(f.id, delta);
}

/** Combat side for a faction, with a fallback for the placeholder. */
export function sideOf(f: Faction, fallback: 'rogue' | 'monster' | 'warden' = 'rogue'): string {
  return f.id || fallback;
}

export function num(ctx: EventCtx, name: string): number {
  const v = ctx.flag(name);
  return typeof v === 'number' ? v : 0;
}

export function bump(ctx: EventCtx, name: string, by = 1): number {
  const v = num(ctx, name) + by;
  ctx.setFlag(name, v);
  return v;
}

export function is(ctx: EventCtx, name: string): boolean {
  return !!ctx.flag(name);
}

/** How many origin fragments the player holds (persists across runs). */
export function fragCount(ctx: EventCtx): number {
  let n = 0;
  for (let i = 1; i <= 7; i++) if (ctx.hasCodex(`frag.origin.${i}`)) n++;
  return n;
}

/**
 * Unlock a fragment if not already held and the player holds at least `need` others.
 * Returns true if it was newly unlocked.
 */
export function fragment(ctx: EventCtx, i: number, need = 0): boolean {
  const id = `frag.origin.${i}`;
  if (ctx.hasCodex(id) || fragCount(ctx) < need) return false;
  ctx.unlockCodex(id);
  ctx.note('Something surfaces from a life you do not remember living. (Codex updated.)');
  return true;
}

/** Unlock the lowest-numbered fragment still missing. */
export function nextFragment(ctx: EventCtx): boolean {
  for (let i = 1; i <= 7; i++) if (fragment(ctx, i)) return true;
  return false;
}

/** Unlock a codex entry only once (avoid repeat notes). */
export function lore(ctx: EventCtx, id: string): void {
  if (!ctx.hasCodex(id)) ctx.unlockCodex(id);
}

// ---------------------------------------------------------------------------
// Staged marker sites
// ---------------------------------------------------------------------------
// Every arc uses a single "site" event for its markers. Whichever marker the
// player reaches plays the next unplayed stage, so missing a marker never
// strands the arc; spare markers play a short "spent" node.

export function stageOf(ctx: EventCtx, arc: string): number {
  return num(ctx, `arc.${arc}.stage`);
}

/** Mark the current stage done and drop markers for the next one. */
export function advance(
  ctx: EventCtx,
  arc: string,
  site: { eventId: string; label: string; kind?: 'beacon' | 'wreck' | 'station' | 'anomaly' | 'planet' },
  total: number,
  offsets: number[] = [1, 2],
): void {
  const s = bump(ctx, `arc.${arc}.stage`);
  if (s >= total) return;
  placeMarkers(ctx, site, offsets);
}

/** Mark an arc's final stage done so spare markers play the 'spent' node. */
export function finish(ctx: EventCtx, arc: string): void {
  ctx.setFlag(`arc.${arc}.stage`, 99);
}

export function placeMarkers(
  ctx: EventCtx,
  site: { eventId: string; label: string; kind?: 'beacon' | 'wreck' | 'station' | 'anomaly' | 'planet' },
  offsets: number[],
): void {
  for (const o of offsets) {
    if (ctx.depth + o > ctx.finalDepth) continue;
    ctx.placeMarker({ colOffset: o, eventId: site.eventId, label: site.label, kind: site.kind });
  }
}

/**
 * Build a start node that presents stage `i` (by the arc's stage flag), or `spent`
 * once all stages are done. Stage nodes may route to other nodes in the same event.
 * Note: stage nodes must not change the stage flag inside `enter`.
 */
export function staged(arc: string, stages: EventNode[], spent: EventNode): EventNode {
  const all = [...stages, spent];
  const idx = (ctx: EventCtx) => Math.min(stageOf(ctx, arc), stages.length);
  return {
    text: (ctx) => txt(all[idx(ctx)].text, ctx),
    enter: (ctx) => all[idx(ctx)].enter?.(ctx),
    choices: all.flatMap((n, i) => {
      const cs: ChoiceDef[] = n.choices && n.choices.length ? n.choices : [{ label: 'Continue' }];
      return cs.map((c) => ({
        ...c,
        visible: (ctx: EventCtx) => idx(ctx) === i && (c.visible ? c.visible(ctx) : true),
      }));
    }),
  };
}

/** Officer name or a fallback phrase. */
export function offName(ctx: EventCtx, fallback = 'your first mate'): string {
  return ctx.officers[0]?.name ?? fallback;
}
