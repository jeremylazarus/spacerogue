import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, fragCount, is, lore, nextFragment, num, placeMarkers, staged } from './util';

const A = 'or';
const SITE = { eventId: 'or_site', label: 'The first road', kind: 'anomaly' as const };
const STAGES = 3;

function past(c: EventCtx): string {
  const s = c.metaFlag('prev_ship');
  const k = c.metaFlag('prev_captain');
  const bits: string[] = [];
  if (typeof k === 'string') bits.push(`a captain called ${k}`);
  if (typeof s === 'string') bits.push(`a ship called the ${s}`);
  return bits.length ? bits.join(', ') : 'a captain whose name you almost know';
}

function avatarStrength(c: EventCtx): number {
  return Math.max(0.9, 1.45 - 0.1 * num(c, 'arc.or.stage') - (is(c, 'arc.or.sang') ? 0.1 : 0));
}

function endRun(c: EventCtx, which: 'freed' | 'bound' | 'broken', text: string): void {
  c.setMetaFlag(`ending.${which}`, true);
  c.setMetaFlag('ending.last', which);
  lore(c, `arc.origin.${which}`);
  c.victory(text);
}

export const ORIGIN: ArcDef = {
  id: 'origin',
  title: 'The First Voyage',
  kind: 'main',
  weight: 4,
  eligible: (m) => m.codexCount('frag.origin.') >= 5,
  begin(ctx) {
    ctx.setFinale('or_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('origin', 'You know enough now. Retrace the first Wayfarer\'s road to the Heart, and finish what she started.');
    ctx.chain('or_intro');
  },
};

const intro: EventDef = {
  id: 'or_intro',
  sites: ['marker'],
  title: 'The Road Remembered',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `This time, when you look at the lanes, you don't see a maze. You see a road. Someone walked it first and left footprints all the way to the Heart, and you have been stepping in them for ${c.runNumber} lives without looking down.\n\nThe singing in the static changes key, just slightly. As if it noticed you noticing.`,
      choices: [{ label: 'Walk the road' }],
    },
  },
};

const site: EventDef = {
  id: 'or_site',
  sites: ['marker'],
  title: 'The First Road',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: `A cradle-pod, drifting alone. The model is so old its controls are labelled in pictographs. The glass is frosted from the inside.\n\nScratched into the frost, in a hand you know because it is the same as yours: I WAS FIRST. I AM SORRY.`,
          choices: [
            {
              label: 'Open it',
              run: (c) => {
                nextFragment(c);
                c.gainXp(40);
                advance(c, A, SITE, STAGES);
                return 'cradle';
              },
            },
            {
              label: 'Leave it sealed. Some doors should stay shut.',
              run: (c) => {
                c.setFlag('arc.or.respect', true);
                advance(c, A, SITE, STAGES);
                return 'sealed';
              },
            },
          ],
        },
        {
          text: (c) =>
            `The lane here is thin as glass, and the singing comes through it clearly. Not a chord. Voices. Thousands. Each one singing alone.\n\nOne of them is ${past(c)}. One of them is you, from ${c.runNumber > 2 ? `${c.runNumber - 1} lives` : 'a life'} ago, still singing the last thing you thought before you died.`,
          choices: [
            {
              label: 'Sing back',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('science', 3) || c.check('diplomacy', 3)) {
                  c.setFlag('arc.or.sang', true);
                  nextFragment(c);
                  return 'sang';
                }
                c.damageHull(15);
                return 'drowned';
              },
            },
            {
              label: 'Just listen',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                nextFragment(c);
                return 'listened';
              },
            },
          ],
        },
        {
          text: `A buoy, so old it has eroded smooth, broadcasting on a frequency only cradle-born ears can hear. A message, left for whoever came this far.\n\n"If you're hearing this, you've walked the road, so you know. When I reached the Heart I found the singing, and it was every traveller who died out here, alone, lost forever. I couldn't bear it. So I bound them. All of them, all of us, into a choir that remembers.\n\nAnd I made it bring us back. Again and again. Until one of us got here and could tell me if I was right."`,
          choices: [
            {
              label: '"Were you?"',
              run: (c) => {
                nextFragment(c);
                advance(c, A, SITE, STAGES);
                return 'binder';
              },
            },
          ],
        },
      ],
      {
        text: `Footprints in the lanes, faint and old. They all point the same way.`,
        choices: [{ label: 'Follow them', run: (c) => c.gainXp(15) }],
      },
    ),
    cradle: {
      text: `Inside, nothing. Not a body. Not dust. A shape pressed into the gel, exactly your size, and a smell like ozone and old flowers.\n\nShe never woke up from this one. She just stopped needing to.`,
      enter: (c) => c.journal('origin', 'The first Wayfarer never died. She became something. Keep walking her road.'),
    },
    sealed: {
      text: `You rest a hand on the frost and leave it. Somewhere in the static, one voice in the chorus holds a note a beat longer than the others. A thank-you, maybe.`,
      enter: (c) => c.journal('origin', 'The first Wayfarer\'s cradle lies sealed behind you. Keep walking her road.'),
    },
    sang: {
      text: `You open your mouth and the note is already there. For a moment the voices turn toward you, all of them, and you are not singing alone, and neither are they.\n\nIt is the most beautiful thing you have ever heard. It is also a cage.`,
      enter: (c) => c.journal('origin', 'The Choir is everyone who died in the Shoal. Including you. Reach the Heart.'),
    },
    drowned: {
      text: `The chorus swells and you go under. You surface minutes later on the deck of the bridge, nose bleeding, the last voice still ringing: your own, saying "not yet, not yet."`,
      enter: (c) => c.journal('origin', 'The Choir is everyone who died in the Shoal. Including you. Reach the Heart.'),
    },
    listened: {
      text: `You listen until you can pick yourself out. You sound frightened. You sound like you're still trying to reach the Heart.\n\nYou mute the channel for a while after that.`,
      enter: (c) => c.journal('origin', 'The Choir is everyone who died in the Shoal. Including you. Reach the Heart.'),
    },
    binder: {
      text: `The buoy has no answer. It only repeats the last line, the one she must have recorded last, quietly:\n\n"Choose differently than I did. Or choose the same, if you must. But choose."`,
      enter: (c) => c.journal('origin', 'At the Heart, the Choir waits for your answer. Free it. Bind it. Or break it.'),
    },
  },
};

const finale: EventDef = {
  id: 'or_finale',
  sites: ['marker'],
  title: 'The Heart',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `The Heart is not a star. It is a throat of light, and out of it pours the singing, so loud here it is a physical pressure on the hull.\n\nThe Choir gathers itself into a shape to meet you. It wears a face, then another, then another: ${past(c)}; every Wayfarer who ever woke in a cradle; at last, briefly, a woman with your eyes and a very old smile.\n\n"YOU CAME," it says, in all of your voices. "SHOW US YOU CAN BEAR WHAT YOU WILL CHOOSE."`,
      enter: (c) => {
        if (fragCount(c) < 7) nextFragment(c);
      },
      choices: [
        {
          label: '"I\'m not here to fight you."',
          next: 'notfight',
        },
        {
          label: 'Face it',
          run: (c) => c.combat({ side: 'monster', boss: 'choir_avatar', strength: avatarStrength(c), afterVictory: 'or_epilogue', announce: 'The Choir' }),
        },
      ],
    },
    notfight: {
      text: `"WE KNOW. THIS IS NOT A FIGHT. IT IS A TEST OF WHETHER YOU CAN HOLD ALL OF US AT ONCE, EVEN FOR A MOMENT, AND NOT BREAK."\n\n"EVERY ONE OF YOU HAS FAILED IT. EVERY ONE OF YOU IS IN HERE NOW. WE WILL BE GENTLE. WE WILL NOT BE EASY."`,
      choices: [
        {
          label: 'Hold them',
          run: (c) => c.combat({ side: 'monster', boss: 'choir_avatar', strength: avatarStrength(c), afterVictory: 'or_epilogue', announce: 'The Choir' }),
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'or_epilogue',
  sites: ['marker'],
  title: 'The Choice',
  start: 'a',
  nodes: {
    a: {
      text: `The Avatar comes apart, gently, into voices. They hang around your ship like snow that hasn't decided to fall.\n\nThe first Wayfarer's voice is the clearest. "You held us. Nobody ever has. So now it's yours. The binding, the cradle, the whole terrible kindness of it."\n\n"What will you do with us?"`,
      choices: [
        {
          label: 'Free them. Let every voice go.',
          next: 'free',
        },
        {
          label: 'Take her place. Someone has to remember them.',
          next: 'bind',
        },
        {
          label: 'Break it. No more cradles. No more choirs.',
          next: 'break',
        },
      ],
    },
    free: {
      text: `You reach into the binding the way you'd untie a knot in a child's shoelace: patiently, one loop at a time.\n\nThe voices go. Not all at once. Each one pauses on the way out, to look at you. Some of them have your face. They seem glad.\n\nThe first Wayfarer goes last. "Thank you," she says. "I was so tired of being right."`,
      choices: [
        {
          label: 'Let the Shoal unknot',
          run: (c) =>
            endRun(
              c,
              'freed',
              `The lanes loosen. Across the Shoal, routes that ran only one way begin, slowly, to run both. Travellers who die out here now simply die, and are mourned, and are gone.\n\nYou are one of them, eventually. The cradle does not open for you again. That was the point.`,
            ),
        },
      ],
    },
    bind: {
      text: `You step into the light where she stood. The binding settles on your shoulders like an old coat; it fits, because it was always going to.\n\nThe voices turn toward you. They are not lonely anymore. They are waiting to see what kind of keeper you'll be.\n\nThe first Wayfarer brushes past you on her way out. "Be kinder than I was," she says. "Or don't. Just keep them."`,
      choices: [
        {
          label: 'Begin the next cycle',
          run: (c) =>
            endRun(
              c,
              'bound',
              `Somewhere at the edge of the Shoal, a cradle-pod hisses open, and a Wayfarer you will never meet wakes up, cold and confused, with a name drifting up from nowhere.\n\nYou sing them a note, very softly, to let them know someone is listening. Then you wait, the way she waited, for one of them to come all the way and choose.`,
            ),
        },
      ],
    },
    break: {
      text: `You don't untie the knot. You cut it.\n\nThe binding snaps with a sound like every bell in the Shoal cracking at once. The voices scatter, not freed, not kept: flung, in every direction, into the dark between lanes.\n\nThe first Wayfarer doesn't say anything. You don't hear her go.`,
      choices: [
        {
          label: 'Watch what you have done',
          run: (c) =>
            endRun(
              c,
              'broken',
              `Nobody wakes in cradles anymore. Nobody sings in the lanes. The wardens fall dark one by one, and the Tide stops, and the Shoal becomes just a place: hard, unfair, and finally, irrevocably, its own.\n\nSome nights, the static carries something faint. A voice, lost, looking for the others. It does not sound like it knows what you did. You hope it never finds out.`,
            ),
        },
      ],
    },
  },
};

export const ORIGIN_EVENTS: EventDef[] = [intro, site, finale, epilogue];
