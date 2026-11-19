import type { EventDef } from '../../game/api';
import { cr } from './util';

export const DISTRESS_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_distress_bait',
    sites: ['distress'],
    title: 'Mayday, Mayday',
    start: 'start',
    nodes: {
      start: {
        text:
          '"Mayday! This is the freighter Plentiful Harvest! Engines out, crew injured, cargo hold full of very valuable things that we would happily give to any rescuer! Please hurry!"\n\nThe voice is a little too cheerful for a mayday.',
        choices: [
          { label: 'Go to the rescue.', next: 'ambush' },
          {
            label: 'Scan the area before approaching.',
            run: (ctx) => (ctx.check('science', 1) || ctx.check('navigation', 2) ? 'spotted' : 'ambush'),
          },
          {
            label: 'Reply in kind: "Mayday! We too are crippled and full of treasure!"',
            req: { apt: { guile: 2 } },
            run: (ctx) => {
              if (ctx.check('guile', 2)) {
                ctx.note('A long silence. Then two raider ships emerge from behind an asteroid and fly toward your "crippled" ship — and right into your opening volley.');
                ctx.combat({ side: 'rogue', count: 2, strength: 0.6, announce: 'Bait for the baiters' });
              } else {
                ctx.note('They are not fooled. They are, however, amused.');
                ctx.combat({ side: 'rogue', count: 3, announce: 'Ambush' });
              }
            },
          },
          { label: 'Ignore it.' },
        ],
      },
      spotted: {
        text: 'Three ships hiding in the shadow of a moon, engines cold, guns warm. The freighter is a gutted hulk with a transmitter.',
        choices: [
          {
            label: 'Attack the ambushers first.',
            run: (ctx) => ctx.combat({ side: 'rogue', count: 3, strength: 0.8, announce: 'Hunting the hunters' }),
          },
          {
            label: 'Steal their transmitter. It\'s a good one.',
            req: { apt: { salvage: 2 } },
            run: (ctx) => {
              ctx.giveItem({ slot: 'utility' });
              ctx.note('You slip away with the bait. Somewhere a raider is going to have a very confusing afternoon.');
            },
          },
          { label: 'Leave quietly.', run: (ctx) => ctx.gainXp(15) },
        ],
      },
      ambush: {
        text: 'You arrive. The freighter is empty. The three ships behind the moon are not.',
        enter: (ctx) => {
          ctx.combat({ side: 'rogue', count: 3, announce: 'Ambush!' });
        },
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_distress_pod',
    sites: ['distress'],
    title: 'Something in the Pod',
    start: 'start',
    nodes: {
      start: {
        text:
          'An escape pod, its beacon fading. Inside: not a person. A small creature, round, with six eyes and an expression of profound worry. It is wearing a tiny spacesuit someone clearly made for it with love.\n\nA note taped to the glass: "PLEASE TAKE CARE OF BISCUIT."',
        choices: [
          {
            label: 'Take care of Biscuit.',
            run: (ctx) => {
              ctx.setFlag('ev_biscuit', true);
              ctx.gainXp(25);
              ctx.note('Biscuit takes up residence in the ventilation ducts. Crew morale improves immeasurably. Hull repairs seem to go faster, though nobody can say why.');
              ctx.repairHull(15);
            },
          },
          {
            label: 'Study it.',
            req: { apt: { science: 2 } },
            run: (ctx) => {
              ctx.setFlag('ev_biscuit', true);
              ctx.gainXp(40);
              ctx.note('Biscuit is a pre-sentient species that eats metal corrosion. It is the most efficient hull-maintenance organism known. Also, it purrs.');
              ctx.repairHull(30);
            },
          },
          {
            label: 'Sell it to a collector.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 110));
              if (ctx.officers.length > 0) ctx.note('{off} looks at the empty pod for a long time.');
            },
          },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_distress_plague',
    sites: ['distress'],
    title: 'Quarantine',
    start: 'start',
    nodes: {
      start: {
        text:
          'A hospital ship, flying the yellow flag of quarantine. Its captain is pale on the comm. "We have medicine — enough — but our engines failed and the fever is spreading to the engineers. Can you help? Do not dock. Please do not dock."',
        choices: [
          {
            label: 'Send {off:medic} over in a suit.',
            req: { officer: 'medic' },
            run: (ctx) => {
              ctx.gainXp(40);
              ctx.gainCredits(cr(ctx, 80));
              ctx.giveItem({ minRarity: 1 });
              ctx.note('{off:medic} spends three days aboard, comes back exhausted and triumphant. The fever is broken. The ship\'s chief surgeon sends a gift.');
            },
          },
          {
            label: 'Talk their crew through the engine repair remotely.',
            req: { apt: { engineering: 2 } },
            run: (ctx) => {
              if (ctx.check('engineering', 3)) {
                ctx.gainXp(35);
                ctx.gainCredits(cr(ctx, 50));
              } else {
                ctx.note('After nine hours of "no, the OTHER red wire," they get it limping. Barely. They thank you anyway.');
                ctx.gainXp(15);
              }
            },
          },
          {
            label: 'Tow them to the nearest station.',
            req: { fuel: 3 },
            run: (ctx) => {
              ctx.loseFuel(2);
              ctx.gainXp(30);
              ctx.gainCredits(cr(ctx, 60));
              if (ctx.chance(0.2) && ctx.officers.length > 0) {
                const o = ctx.officers[ctx.rng.int(0, ctx.officers.length - 1)];
                ctx.removeOfficer(o.id, 'stayed behind with fever');
                ctx.note(`${o.name} caught the fever on the tow cable work. They stay aboard the hospital ship to recover.`);
              }
            },
          },
          {
            label: 'Board them and take the medicine.',
            run: (ctx) => {
              ctx.giveItem({ slot: 'utility', minRarity: 1 });
              ctx.damageHull(10);
              ctx.note('No one resists. That is the worst part.');
            },
          },
          { label: 'Wish them luck and go.' },
        ],
      },
    },
  },

  // 4 -----------------------------------------------------------------------
  {
    id: 'ev_distress_miner',
    sites: ['distress'],
    title: 'Pinned',
    start: 'start',
    nodes: {
      start: {
        text:
          'A one-person mining skiff pinned beneath a tumbling boulder. The miner, a grizzled old prospector, is on the comm.\n\n"Look, I\'ve got air for six hours and a claim worth a fortune. Get this rock off me and we split it. Fair\'s fair."',
        choices: [
          {
            label: 'Nudge the boulder off with your hull.',
            run: (ctx) => {
              if (ctx.check('navigation', 2)) {
                ctx.gainCredits(cr(ctx, 90));
                ctx.note('One gentle nudge, and the boulder spins away. The prospector, true to their word, splits the claim.');
              } else {
                ctx.damageHull(15);
                ctx.gainCredits(cr(ctx, 50));
              }
            },
          },
          {
            label: 'Cut the boulder apart.',
            req: { apt: { salvage: 2 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 130));
              ctx.note('The boulder was full of ore. You split that too.');
            },
          },
          {
            label: '"Make it 80/20 and I\'ll help."',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 120));
              ctx.note('"...Fine. You\'d have made a good prospector. Terrible person, good prospector."');
            },
          },
          {
            label: 'Recruit them.',
            visible: (ctx) => ctx.officers.length < 4,
            run: (ctx) => {
              ctx.addOfficer('quartermaster');
              ctx.note('"Claim\'s busted anyway. I\'ve always wanted to see the Heart."');
            },
          },
        ],
      },
    },
  },

  // 5 -----------------------------------------------------------------------
  {
    id: 'ev_distress_ancient_beacon',
    sites: ['distress'],
    title: 'Four Hundred Years Late',
    start: 'start',
    nodes: {
      start: {
        text:
          'The beacon is ancient. Its signal format went obsolete centuries ago; your computer needs ten minutes to decode it.\n\n"Colony ship Perseverance. Hull breach. 4,000 souls. We will wait for rescue. We will wait for as long as it takes."\n\nThe ship is right there. Its lights are on.',
        choices: [
          { label: 'Board the colony ship.', next: 'board' },
          { label: 'Answer the beacon.', next: 'answer' },
          { label: 'Leave. You know how this ends.' },
        ],
      },
      board: {
        text:
          'The breach was sealed long ago. The colonists did not wait. They built a society inside the hull, generation after generation. A few hundred descendants, who have never seen a sky, stare at you in awe.\n\n"Are you... the rescue?"',
        choices: [
          {
            label: '"Yes." Lead them to a habitable world.',
            req: { fuel: 3 },
            run: (ctx) => {
              ctx.loseFuel(3);
              ctx.gainXp(60);
              ctx.unlockCodex('lore.perseverance');
              ctx.note('They follow you to a green world. On landing, an old woman steps out, touches soil, and says, "Four hundred years. We waited." Then she laughs.');
              if (ctx.officers.length < 4 && ctx.chance(0.6)) ctx.addOfficer();
            },
          },
          {
            label: 'Give them charts and supplies instead.',
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 30));
              ctx.gainXp(30);
              ctx.unlockCodex('lore.perseverance');
            },
          },
          {
            label: 'Trade with them. They have old tech.',
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.note('They give you a working prototype from the age of their ancestors, in exchange for a mirror. Nobody aboard had seen their own face in a hundred years.');
            },
          },
        ],
      },
      answer: {
        text: '"Rescue acknowledged," the beacon responds. Then: "Thank you. We can stop waiting now." The lights on the colony ship turn off, one by one.',
        enter: (ctx) => {
          ctx.gainXp(20);
          ctx.unlockCodex('lore.perseverance');
        },
      },
    },
  },
];
