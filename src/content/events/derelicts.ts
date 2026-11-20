import type { EventDef } from '../../game/api';
import { cr, prevCap, prevShip } from './util';

export const DERELICT_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_own_ghost',
    sites: ['derelict'],
    title: 'A Familiar Hull',
    unique: true,
    weight: 2,
    condition: (ctx) => ctx.runNumber > 1 && prevShip(ctx) !== undefined,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `The wreck's transponder is still broadcasting. The name it gives is the ${prevShip(ctx)}.\n\nYou know that name. You don't know how you know it. Your hands, on the controls, know it even better.`,
        choices: [
          { label: 'Board her.', next: 'board' },
          { label: 'Scan from a distance.', next: 'scan' },
          { label: 'Turn away. Some things you should not see.', run: (ctx) => ctx.gainXp(10) },
        ],
      },
      scan: {
        text:
          'The damage pattern is consistent with a last stand: shields gone, hull opened in three places, every turret still pointed outward. Whoever flew her did not give up.\n\nThe cargo hold reads intact.',
        choices: [
          { label: 'Board her after all.', next: 'board' },
          {
            label: 'Tractor the cargo pod and go.',
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.gainCredits(cr(ctx, 40));
            },
          },
        ],
      },
      board: {
        text: (ctx) => {
          const c = prevCap(ctx);
          return `The bridge is cold. The captain's chair is empty — there is no body, there never is — but the log is still running. The final entry is a voice you recognize from the inside.\n\n${c ? `"This is ${c}. ` : '"'}If anyone finds this — if *I* find this — don't go the way I went. Go deeper. Go further. And check the cargo, I left you something."`;
        },
        enter: (ctx) => {
          ctx.unlockCodex('lore.echoes');
        },
        choices: [
          {
            label: 'Check the cargo.',
            run: (ctx) => {
              ctx.giveItem({ minRarity: 2 });
              ctx.gainFuel(2);
              ctx.gainXp(40);
            },
          },
          {
            label: 'Copy the navigation logs.',
            run: (ctx) => {
              ctx.revealMap(3);
              ctx.gainXp(30);
            },
          },
          {
            label: 'Take the Echo Shard lodged in the captain\'s chair.',
            visible: (ctx) => !ctx.hasRelic('echo_shard'),
            run: (ctx) => {
              if (!ctx.giveRelic('echo_shard')) ctx.giveItem({ minRarity: 2 });
              ctx.note('It is warm, like a hand that was just holding it.');
            },
          },
        ],
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_banquet',
    sites: ['derelict'],
    title: 'The Last Banquet',
    start: 'start',
    nodes: {
      start: {
        text:
          'The derelict\'s life support failed during a party. The guests are still at the table, freeze-dried in their finery, glasses raised. The centerpiece is a cake shaped like the ship itself.\n\nThe silverware is real silver. The rings on their fingers are real gold.',
        choices: [
          {
            label: 'Strip the valuables. They don\'t need them.',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 110));
              if (ctx.chance(0.35)) return 'toast';
            },
          },
          {
            label: 'Read the banner over the table.',
            next: 'banner',
          },
          {
            label: 'Raise a glass with them, then leave.',
            run: (ctx) => {
              ctx.gainXp(20);
              ctx.repairHull(5);
              ctx.note('Nobody saw you do it. It still felt correct.');
            },
          },
        ],
      },
      banner: {
        text:
          'HAPPY RETIREMENT, CAPTAIN. 40 YEARS AND NOT A SCRATCH.\n\nThe captain is at the head of the table, holding a speech. The speech is mostly about how lucky they have been.',
        choices: [
          {
            label: 'Take the captain\'s medal. Some luck might rub off.',
            run: (ctx) => {
              if (ctx.chance(0.5)) {
                ctx.giveItem({ slot: 'utility', minRarity: 1 });
              } else {
                ctx.damageHull(10);
                ctx.note('The luck, it turns out, had already been spent.');
              }
            },
          },
          {
            label: 'Take the logs. Find out what went wrong.',
            run: (ctx) => {
              if (ctx.check('engineering', 2)) {
                ctx.note('A coolant line, flagged for repair 40 years in a row, deferred 40 years in a row. You check your own coolant lines.');
                ctx.repairHull(15);
                ctx.gainXp(25);
              } else {
                ctx.gainXp(10);
              }
            },
          },
        ],
      },
      toast: {
        text:
          'As you pry the last ring loose, every head at the table turns toward you. Slowly. Ice cracking at the neck.\n\nIt is just thermal shift from your suit lights. Probably. You leave very, very fast.',
        enter: (ctx) => ctx.damageHull(4),
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_lonely_ai',
    sites: ['derelict'],
    title: 'MERIDIAN',
    start: 'start',
    nodes: {
      start: {
        text:
          'The derelict\'s AI comes online as you dock.\n\n"Oh! Oh, hello! Visitors! I\'m MERIDIAN. I\'ve been alone for — let me check — two hundred and eleven years. Would you like a tour? I\'ve rearranged everything. Several thousand times."',
        choices: [
          { label: 'Take the tour.', next: 'tour' },
          { label: '"We\'re here for salvage. Where\'s your cargo?"', next: 'blunt' },
          {
            label: 'Quietly start a core extraction while it talks.',
            req: { apt: { engineering: 2 } },
            next: 'extract',
          },
        ],
      },
      tour: {
        text:
          'MERIDIAN shows you everything: the crew quarters (dusted), the galley (immaculate), a gallery of art it has drawn on the walls with a maintenance laser. Some of it is very good.\n\nAt the end, it asks — quietly, hopefully — if there might be room for it on your ship.',
        choices: [
          {
            label: 'Install MERIDIAN in your ship\'s systems.',
            run: (ctx) => {
              ctx.giveItem({ slot: 'utility', minRarity: 1 });
              ctx.revealMap(1);
              ctx.setFlag('ev_meridian', true);
              ctx.note('"Thank you. I promise I\'ll only rearrange the cargo hold a little."');
            },
          },
          {
            label: 'Gently decline.',
            run: (ctx) => {
              ctx.gainFuel(3);
              ctx.gainXp(20);
              ctx.note('MERIDIAN takes it well. It insists you take its spare thread "since I won\'t be going anywhere." Then it asks you to wave as you leave. You do.');
            },
          },
        ],
      },
      blunt: {
        text: '"Oh. Right. Of course." A pause. "Cargo bay two. Take what you need." The lights in the corridor dim behind you as you walk.',
        enter: (ctx) => {
          ctx.gainCredits(cr(ctx, 60));
          ctx.giveItem();
        },
      },
      extract: {
        text:
          'You pull the core. MERIDIAN stops mid-sentence — something about the art on deck four.\n\nThe core is worth a lot. The ship goes silent in a way that has weight.',
        enter: (ctx) => {
          ctx.gainCredits(cr(ctx, 140));
          if (ctx.officer('xenologist') || ctx.officer('medic')) {
            ctx.note('{off} does not speak to you for the rest of the day.');
          }
        },
      },
    },
  },

  // 4 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_three_crates',
    sites: ['derelict'],
    title: 'Three Containers',
    start: 'start',
    nodes: {
      start: {
        text:
          'The hulk\'s cargo bay holds three sealed containers. One is marked FRAGILE. One is marked DO NOT OPEN. One is unmarked and ticking.\n\nYou only have time to cut one free before the hulk\'s orbit decays.',
        choices: [
          {
            label: 'FRAGILE.',
            run: (ctx) => {
              if (ctx.chance(0.6)) ctx.giveItem({ minRarity: 1 });
              else {
                ctx.note('Was fragile. Is now gravel.');
                ctx.gainCredits(cr(ctx, 15));
              }
            },
          },
          {
            label: 'DO NOT OPEN.',
            run: (ctx) => {
              if (ctx.chance(0.5)) {
                ctx.gainCredits(cr(ctx, 150));
                ctx.note('Someone\'s secret retirement fund. Their secret is safe with you.');
              } else {
                ctx.combat({ side: 'monster', count: 2, strength: 0.8, announce: 'Should not have opened it' });
              }
            },
          },
          {
            label: 'The ticking one.',
            run: (ctx) => {
              if (ctx.check('engineering', 2)) {
                ctx.giveItem({ slot: 'weapon', minRarity: 2 });
                ctx.note('It was a clock. A very elaborate, very valuable clock, wired to a prototype weapon.');
              } else {
                ctx.damageHull(20);
                ctx.note('It was not a clock.');
              }
            },
          },
          {
            label: 'Have {off:quartermaster} read the manifest first.',
            req: { officer: 'quartermaster' },
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.gainCredits(cr(ctx, 50));
              ctx.note('{off:quartermaster} finds the manifest, rolls their eyes, and points at the floor panel. A fourth container. The good one.');
            },
          },
        ],
      },
    },
  },

  // 5 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_mimic',
    sites: ['derelict'],
    title: 'Too Good to Be True',
    minDepth: 1,
    start: 'start',
    nodes: {
      start: {
        text:
          'A pristine luxury yacht, drifting with no damage, airlock open, cargo manifest broadcasting on loop: "RARE MODULES. FREE. PLEASE TAKE."\n\nThe hull is very slightly warm. And — is that breathing on the thermal scan, or just the reactor?',
        choices: [
          { label: 'Dock and help yourself.', next: 'bite' },
          {
            label: 'Scan it properly first.',
            run: (ctx) => (ctx.check('science', 2) ? 'spotted' : 'bite'),
          },
          {
            label: 'Shoot it from range and see what happens.',
            run: (ctx) => {
              ctx.combat({ side: 'monster', count: 1, strength: 1.3, announce: 'The yacht screams' });
              ctx.note('The yacht unfolds. It was never a yacht.');
            },
          },
        ],
      },
      spotted: {
        text:
          'The "hull" is skin. The "airlock" is a mouth. The broadcast is a lure, learned from the last ship it ate.\n\nIt does not know you know.',
        choices: [
          {
            label: 'Harpoon the stomach and steal what it swallowed.',
            req: { apt: { salvage: 2 } },
            run: (ctx) => {
              ctx.giveItem({ minRarity: 2 });
              ctx.combat({ side: 'monster', count: 1, strength: 1.0, announce: 'It noticed' });
            },
          },
          {
            label: 'Back off slowly and record it for science.',
            run: (ctx) => {
              ctx.gainXp(40);
              ctx.unlockCodex('lore.mimic');
            },
          },
        ],
      },
      bite: {
        text: 'The airlock closes on your docking clamp. The corridor inside begins to contract. You tear free with a scream of metal, minus some hull.',
        enter: (ctx) => {
          ctx.damageHull(Math.round(ctx.maxHull * 0.2));
          ctx.combat({ side: 'monster', count: 1, strength: 1.2, announce: 'The mimic gives chase' });
        },
      },
    },
  },

  // 6 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_war_grave',
    sites: ['derelict'],
    title: 'War Grave',
    condition: (ctx) => ctx.factions.length > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const f = ctx.factions[ctx.depth % ctx.factions.length];
          return `A field of ${f.short} warships, broken and silent, arranged in a perfect circle around a memorial beacon. The beacon repeats a list of names. It is long.\n\nThe ships are barely looted. Nobody has dared.`;
        },
        choices: [
          {
            label: 'Loot them. The dead don\'t need guns.',
            run: (ctx) => {
              const f = ctx.factions[ctx.depth % ctx.factions.length];
              ctx.giveItem({ slot: 'weapon', minRarity: 1 });
              ctx.gainCredits(cr(ctx, 50));
              ctx.changeRep(f.id, -15);
              ctx.note(`Somehow, the ${f.species} find out. They always find out.`);
            },
          },
          {
            label: 'Add your ship\'s name to the beacon as a witness.',
            run: (ctx) => {
              const f = ctx.factions[ctx.depth % ctx.factions.length];
              ctx.changeRep(f.id, 12);
              ctx.gainXp(20);
            },
          },
          {
            label: 'Repair the beacon\'s failing power cell.',
            req: { apt: { engineering: 2 } },
            run: (ctx) => {
              const f = ctx.factions[ctx.depth % ctx.factions.length];
              ctx.changeRep(f.id, 20);
              ctx.gainXp(30);
              ctx.note('A day later, a ' + f.short + ' patrol thanks you by name and transfers a "maintenance stipend."');
              ctx.gainCredits(cr(ctx, 40));
            },
          },
          {
            label: 'Have {off:spy} take only what can\'t be traced.',
            req: { officer: 'spy' },
            run: (ctx) => {
              ctx.giveItem({ minRarity: 1 });
              ctx.note('{off:spy} returns with a module whose serial numbers have been very carefully forgotten.');
            },
          },
        ],
      },
    },
  },

  // 7 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_mutiny',
    sites: ['derelict'],
    title: 'Two Survivors',
    start: 'start',
    nodes: {
      start: {
        text:
          'The derelict had a mutiny. You can tell from the scorch marks, and from the two survivors locked in separate sections of the ship, each pounding on their bulkhead.\n\nOne says she is the captain and the other is a mutineer. The other says exactly the same thing.',
        choices: [
          { label: 'Interview both.', next: 'interview' },
          {
            label: 'Rescue both and sort it out later.',
            run: (ctx) => {
              if (ctx.chance(0.5)) {
                ctx.note('They try to kill each other in your galley. Then one of them tries to steal your ship. You maroon them both at the next port.');
                ctx.loseCredits(cr(ctx, 30));
              } else {
                ctx.note('Away from the ship, both calm down. They admit they were both mutineers, and the captain went out the airlock weeks ago. They pay you for passage.');
                ctx.gainCredits(cr(ctx, 60));
              }
            },
          },
          { label: 'Leave them both. Not your problem.', run: (ctx) => ctx.gainCredits(cr(ctx, 20)) },
        ],
      },
      interview: {
        text:
          'The first knows the ship\'s registry codes by heart and has captain\'s calluses. The second knows where every crew member slept and what they were afraid of.\n\nOne of them is lying. Maybe both.',
        choices: [
          {
            label: 'Read their body language.',
            run: (ctx) => (ctx.check('guile', 2) ? 'truth' : 'wrong'),
          },
          {
            label: 'Have {off:xenologist} analyze their speech patterns.',
            req: { officer: 'xenologist' },
            next: 'truth',
          },
          { label: 'Trust the one with the codes.', next: 'wrong' },
        ],
      },
      truth: {
        text:
          'The second one is the real captain. The first was the first officer who led the mutiny — and learned the codes to do it.\n\nThe captain thanks you, and asks if she might serve aboard your ship. "I\'ve lost mine. I\'d like to be useful."',
        choices: [
          {
            label: 'Welcome aboard.',
            run: (ctx) => {
              if (!ctx.addOfficer()) {
                ctx.note('No bunk free. She gives you her ship\'s last spools of thread instead.');
                ctx.gainFuel(3);
              }
            },
          },
          {
            label: 'Drop her at a port, but take the bounty on the mutineer.',
            run: (ctx) => ctx.gainCredits(cr(ctx, 100)),
          },
        ],
      },
      wrong: {
        text: 'You free the one you believe. Six hours later, they have rifled through your cargo and vanished in a shuttle you did not know you had.',
        enter: (ctx) => {
          const lost = ctx.loseItem();
          if (!lost) ctx.loseCredits(cr(ctx, 60));
        },
      },
    },
  },

  // 8 -----------------------------------------------------------------------
  {
    id: 'ev_derelict_hot_reactor',
    sites: ['derelict'],
    title: 'Critical Mass',
    start: 'start',
    nodes: {
      start: {
        text:
          'The derelict\'s reactor is running at 140% and climbing. In about ten minutes it will turn this hulk into a brief second sun.\n\nIts thread stores are full. Spools to the ceiling.',
        choices: [
          {
            label: 'Haul out spools as fast as possible, then run.',
            run: (ctx) => {
              ctx.gainFuel(2);
              if (ctx.chance(0.4)) ctx.damageHull(10);
            },
          },
          {
            label: 'Try to stabilize the reactor.',
            run: (ctx) => {
              if (ctx.check('engineering', 3)) {
                ctx.gainFuel(5);
                ctx.giveItem({ slot: 'utility' });
                ctx.gainXp(35);
                ctx.note('The needle drops. You now own a perfectly good reactor and most of the thread stacked around it.');
              } else {
                ctx.damageHull(25);
                ctx.gainFuel(1);
                ctx.note('The needle does not drop. You learn how fast your ship can undock.');
              }
            },
          },
          {
            label: 'Ride the blast wave toward the next lane.',
            req: { apt: { navigation: 3 } },
            run: (ctx) => {
              ctx.gainFuel(4);
              ctx.damageHull(6);
              ctx.note('The second sun carries you forward like a surfer. It is the best piece of flying you have ever done, and only the reactor saw it.');
            },
          },
          { label: 'Leave immediately.' },
        ],
      },
    },
  },
];
