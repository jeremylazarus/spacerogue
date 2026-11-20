import type { EventDef } from '../../game/api';
import { cr, rep, side } from './util';

export const HAIL_EVENTS: EventDef[] = [
  // MERCANTILE --------------------------------------------------------------
  {
    id: 'ev_hail_merc_insurance',
    sites: ['hail'],
    title: 'A Policy for Every Peril',
    archetypes: ['mercantile'],
    portrait: 'faction',
    condition: (ctx) => !ctx.flag('ev_insured'),
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `"Good cycle, Captain! Underwriter Sesk, {F} Mutual. Our actuaries have flagged your vessel as — how to put this — a magnificent risk. We'd like to insure you."\n\n"For a modest ${cr(ctx, 50)} credits, should your hull suffer grievous misfortune, any {Fs} office will settle your claim. Terms and conditions are, of course, extensive."`,
        choices: [
          {
            label: (ctx) => `Buy the policy (${cr(ctx, 50)} credits).`,
            req: { credits: 1 },
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 50));
              ctx.setFlag('ev_insured', true);
              rep(ctx, 5);
              ctx.note('"A pleasure. Do try to have an accident somewhere convenient."');
            },
          },
          {
            label: 'Read the terms and conditions.',
            req: { apt: { diplomacy: 2 } },
            next: 'terms',
          },
          { label: '"No thanks."', run: () => undefined },
        ],
      },
      terms: {
        text:
          'Clause 4,112: "Policy void in the event of being eaten." Clause 9,007: "Policy void if insured party has died before, in this or any prior life."\n\nSesk notices you reading. "Ah. Those are... boilerplate."',
        choices: [
          {
            label: 'Negotiate the clauses away.',
            run: (ctx) => {
              if (ctx.check('diplomacy', 3)) {
                ctx.loseCredits(cr(ctx, 30));
                ctx.setFlag('ev_insured', true);
                rep(ctx, 8);
                ctx.note('Sesk, impressed, writes you a bespoke policy. "Margins are thin, but the story will be excellent."');
              } else {
                ctx.note('"Our underwriters do not negotiate with the previously deceased." Sesk ends the call.');
              }
            },
          },
          {
            label: 'Report Sesk to the {Fs} regulators for fraud.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 60));
              ctx.note('The whistleblower bounty arrives with a form letter thanking you for "preserving the integrity of the ledger."');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ev_hail_merc_claim',
    sites: ['hail', 'station'],
    title: 'Filing a Claim',
    archetypes: ['mercantile'],
    portrait: 'faction',
    weight: 4,
    unique: true,
    condition: (ctx) => ctx.flag('ev_insured') === true && ctx.hull < ctx.maxHull * 0.6,
    start: 'start',
    nodes: {
      start: {
        text: '"Captain! Our records show you are insured, and our sensors show you are — goodness — rather perforated. Shall we process a claim?"',
        choices: [
          {
            label: 'File the claim honestly.',
            run: (ctx) => {
              ctx.repairHull(ctx.maxHull);
              ctx.setFlag('ev_insured', 'claimed');
              ctx.note('"Settled in full. Our condolences to your hull."');
            },
          },
          {
            label: 'Exaggerate the damage for a cash payout too.',
            run: (ctx) => {
              ctx.setFlag('ev_insured', 'claimed');
              if (ctx.check('guile', 2)) {
                ctx.repairHull(ctx.maxHull);
                ctx.gainCredits(cr(ctx, 100));
              } else {
                ctx.repairHull(Math.round(ctx.maxHull * 0.3));
                rep(ctx, -15);
                ctx.note('"Our adjusters found the \'missing reactor\' in your cargo bay, Captain." Partial settlement.');
              }
            },
          },
        ],
      },
    },
  },
  {
    id: 'ev_hail_merc_futures',
    sites: ['hail'],
    title: 'Speculative Instruments',
    archetypes: ['mercantile'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `"Captain, a proposition. We trade in futures. Specifically: yours. Our actuaries give you a ${ctx.depth < 4 ? 'modest' : 'surprising'} chance of reaching the Heart. We'll buy a share of your eventual fortune — cash now, against a cut later."\n\nThe {Fsp} trader smiles with entirely too many teeth for a merchant.`,
        choices: [
          {
            label: 'Sell them a share.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 120));
              ctx.setFlag('ev_futures_sold', ctx.faction?.id ?? 'x');
              ctx.note('"A pleasure. We\'ll be watching your career with interest. And with lawyers."');
            },
          },
          {
            label: 'Counter-offer: you buy a share of THEIR future.',
            req: { apt: { guile: 3 } },
            run: (ctx) => {
              if (ctx.check('guile', 3)) {
                ctx.gainCredits(cr(ctx, 90));
                rep(ctx, 10);
                ctx.note('After a long pause, the trader laughs. "Nobody has ever tried that. Have this, for the novelty."');
              } else {
                ctx.loseCredits(cr(ctx, 30));
                ctx.note('Somehow you end up paying a consultation fee.');
              }
            },
          },
          { label: '"My future is not for sale."', run: (ctx) => rep(ctx, -2) },
        ],
      },
    },
  },

  // ZEALOT ------------------------------------------------------------------
  {
    id: 'ev_hail_zealot_pilgrims',
    sites: ['hail'],
    title: 'Pilgrims Adrift',
    archetypes: ['zealot'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          '"Hail, traveller! Hail and hosanna! We are pilgrims bound for the Heart, where the Song is sung whole. Our engine has fallen silent, as is the will of the Song, surely. And yet. If thou hast thread to spare, the Song would surely smile upon thee."\n\nTheir ship is held together with prayer ribbons. Literally.',
        choices: [
          {
            label: 'Give them 2 spools of thread.',
            req: { fuel: 3 },
            run: (ctx) => {
              ctx.loseFuel(2);
              rep(ctx, 15);
              ctx.gainXp(20);
              if (ctx.chance(0.3)) {
                ctx.giveItem({ minRarity: 1 });
                ctx.note('In return they give you an "icon" which is, on inspection, a very good targeting array.');
              }
            },
          },
          {
            label: 'Fix their engine instead.',
            req: { apt: { engineering: 2 } },
            run: (ctx) => {
              rep(ctx, 20);
              ctx.gainXp(30);
              ctx.note('"A miracle! A miracle wrought with a spanner!" They name you a Minor Saint of Spanners.');
            },
          },
          {
            label: 'Sell them thread at a pilgrim\'s markup.',
            req: { fuel: 2 },
            run: (ctx) => {
              ctx.loseFuel(1);
              ctx.gainCredits(cr(ctx, 70));
              rep(ctx, -5);
            },
          },
          { label: '"May the Song tow you."', run: (ctx) => rep(ctx, -3) },
        ],
      },
    },
  },
  {
    id: 'ev_hail_zealot_inquisitor',
    sites: ['hail'],
    title: 'The Question of Faith',
    archetypes: ['zealot'],
    portrait: 'faction',
    minDepth: 1,
    start: 'start',
    nodes: {
      start: {
        text:
          '"Halt, vessel. I am an Inquisitor of {Fl}. I hear the Song and I hear thee, and thou art... discordant. Answer me truly: dost thou hear the singing in the lanes?"',
        choices: [
          { label: '"Yes. I hear it."', next: 'yes' },
          { label: '"No. There is no Song."', next: 'no' },
          {
            label: '"I am the Song, and you are out of tune."',
            req: { apt: { guile: 4 } },
            run: (ctx) => {
              if (ctx.check('guile', 4)) {
                rep(ctx, 15);
                ctx.gainCredits(cr(ctx, 80));
                ctx.note('The Inquisitor trembles, apologizes profusely, and sends tithes.');
              } else {
                rep(ctx, -20);
                ctx.combat({ side: side(ctx), strength: 1.2, announce: 'Blasphemy!' });
              }
            },
          },
          {
            label: 'Show them the Pilgrim\'s Lamp.',
            req: { relic: 'pilgrim_lamp' },
            hideIfUnmet: true,
            run: (ctx) => {
              rep(ctx, 25);
              ctx.gainFuel(3);
              ctx.note('"Forgive me. Forgive me, lamp-bearer. Go with the Song."');
            },
          },
        ],
      },
      yes: {
        text: '"Then sing it." He waits.',
        choices: [
          {
            label: 'Hum what you heard in the static.',
            run: (ctx) => {
              if (ctx.hasCodex('lore.choir') || ctx.check('science', 2)) {
                rep(ctx, 15);
                ctx.gainXp(30);
                ctx.note('The Inquisitor weeps behind his mask. "True. Go."');
              } else {
                rep(ctx, -10);
                ctx.combat({ side: side(ctx), count: 2, announce: 'False witness' });
              }
            },
          },
          {
            label: 'Have {off:xenologist} improvise a hymn.',
            req: { officer: 'xenologist' },
            run: (ctx) => {
              rep(ctx, 10);
              ctx.note('It is, somehow, a correct hymn. {off:xenologist} refuses to explain how.');
            },
          },
        ],
      },
      no: {
        text: '"Honest, at least. The Faithless are honest. That is their only virtue." He considers. "Pay the tithe of the unbeliever and pass."',
        choices: [
          {
            label: (ctx) => `Pay the tithe (${cr(ctx, 40)}).`,
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 40));
              rep(ctx, 2);
            },
          },
          {
            label: 'Refuse.',
            run: (ctx) => {
              rep(ctx, -15);
              ctx.combat({ side: side(ctx), announce: 'The Faithless are judged' });
            },
          },
        ],
      },
    },
  },

  // HIVE --------------------------------------------------------------------
  {
    id: 'ev_hail_hive_taste',
    sites: ['hail'],
    title: 'We Would Taste You',
    archetypes: ['hive'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          '"HELLO SMALL WARM ONE. we are {Fsp}. we taste many ships. your ship tastes of iron and worry. we would like to taste MORE. we would touch your hull with our many tongues. it is friendship. it is also lunch. mostly friendship."',
        choices: [
          {
            label: 'Allow a "light tasting."',
            run: (ctx) => {
              ctx.damageHull(10);
              rep(ctx, 20);
              ctx.note('"delicious. you are now known to us. we will remember the flavor of your worry."');
              if (ctx.chance(0.5)) ctx.giveItem();
            },
          },
          {
            label: 'Offer them scrap metal instead.',
            run: (ctx) => {
              const it = ctx.loseItem();
              if (it) {
                rep(ctx, 15);
                ctx.gainFuel(3);
                ctx.note(`"${it.toUpperCase()}. crunchy. we give warm thread in return. it is from inside us. do not ask."`);
              } else {
                ctx.note('You have nothing to spare. "sad. we are sad with you."');
              }
            },
          },
          {
            label: 'Ask what they taste in YOU.',
            req: { apt: { diplomacy: 2 } },
            next: 'deep',
          },
          {
            label: '"No."',
            run: (ctx) => {
              rep(ctx, -5);
              ctx.note('"that is a flavor too."');
            },
          },
        ],
      },
      deep: {
        text:
          '"we taste... many of you. layered. like sediment. you have been here before. you will be here again. the singing is in your bones. we hear it too. it is louder in you."\n\nA long pause on the line.\n\n"we are sorry for you. here. take this. it is for courage."',
        enter: (ctx) => {
          ctx.unlockCodex('lore.choir');
          ctx.giveItem({ minRarity: 1 });
          rep(ctx, 10);
        },
      },
    },
  },
  {
    id: 'ev_hail_hive_stray',
    sites: ['hail'],
    title: 'The Stray',
    archetypes: ['hive'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          'A single {Fsp} drone, tiny, hull scarred. "i am... i. only i. the We forgot me. there is no warmth. there is only i. it is too quiet in i."\n\n"may i be with you? you are many. you are a small We."',
        choices: [
          {
            label: 'Take it aboard.',
            run: (ctx) => {
              const o = ctx.addOfficer(undefined, ctx.faction?.species);
              if (o) {
                ctx.note(`It chooses the name "${o.name}" from a list you show it. It says "we" about the crew almost immediately.`);
              } else {
                ctx.note('There is no room. It clings to your hull for two systems, then lets go, content.');
                ctx.gainXp(20);
              }
            },
          },
          {
            label: 'Guide it back to its hive.',
            req: { apt: { navigation: 2 } },
            run: (ctx) => {
              rep(ctx, 25);
              ctx.gainXp(30);
              ctx.note('The hive receives it with a broadcast that is mostly the word "WARM," repeated, at volume.');
            },
          },
          {
            label: 'Harvest it. Hive tissue sells well.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 90));
              rep(ctx, -25);
              ctx.note('Somewhere, a great many minds taste something bitter.');
            },
          },
        ],
      },
    },
  },

  // MACHINE -----------------------------------------------------------------
  {
    id: 'ev_hail_machine_survey',
    sites: ['hail'],
    title: 'Customer Satisfaction Survey',
    archetypes: ['machine'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          '"GREETINGS. WE ARE {F}. STATEMENT 1: we are conducting a survey of organic decision-making. STATEMENT 2: participation is compensated. STATEMENT 3: question one follows."\n\n"QUESTION 1: You are in a burning ship with a stranger and a priceless artwork. You may save one. Which, and why, and why do you hesitate."',
        choices: [
          {
            label: '"The stranger. Obviously."',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 40));
              ctx.note('"RESPONSE LOGGED. 94.2% of organics say this. 31.7% of them actually do it. INTERESTING."');
              return 'q2';
            },
          },
          {
            label: '"The artwork. The stranger would understand."',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 40));
              ctx.note('"RESPONSE LOGGED. RARE. FLAGGED FOR FOLLOW-UP."');
              return 'q2';
            },
          },
          {
            label: '"I\'d put out the fire."',
            req: { apt: { engineering: 2 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 60));
              rep(ctx, 10);
              ctx.note('"RESPONSE INVALID. RESPONSE ALSO CORRECT. ERROR. DELIGHT."');
              return 'q2';
            },
          },
        ],
      },
      q2: {
        text:
          '"QUESTION 2: You have died before. Our sensors indicate a 97.3% match with prior hull-signatures. Why do you continue?"',
        choices: [
          {
            label: '"Because I don\'t remember not to."',
            run: (ctx) => {
              ctx.unlockCodex('lore.echoes');
              ctx.gainXp(30);
              rep(ctx, 5);
            },
          },
          {
            label: '"Because the Heart is there."',
            run: (ctx) => {
              ctx.revealMap(1);
              rep(ctx, 5);
            },
          },
          {
            label: '"End survey."',
            run: (ctx) => {
              ctx.note('"ACKNOWLEDGED. COMPENSATION RETAINED. CURIOSITY RETAINED."');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ev_hail_machine_wager',
    sites: ['hail'],
    title: 'A Wager on Chaos',
    archetypes: ['machine'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `"PROPOSAL. We have modeled your behavior. Our prediction: you will refuse this wager. If you accept, you have disproved us. We will pay ${cr(ctx, 80)} credits for the data point."\n\n"CLARIFICATION: if you accept, you must then guess a number from 1 to 3. If you guess what we predict, you pay us. Probability of our success: 66.6%. Please be irrational."`,
        choices: [
          {
            label: 'Accept, and choose with pure instinct.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 80));
              if (ctx.chance(0.5)) {
                ctx.loseCredits(cr(ctx, 50));
                ctx.note('"PREDICTED. Your instinct is very predictable. Thank you."');
              } else {
                ctx.gainCredits(cr(ctx, 40));
                ctx.note('"UNPREDICTED. Fascinating. Ruinous. Again sometime."');
              }
            },
          },
          {
            label: 'Accept, and answer "four."',
            req: { apt: { guile: 2 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 80));
              rep(ctx, 8);
              ctx.note('A very long pause. "...RULE AMBIGUITY DETECTED. We concede. We are updating our models of humor."');
            },
          },
          {
            label: 'Refuse — exactly as predicted.',
            run: (ctx) => {
              rep(ctx, 3);
              ctx.gainXp(10);
              ctx.note('"PREDICTED. Comforting." They sound, for a machine, relieved.');
            },
          },
          {
            label: 'Out-compute them.',
            req: { apt: { science: 4 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 140));
              ctx.giveItem({ slot: 'utility', minRarity: 1 });
              ctx.note('"Our model of you has been... corrected. Please accept this processor as an apology for underestimating you."');
            },
          },
        ],
      },
    },
  },

  // RAIDER ------------------------------------------------------------------
  {
    id: 'ev_hail_raider_tribute',
    sites: ['hail'],
    title: 'Toll of the Clan',
    archetypes: ['raider'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `"Oi, tin can! This lane belongs to {F}, sworn to {Fl}, scourge of the Shoal, drinker of engine coolant! Tribute's ${cr(ctx, 60)} creds or a fight. Your call, but I'd pay. I'm in a mood."`,
        choices: [
          {
            label: 'Pay the tribute.',
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 60));
              rep(ctx, 8);
              ctx.note('"Smart. Have a drink on us." They transmit a drinking song. It is very long.');
            },
          },
          {
            label: 'Challenge their captain to single combat.',
            run: (ctx) => {
              rep(ctx, 5);
              ctx.combat({ side: side(ctx), count: 1, strength: 1.4, announce: 'Single combat — by the code!' });
              ctx.note('"HA! The code is the code. One ship. Mine. To the scrap!"');
            },
          },
          {
            label: 'Out-swagger them.',
            req: { apt: { combat: 3 } },
            run: (ctx) => {
              if (ctx.check('combat', 3)) {
                rep(ctx, 15);
                ctx.gainCredits(cr(ctx, 30));
                ctx.note('"...Alright, alright. Respect. You pay nothing, AND we toast you. To the {ship}!"');
              } else {
                rep(ctx, -5);
                ctx.combat({ side: side(ctx), announce: 'Called your bluff' });
              }
            },
          },
          {
            label: 'Show them the Rust Crown.',
            req: { relic: 'rust_crown' },
            hideIfUnmet: true,
            run: (ctx) => {
              rep(ctx, 20);
              ctx.gainCredits(cr(ctx, 60));
              ctx.note('"...Boss? BOSS! Forgive us! Here, here, tribute flows UP, not down!"');
            },
          },
          {
            label: 'Refuse and fire first.',
            run: (ctx) => {
              rep(ctx, -10);
              ctx.combat({ side: side(ctx), announce: 'No tribute today' });
            },
          },
        ],
      },
    },
  },
  {
    id: 'ev_hail_raider_wedding',
    sites: ['hail'],
    title: 'You\'re Invited',
    archetypes: ['raider'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          '"Captain! You\'re just in time! My sister\'s marrying the Gutter-Baron of the Fourth Flotilla and we need a neutral witness. Clan law. Can\'t be a clan member. You\'re not a clan member, are you? Course not. Come aboard! Bring a gift!"',
        choices: [
          {
            label: 'Attend, and bring a good gift.',
            run: (ctx) => {
              const it = ctx.loseItem();
              if (it) {
                rep(ctx, 25);
                ctx.gainXp(30);
                ctx.note(`The ${it} is received with a roar of approval and immediately bolted to the bride's ship.`);
              } else {
                ctx.loseCredits(cr(ctx, 40));
                rep(ctx, 12);
              }
            },
          },
          {
            label: 'Attend empty-handed but give a magnificent toast.',
            run: (ctx) => {
              if (ctx.check('diplomacy', 2)) {
                rep(ctx, 20);
                ctx.note('Your toast — "May your shields be thick and your enemies thin" — becomes a clan proverb by morning.');
                ctx.gainFuel(2);
              } else {
                rep(ctx, -5);
                ctx.note('You mention the groom\'s first wife. Nobody told you there was a first wife.');
                ctx.damageHull(8);
              }
            },
          },
          { label: 'Witness, then object to the marriage.', next: 'object' },
          { label: 'Politely decline.', run: (ctx) => rep(ctx, -3) },
        ],
      },
      object: {
        text: 'The hall goes silent. Seven hundred pirates turn toward you. The bride, very slowly, begins to smile.\n\n"Finally," she says. "Someone with a spine. Duel the Baron for me, and I\'ll owe you."',
        choices: [
          {
            label: 'Duel the Baron.',
            run: (ctx) => {
              ctx.setFlag('ev_bride_owes', true);
              ctx.combat({ side: side(ctx), count: 1, strength: 1.5, announce: 'The Gutter-Baron' });
            },
          },
          {
            label: '"I was joking." Back away.',
            run: (ctx) => {
              rep(ctx, -10);
              ctx.note('You are escorted to your ship. Some of the escort is humming the wedding march, mockingly.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ev_hail_bride_repays',
    sites: ['hail', 'arrival'],
    title: 'A Debt Repaid',
    weight: 5,
    unique: true,
    condition: (ctx) => ctx.flag('ev_bride_owes') === true,
    start: 'start',
    nodes: {
      start: {
        text:
          'A heavily armed corsair drops out of the lane next to you. On the comm: the bride, now very much unmarried, wearing what appears to be the Baron\'s hat.\n\n"Told you I\'d owe you. I always pay. Take your pick, Captain."',
        choices: [
          { label: 'A weapon from the Baron\'s collection.', run: (ctx) => ctx.giveItem({ slot: 'weapon', minRarity: 2 }) },
          { label: 'A heap of thread and a hull patch.', run: (ctx) => { ctx.gainFuel(5); ctx.repairHull(ctx.maxHull); } },
          {
            label: 'Join my crew.',
            run: (ctx) => {
              const o = ctx.addOfficer('gunner');
              if (!o) {
                ctx.note('"No bunk? Your loss." She gives you the hat instead. It is worth a fortune.');
                ctx.gainCredits(cr(ctx, 150));
              }
            },
          },
        ],
      },
    },
  },

  // ANCIENT -----------------------------------------------------------------
  {
    id: 'ev_hail_ancient_riddle',
    sites: ['hail'],
    title: 'The Elder Asks',
    archetypes: ['ancient'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          'The ship is the size of a moon, and it has been watching you for some time. When it speaks, it takes a minute per word.\n\n"WHAT. CROSSES. THE. RIVER. AND. IS. NOT. WET."',
        choices: [
          {
            label: '"A bridge."',
            run: (ctx) => {
              ctx.note('"...ADEQUATE. YOUNG."');
              rep(ctx, 5);
              ctx.gainXp(15);
            },
          },
          {
            label: '"A name."',
            req: { apt: { diplomacy: 3 } },
            next: 'right',
          },
          {
            label: '"Me. Every time."',
            visible: (ctx) => ctx.runNumber > 1,
            next: 'wayfarer',
          },
          {
            label: 'Say nothing. Wait.',
            run: (ctx) => (ctx.check('science', 3) ? 'right' : 'silence'),
          },
        ],
      },
      right: {
        text: '"YES." A long, long pause. "WE. HAVE. NOT. HEARD. A. CORRECT. ANSWER. IN. FOUR. AGES." Something small and bright detaches from the hull and drifts toward you.',
        enter: (ctx) => {
          rep(ctx, 20);
          ctx.giveItem({ minRarity: 2 });
        },
      },
      wayfarer: {
        text: '"...WAYFARER." The word takes a long time, and is said gently. "WE. REMEMBER. THE. FIRST. OF. YOU." It says nothing more. But the lanes ahead feel suddenly, quietly, clearer.',
        enter: (ctx) => {
          rep(ctx, 15);
          ctx.revealMap(3);
          ctx.unlockCodex('lore.ancients');
        },
      },
      silence: {
        text: 'You wait. It waits. It is better at waiting. Eventually you realize it has gone, and three days have passed.',
        enter: (ctx) => ctx.loseFuel(1),
      },
    },
  },
  {
    id: 'ev_hail_ancient_ferry',
    sites: ['hail'],
    title: 'The Ferryman',
    archetypes: ['ancient'],
    portrait: 'faction',
    start: 'start',
    nodes: {
      start: {
        text:
          '"SMALL. ONE. YOU. WISH. TO. GO. DEEPER."\n\nIt is not a question. The vessel opens a hangar large enough to swallow a fleet.\n\n"WE. CARRY. THE. PRICE. IS. A. MEMORY."',
        choices: [
          {
            label: 'Pay with a memory.',
            run: (ctx) => {
              ctx.gainFuel(6);
              ctx.revealMap(2);
              ctx.note('You cannot remember, afterward, what you gave. Only that the price seemed fair, and that you cried a little.');
            },
          },
          {
            label: 'Offer {off}\'s memory instead.',
            visible: (ctx) => ctx.officers.length > 0,
            run: (ctx) => {
              ctx.gainFuel(6);
              ctx.revealMap(2);
              const o = ctx.officers[0];
              ctx.note(`${o.name} agrees. Afterward, they cannot remember why they joined your crew. They stay anyway, but they look at you differently.`);
            },
          },
          {
            label: 'Ask what it does with the memories.',
            req: { apt: { diplomacy: 2 } },
            next: 'why',
          },
          { label: '"No thank you."', run: (ctx) => rep(ctx, 2) },
        ],
      },
      why: {
        text: '"WE. KEEP. THEM. FOR. WHEN. THE. SHOAL. FORGETS. SOMEONE. MUST."\n\nThe hangar remains open.',
        enter: (ctx) => {
          ctx.unlockCodex('lore.ancients');
          ctx.gainXp(25);
        },
        choices: [
          {
            label: 'Give a memory freely, as a gift.',
            run: (ctx) => {
              rep(ctx, 25);
              ctx.gainFuel(6);
              ctx.revealMap(3);
              ctx.giveItem({ minRarity: 1 });
            },
          },
          { label: 'Decline, respectfully.', run: (ctx) => rep(ctx, 8) },
        ],
      },
    },
  },

  // GENERIC / CHAIN ---------------------------------------------------------
  {
    id: 'ev_hail_debt_collector',
    sites: ['hail', 'arrival'],
    title: 'Collections',
    weight: 4,
    unique: true,
    condition: (ctx) => typeof ctx.flag('ev_loan') === 'number' && Number(ctx.flag('ev_loan_depth') ?? 0) < ctx.depth,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `A sleek cutter pulls alongside. "Captain {cap}? Collections, on behalf of the Velvet Window. You borrowed ${ctx.flag('ev_loan')} credits. With interest, it's ${Math.round(Number(ctx.flag('ev_loan')) * 1.5)}. We accept cash, cargo, or kneecaps."`,
        choices: [
          {
            label: 'Pay in full.',
            run: (ctx) => {
              ctx.loseCredits(Math.round(Number(ctx.flag('ev_loan')) * 1.5));
              ctx.setFlag('ev_loan', 'paid');
              ctx.note('"A pleasure doing business. The Window remembers good customers."');
            },
          },
          {
            label: 'Pay with cargo.',
            run: (ctx) => {
              const a = ctx.loseItem();
              const b = ctx.loseItem();
              ctx.setFlag('ev_loan', 'paid');
              if (!a && !b) {
                ctx.note('Your hold is empty. The collector settles for your hull plating.');
                ctx.damageHull(20);
              }
            },
          },
          {
            label: 'Fake your own death on the comm.',
            req: { apt: { guile: 3 } },
            run: (ctx) => {
              ctx.setFlag('ev_loan', 'escaped');
              if (ctx.check('guile', 3)) ctx.note('"...Oh. My condolences to the deceased." The cutter leaves. You may need to stay dead for a while.');
              else {
                ctx.note('"Captain, you are literally waving at the camera."');
                ctx.combat({ side: 'rogue', count: 3, announce: 'Collections, in person' });
              }
            },
          },
          {
            label: 'Refuse.',
            run: (ctx) => {
              ctx.setFlag('ev_loan', 'escaped');
              ctx.combat({ side: 'rogue', count: 3, strength: 1.1, announce: 'Repossession' });
            },
          },
        ],
      },
    },
  },
];
