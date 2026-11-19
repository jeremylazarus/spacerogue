import type { EventCtx, EventDef } from '../../game/api';

/** Remember the previous life's ship/captain for cross-run callbacks (read prev_*, write last_*). */
function rememberLife(ctx: EventCtx): void {
  const lastShip = ctx.metaFlag('last_ship');
  const lastCap = ctx.metaFlag('last_captain');
  if (typeof lastShip === 'string') ctx.setMetaFlag('prev_ship', lastShip);
  if (typeof lastCap === 'string') ctx.setMetaFlag('prev_captain', lastCap);
  ctx.setMetaFlag('last_ship', ctx.shipName);
  ctx.setMetaFlag('last_captain', ctx.captainName);
}

function ending(ctx: EventCtx): 'freed' | 'bound' | 'broken' | null {
  // the most recent ending wins
  const last = ctx.metaFlag('ending.last');
  if (last === 'freed' || last === 'bound' || last === 'broken') return last;
  return null;
}

const LATER: ((ctx: EventCtx) => string)[] = [
  (c) => `The cradle unseals with a sigh you have heard ${c.runNumber - 1} times before.\n\nYou know where the lights are. You know which panel sticks. You kick it anyway.`,
  () => `Cold gel. Bright light. A body that fits like a borrowed coat.\n\nSomewhere in the static, the singing holds a note, as if waiting to see what you do this time.`,
  (c) => `You wake mid-sentence, finishing a thought from a life that ended in fire.\n\nThe ship's registry says ${c.shipName}. The name tag on your chest says ${c.captainName}. Fine. Sure.`,
  () => `The pod's display reads WELCOME BACK in a typeface you're fairly sure it didn't have last time.\n\nYou don't remember dying. You remember the shape of it, like a word on the tip of your tongue.`,
  () => `First breath. Then the second, which is always worse, because that's when you remember.\n\nThe lanes ahead have rearranged themselves again. The Heart has not moved.`,
];

const MANY: ((ctx: EventCtx) => string)[] = [
  (c) => `Life ${c.runNumber}. The cradle opens. You are already reaching for the throttle.`,
  () => `You wake. The singing says hello. You do not say it back.`,
  (c) => `Gel, light, ${c.shipName}. You've had worse mornings. You've had, specifically, ${c.runNumber - 1} of them.`,
  () => `The cradle hisses open. Somewhere, a ledger gains a line. You let it.`,
];

export const WAKE: EventDef = {
  id: 'wake',
  sites: ['marker'],
  title: (c) => (c.runNumber === 1 ? 'The Cradle' : `The Cradle (again)`),
  start: 'start',
  nodes: {
    start: {
      enter: rememberLife,
      text: (c) => {
        const e = ending(c);
        if (e === 'freed')
          return `You wake, and it is quiet.\n\nNo singing in the static. Just the hum of ${c.shipName} and your own pulse. The cradle was not supposed to work anymore. It did anyway, once, out of habit, or kindness.\n\nThe lanes ahead are loose and wide, like a fist unclenched.`;
        if (e === 'bound')
          return `You wake, and you are also the one waking you.\n\nIt is a strange courtesy, holding the door for yourself. The Choir hums in your own voice now. Somewhere in it, a version of you is very tired, and very patient.\n\nGo on, it says. See if you do better.`;
        if (e === 'broken')
          return `You wake to static with a hole in it.\n\nWhere the singing was, there is a ragged silence, and at the edges of it, voices that do not know they are alone yet.\n\nThe cradle's lights flicker red, then green. Something is still bringing you back. You are no longer sure what.`;
        if (c.runNumber === 1)
          return `Cold. Then light. Then a voice, very far off, singing a note you almost recognise.\n\nYou are lying in a cradle-pod in a ship you do not remember boarding. A name drifts up from somewhere: ${c.captainName}. It might be yours.\n\nThrough the viewport, the lanes of the Shoal twist inward like water circling a drain. Toward the Heart.`;
        if (c.runNumber <= 4) return LATER[(c.runNumber - 2) % LATER.length](c);
        if (c.runNumber >= 15 && c.runNumber % 3 !== 0) return MANY[c.runNumber % MANY.length](c);
        if (c.runNumber % 2 === 0) return LATER[c.runNumber % LATER.length](c);
        return MANY[c.runNumber % MANY.length](c);
      },
      choices: [
        {
          label: 'Where am I?',
          visible: (c) => c.runNumber === 1 && !ending(c),
          next: 'first',
        },
        {
          label: (c) => {
            const prev = c.metaFlag('prev_ship');
            return typeof prev === 'string' ? `Check the logs for the ${prev}` : 'Check the logs';
          },
          visible: (c) => c.runNumber >= 2 && c.runNumber <= 4 && typeof c.metaFlag('prev_ship') === 'string' && !ending(c),
          next: 'logs',
        },
        {
          label: (c) => (c.runNumber >= 10 ? 'Yes, yes. Go.' : 'Take the helm'),
          visible: (c) => c.runNumber > 1 || !!ending(c),
        },
      ],
    },
    first: {
      text: (c) =>
        `The ship answers before you finish asking. "Wayfarer-class cradle, ${c.shipName}. Captain revived. Memory integrity: partial."\n\nPartial. You test the word and find holes in it. A hand on a throttle. A great bright place at the centre of everything. A door you were supposed to open, or close.\n\nThe lanes only run one way from here. Deeper.`,
      choices: [{ label: 'Then deeper it is' }],
    },
    logs: {
      text: (c) => {
        const prev = c.metaFlag('prev_ship');
        const cap = c.metaFlag('prev_captain');
        return `The registry lists no ${String(prev)}. No ${typeof cap === 'string' ? cap : 'previous captain'}. No record that you were ever anywhere but here.\n\nYour hands remember the controls better than they should. You decide not to think about that yet.`;
      },
      choices: [{ label: 'Take the helm' }],
    },
  },
};
