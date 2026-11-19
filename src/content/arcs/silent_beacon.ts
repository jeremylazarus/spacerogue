import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, fragment, is, lore, placeMarkers, staged } from './util';

const A = 'sb';
const SITE = { eventId: 'sb_site', label: 'Signal source', kind: 'beacon' as const };
const STAGES = 3;

function keeperName(ctx: EventCtx): string {
  const anc = ctx.factionOf('ancient');
  return anc ? `a lone ${anc.species} hermit` : 'a hermit of no species you can name';
}

function bossStrength(ctx: EventCtx): number {
  let s = 1.25;
  if (ctx.flag('arc.sb.brood') === 'burned') s -= 0.2;
  if (is(ctx, 'arc.sb.keyed')) s -= 0.2;
  if (is(ctx, 'arc.sb.lured')) s -= 0.15;
  if (is(ctx, 'arc.sb.boosted')) s += 0.1;
  return Math.max(0.7, s);
}

export const SILENT_BEACON: ArcDef = {
  id: 'silent_beacon',
  title: 'The Silent Beacon',
  kind: 'main',
  weight: 1,
  begin(ctx) {
    ctx.setFinale('sb_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('silent_beacon', 'A thirteen-note signal is calling from deeper in the Shoal. Follow it to its source.');
    ctx.chain('sb_intro');
  },
};

const intro: EventDef = {
  id: 'sb_intro',
  sites: ['marker'],
  title: 'Thirteen Notes',
  start: 'a',
  nodes: {
    a: {
      text: `Your comms crackle with a signal that has no source. Thirteen notes, rising, then a gap, then again.\n\n{off} frowns at the waveform. "That's older than the lanes it's riding on. And it's not asking for help. It's... inviting."\n\nThe notes fall silent for exactly one heartbeat each time. Like something listening for an answer.`,
      choices: [
        { label: 'Log the bearing and follow it' },
        {
          label: 'Answer it',
          run: (c) => {
            c.setFlag('arc.sb.answered', true);
            c.note('You hum the thirteen notes back. Far off, something very large shifts in its sleep.');
          },
        },
      ],
    },
  },
};

const site: EventDef = {
  id: 'sb_site',
  sites: ['marker'],
  title: 'Signal Source',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: `A relay buoy, older than the lanes around it and crusted with ice, is singing the thirteen notes into the dark.\n\nSomething has been chewing on it. The bite marks are a metre across.`,
          choices: [
            {
              label: 'Decode the signal',
              run: (c) => {
                if (c.check('science', 2)) {
                  c.setFlag('arc.sb.copied', true);
                  c.gainXp(25);
                  advance(c, A, SITE, STAGES);
                  return 'decoded';
                }
                c.gainXp(10);
                advance(c, A, SITE, STAGES);
                return 'garbled';
              },
            },
            {
              label: 'Boost its output and see what comes',
              req: { apt: { engineering: 2 } },
              run: (c) => {
                c.setFlag('arc.sb.boosted', true);
                advance(c, A, SITE, STAGES);
                c.combat({ side: 'monster', count: 3, strength: 0.7, announce: 'Something answers the song' });
                return 'boosted';
              },
            },
            {
              label: 'Strip it for parts',
              run: (c) => {
                c.gainCredits(c.check('salvage', 1) ? 140 : 60);
                advance(c, A, SITE, STAGES);
                c.journal('silent_beacon', 'You silenced one relay. The signal still sings from deeper in. Keep following.');
              },
            },
          ],
        },
        {
          text: `Wrecks. Dozens of them, drifting in a loose ring, every one hollowed out from the inside like fruit scooped with a spoon.\n\nEvery one of them has its comms tuned to the thirteen notes.\n\nAt the centre, clinging to a freighter's spine, a clutch of glowing eggs pulses in time with the song.`,
          choices: [
            {
              label: 'Burn the clutch',
              run: (c) => {
                c.setFlag('arc.sb.brood', 'burned');
                advance(c, A, SITE, STAGES);
                c.journal('silent_beacon', 'You burned a brood of whatever eats these ships. Its parent will not be pleased. Follow the signal deeper.');
                c.combat({ side: 'monster', count: 2, strength: 0.9, announce: 'The brood wakes' });
                return 'burned';
              },
            },
            {
              label: 'Take a sample for study',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('science', 3)) {
                  c.setFlag('arc.sb.brood', 'sample');
                  c.gainXp(30);
                  return 'sample';
                }
                c.damageHull(15);
                c.setFlag('arc.sb.brood', 'left');
                return 'sampleFail';
              },
            },
            {
              label: 'Pick the wrecks clean and leave the eggs be',
              run: (c) => {
                c.setFlag('arc.sb.brood', 'left');
                advance(c, A, SITE, STAGES);
                if (c.check('salvage', 2)) c.giveItem({ minRarity: 1 });
                else c.gainCredits(90);
                c.journal('silent_beacon', 'Whatever feeds on this signal has young. Follow the notes to the source.');
              },
            },
          ],
        },
        {
          text: (c) =>
            `The beacon's last relay is a hut of welded hull plates, and someone lives in it: ${keeperName(c)}, wrapped in insulation foil, tending a console with the patience of a gardener.\n\n"Another one," it says, not unkindly. "You all come. The song is very good at that."`,
          choices: [
            {
              label: '"What is this place?"',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                return 'keeper2';
              },
            },
          ],
        },
      ],
      {
        text: `A dead relay, drifting. Its notes have already moved deeper. Someone has scratched a tally of thirteen marks into the casing.`,
        choices: [
          {
            label: 'Siphon what is left',
            run: (c) => {
              c.gainFuel(1);
            },
          },
        ],
      },
    ),
    decoded: {
      text: `The thirteen notes resolve into words in a language nobody speaks any more. Your translator makes its best guess:\n\nCOME. FEED IT. KEEP IT FAR FROM THE HEART.\n\nYou save a clean copy of the signal. It may be useful to have something it wants.`,
      enter: (c) => c.journal('silent_beacon', 'The beacon is a lure, set to feed something. You carry a copy of its song. Find the source.'),
    },
    garbled: {
      text: `The signal folds in on itself every time you try to pin it down. You get one word, maybe: FEED.\n\nYou are not sure if it is an instruction or a warning.`,
      enter: (c) => c.journal('silent_beacon', 'The beacon may be a lure. Follow the signal anyway; you need to know what it is feeding.'),
    },
    boosted: {
      text: `The buoy screams the notes into the void at triple power. For a moment nothing. Then sensor ghosts, fast and hungry, converge on you from three directions.\n\nSmall ones. Young ones. Which means somewhere there's a big one.`,
      enter: (c) => c.journal('silent_beacon', 'You rang the dinner bell. Something large now knows your shape. Find the source of the signal.'),
    },
    burned: {
      text: `The eggs go up like paper lanterns. In the flash, three of them hatch early, furious and starving.\n\nFar off, below the noise floor, something lets out a sound your hull feels before your ears do.`,
    },
    sample: {
      text: `You seal a single egg in a cryo-flask. Under the scanner it isn't flesh so much as a tuning fork wrapped in skin. It vibrates when you hum.\n\nWhatever laid it doesn't eat ships. It eats the songs inside them.`,
      enter: (c) => c.journal('silent_beacon', 'The creature eats songs, not metal. You carry one of its eggs. Follow the signal to its source.'),
    },
    sampleFail: {
      text: `The egg bursts in the grapple, spraying something that eats through two hull plates before {off} gets the bulkhead sealed.\n\nYou leave with nothing but a scorched airlock and a strong opinion.`,
      enter: (c) => c.journal('silent_beacon', 'Whatever lays those eggs is not friendly. Follow the signal to its source.'),
    },
    keeper2: {
      text: `"A larder," it says. "The beast at the end of the song eats singing. Not your little radio songs. The big one. The one in the lanes."\n\n"Long ago, the first of you came this way. She saw what the beast would do if it reached the Heart. So she lit a lamp to keep it fed and far away, and asked someone to tend it." It spreads its hands. "Someone did. For an age. The lamp eats travellers. The travellers keep the beast fat and lazy. Everybody sings."\n\n"I am very tired."`,
      enter: (c) => {
        fragment(c, 1);
        lore(c, 'arc.silent_beacon');
      },
      choices: [
        {
          label: '"Then let me finish it. Give me a way to kill it."',
          run: (c) => {
            c.setFlag('arc.sb.keeper', 'dark');
            c.setFlag('arc.sb.keyed', true);
            c.journal('silent_beacon', 'The keeper gave you the beacon\'s key. When you reach the source, the lamp goes out. Kill what comes for you.');
            return 'dark';
          },
        },
        {
          label: '"Keep the lamp lit. I\'ll take your place when this is done."',
          run: (c) => {
            c.setFlag('arc.sb.keeper', 'lit');
            c.giveRelic('mourning_bell');
            c.journal('silent_beacon', 'You promised to keep the lamp lit. First, the beast at the source has to learn who tends it now.');
            return 'lit';
          },
        },
        {
          label: '"Not my problem." Take its stores and go.',
          req: { apt: { guile: 2 } },
          run: (c) => {
            c.setFlag('arc.sb.keeper', 'robbed');
            c.gainCredits(220);
            c.gainFuel(2);
            c.journal('silent_beacon', 'You robbed a tired old hermit. The beacon still sings. Find its source.');
            return 'robbed';
          },
        },
      ],
    },
    dark: {
      text: `It presses a key into your palm: a tuning crystal, warm. "When you reach the lamp, break this. It will stop singing, and the beast will come to see why. It will be angry and hungry and slower than it thinks."\n\nIt turns back to its console and, for the first time in an age, switches it off.`,
    },
    lit: {
      text: `It gives you a bell, small and black and cold. "For when it gets close. It knows that sound. It means dinner is coming, and to be patient."\n\nIt does not thank you. It just closes its eyes, as if listening to the song for the first time in a long while.`,
    },
    robbed: {
      text: `It does not resist. It does not even look up.\n\n"You'll be back," it says to the console. "All of you come back."`,
    },
  },
};

const finale: EventDef = {
  id: 'sb_finale',
  sites: ['marker'],
  title: 'The Lamp',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        const k = c.flag('arc.sb.keeper');
        let t = `At the centre of {sys} hangs the beacon: a ship, once. Its hull has been stretched into a great brass bell, and it is still singing.\n\nCoiled around it is the leviathan. It is the size of a moon and has no eyes, only a vast ribbed throat that opens and closes in time with the notes.`;
        if (k === 'dark') t += `\n\nThe keeper's crystal is warm in your hand.`;
        else if (k === 'lit') t += `\n\nThe black bell trembles in its cradle on your bridge.`;
        else if (!c.flag('arc.sb.brood')) t += `\n\nYou came here knowing almost nothing. Maybe that's for the best.`;
        return t;
      },
      choices: [
        {
          label: 'Break the crystal',
          visible: (c) => c.flag('arc.sb.keeper') === 'dark',
          run: (c) => {
            c.note('The beacon stops. The silence is enormous. The leviathan uncoils, slow and confused and very, very hungry.');
            c.combat({ side: 'monster', boss: 'leviathan', strength: bossStrength(c), afterVictory: 'sb_epilogue', announce: 'The lamp goes dark' });
          },
        },
        {
          label: 'Play its own song back at it, inverted',
          visible: (c) => is(c, 'arc.sb.copied'),
          run: (c) => {
            if (c.check('science', 3)) {
              c.setFlag('arc.sb.lured', true);
              c.note('The inverted song tears through its throat like a swallowed hook. It thrashes, bleeding light.');
            } else c.note('The song comes out wrong. It only wakes the thing up faster.');
            c.combat({ side: 'monster', boss: 'leviathan', strength: bossStrength(c), afterVictory: 'sb_epilogue', announce: 'The leviathan rises' });
          },
        },
        {
          label: 'Ring the bell, and hum to the egg',
          visible: (c) => c.flag('arc.sb.keeper') === 'lit' && c.flag('arc.sb.brood') === 'sample',
          req: { apt: { science: 4 } },
          next: 'lullaby',
        },
        {
          label: 'Open fire',
          run: (c) => {
            c.combat({ side: 'monster', boss: 'leviathan', strength: bossStrength(c), afterVictory: 'sb_epilogue', announce: 'The leviathan rises' });
          },
        },
      ],
    },
    lullaby: {
      text: `The bell rings once. The egg in its flask answers, a thin sweet note, and the great throat stops.\n\nYou hum. You don't know the tune; your mouth does. The leviathan settles around the beacon like a cat around a hearth, and the thirteen notes go on, softer now.\n\nSomeone has to tend the lamp. You knew that when you promised.`,
      choices: [
        {
          label: 'Take the keeper\'s chair',
          run: (c) => {
            lore(c, 'arc.silent_beacon');
            c.setMetaFlag('sb.tended', true);
            c.victory(
              `You stayed. The beacon sings, the beast sleeps, and travellers come and are turned gently aside before they reach its mouth, because the new keeper knows how.\n\nIt is lonely work. Some nights, in the static, you hear a choir humming along. You hum back.`,
            );
          },
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'sb_epilogue',
  sites: ['marker'],
  title: 'Silence',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        const k = c.flag('arc.sb.keeper');
        if (k === 'dark')
          return `The leviathan comes apart like a cloud of moths. Inside its throat, uncountable faint notes scatter into the lanes, free.\n\nThe beacon is dark. Nothing will be lured here again.`;
        if (k === 'lit')
          return `The leviathan dies with the bell still ringing. The beacon goes on singing to nothing.\n\nYou made a promise. The lamp is lit. There is just no one left to feed.`;
        return `The leviathan dies the way stars do: slowly, then all at once, then for a very long time.\n\nThe beacon sings on, calling for something that will never come.`;
      },
      choices: [
        {
          label: 'Let the silence settle',
          run: (c) => {
            lore(c, 'arc.silent_beacon');
            const k = c.flag('arc.sb.keeper');
            c.victory(
              k === 'dark'
                ? `The thirteen notes are gone from the Shoal. In the months after, captains report something odd: the singing in the lanes sounds fuller, as if voices long swallowed have rejoined the chorus.\n\nThe keeper's hut drifts empty. On the console, someone has written: THANK YOU. GO HOME.`
                : k === 'lit'
                  ? `You keep your promise. The beacon sings, and you tend it, and nothing comes. It is the most peaceful place in the Shoal.\n\nSometimes you wonder whether the first Wayfarer meant it to end like this. You decide she would have liked the quiet.`
                  : `You leave the beacon singing. Travellers will keep coming. Nothing will eat them now; they'll simply find a dead god and a bell.\n\nYou don't think about the keeper. Mostly.`,
            );
          },
        },
      ],
    },
  },
};

export const SILENT_BEACON_EVENTS: EventDef[] = [intro, site, finale, epilogue];
