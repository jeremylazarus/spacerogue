import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, bump, fragment, is, lore, num, placeMarkers, staged } from './util';

const A = 'hb';
const SITE = { eventId: 'hb_site', label: 'Bloom-touched', kind: 'planet' as const };
const STAGES = 3;

const hive = (c: EventCtx) => c.factionOf('hive');
const hName = (c: EventCtx) => hive(c)?.name ?? 'the Bloom';
const hSp = (c: EventCtx) => hive(c)?.species ?? 'bloom-kin';
const hSide = (c: EventCtx) => hive(c)?.id ?? 'monster';
const taste = (c: EventCtx) => num(c, 'arc.hb.taste');

function hiveRep(c: EventCtx, d: number): void {
  const h = hive(c);
  if (h) c.changeRep(h.id, d);
}

function queenStrength(c: EventCtx): number {
  if (is(c, 'arc.hb.betray')) return 0.8;
  return Math.max(0.85, 1.3 - 0.1 * num(c, 'arc.hb.burned'));
}

export const HIVE_BLOOM: ArcDef = {
  id: 'hive_bloom',
  title: 'The Bloom',
  kind: 'main',
  weight: 1,
  begin(ctx) {
    ctx.setFinale('hb_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('hive_bloom', 'Something is flowering in the deep Shoal, and the flowers are spreading outward, system by system. Go and see.');
    ctx.chain('hb_intro');
  },
};

const intro: EventDef = {
  id: 'hb_intro',
  sites: ['marker'],
  title: 'Pollen',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `Your intake filters are clogged with something gold and fine as flour. Under the scope, each grain is a tiny sealed seed, humming faintly.\n\nThe lane traffic reports are full of the same word, in a dozen languages: Bloom. Whole stations flowering. ${hive(c) ? `Everyone says it started with ${hName(c)}.` : 'Nobody knows where it started.'}\n\nThe pollen in your filters smells, impossibly, like home.`,
      choices: [
        { label: 'Purge the filters' },
        {
          label: 'Keep a pinch, sealed',
          run: (c) => {
            bump(c, 'arc.hb.taste');
            c.note('You seal the gold dust in a vial. It hums a little louder when you hold it.');
          },
        },
      ],
    },
  },
};

const site: EventDef = {
  id: 'hb_site',
  sites: ['marker'],
  title: 'The Bloom',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: `The station is in flower.\n\nPetals the size of hatch doors unfold along every corridor. The colonists sit among them, half-grown into the walls, smiling. They are not in pain. They tell you so, in unison, before you ask.\n\nA few, not yet touched, hide in a sealed med-bay, banging on the glass.`,
          choices: [
            {
              label: 'Burn the spore-beds',
              run: (c) => {
                bump(c, 'arc.hb.burned');
                hiveRep(c, -15);
                advance(c, A, SITE, STAGES);
                c.combat({ side: 'monster', count: 2, strength: 0.8, announce: 'The bloom defends itself' });
                return 'burn';
              },
            },
            {
              label: 'Evacuate the ones still themselves',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('engineering', 2) || c.check('diplomacy', 3)) {
                  c.setFlag('arc.hb.evac', true);
                  c.gainCredits(120);
                  c.gainXp(30);
                  return 'evac';
                }
                c.damageHull(10);
                return 'evacFail';
              },
            },
            {
              label: 'Let a petal brush your hand',
              run: (c) => {
                bump(c, 'arc.hb.taste');
                c.repairHull(25);
                advance(c, A, SITE, STAGES);
                return 'touch';
              },
            },
          ],
        },
        {
          text: (c) =>
            `A ${hSp(c)} envoy is waiting in the shade of a moon-sized flower. It is a cluster of soft warm bodies that speak in overlapping voices, like a choir warming up.\n\n"We taste you from far, Wayfarer. You taste of many. Of so many." ${taste(c) > 0 ? '"You touched us. We remember. We are glad."' : ''}\n\n"We are lonely. Everything out here is one, one, one. We would be many with you. Come be warm."\n\nIt offers you a seed. It pulses like a heart.`,
          choices: [
            {
              label: 'Accept the seed',
              run: (c) => {
                c.setFlag('arc.hb.joined', true);
                bump(c, 'arc.hb.taste');
                hiveRep(c, 25);
                advance(c, A, SITE, STAGES);
                const o = c.officers[0];
                if (o && !c.check('diplomacy', 2)) {
                  c.removeOfficer(o.id, 'would not stay aboard a ship that is starting to bloom');
                  c.setFlag('arc.hb.lost', o.name);
                }
                return 'seed';
              },
            },
            {
              label: '"I am one. I like being one."',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.gainXp(20);
                return 'refuse';
              },
            },
            {
              label: 'Burn the envoy where it sits',
              run: (c) => {
                bump(c, 'arc.hb.burned');
                hiveRep(c, -30);
                advance(c, A, SITE, STAGES);
                c.combat({ side: hSide(c), count: 3, announce: 'The bloom screams' });
                return 'kill';
              },
            },
          ],
        },
        {
          text: (c) =>
            is(c, 'arc.hb.joined')
              ? `A wall of living spores stretches across the lane, gold and breathing.\n\nAs you approach, it parts. Drones drift alongside you like an honour guard, and the seed in your hold sings to them, and they sing back.`
              : `A wall of living spores stretches across the lane, gold and breathing, thick enough to choke an engine.\n\nDrones drift in the haze. They have noticed you.`,
          choices: [
            {
              label: 'Let them escort you through',
              visible: (c) => is(c, 'arc.hb.joined'),
              run: (c) => {
                bump(c, 'arc.hb.taste');
                c.repairHull(30);
                advance(c, A, SITE, STAGES);
                return 'escort';
              },
            },
            {
              label: 'Find a gap in the wall',
              visible: (c) => !is(c, 'arc.hb.joined'),
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('navigation', 3)) return 'gap';
                c.combat({ side: hSide(c), count: 4, announce: 'Drones swarm' });
                return 'swarm';
              },
            },
            {
              label: 'Burn straight through (2 spools of thread)',
              visible: (c) => !is(c, 'arc.hb.joined'),
              req: { fuel: 2 },
              run: (c) => {
                c.loseFuel(2);
                bump(c, 'arc.hb.burned');
                advance(c, A, SITE, STAGES);
                return 'gap';
              },
            },
          ],
        },
      ],
      {
        text: `A garden of dead petals, drifting. The bloom has moved on from here, deeper, toward its root.`,
        choices: [{ label: 'Gather spore-honey', run: (c) => c.repairHull(10) }],
      },
    ),
    burn: {
      text: `The petals curl and blacken. The smiling colonists stop smiling, all at once, and begin to scream, all at once.\n\nSome of them are free now. Some of them are just dying. You can't tell which.`,
      enter: (c) => c.journal('hive_bloom', 'You burned a station\'s bloom. Its root lies deeper. Find it.'),
    },
    evac: {
      text: `You cut through the med-bay seals and get twenty-two people aboard. One of them, a child, keeps a single petal tucked in her sleeve. You pretend not to notice.`,
      enter: (c) => c.journal('hive_bloom', 'You saved who you could. The bloom\'s root lies deeper. Find it.'),
    },
    evacFail: {
      text: `The bloom closes over the med-bay before you can reach it. The people inside stop banging on the glass. They start smiling.`,
      enter: (c) => c.journal('hive_bloom', 'You were too late. The bloom\'s root lies deeper. Find it.'),
    },
    touch: {
      text: `Warmth. Not heat; warmth, like being remembered by someone who loves you.\n\nFor a heartbeat you are a hundred people at once, all of them glad you came. Then you are one again, and your hull damage has quietly knitted shut.`,
      enter: (c) => c.journal('hive_bloom', 'The bloom tasted you, and liked you. Its root lies deeper. Go and meet it.'),
    },
    seed: {
      text: (c) => {
        const lost = c.flag('arc.hb.lost');
        return `The seed settles into your hold and puts out a single root, into the deck, gently.${lost ? `\n\n${String(lost)} packs a bag without a word and leaves at the station. You can't blame them.` : ''}\n\nAt night, your crew dreams the same dream. They wake up holding hands.`;
      },
      enter: (c) => c.journal('hive_bloom', 'You carry the bloom\'s seed. Its queen waits at the Heart. You might be welcome there. You might be food.'),
    },
    refuse: {
      text: `"Oh," it says, in forty voices, terribly sad. "Oh. Then we will be many without you."\n\nIt lets you go. It does not seem to understand why anyone would want to be alone.`,
      enter: (c) => c.journal('hive_bloom', 'You refused the bloom. Its queen waits at the Heart.'),
    },
    kill: {
      text: `The envoy burns. Every flower on the station turns toward you at once, the way sunflowers turn.`,
      enter: (c) => c.journal('hive_bloom', 'You made the bloom your enemy. Its queen waits at the Heart. She knows your taste now.'),
    },
    escort: {
      text: `The bloom carries you through like a hand carrying a cup. When you come out the other side your ship is greener than it was. Things are growing in the vents. They smell lovely.`,
      enter: (c) => c.journal('hive_bloom', 'The bloom has welcomed you in. The queen waits at the Heart for her newest voice.'),
    },
    gap: {
      text: `You punch through the wall in a shower of gold. The bloom closes behind you like water.`,
      enter: (c) => c.journal('hive_bloom', 'Past the spore wall. The queen waits at the Heart.'),
    },
    swarm: {
      text: `The drones pour out of the gold like bees from a kicked hive.`,
      enter: (c) => c.journal('hive_bloom', 'Past the spore wall, barely. The queen waits at the Heart.'),
    },
  },
};

const finale: EventDef = {
  id: 'hb_finale',
  sites: ['marker'],
  title: 'The Root',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        let t = `The queen is a world-ship wrapped in petals, rooted in the Heart's light like a flower in a sunbeam. Its drones fill the sky like pollen.\n\n`;
        if (is(c, 'arc.hb.joined'))
          t += `"There you are," it says, in a voice made of everyone it has ever eaten, and every one of them sounds happy to see you. "Come down. Be warm. Be many."`;
        else if (num(c, 'arc.hb.burned') > 0) t += `It knows the taste of your fire. Every drone turns toward you at once.`;
        else t += `It notices you the way an ocean notices a boat.`;
        return t;
      },
      choices: [
        {
          label: '"What do you want?"',
          req: { apt: { diplomacy: 3 } },
          next: 'want',
        },
        {
          label: 'Join the bloom',
          visible: (c) => is(c, 'arc.hb.joined') && taste(c) >= 2,
          next: 'join',
        },
        {
          label: 'Accept its embrace, and set your reactor to overload',
          visible: (c) => is(c, 'arc.hb.joined'),
          run: (c) => {
            c.setFlag('arc.hb.betray', true);
            c.note('The drones part for you. The queen opens its heart to you. You fire into it.');
            c.combat({ side: hSide(c), boss: 'hive_queen', strength: queenStrength(c), afterVictory: 'hb_epilogue', announce: 'The queen recoils' });
          },
        },
        {
          label: 'Burn the root',
          run: (c) => c.combat({ side: hSide(c), boss: 'hive_queen', strength: queenStrength(c), afterVictory: 'hb_epilogue', announce: 'The hive queen' }),
        },
      ],
    },
    want: {
      text: `"Listen," it says, and for a moment you do.\n\nIn the lanes, under everything, the singing. You've heard it all your lives. But the queen hears it clearly: thousands of voices, all singing alone.\n\n"They are so lonely in there," it says. "We want to answer them with one voice. We want everyone to be one voice. Then they will not be lonely. Then nobody will."`,
      enter: (c) => {
        lore(c, 'arc.hive_bloom');
        fragment(c, 3, 1);
      },
      choices: [
        {
          label: 'Join the bloom',
          visible: (c) => is(c, 'arc.hb.joined'),
          next: 'join',
        },
        {
          label: '"Not everyone wants to be answered."',
          run: (c) => c.combat({ side: hSide(c), boss: 'hive_queen', strength: queenStrength(c), afterVictory: 'hb_epilogue', announce: 'The hive queen' }),
        },
      ],
    },
    join: {
      text: `You open the airlock. The gold comes in like a tide, and it is warm, and it is not frightening at all.\n\nYou are one, and then you are a few, and then you are many. Somewhere in the many is everyone the bloom ever touched, glad to see you. Somewhere further in, fainter, the old singing in the lanes, and the bloom turns its thousand faces toward it, and sings back.`,
      enter: (c) => {
        fragment(c, 3, 1);
        lore(c, 'arc.hive_bloom');
      },
      choices: [
        {
          label: 'Be many',
          run: (c) => {
            c.setMetaFlag('hive.joined', true);
            c.victory(
              `The bloom spreads through the Shoal, slow and gold and patient. Stations flower. Ships flower. Nobody is ever alone again, which is either the best thing that ever happened or the end of everything; from inside, it is very hard to tell.\n\nIn the lanes, the old singing and the new one meet, and for the first time in an age, something answers.`,
            );
          },
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'hb_epilogue',
  sites: ['marker'],
  title: 'Wilt',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        is(c, 'arc.hb.betray')
          ? `The queen dies holding you, still welcoming, still warm. It does not understand what you did. It forgives you anyway, in forty thousand voices, as they go out one by one.`
          : `The queen's petals curl and fall like the last leaves of a long year. Across the Shoal, flowers close, and people sit up in their stations and blink, alone again, and some of them cry.`,
      enter: (c) => {
        lore(c, 'arc.hive_bloom');
        fragment(c, 3, 1);
      },
      choices: [
        {
          label: 'Let it wilt',
          run: (c) => {
            let e = `The bloom recedes. Stations are scraped clean of gold. Within a year it is a story; within ten, a children's warning.\n\n`;
            if (is(c, 'arc.hb.evac')) e += `A girl you pulled from a med-bay grows up and keeps a single pressed petal in a book. She never tells anyone what it smells like. `;
            if (is(c, 'arc.hb.joined')) e += `Your ship never quite stops growing things in its vents. You let it.`;
            else e += `Sometimes, in the static between lanes, you think you hear forty voices calling your name, very far off, sad.`;
            c.victory(e);
          },
        },
      ],
    },
  },
};

export const HIVE_BLOOM_EVENTS: EventDef[] = [intro, site, finale, epilogue];
