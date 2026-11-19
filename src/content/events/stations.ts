import type { EventDef, OfficerRole } from '../../game/api';
import { cr, rep } from './util';

const ROLES: OfficerRole[] = ['gunner', 'engineer', 'navigator', 'xenologist', 'medic', 'quartermaster', 'spy'];

export const STATION_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_station_death_ledger',
    sites: ['station'],
    title: 'The Keeper of Accounts',
    unique: true,
    weight: 1.5,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const visits = Number(ctx.metaFlag('ev.keeper') ?? 0);
          if (visits === 0)
            return 'In a back corridor of {poi}, an old clerk sits behind a desk piled with ledgers. She looks up as you pass, then looks at you a second time, longer.\n\n"New one. Hm. Sit. I keep accounts. I\'ll be keeping yours, I expect."';
          if (visits < 3)
            return `The old clerk is here again — or still — though the station is a different station and the corridor is a different corridor.\n\n"Back. That's ${visits + 1} times now I've seen your face. Different face, mind. Same eyes." She opens a ledger to a page with your name on it. Several names, actually.`;
          return `"Ah. You." The clerk doesn't look up. "Visit ${visits + 1}. Sit, sit. I've started a second volume for you. Shelf space isn't free, you know."`;
        },
        choices: [
          {
            label: 'Ask what she writes down.',
            next: 'what',
          },
          {
            label: 'Ask her to strike your name out.',
            run: (ctx) => {
              ctx.note('"Can\'t. Ink\'s not mine, it\'s the Shoal\'s. But I can make the margins kinder." She writes something small. You feel lighter.');
              ctx.repairHull(Math.round(ctx.maxHull * 0.3));
            },
          },
          {
            label: 'Pay her for her trouble.',
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 25));
              ctx.note('She takes the money, which surprises you, and gives you back a slip of paper with lane coordinates, which surprises you more.');
              ctx.revealMap(2);
            },
          },
        ],
      },
      what: {
        text: (ctx) =>
          ctx.runNumber > 1
            ? `"How you died. Where. What you were carrying. Who you left behind." She taps the page. "${ctx.runNumber - 1} entr${ctx.runNumber === 2 ? 'y' : 'ies'} so far. You're an interesting read. Not a happy one."`
            : '"Births. Deaths. Debts. Yours is a short entry so far. One line. \'Woke.\'" She smiles thinly. "They get longer."',
        enter: (ctx) => {
          ctx.setMetaFlag('ev.keeper', Number(ctx.metaFlag('ev.keeper') ?? 0) + 1);
          ctx.unlockCodex('lore.ledger');
          ctx.gainXp(20 + 5 * Math.min(ctx.runNumber, 10));
        },
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_station_loan',
    sites: ['station'],
    title: 'The Velvet Window',
    maxDepth: 5,
    condition: (ctx) => ctx.flag('ev_loan') === undefined,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `A booth with velvet curtains. A sign: LOANS. NO QUESTIONS. SOME ANSWERS. Behind the curtain, a soft voice: "Captain. You look like someone with a future. We'd like to invest. ${cr(ctx, 120)} credits, now. Repay at your leisure. Our collectors are very patient people. Until they aren't."`,
        choices: [
          {
            label: (ctx) => `Take the loan (${cr(ctx, 120)}).`,
            run: (ctx) => {
              const n = cr(ctx, 120);
              ctx.gainCredits(n);
              ctx.setFlag('ev_loan', n);
              ctx.setFlag('ev_loan_depth', ctx.depth);
            },
          },
          {
            label: 'Ask what happens to those who don\'t pay.',
            run: (ctx) => {
              ctx.note('"They pay," says the voice. A pause. "Eventually. In some currency."');
              return 'start';
            },
          },
          {
            label: 'Have {off:spy} look into who runs the Window.',
            req: { officer: 'spy' },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 60));
              ctx.note('{off:spy} returns with the Window\'s collection list. You sell it to three people on it.');
              ctx.setFlag('ev_loan', 'avoided');
            },
          },
          { label: 'Walk away.' },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_station_pit',
    sites: ['station'],
    title: 'The Drone Pit',
    start: 'start',
    nodes: {
      start: {
        text:
          'Down in the station\'s cargo levels, a crowd surrounds a pit where combat drones tear each other apart. Bets fly. The house drone, a battered thing called GRANDMOTHER, has won 41 fights straight.',
        choices: [
          {
            label: (ctx) => `Bet ${cr(ctx, 40)} on GRANDMOTHER.`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 40));
              if (ctx.chance(0.7)) ctx.gainCredits(cr(ctx, 60));
              else ctx.note('Fight 42 is GRANDMOTHER\'s last. The crowd is silent. Someone starts a slow clap that nobody joins.');
            },
          },
          {
            label: (ctx) => `Bet ${cr(ctx, 40)} on the challenger.`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 40));
              if (ctx.chance(0.3)) ctx.gainCredits(cr(ctx, 150));
              else ctx.note('GRANDMOTHER wins in eleven seconds. 42 straight.');
            },
          },
          {
            label: 'Enter your own drone, built from spare parts.',
            req: { apt: { engineering: 3 } },
            run: (ctx) => {
              if (ctx.check('engineering', 3)) {
                ctx.gainCredits(cr(ctx, 140));
                ctx.note('Your drone, cobbled from a toaster and a point-defense turret, beats GRANDMOTHER. The crowd carries you out. Someone weeps.');
              } else {
                ctx.loseItem();
                ctx.note('Your drone lasts four seconds. GRANDMOTHER eats its parts.');
              }
            },
          },
          {
            label: 'Rig the fight.',
            req: { apt: { guile: 3 } },
            run: (ctx) => {
              if (ctx.check('guile', 2)) {
                ctx.gainCredits(cr(ctx, 120));
              } else {
                ctx.damageHull(10);
                rep(ctx, -10);
                ctx.note('The pit bosses find the magnet. They escort you to your ship and dent it thoughtfully on the way.');
              }
            },
          },
        ],
      },
    },
  },

  // 4 -----------------------------------------------------------------------
  {
    id: 'ev_station_oracle',
    sites: ['station'],
    title: 'The Lane-Reader',
    start: 'start',
    nodes: {
      start: {
        text:
          'A fortune teller\'s stall on {poi}. The reader is blind, and lays out navigation charts like tarot cards. "I read lanes, Captain. Where they go. Where they\'ll go. Cross my palm."',
        choices: [
          {
            label: (ctx) => `Pay for a reading (${cr(ctx, 30)}).`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 30));
              ctx.revealMap(2);
            },
          },
          {
            label: (ctx) => `Pay for the deep reading (${cr(ctx, 80)}).`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 80));
              return 'deep';
            },
          },
          {
            label: 'Call her a fraud and test her.',
            req: { apt: { navigation: 3 } },
            run: (ctx) => {
              ctx.note('You quiz her on lanes you know. She answers every one correctly, then corrects two you got wrong. You leave chastened, and better informed.');
              ctx.revealMap(1);
              ctx.gainXp(25);
            },
          },
        ],
      },
      deep: {
        text: (ctx) =>
          `She turns a card. It shows the Heart. She turns another. It shows your ship, the ${ctx.shipName}. She turns a third. It is blank.\n\n"That one's not been drawn yet," she says. "You draw it. Everyone thinks I mean that as a metaphor."`,
        enter: (ctx) => {
          ctx.revealMap(4);
          ctx.gainXp(30);
        },
      },
    },
  },

  // 5 -----------------------------------------------------------------------
  {
    id: 'ev_station_bar',
    sites: ['station'],
    title: 'The Hiring Bar',
    condition: (ctx) => ctx.officers.length < 4,
    start: 'start',
    nodes: {
      start: {
        text:
          'A bar on {poi} where spacers sit with signs on their tables: WILL WORK FOR PASSAGE. Most of them look like trouble. A few look like useful trouble.',
        choices: [
          {
            label: (ctx) => `Hire the one with the good references (${cr(ctx, 60)}).`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 60));
              ctx.addOfficer(ctx.rng.pick(ROLES));
            },
          },
          {
            label: 'Hire the one who can\'t pay their tab.',
            run: (ctx) => {
              const o = ctx.addOfficer();
              if (o) {
                ctx.loseCredits(cr(ctx, 20));
                ctx.note(`${o.name} is ${o.trait}, which explains the tab. You pay it.`);
              }
            },
          },
          {
            label: 'Look for someone specific.',
            req: { apt: { diplomacy: 2 } },
            next: 'specific',
          },
        ],
      },
      specific: {
        text: 'You ask around. People point. What do you need?',
        choices: ROLES.map((r) => ({
          label: `A ${r}.`,
          run: (ctx) => {
            ctx.loseCredits(cr(ctx, 50));
            ctx.addOfficer(r);
          },
        })),
      },
    },
  },

  // 6 -----------------------------------------------------------------------
  {
    id: 'ev_station_seeds',
    sites: ['station'],
    title: 'The Botanist',
    weight: 4,
    unique: true,
    condition: (ctx) => typeof ctx.flag('ev_seeds') === 'number',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `In a hydroponics bay on {poi}, an old botanist notices the canister${Number(ctx.flag('ev_seeds')) > 1 ? 's' : ''} you're carrying. Her hands start to shake.\n\n"Those are from the Vault. My grandmother helped seal it. I never thought — may I see?"`,
        choices: [
          {
            label: 'Give them to her.',
            run: (ctx) => {
              ctx.setFlag('ev_seeds', 'given');
              ctx.gainXp(40);
              ctx.repairHull(Math.round(ctx.maxHull * 0.4));
              ctx.giveItem({ minRarity: 1 });
              rep(ctx, 10);
              ctx.note('She plants one immediately. In the morning there is a green shoot, and she has refitted half your ship out of gratitude.');
            },
          },
          {
            label: 'Sell them to her.',
            run: (ctx) => {
              const n = Number(ctx.flag('ev_seeds'));
              ctx.setFlag('ev_seeds', 'sold');
              ctx.gainCredits(cr(ctx, 40 + 15 * Math.min(n, 12)));
            },
          },
          {
            label: 'Keep them. You promised to plant them yourself.',
            run: (ctx) => {
              ctx.note('"Then plant them somewhere good," she says. "Somewhere deep." You will.');
              ctx.gainXp(15);
            },
          },
        ],
      },
    },
  },

  // 7 -----------------------------------------------------------------------
  {
    id: 'ev_station_black_market',
    sites: ['station'],
    title: 'Under the Counter',
    start: 'start',
    nodes: {
      start: {
        text:
          'A vendor on {poi} sells "souvenirs." Under the counter, she sells other things. She leans forward. "For you, Captain, a special item. No provenance. No refunds. No questions. Possibly cursed."',
        choices: [
          {
            label: (ctx) => `Buy the mystery item (${cr(ctx, 90)}).`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 90));
              if (ctx.chance(0.15)) {
                if (!ctx.giveRelic()) ctx.giveItem({ minRarity: 2 });
              } else if (ctx.chance(0.7)) ctx.giveItem({ minRarity: 1 });
              else ctx.note('It is a rock. It is, you have to admit, a very nice rock.');
            },
          },
          {
            label: 'Sell her something from your hold.',
            run: (ctx) => {
              const it = ctx.loseItem();
              if (it) ctx.gainCredits(cr(ctx, 70));
              else ctx.note('"Come back when you have something."');
            },
          },
          {
            label: 'Appraise her stock properly.',
            req: { apt: { salvage: 3 } },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 50));
              ctx.giveItem({ minRarity: 2 });
              ctx.note('You spot the one genuine treasure in a box of junk and buy it at junk prices. She knows. She respects it.');
            },
          },
        ],
      },
    },
  },
];
