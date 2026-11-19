import type { EventCtx, EventDef } from '../../game/api';

/** Scale a credit amount by depth: base * (1 + depth*0.3). */
export function cr(ctx: EventCtx, base: number): number {
  return Math.round(base * (1 + ctx.depth * 0.3));
}

/** Combat side for the context faction, falling back to unaffiliated mercs. */
export function side(ctx: EventCtx): string {
  return ctx.faction?.id ?? 'rogue';
}

/** Shift rep with the context faction, if any. */
export function rep(ctx: EventCtx, delta: number): void {
  if (ctx.faction) ctx.changeRep(ctx.faction.id, delta);
}

/** Faction-name helpers that work even when ctx.faction is null. */
export function fsp(ctx: EventCtx): string {
  return ctx.faction?.species ?? 'locals';
}

// ---------------------------------------------------------------------------
// Cross-run ship memory. `rememberShip` is called on entering any event from
// this pack (see index.ts). The previous life's ship/captain are derived purely.
// ---------------------------------------------------------------------------

export function rememberShip(ctx: EventCtx): void {
  const curRun = ctx.metaFlag('ev.curRun');
  if (curRun !== ctx.runNumber) {
    const s = ctx.metaFlag('ev.curShip');
    const c = ctx.metaFlag('ev.curCap');
    if (typeof s === 'string') ctx.setMetaFlag('ev.prevShip', s);
    if (typeof c === 'string') ctx.setMetaFlag('ev.prevCap', c);
    ctx.setMetaFlag('ev.curRun', ctx.runNumber);
  }
  ctx.setMetaFlag('ev.curShip', ctx.shipName);
  ctx.setMetaFlag('ev.curCap', ctx.captainName);
}

/** Name of the ship from a previous life, if known. */
export function prevShip(ctx: EventCtx): string | undefined {
  const key = ctx.metaFlag('ev.curRun') !== ctx.runNumber ? 'ev.curShip' : 'ev.prevShip';
  const v = ctx.metaFlag(key);
  return typeof v === 'string' && v !== ctx.shipName ? v : undefined;
}

export function prevCap(ctx: EventCtx): string | undefined {
  const key = ctx.metaFlag('ev.curRun') !== ctx.runNumber ? 'ev.curCap' : 'ev.prevCap';
  const v = ctx.metaFlag(key);
  return typeof v === 'string' ? v : undefined;
}

/** Wrap every event's start node so ship memory is recorded. */
export function withMemory(ev: EventDef): EventDef {
  const start = ev.nodes[ev.start];
  if (!start) return ev;
  const orig = start.enter;
  return {
    ...ev,
    nodes: {
      ...ev.nodes,
      [ev.start]: {
        ...start,
        enter: (ctx) => {
          rememberShip(ctx);
          if (orig) orig(ctx);
        },
      },
    },
  };
}
