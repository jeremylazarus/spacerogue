import type { EventDef } from '../../game/api';
import { cr } from './util';

export const ASTEROID_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_rock_hermit',
    sites: ['asteroid'],
    title: 'The Hollow Rock',
    start: 'start',
    nodes: {
      start: {
        text:
          'The asteroid has a door. A small, round, painted door, with a knocker.\n\nWhen you knock, a very old person in a very patched spacesuit opens it. "Visitors! Come in, come in. Mind the gravity, it\'s homemade."',
        choices: [
          { label: 'Go in.', next: 'inside' },
          {
            label: 'Ask about the rock\'s ore.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 40));
              ctx.note('"Ore? Oh, I ate most of it. Kidding. Here, take a sack."');
            },
          },
        ],
      },
      inside: {
        text: (ctx) =>
          ctx.flag('ev_biscuit') === true
            ? 'The hermit\'s home is cozy, crammed with trinkets. Then a small round shape with six eyes tumbles out of your cargo bag and the hermit drops their teacup.\n\n"BISCUIT?"'
            : 'The hermit\'s home is cozy, crammed with forty years of trinkets. They pour you tea from a pot that was obviously once part of a reactor. "Don\'t get many visitors. Tell me about the Shoal. Is it still shrinking?"',
        choices: [
          {
            label: 'Return Biscuit.',
            visible: (ctx) => ctx.flag('ev_biscuit') === true,
            run: (ctx) => {
              ctx.setFlag('ev_biscuit', 'home');
              ctx.gainXp(50);
              const r = ctx.chance(0.4) ? ctx.giveRelic() : null;
              if (!r) ctx.giveItem({ minRarity: 2 });
              ctx.note('The hermit weeps. They had put Biscuit in the pod when the pirates came, and never thought they\'d see it again. They insist you take "the good thing from the shelf."');
            },
          },
          {
            label: 'Tell them the truth: it is.',
            run: (ctx) => {
              ctx.unlockCodex('lore.tide');
              ctx.gainXp(20);
              ctx.note('"Thought so. My door used to open onto a busier lane." They give you a spool of homespun thread. It is suspiciously strong.');
              ctx.gainFuel(2);
            },
          },
          {
            label: 'Lie, gently: "No, it\'s fine."',
            run: (ctx) => {
              ctx.repairHull(15);
              ctx.note('"Good. Good." They patch your hull while humming, contented.');
            },
          },
        ],
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_rock_vein',
    sites: ['asteroid'],
    title: 'Mother Lode',
    start: 'start',
    nodes: {
      start: {
        text:
          'The asteroid is threaded with a vein of something that glows blue under your lights. Your scanners don\'t recognize it. Your quartermaster instinct does: it\'s worth a lot.\n\nThe rock is also spinning, cracked, and only barely holding itself together.',
        choices: [
          {
            label: 'Mine the surface. Safe and quick.',
            run: (ctx) => ctx.gainCredits(cr(ctx, 50)),
          },
          {
            label: 'Drill to the core.',
            run: (ctx) => {
              if (ctx.check('salvage', 3)) {
                ctx.gainCredits(cr(ctx, 150));
                ctx.gainXp(20);
              } else {
                ctx.damageHull(22);
                ctx.gainCredits(cr(ctx, 70));
                ctx.note('The rock splits. Half of it hits you.');
              }
            },
          },
          {
            label: 'Analyze the blue mineral first.',
            req: { apt: { science: 2 } },
            next: 'mineral',
          },
        ],
      },
      mineral: {
        text: 'The blue material is crystallized hyperspace. Lane-stuff, frozen solid. It hums faintly at the same pitch as the static between systems. It would spin into superb thread, or a very valuable curiosity.',
        choices: [
          { label: 'Spin it into thread.', run: (ctx) => ctx.gainFuel(5) },
          { label: 'Sell it as a curiosity.', run: (ctx) => ctx.gainCredits(cr(ctx, 130)) },
          {
            label: 'Have {off:engineer} build something with it.',
            req: { officer: 'engineer' },
            run: (ctx) => {
              ctx.giveItem({ minRarity: 2 });
              ctx.note('{off:engineer} works for 30 hours straight and emerges with something that should not work. It does.');
            },
          },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_rock_heartbeat',
    sites: ['asteroid'],
    title: 'A Heartbeat in Stone',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          ctx.flag('ev_hatchling') === true
            ? 'The asteroid has a heartbeat. Slow, massive, rhythmic.\n\nThen something huge uncoils from behind it, and you recognize the glistening head. The hatchling from the nesting world. Bigger now. Much bigger. It has been following you.'
            : 'Your seismic probe registers a pulse inside the asteroid. Slow. Rhythmic. Like a heartbeat.\n\nThe rock is warm. The surface is faintly, slowly flexing.',
        choices: [
          {
            label: 'Greet the hatchling.',
            visible: (ctx) => ctx.flag('ev_hatchling') === true,
            run: (ctx) => {
              ctx.setFlag('ev_hatchling', 'grown');
              ctx.repairHull(ctx.maxHull);
              ctx.gainFuel(3);
              ctx.giveItem({ minRarity: 2 });
              ctx.note('It nuzzles your hull, leaves a gift of shed scales that harden into perfect armor plate, and winds warm, glistening thread onto your spools. Then it is gone, into the deep.');
            },
          },
          {
            label: 'Crack it open.',
            visible: (ctx) => ctx.flag('ev_hatchling') !== true,
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 100));
              ctx.combat({ side: 'monster', strength: 1.3, announce: 'Something hatches angry' });
            },
          },
          {
            label: 'Listen to the heartbeat.',
            visible: (ctx) => ctx.flag('ev_hatchling') !== true,
            run: (ctx) => {
              if (ctx.check('science', 2)) {
                ctx.gainXp(35);
                ctx.note('It is not an egg. It is something sleeping, and it is dreaming of you, and you leave very carefully.');
              } else {
                ctx.gainXp(10);
              }
            },
          },
          { label: 'Leave it alone.', visible: (ctx) => ctx.flag('ev_hatchling') !== true },
        ],
      },
    },
  },
];
