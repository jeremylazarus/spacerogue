/**
 * Former selves. A Wayfarer who died in the Shoal lingers in it; later lives can meet them.
 * Also: kindred (crews you once cut loose) and what the Tide gives back. SPOILERS.
 */
import { RNG, hashSeed } from '../core/rng';
import type { EventDef, EventCtx, FactionArchetype } from './api';
import type { RunState } from './run';
import { meta, saveMeta, type Remnant } from './meta';
import { moduleName, nextUid, type ModuleInst } from './items';
import { NARROWS, FINAL_STEP } from './weave';
import { shiftStrength } from './exodus';
import { GRAFT_HOLD } from './grafts';

/** called once when a life ends */
export function rememberLife(run: RunState, won: boolean, abandoned: boolean, killer: { arch: string; name: string } | null) {
  // crews you released remember you
  for (const f of run.factions) {
    const n = Number(run.flags['released.' + f.id] ?? 0);
    if (n > 0) meta.kindred[f.archetype] = Math.min(9, (meta.kindred[f.archetype] ?? 0) + n);
  }
  if (!won && !abandoned && run.stats.systems > 0) {
    const ws = run.weapons.filter((m): m is ModuleInst => !!m).sort((a, b) => b.rarity - a.rarity);
    const r: Remnant = { ship: run.shipName, captain: run.captain, hullId: run.hullId, depth: run.depth, weapon: ws[0] ?? null, killerArch: killer?.arch ?? null, killerName: killer?.name ?? null, run: run.runNumber };
    meta.remnants = [r, ...(meta.remnants ?? [])].slice(0, 6);
  }
  saveMeta();
}

/** at the start of a life: maybe a former self is out there */
export function seedRemnant(run: RunState) {
  const rs = meta.remnants ?? [];
  if (!rs.length) return;
  const rng = new RNG(hashSeed(run.seed, 'remnant'));
  if (!rng.chance(0.6)) return;
  const steps = [2, 3, 5, 6, 7, 9, 10].filter((s) => !NARROWS.includes(s) && s < FINAL_STEP);
  run.flags['remnant.step'] = rng.pick(steps);
  run.flags['remnant.i'] = rng.pick(rs).run;
}

export function remnantEvent(run: RunState, refresh: () => void): EventDef | null {
  const r = (meta.remnants ?? []).find((x) => x.run === Number(run.flags['remnant.i'] ?? -1));

  if (!r) return null;
  const consume = () => {
    meta.remnants = meta.remnants.filter((x) => x !== r);
    saveMeta();
  };
  const weapon = r.weapon as ModuleInst | null;
  const giveWeapon = (ctx: EventCtx) => {
    if (!weapon) return;
    // their gear has drifted with them; it comes back no better than this depth allows
    const m: ModuleInst = { ...weapon, uid: nextUid(), rarity: Math.min(weapon.rarity, run.depth + 1) };
    run.cargo.push(m);
    ctx.note(`They pass you the ${moduleName(m)}. It still has your grip worn into it.`);
    refresh();
  };
  const killer = r.killerArch && r.killerArch !== 'tide' ? run.factions.find((f) => f.archetype === (r.killerArch as FactionArchetype)) : null;
  const how = r.killerName ? `scored where ${r.killerName} finished it` : 'scored by something you do not remember';
  return {
    id: 'engine.remnant.' + r.run,
    sites: ['marker'],
    title: `The ${r.ship}`,
    start: 's',
    nodes: {
      s: {
        text: `A hail on a frequency nobody uses any more. The ship that answers is the ${r.ship}, its hull ${how}, deep in the Shoal.\n\nThe voice is ${r.captain}'s. It is also, very nearly, yours.\n\n"You again," it says. "Still running?"`,
        choices: [
          {
            label: 'Ask what it remembers.',
            run: (ctx) => {
              consume();
              if (ctx.check('diplomacy', 2)) {
                run.flags['remnant.reconciled'] = true;
                ctx.unlockCodex('lore.remnant');
                ctx.note('"Not much. A lane. A choice I made too late." It is quiet a while. "Take this. I am done with it."');
                giveWeapon(ctx);
                ctx.gainXp(40);
                return;
              }
              ctx.note('It starts to answer, and then the signal frays. When it comes back, the ship is gone.');
            },
          },
          {
            label: 'Offer it something to carry. (60¢)',
            req: { credits: 60 },
            run: (ctx) => {
              consume();
              ctx.loseCredits(60);
              run.flags['remnant.reconciled'] = true;
              ctx.unlockCodex('lore.remnant');
              ctx.note('"Strange gift, for a ghost." But it takes it, and gives back what it has.');
              giveWeapon(ctx);
            },
          },
          ...(killer
            ? [{
                label: `Tell it the ${killer.species} are here too.`,
                run: (ctx: EventCtx) => {
                  consume();
                  shiftStrength(run, killer.id, -1.2);
                  ctx.note(`It says nothing. It turns toward the ${killer.short} lanes and goes. Later, you hear the lane-chatter: something has been hunting ${killer.short} ships, and it does not stop.`);
                },
              }]
            : []),
          {
            label: 'It is wearing your face. End it.',
            run: (ctx) => {
              consume();
              run.flags['remnant.weapon'] = weapon ? JSON.stringify(weapon) : '';
              ctx.combat({ side: 'rogue', count: 1, strength: 2.4, announce: `The ${r.ship} comes about.`, afterVictory: 'engine.remnant.won' });
              run.flags['remnant.weapon'] = weapon ? JSON.stringify(weapon) : '';
            },
          },
        ],
      },
    },
  };
}

/** the run the remnant fight belongs to (set by the game when a run starts or continues) */
let liveRun: RunState | null = null;
export function setRemnantRun(run: RunState | null) {
  liveRun = run;
}

export const REMNANT_WON: EventDef = {
  id: 'engine.remnant.won',
  sites: ['marker'],
  title: 'Quiet',
  start: 's',
  nodes: {
    s: {
      text: 'It breaks apart without a sound. In the wreck, nothing you would want to keep — except one thing, which you were always going to take.',
      enter: (ctx) => {
        const run = liveRun;
        const raw = run?.flags['remnant.weapon'];
        if (run && raw) {
          const w = JSON.parse(String(raw)) as ModuleInst;
          const m: ModuleInst = { ...w, uid: nextUid(), rarity: Math.min(4, Math.max(w.rarity, Math.min(run.depth + 1, w.rarity + 1))) };
          run.cargo.push(m);
          run.flags['remnant.weapon'] = '';
          ctx.note(`You pull the ${moduleName(m)} from the wreck. It still has your grip worn into it.`);
        } else ctx.giveItem({ slot: 'weapon', minRarity: 1 });
        ctx.unlockCodex('lore.remnant');
      },
    },
  },
};

/** what the Tide took in another life, washing up again */
export function wrackReturn(run: RunState): string | null {
  const raw = meta.metaFlags['tide.wrack'];
  if (!raw) return null;
  const list = JSON.parse(String(raw)) as { kind: string; data: unknown }[];
  // the newest thing that can actually come back
  const idx = list.findIndex((it) => {
    if (it.kind === 'module') return run.cargo.length < 12;
    if (it.kind === 'relic') return !run.relics.includes(it.data as RunState['relics'][number]);
    if (it.kind === 'graft') {
      const g = it.data as RunState['graftHold'][number];
      return run.graftHold.length < GRAFT_HOLD && ![...run.graftHold, ...run.grafts].some((x) => x?.id === g.id);
    }
    return false;
  });
  if (idx < 0) return null;
  const [it] = list.splice(idx, 1);
  meta.metaFlags['tide.wrack'] = JSON.stringify(list);
  saveMeta();
  if (it.kind === 'module') {
    const m = it.data as ModuleInst;
    run.cargo.push({ ...m, uid: nextUid(), rarity: Math.min(m.rarity, run.depth + 1) });
    return moduleName(m);
  }
  if (it.kind === 'relic') {
    run.relics.push(it.data as RunState['relics'][number]);
    return 'a relic you once carried';
  }
  run.graftHold.push(it.data as RunState['graftHold'][number]);
  return 'a graft you once wore';
}
