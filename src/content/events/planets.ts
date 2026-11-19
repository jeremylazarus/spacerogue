import type { EventDef } from '../../game/api';
import { cr, rep, side } from './util';

export const PLANET_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_planet_singing_moss',
    sites: ['planet'],
    title: 'The Humming Moss',
    start: 'start',
    nodes: {
      start: {
        text:
          'The surface of {poi} is carpeted in a grey-green moss. When your landing struts touch it, the whole valley begins to hum. One long chord, perfectly in tune with the hyperspace static your comms pick up between systems.\n\n{off} takes off their helmet seal for a moment, then very quickly puts it back on.',
        choices: [
          {
            label: 'Harvest a few crates. Someone will pay for singing moss.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 60));
              if (ctx.chance(0.4)) {
                ctx.note('For three days the cargo hold hums at night. Nobody sleeps well.');
                ctx.damageHull(4);
              }
            },
          },
          {
            label: 'Run a full spectral analysis of the chord.',
            req: { apt: { science: 2 } },
            run: (ctx) => (ctx.check('science', 3) ? 'analysis' : 'analysis_fail'),
          },
          {
            label: 'Hum back.',
            run: () => 'humback',
          },
          { label: 'Leave it undisturbed.', run: (ctx) => ctx.gainXp(10) },
        ],
      },
      analysis: {
        text:
          'The chord is not one note. It is thousands of voices, compressed and sustained, each holding the same pitch with superhuman patience. The moss is not making the sound. It is listening to it, and repeating.\n\nYou file the recording. It feels like eavesdropping.',
        enter: (ctx) => {
          ctx.unlockCodex('lore.choir_moss');
          ctx.gainXp(35);
        },
      },
      analysis_fail: {
        text: 'The sensors saturate and the analysis returns a single word: OVERFLOW. The data is junk, but you got close to something.',
        enter: (ctx) => ctx.gainXp(15),
      },
      humback: {
        text:
          'You hum. Badly. The valley goes silent for a long moment.\n\nThen the moss hums your off-key note back to you, exactly, and the soil underfoot loosens. Something metallic surfaces among the roots, offered up like a cat brings a bird.',
        enter: (ctx) => {
          ctx.giveItem({ minRarity: 1 });
        },
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_planet_dinner_colony',
    sites: ['planet'],
    title: 'Supper, Interrupted',
    start: 'start',
    nodes: {
      start: {
        text:
          'A small colony dome on {poi}. Lights on, air good, tables set. Plates of food long since gone to dust. Chairs pushed back as if everyone stood up at once, mid-sentence.\n\nNo bodies. No damage. One child\'s drawing on the wall shows a lot of people walking up a ladder into the sky.',
        choices: [
          { label: 'Check the colony logs.', run: () => 'logs' },
          {
            label: 'Search the habitat for anything worth taking.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 45));
              ctx.gainFuel(1);
              if (ctx.chance(0.3)) return 'ladder';
            },
          },
          { label: 'Look for the cryo bay. Colonies always have one.', run: () => 'cryo' },
        ],
      },
      logs: {
        text:
          'The last entry is from the administrator: "The music is so much clearer tonight. Everyone hears it. We\'re going up after dessert."\n\nThere is no dessert in the logs. There is no "after."',
        enter: (ctx) => {
          ctx.unlockCodex('lore.choir');
          ctx.gainXp(20);
        },
        choices: [
          { label: 'Go to the cryo bay.', next: 'cryo' },
          { label: 'Leave. Quickly.' },
        ],
      },
      ladder: {
        text:
          'Behind a storage locker you find a real ladder, bolted to nothing, standing upright in the middle of the room. It goes up about four meters and stops.\n\nYou do not climb it. You do take a photograph, which comes out completely white.',
        enter: (ctx) => ctx.gainXp(25),
      },
      cryo: {
        text:
          'One pod is occupied. The display reads "PUNISHMENT: 30 DAYS. TOO NOISY AT SUPPER." The occupant has been in for considerably longer than thirty days.',
        choices: [
          {
            label: 'Thaw them out.',
            run: (ctx) => {
              const o = ctx.addOfficer();
              if (o) {
                ctx.note(`${o.name} wakes, asks where everyone went, and then — after you explain — asks if your ship has a spare bunk. It does now.`);
              } else {
                ctx.note('They wake, thank you, and decide to wait for the others. You leave them rations and a working radio.');
                ctx.gainXp(20);
              }
            },
          },
          {
            label: 'Strip the pod for parts instead.',
            run: (ctx) => {
              ctx.giveItem({ slot: 'utility' });
              ctx.note('The pod\'s display flickers to "OCCUPANT: COMPLAINING" as the power drops. Then nothing.');
            },
          },
          { label: 'Leave them sleeping. Whatever happened here, they were spared it.' },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_planet_toll',
    sites: ['planet'],
    title: 'Landing Fees',
    condition: (ctx) => ctx.faction !== null,
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `A ${ctx.faction?.species ?? 'local'} customs officer flags you down the moment you touch ground on {poi}. There is a landing fee. There is also, apparently, a fee for having been asked about the landing fee. The total is ${cr(ctx, 40)} credits.`,
        choices: [
          {
            label: (ctx) => `Pay the ${cr(ctx, 40)} credits.`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 40));
              rep(ctx, 8);
              ctx.note('Stamped, sealed, and given a little commemorative pin.');
            },
          },
          {
            label: 'Claim diplomatic immunity, citing a treaty you just invented.',
            run: (ctx) => {
              if (ctx.check('guile', 2)) {
                ctx.note('The officer has never heard of the Treaty of Unfortunate Delays but is not about to admit it.');
                rep(ctx, 2);
                ctx.gainXp(20);
              } else {
                ctx.note('The officer has heard that one before. The fee doubles.');
                ctx.loseCredits(cr(ctx, 80));
                rep(ctx, -5);
              }
            },
          },
          {
            label: 'Negotiate a "frequent lander" discount.',
            req: { apt: { diplomacy: 3 } },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 10));
              rep(ctx, 12);
              ctx.note('You leave with a reduced fee, a loyalty card, and the officer\'s private recommendation for a decent fuel depot.');
              ctx.gainFuel(1);
            },
          },
          {
            label: 'Lift off without paying.',
            run: (ctx) => {
              rep(ctx, -12);
              if (ctx.chance(0.5)) {
                ctx.combat({ side: side(ctx), count: 2, strength: 0.7, announce: 'Customs cutters in pursuit' });
              } else {
                ctx.note('A furious message follows you to orbit. Nobody follows the message.');
              }
            },
          },
        ],
      },
    },
  },

  // 4 -----------------------------------------------------------------------
  {
    id: 'ev_planet_glass_desert',
    sites: ['planet'],
    title: 'Fulgurite Fields',
    start: 'start',
    nodes: {
      start: {
        text:
          'Lightning on {poi} is so frequent and so hot that the desert has turned to glass. Every strike leaves a fulgurite: branching tubes of fused sand, some of them taller than your ship.\n\nA storm front is building on the horizon. You have perhaps an hour.',
        choices: [
          {
            label: 'Harvest fulgurites quickly and leave before the storm.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 50));
            },
          },
          {
            label: 'Stay for the storm. The best ones form fresh.',
            run: (ctx) => {
              if (ctx.check('navigation', 2)) {
                ctx.note('You thread the ship between strikes like a needle through cloth.');
                ctx.gainCredits(cr(ctx, 130));
                ctx.gainXp(25);
              } else {
                ctx.damageHull(15);
                ctx.gainCredits(cr(ctx, 70));
              }
            },
          },
          {
            label: 'Have {off:quartermaster} look for something buried in the glass.',
            req: { officer: 'quartermaster' },
            run: () => 'buried',
          },
        ],
      },
      buried: {
        text:
          '{off:quartermaster} spots a shape inside a fulgurite the width of a house: a ship, fused into the glass mid-landing, its hull etched by ten thousand storms.\n\nCutting it free will take time you may not have.',
        choices: [
          {
            label: 'Cut it free.',
            run: (ctx) => {
              if (ctx.check('salvage', 3)) {
                ctx.giveItem({ minRarity: 2 });
              } else {
                ctx.giveItem({ minRarity: 1 });
                ctx.damageHull(10);
                ctx.note('The storm arrives halfway through. You get something, and so does it.');
              }
            },
          },
          { label: 'Just take the hull plating that\'s exposed.', run: (ctx) => ctx.repairHull(15) },
        ],
      },
    },
  },

  // 5 -----------------------------------------------------------------------
  {
    id: 'ev_planet_seed_vault',
    sites: ['planet'],
    title: 'The Seed Vault',
    unique: true,
    start: 'start',
    nodes: {
      start: {
        text:
          'Carved into a polar mountain on {poi}: a vault door, stamped with a sunburst and the words SLEEP WELL in a dozen scripts. Inside, row after row of sealed canisters. Seeds. Millions of them, from worlds that may not exist anymore.\n\nThe vault\'s caretaker drone has been offline for centuries. Its last instruction blinks on a display: "TAKE ONLY WHAT YOU WILL PLANT."',
        choices: [
          {
            label: 'Take one canister. Honor the instruction.',
            run: (ctx) => {
              ctx.setFlag('ev_seeds', 1);
              ctx.gainXp(20);
              ctx.note('The canister is cold and heavier than it should be. Someone, somewhere, will want this.');
            },
          },
          {
            label: 'Take a dozen. You\'re a ship, not a garden.',
            run: (ctx) => {
              ctx.setFlag('ev_seeds', 12);
              ctx.gainCredits(cr(ctx, 40));
              if (ctx.chance(0.5)) {
                ctx.note('The caretaker drone flickers on as you leave, and says, very quietly: "Liar."');
                ctx.damageHull(5);
              }
            },
          },
          {
            label: 'Reactivate the caretaker drone.',
            req: { apt: { engineering: 2 } },
            run: (ctx) => (ctx.check('engineering', 2) ? 'drone' : undefined),
          },
        ],
      },
      drone: {
        text:
          'The drone wakes, takes inventory, and is visibly relieved that someone came. It asks where you are going. You say: deeper.\n\nIt gives you a canister marked HEART-HARDY and the coordinates of a fuel cache the vault builders left "for the next gardener."',
        enter: (ctx) => {
          ctx.setFlag('ev_seeds', 1);
          ctx.gainFuel(3);
          ctx.gainXp(30);
        },
      },
    },
  },

  // 6 -----------------------------------------------------------------------
  {
    id: 'ev_planet_shipwright',
    sites: ['planet'],
    title: 'The Hermit Shipwright',
    start: 'start',
    nodes: {
      start: {
        text:
          'A lone figure on {poi} waves you down with two very large wrenches. They have built a workshop out of a crashed freighter and claim to fix anything that flies.\n\n"Payment," they say, "is a story. A good one. I\'ve heard all the bad ones."',
        choices: [
          {
            label: 'Tell them the truth: you woke in a pod with no memory.',
            run: (ctx) => {
              if (ctx.runNumber > 1) {
                ctx.note('They listen, then say: "And you keep waking? Huh. That one\'s good. Never heard that one."');
                ctx.repairHull(Math.round(ctx.maxHull * 0.5));
              } else {
                ctx.note('"Everyone wakes up with no memory, kid. Most of us just get it gradually." A half-hearted patch job.');
                ctx.repairHull(Math.round(ctx.maxHull * 0.2));
              }
            },
          },
          {
            label: 'Spin them a magnificent lie.',
            run: (ctx) => {
              if (ctx.check('guile', 3)) {
                ctx.note('The tale of the space whale that swallowed a moon goes over very well. They fix your hull and throw in an upgrade.');
                ctx.repairHull(ctx.maxHull);
                ctx.giveItem({ rarity: 1 });
              } else {
                ctx.note('"Heard it. Heard it worse, but heard it." They charge you parts and labor.');
                ctx.loseCredits(cr(ctx, 30));
                ctx.repairHull(Math.round(ctx.maxHull * 0.3));
              }
            },
          },
          {
            label: 'Let {off} tell a story instead.',
            visible: (ctx) => ctx.officers.length > 0,
            run: (ctx) => {
              const o = ctx.officers[ctx.rng.int(0, ctx.officers.length - 1)];
              ctx.note(`${o.name}, being ${o.trait}, tells a story you have never heard before. It is about you. You are not sure it is flattering. The hermit laughs until they cry.`);
              ctx.repairHull(Math.round(ctx.maxHull * 0.4));
              ctx.gainXp(15);
            },
          },
          {
            label: 'Talk shop instead. Engineer to engineer.',
            req: { apt: { engineering: 4 } },
            run: (ctx) => {
              ctx.repairHull(ctx.maxHull);
              ctx.giveItem({ minRarity: 1 });
              ctx.note('You argue about coupling ratios until dawn. It is the best night either of you has had in years.');
            },
          },
        ],
      },
    },
  },

  // 7 -----------------------------------------------------------------------
  {
    id: 'ev_planet_coin_rain',
    sites: ['planet'],
    title: 'It Is Raining Money',
    archetypes: ['mercantile'],
    start: 'start',
    nodes: {
      start: {
        text:
          'An orbital mint above {poi} has lost attitude control and is shedding freshly stamped {Fs} coinage into the atmosphere. It is, quite literally, raining money.\n\nThe locals are out with umbrellas held upside-down. The mint\'s owners are broadcasting increasingly desperate legal notices.',
        choices: [
          {
            label: 'Grab an umbrella.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 70));
              rep(ctx, -4);
            },
          },
          {
            label: 'Fly up and stabilize the mint for the owners.',
            run: (ctx) => {
              if (ctx.check('engineering', 2)) {
                rep(ctx, 15);
                ctx.gainCredits(cr(ctx, 90));
                ctx.note('The owners pay you a finder\'s fee "net of losses, pending audit," which is the warmest thing a {Fsp} has ever said to you.');
              } else {
                ctx.damageHull(12);
                rep(ctx, 3);
                ctx.note('You get it spinning slower. The owners appreciate the effort and invoice you for the scratches.');
              }
            },
          },
          {
            label: 'Fly into the mint\'s exhaust and catch the coin stream directly.',
            req: { apt: { navigation: 3 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 150));
              ctx.damageHull(6);
              rep(ctx, -10);
            },
          },
          {
            label: 'Short the currency before the news spreads.',
            req: { apt: { guile: 4 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 200));
              ctx.note('By the time the markets in {sys} learn about the rain, you have already sold everything you owned in {Fs} money. Somewhere, a ledger weeps.');
            },
          },
        ],
      },
    },
  },

  // 8 -----------------------------------------------------------------------
  {
    id: 'ev_planet_nest',
    sites: ['planet'],
    title: 'Nesting Grounds',
    start: 'start',
    nodes: {
      start: {
        text:
          'Scanners on {poi} show a field of eggs, each the size of a shuttle, half-buried in warm black sand. Something enormous has been here recently. The sand still holds the shape of its coils.',
        choices: [
          {
            label: 'Take one egg. Collectors pay absurd sums.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 120));
              ctx.combat({ side: 'monster', strength: 1.2, announce: 'The mother returns' });
            },
          },
          {
            label: 'Study the eggs without touching.',
            run: (ctx) => {
              if (ctx.check('science', 2)) {
                ctx.gainXp(35);
                ctx.note('Each egg is also a small reactor. The creature lays them where the crust is thinnest so the young can drink geothermal heat. Elegant. Horrifying.');
                ctx.gainFuel(2);
              } else {
                ctx.gainXp(10);
              }
            },
          },
          {
            label: 'Have {off:medic} check whether one is unhatched and dying.',
            req: { officer: 'medic' },
            run: () => 'dying',
          },
          { label: 'Leave before the owner notices.' },
        ],
      },
      dying: {
        text:
          'One egg is cold. {off:medic} presses a scanner against it and finds a heartbeat, very slow.\n\nYou could warm it with the ship\'s reactor exhaust. Or you could take it — it will not survive here regardless.',
        choices: [
          {
            label: 'Warm it.',
            run: (ctx) => {
              ctx.loseFuel(1);
              ctx.gainXp(40);
              ctx.note('Something cracks. A tiny, glistening head emerges, looks at your ship, and imprints. When you leave, a shape follows you to orbit and then, reluctantly, turns back.');
              ctx.setFlag('ev_hatchling', true);
            },
          },
          {
            label: 'Take it.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 150));
              ctx.note('It stops beating somewhere between {sys} and the next lane. You sell the shell.');
            },
          },
        ],
      },
    },
  },

  // 9 -----------------------------------------------------------------------
  {
    id: 'ev_planet_monastery',
    sites: ['planet'],
    title: 'The Listening House',
    archetypes: ['zealot'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          'A monastery clings to a cliff on {poi}. The {Fsp} monks inside have taken a vow of silence so that they can hear the Song better. A sign at the gate, written for the Faithless: "WE HEAR. DO YOU?"\n\nAn old monk breaks her vow to greet you, which seems to cost her something.\n\n"Pilgrim. Or thief. Which?"',
        choices: [
          {
            label: '"Pilgrim."',
            run: (ctx) => (ctx.check('guile', 1) || ctx.rep(ctx.faction?.id ?? '') > 20 ? 'pilgrim' : 'doubt'),
          },
          {
            label: '"Neither. Just tired."',
            run: (ctx) => {
              ctx.repairHull(20);
              rep(ctx, 5);
              ctx.note('"Honest. Rare. Sleep, then." You do, deeply, for the first time in a long while.');
            },
          },
          {
            label: 'Raise the Pilgrim\'s Lamp.',
            req: { relic: 'pilgrim_lamp' },
            hideIfUnmet: true,
            run: () => 'lamp',
          },
          {
            label: '"Thief," you say, and draw.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 100));
              rep(ctx, -30);
              ctx.combat({ side: side(ctx), strength: 1.1, announce: 'The Faithless are named' });
            },
          },
        ],
      },
      pilgrim: {
        text:
          'She leads you to a chamber where the monks sit facing a wall. On the wall, carved in a hundred hands, a map of lanes no living navigator has charted. "The Song sang it to us. Take it to the Heart."',
        enter: (ctx) => {
          ctx.revealMap(2);
          rep(ctx, 10);
        },
      },
      doubt: {
        text: '"Your voice says pilgrim. Your hands say thief." She gives you a cup of water and closes the gate. It is good water.',
        enter: (ctx) => ctx.repairHull(5),
      },
      lamp: {
        text:
          'The monks see the lamp and every one of them, all at once, breaks their vow to sing a single note. The monastery rings like a bell.\n\nThey load your ship with gifts. You did not ask for any of this, and that is apparently the point.',
        enter: (ctx) => {
          rep(ctx, 25);
          ctx.giveItem({ minRarity: 2 });
          ctx.gainFuel(3);
          ctx.revealMap(2);
        },
      },
    },
  },

  // 10 ----------------------------------------------------------------------
  {
    id: 'ev_planet_tidal_city',
    sites: ['planet'],
    title: 'The Seven-Hour City',
    start: 'start',
    nodes: {
      start: {
        text:
          '{poi} has a moon so close that its tides are measured in kilometers. Every seven hours the sea withdraws and reveals a drowned city of spires, glittering with wet treasure. Every seven hours, it comes back.\n\nThe tide is going out now.',
        choices: [
          {
            label: 'Land in the plaza and loot fast.',
            run: (ctx) => {
              if (ctx.check('navigation', 2)) {
                ctx.gainCredits(cr(ctx, 110));
                ctx.note('You lift off with the first wave lapping at the landing struts.');
              } else {
                ctx.gainCredits(cr(ctx, 60));
                ctx.damageHull(18);
                ctx.note('The sea comes back early. It always comes back early for the greedy.');
              }
            },
          },
          { label: 'Explore the central tower carefully.', next: 'tower' },
          { label: 'Watch from orbit. It is beautiful.', run: (ctx) => ctx.gainXp(10) },
        ],
      },
      tower: {
        text:
          'Inside the tower, behind a door sealed against the sea: a dry room, a chair, and a skeleton holding a lantern. The builders of the city knew the tides. They chose to stay.\n\nThe lantern is still warm.',
        choices: [
          {
            label: 'Take the lantern.',
            run: (ctx) => {
              if (ctx.chance(0.2)) {
                const r = ctx.giveRelic();
                if (!r) ctx.giveItem({ minRarity: 2 });
              } else {
                ctx.giveItem({ minRarity: 1 });
              }
              ctx.damageHull(8);
              ctx.note('You barely make it out. The tower door closes behind you on its own.');
            },
          },
          {
            label: 'Leave it. Read the inscriptions instead.',
            run: (ctx) => {
              ctx.gainXp(30);
              ctx.unlockCodex('lore.tide');
              ctx.note('"The sea leaves and the sea returns. So do we." The inscription is newer than the city.');
            },
          },
        ],
      },
    },
  },

  // 11 ----------------------------------------------------------------------
  {
    id: 'ev_planet_quiet_world',
    sites: ['planet'],
    title: 'The Quiet',
    condition: (ctx) => ctx.officers.length > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const o = ctx.officers[0];
          return `{poi} has no wind, no fauna, no radio noise. Even the hyperspace static — the faint singing everyone pretends not to hear — is gone here.\n\n${o.name} stands at the edge of a still lake for a long time. When they come back aboard, they ask to talk to you privately.\n\n"I'd like to stay," they say. "It's the first time it's been quiet in my head since I was born."`;
        },
        choices: [
          {
            label: 'Let them go, with your blessing.',
            run: (ctx) => {
              const o = ctx.officers[0];
              ctx.removeOfficer(o.id, 'stayed on a quiet world');
              ctx.giveItem({ minRarity: 1 });
              ctx.gainXp(40);
              ctx.note(`${o.name} gives you everything they own that isn't clothing, and doesn't look back.`);
            },
          },
          {
            label: 'Ask them to stay with the ship. You need them.',
            run: (ctx) => {
              if (ctx.check('diplomacy', 2)) {
                ctx.note('They agree. They spend the rest of the voyage a little sadder and a little more loyal.');
                ctx.gainXp(20);
              } else {
                const o = ctx.officers[0];
                ctx.removeOfficer(o.id, 'deserted on a quiet world');
                ctx.note(`In the morning, ${o.name}'s bunk is empty. Their boots are by the lake.`);
              }
            },
          },
          {
            label: 'Stay a few days yourself.',
            run: (ctx) => {
              ctx.repairHull(Math.round(ctx.maxHull * 0.3));
              ctx.gainXp(25);
              ctx.note('The silence settles into you too. When you leave, both of you are ready. Mostly.');
              ctx.unlockCodex('lore.choir');
            },
          },
        ],
      },
    },
  },

  // 12 ----------------------------------------------------------------------
  {
    id: 'ev_planet_question',
    sites: ['planet'],
    title: 'The World That Asks',
    minDepth: 2,
    start: 'start',
    nodes: {
      start: {
        text:
          'Every continent on {poi} has been terraformed into a single enormous glyph. From orbit, it is legible. It is a question mark, in a script your translator renders as:\n\n"WHY DO YOU KEEP COMING BACK?"\n\nThere is a landing pad at the base of the question.',
        choices: [
          { label: 'Land.', next: 'land' },
          { label: 'Broadcast an answer from orbit: "To reach the Heart."', next: 'answer_heart' },
          { label: 'Leave. Some questions aren\'t meant for you.' },
        ],
      },
      land: {
        text: (ctx) =>
          ctx.runNumber > 1
            ? 'There is a ledger on the landing pad, weatherproofed and open. It lists ships. Captains. Dates. Near the bottom, in your own handwriting, a name you almost remember.\n\nBelow that, a blank line.'
            : 'There is a ledger on the landing pad, weatherproofed and open. It lists ships and captains, hundreds of them, going back further than the paper should allow.\n\nBelow the last name, a blank line, and a pen.',
        choices: [
          {
            label: 'Sign it.',
            run: (ctx) => {
              const n = Number(ctx.metaFlag('ev.signed') ?? 0) + 1;
              ctx.setMetaFlag('ev.signed', n);
              ctx.gainXp(30 + n * 10);
              ctx.unlockCodex('lore.ledger');
              if (n > 1) ctx.note(`Your name is already on this page ${n - 1} time${n > 2 ? 's' : ''}.`);
            },
          },
          {
            label: 'Tear out the page.',
            run: (ctx) => {
              ctx.gainXp(10);
              ctx.combat({ side: 'warden', count: 2, announce: 'Something noticed' });
              ctx.note('The page dissolves in your hand. The sky above {poi} goes very still.');
            },
          },
        ],
      },
      answer_heart: {
        text: 'The glyph does not change. But a few hours later, your navigation computer contains lane data it did not have before, timestamped from the future.',
        enter: (ctx) => {
          ctx.revealMap(1);
          ctx.gainXp(20);
        },
      },
    },
  },
];
