import type { EventCtx, EventDef } from '../../game/api';
import { cr } from './util';

const BOTTLE_MESSAGES: Record<string, string> = {
  hope: '"It gets better. Not easier. Better."',
  warn: '"Don\'t trust the yacht that\'s giving things away."',
  map: '"Go left at the knot. Always left."',
  sorry: '"I\'m sorry. I tried. You\'ll do better."',
};

function bottleText(ctx: EventCtx): string {
  const m = ctx.metaFlag('ev.bottle');
  return typeof m === 'string' && BOTTLE_MESSAGES[m] ? BOTTLE_MESSAGES[m] : '"..."';
}

export const ANOMALY_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_anom_loop',
    sites: ['anomaly'],
    title: 'Déjà Vu',
    start: 'start',
    nodes: {
      start: {
        text:
          'You approach the anomaly. The anomaly is a faint ring of light. You approach the anomaly. The anomaly is a faint ring of light.\n\n{off} says, "Captain, didn\'t we just—" and then stops, because they have said this before. Several times. The chronometer agrees.',
        choices: [
          {
            label: 'Plot a course out through the loop\'s seam.',
            run: (ctx) => {
              if (ctx.check('navigation', 2)) {
                ctx.gainXp(30);
                ctx.revealMap(1);
                ctx.note('You exit with a lane chart that was, technically, drawn by you tomorrow.');
              } else {
                ctx.loseFuel(2);
                ctx.note('You get out eventually. Your spools insist you spent a week trying.');
              }
            },
          },
          {
            label: 'Use the loop. Repair the hull over and over until it sticks.',
            req: { apt: { engineering: 2 } },
            run: (ctx) => {
              ctx.repairHull(ctx.maxHull);
              ctx.loseFuel(1);
              ctx.note('Each loop, you fix one more plate. Each loop, the fix stays. By the hundredth pass, the ship is pristine and you are very tired.');
            },
          },
          {
            label: 'Wait. See what the loop wants.',
            next: 'wait',
          },
        ],
      },
      wait: {
        text:
          'On the 40th repetition, a second copy of your ship appears beside you. Its captain waves. They look exhausted.\n\nThey transmit a single file and fly off into the ring. The loop breaks.',
        enter: (ctx) => {
          if (ctx.chance(0.5)) ctx.giveItem({ minRarity: 1 });
          else ctx.gainCredits(cr(ctx, 80));
          ctx.gainXp(20);
        },
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_anom_mirror',
    sites: ['anomaly'],
    title: 'The Reflection',
    minDepth: 3,
    weight: 0.6,
    unique: true,
    start: 'start',
    nodes: {
      start: {
        text:
          'A perfectly flat sheet of silvered space, light-minutes wide. In it, your ship. Behind your ship, your trail. In the reflection, the {ship} is moving a fraction of a second before you are.\n\nThe reflection\'s weapons are warming up.',
        choices: [
          {
            label: 'Fight it. Better now than later.',
            run: (ctx) => {
              ctx.combat({ side: 'rogue', boss: 'mirror', announce: 'Your reflection steps out' });
            },
          },
          {
            label: 'Power everything down. Give it nothing to copy.',
            run: (ctx) => {
              if (ctx.check('guile', 3)) {
                ctx.note('Your reflection goes dark, confused. Then it fades. You leave the mirror behind, and catch it once more in the corner of a viewport. Waving.');
                ctx.gainXp(50);
              } else {
                ctx.note('Your reflection was always better at hiding than you.');
                ctx.combat({ side: 'rogue', boss: 'mirror', strength: 1.2, announce: 'It moves first' });
              }
            },
          },
          {
            label: 'Read the reflection\'s hull for differences.',
            req: { apt: { science: 3 } },
            next: 'diff',
          },
        ],
      },
      diff: {
        text:
          'The reflection is not a copy. Its scars are in different places. Its paint is older. The name on its hull is yours, but the registry date is — impossible. It has been flying the Shoal for a very long time.\n\nIt stops charging weapons. Instead, a docking light blinks.',
        choices: [
          {
            label: 'Dock with it.',
            run: (ctx) => {
              ctx.unlockCodex('lore.echoes');
              const r = ctx.giveRelic('frozen_second');
              if (!r) ctx.giveItem({ minRarity: 3 });
              ctx.note('Nobody is aboard. On the bridge, someone has left a gift with a note: "For when you need a little longer."');
            },
          },
          {
            label: 'Fight anyway. You don\'t trust yourself.',
            run: (ctx) => ctx.combat({ side: 'rogue', boss: 'mirror', strength: 0.8, announce: 'You never trusted yourself' }),
          },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_anom_choir_static',
    sites: ['anomaly'],
    title: 'The Singing',
    start: 'start',
    nodes: {
      start: {
        text:
          'Here the hyperspace static is so loud it bleeds into the ship\'s speakers. Not noise. Voices, thousands of them, singing the same long note.\n\nSome of the crew are crying. Some are humming along. {off} is doing both.',
        choices: [
          {
            label: 'Listen closely.',
            run: (ctx) => (ctx.check('science', 2) ? 'listen' : 'lost'),
          },
          {
            label: 'Sing back.',
            next: 'sing',
          },
          {
            label: 'Mute the speakers and go.',
            run: (ctx) => ctx.gainXp(5),
          },
        ],
      },
      listen: {
        text:
          'Beneath the chord, individual voices. One is counting stars. One is reciting a ship\'s registry. One is saying a name over and over, and with a jolt you realize the name is one you have used.',
        enter: (ctx) => {
          ctx.unlockCodex('lore.choir');
          ctx.gainXp(40);
        },
      },
      lost: {
        text: 'You lose six hours. Nobody aboard can account for them. The navigator\'s log simply reads: "it was beautiful" in their handwriting, sixty times.',
        enter: (ctx) => {
          ctx.loseFuel(1);
          ctx.gainXp(15);
        },
      },
      sing: {
        text:
          'Your voice goes out into the static and — the Choir pauses. For one breath, the entire chorus is silent, listening to you.\n\nThen it resumes, a half-step closer to your pitch.',
        choices: [
          {
            label: 'Hold the note.',
            run: (ctx) => {
              if (!ctx.hasRelic('hollow_idol') && ctx.chance(0.25)) {
                ctx.giveRelic('hollow_idol');
                ctx.note('When you stop, there is something in your hand that was not there before. It is hollow. It is watching.');
              } else {
                ctx.gainXp(50);
              }
            },
          },
          { label: 'Stop. That was too much.', run: (ctx) => ctx.gainXp(20) },
        ],
      },
    },
  },

  // 4 -----------------------------------------------------------------------
  {
    id: 'ev_anom_fuel_bloom',
    sites: ['anomaly'],
    title: 'Plasma Bloom',
    start: 'start',
    nodes: {
      start: {
        text:
          'A flower of ionized gas, kilometers across, unfolding in slow motion. Its petals are rich in exotic isotopes — excellent for spinning thread, if you can scoop it before the bloom closes.\n\nIts center is the hottest thing in the system.',
        choices: [
          { label: 'Skim the outer petals.', run: (ctx) => ctx.gainFuel(2) },
          {
            label: 'Dive toward the center.',
            run: (ctx) => {
              if (ctx.check('navigation', 3)) {
                ctx.gainFuel(6);
                ctx.gainXp(25);
              } else {
                ctx.gainFuel(3);
                ctx.damageHull(20);
              }
            },
          },
          {
            label: 'Bottle some for sale.',
            req: { apt: { salvage: 2 } },
            run: (ctx) => {
              ctx.gainFuel(1);
              ctx.gainCredits(cr(ctx, 80));
            },
          },
        ],
      },
    },
  },

  // 5 -----------------------------------------------------------------------
  {
    id: 'ev_anom_gravity_garden',
    sites: ['anomaly'],
    title: 'The Orrery',
    start: 'start',
    nodes: {
      start: {
        text:
          'Thousands of objects orbit nothing at all: rocks, ship parts, a teapot, a whole frozen lake. Their paths knot into a structure too regular to be natural. An orrery, with no sun.\n\nAt the center, where the sun should be, a pale bead the size of your fist.',
        choices: [
          {
            label: 'Fish for valuables in the outer orbits.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 50));
              ctx.giveItem();
            },
          },
          {
            label: 'Navigate to the center.',
            req: { apt: { navigation: 2 } },
            run: (ctx) => (ctx.check('navigation', 4) ? 'center' : 'collide'),
          },
          {
            label: 'Calculate the orrery\'s pattern.',
            req: { apt: { science: 3 } },
            run: (ctx) => {
              ctx.revealMap(2);
              ctx.gainXp(35);
              ctx.note('The orrery is a map. Of the Shoal. As it will look in a few days.');
            },
          },
        ],
      },
      center: {
        text: 'You thread every orbit. The bead is cool and very heavy. As you leave, the entire orrery quietly collapses inward, as if it had only been waiting for someone to take it.',
        enter: (ctx) => {
          if (!ctx.giveRelic('gravity_pearl')) ctx.giveItem({ minRarity: 2 });
        },
      },
      collide: {
        text: 'A frozen lake clips your port side. Then the teapot. The teapot, inexplicably, does the most damage.',
        enter: (ctx) => ctx.damageHull(18),
      },
    },
  },

  // 6 -----------------------------------------------------------------------
  {
    id: 'ev_anom_probability',
    sites: ['anomaly'],
    title: 'Probability Squall',
    start: 'start',
    nodes: {
      start: {
        text:
          'Inside the squall, unlikely things happen constantly. A coin lands on its edge eleven times. {off} wins a card game they were not playing. A bolt that has never been loose falls out of the ceiling.\n\nYou could ride it out, or try to steer the weirdness.',
        choices: [
          {
            label: 'Roll the dice. Fly straight through.',
            run: (ctx) => {
              const r = ctx.rng.int(0, 4);
              if (r === 0) ctx.gainCredits(cr(ctx, 120));
              else if (r === 1) ctx.damageHull(15);
              else if (r === 2) ctx.giveItem();
              else if (r === 3) {
                ctx.loseFuel(1);
                ctx.gainFuel(4);
                ctx.note('Your spools briefly held more thread than they can.');
              } else {
                const o = ctx.addOfficer();
                if (o) ctx.note(`${o.name} is suddenly aboard. They are as surprised as you are. They were, apparently, always on the crew roster.`);
                else ctx.gainXp(40);
              }
            },
          },
          {
            label: 'Steer the squall with careful observation.',
            req: { apt: { science: 3 } },
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.gainCredits(cr(ctx, 60));
            },
          },
          { label: 'Go around.', run: (ctx) => ctx.loseFuel(1) },
        ],
      },
    },
  },

  // 7 -----------------------------------------------------------------------
  {
    id: 'ev_anom_warden_wake',
    sites: ['anomaly'],
    title: 'A Wake in Space',
    minDepth: 1,
    start: 'start',
    nodes: {
      start: {
        text:
          'A trail of disturbed space, like the wake behind a boat. Something enormous passed through here recently — something that moves without engines and leaves no heat.\n\nThe trail leads off the lanes into nothing.',
        choices: [
          {
            label: 'Follow the wake.',
            next: 'follow',
          },
          {
            label: 'Sample the disturbance.',
            run: (ctx) => {
              if (ctx.check('science', 2)) {
                ctx.unlockCodex('lore.wardens');
                ctx.gainXp(30);
              } else ctx.gainXp(10);
            },
          },
          { label: 'Leave. Quietly.' },
        ],
      },
      follow: {
        text:
          'The wake ends at the remains of a ship. Not destroyed. Erased: its hull smoothed, its weapons folded inward, its name scrubbed off. As if it were being edited.\n\nOn its last log entry, the captain notes they had been in-system "for a while now. It\'s nice here. Think I\'ll stay."',
        choices: [
          {
            label: 'Salvage what\'s left.',
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.unlockCodex('lore.wardens');
              if (ctx.chance(0.4)) ctx.combat({ side: 'warden', count: 2, announce: 'The editors return' });
            },
          },
          {
            label: 'Study the erasure pattern.',
            req: { apt: { science: 4 } },
            run: (ctx) => {
              ctx.unlockCodex('lore.wardens');
              if (!ctx.giveRelic('warden_key')) ctx.gainXp(60);
              ctx.note('The pattern is a signature. A key, of sorts. You copy it into the ship\'s transponder.');
            },
          },
        ],
      },
    },
  },

  // 8 -----------------------------------------------------------------------
  {
    id: 'ev_anom_bottle',
    sites: ['anomaly'],
    title: 'Message in a Lane',
    weight: 1.2,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          ctx.metaFlag('ev.bottle') !== undefined && ctx.metaFlag('ev.bottleRun') !== ctx.runNumber
            ? 'A pocket of folded hyperspace, where signals circle forever. One of them is addressed to you. It is in your own voice.\n\n' +
              bottleText(ctx) +
              '\n\nThe pocket offers to carry a reply. To whoever comes next.'
            : 'A pocket of folded hyperspace, where signals circle forever. Fragments of messages drift through it: last words, coordinates, love letters, an advertisement for a restaurant that closed a thousand years ago.\n\nThere is room for one more.',
        enter: (ctx) => {
          if (ctx.metaFlag('ev.bottle') !== undefined && ctx.metaFlag('ev.bottleRun') !== ctx.runNumber) {
            ctx.gainXp(30);
            if (ctx.metaFlag('ev.bottle') === 'map') ctx.revealMap(1);
          }
        },
        choices: [
          {
            label: 'Leave a message of hope.',
            run: (ctx) => {
              ctx.setMetaFlag('ev.bottle', 'hope');
              ctx.setMetaFlag('ev.bottleRun', ctx.runNumber);
              ctx.gainXp(10);
            },
          },
          {
            label: 'Leave a warning.',
            run: (ctx) => {
              ctx.setMetaFlag('ev.bottle', 'warn');
              ctx.setMetaFlag('ev.bottleRun', ctx.runNumber);
              ctx.gainXp(10);
            },
          },
          {
            label: 'Leave your lane charts.',
            req: { apt: { navigation: 2 } },
            run: (ctx) => {
              ctx.setMetaFlag('ev.bottle', 'map');
              ctx.setMetaFlag('ev.bottleRun', ctx.runNumber);
              ctx.gainXp(10);
            },
          },
          {
            label: 'Leave an apology.',
            visible: (ctx) => ctx.runNumber > 1,
            run: (ctx) => {
              ctx.setMetaFlag('ev.bottle', 'sorry');
              ctx.setMetaFlag('ev.bottleRun', ctx.runNumber);
              ctx.gainXp(10);
            },
          },
          {
            label: 'Fish out the restaurant ad instead.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 30));
              ctx.note('It includes a coupon. Some station somewhere still honors it, presumably out of sheer bewilderment.');
            },
          },
        ],
      },
    },
  },
];
