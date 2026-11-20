/**
 * The Tide's toll at each Narrows: it reaches for one of the two finest things you carry. SPOILERS.
 */
import type { EventDef } from './api';
import type { RunState } from './run';
import { RELICS, moduleName, type ModuleInst } from './items';
import { graftDef } from './grafts';
import { NARROWS } from './weave';
import { meta, saveMeta } from './meta';

interface Valuable {
  name: string;
  worth: number;
  take: () => void;
  wrack: { kind: 'module' | 'relic' | 'graft'; data: unknown };
}

function valuables(run: RunState): Valuable[] {
  const out: Valuable[] = [];
  const mod = (arr: (ModuleInst | null)[], i: number) => {
    const m = arr[i];
    if (!m) return;
    out.push({ name: moduleName(m), worth: m.rarity * 1.2 + m.affixes.length * 0.4 + 0.5, take: () => {
      const j = arr.findIndex((x) => x?.uid === m.uid);
      if (j >= 0) arr[j] = null;
    }, wrack: { kind: 'module', data: m } });
  };
  run.weapons.forEach((_, i) => mod(run.weapons, i));
  run.utils.forEach((_, i) => mod(run.utils, i));
  for (const r of run.relics) out.push({ name: RELICS[r].name, worth: 4, take: () => (run.relics = run.relics.filter((x) => x !== r)), wrack: { kind: 'relic', data: r } });
  run.grafts.forEach((g) => {
    if (g) out.push({ name: graftDef(g.id).name, worth: 3.5, take: () => (run.grafts = run.grafts.map((x) => (x?.id === g.id ? null : x))), wrack: { kind: 'graft', data: g } });
  });
  // never take the last weapon: it would leave you unable to fight
  const weapons = run.weapons.filter(Boolean).length;
  return out.filter((v) => !(v.wrack.kind === 'module' && (v.wrack.data as ModuleInst).slot === 'weapon' && weapons <= 1)).sort((a, b) => b.worth - a.worth);
}

/** remember what the Tide took: it can wash up in another life */
function remember(v: Valuable) {
  const list = (meta.metaFlags['tide.wrack'] ? JSON.parse(String(meta.metaFlags['tide.wrack'])) : []) as unknown[];
  list.unshift(v.wrack);
  meta.metaFlags['tide.wrack'] = JSON.stringify(list.slice(0, 8));
  saveMeta();
}

export function tollEvent(run: RunState, refresh: () => void): EventDef | null {
  const vals = valuables(run);
  const idx = NARROWS.indexOf(run.step);
  const price = 12 + idx * 8; // whole spools (4 thread each)
  const [a, b] = vals;
  const paid = () => (run.flags['toll.' + run.step] = true);
  if (!vals.length) paid();
  const takeLine = (v: Valuable) => `It takes the ${v.name}. You feel the place it was, for a long time after.`;
  const def: EventDef = {
    id: 'engine.toll.' + run.step,
    sites: ['marker'],
    title: 'The Toll',
    start: 's',
    nodes: {
      s: {
        text: a
          ? `The lanes pinch to a single throat and the whole exodus is jammed into it, hull to hull. Behind everyone, the Tide leans close — close enough to touch the ships at the back.\n\nIt touches yours. It is not here for your life. It wants something you carry, and ${b ? `it has narrowed its choice to two: the ${a.name} or the ${b.name}.` : `it has settled on the ${a.name}.`}`
          : 'The lanes pinch to a single throat. The Tide leans close, looks your ship over, and finds nothing it wants. It lets you pass.',
        choices: a
          ? [
              { label: `Let it take the ${a.name}.`, run: (ctx) => { paid(); a.take(); remember(a); refresh(); ctx.note(takeLine(a)); } },
              ...(b ? [{ label: `Let it take the ${b.name}.`, run: (ctx: Parameters<NonNullable<EventDef['nodes'][string]['enter']>>[0]) => { paid(); b.take(); remember(b); refresh(); ctx.note(takeLine(b)); } }] : []),
              {
                label: `Bind ${b ? 'both' : 'it'} down with thread.`,
                req: { fuel: price / 4 },
                run: (ctx) => {
                  paid();
                  ctx.loseFuel(price / 4);
                  ctx.note('You spin knot after knot over everything you own. The Tide picks at them, considers, and lets go.');
                },
              },
              ...(run.strands.length >= 2
                ? [{
                    label: 'Feed it every strand on your Loom instead.',
                    run: (ctx: Parameters<NonNullable<EventDef['nodes'][string]['enter']>>[0]) => {
                      paid();
                      run.strands = [];
                      ctx.note('You unspool the Loom into the dark. The Tide takes the strands like a held breath, and is satisfied.');
                    },
                  }]
                : []),
            ]
          : undefined,
      },
    },
  };
  return def;
}
