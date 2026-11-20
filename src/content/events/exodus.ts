import type { EventCtx, EventDef, Faction, FactionArchetype } from '../../game/api';
import { cr, rep, side } from './util';

// ---------------------------------------------------------------------------
// Helpers over the engine-maintained exodus facts (see design/DESIGN.md).
// ---------------------------------------------------------------------------

type Arch = FactionArchetype | 'monster';
const ARCHES: Arch[] = ['mercantile', 'zealot', 'hive', 'machine', 'raider', 'ancient', 'monster'];

function num(ctx: EventCtx, key: string): number {
  const v = ctx.flag(key);
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}
const wears = (ctx: EventCtx, a: Arch | 'total') => num(ctx, 'wears.' + a);
const str = (ctx: EventCtx, f: Faction) => num(ctx, 'str.' + f.id);
const isBroken = (ctx: EventCtx, f: Faction) => ctx.flag('broken.' + f.id) === true;
const released = (ctx: EventCtx, f: Faction) => num(ctx, 'released.' + f.id);
const narrows = (ctx: EventCtx) => ctx.flag('here.narrows') === true;
function extras(ctx: EventCtx): string[] {
  const v = ctx.flag('here.extras');
  return typeof v === 'string' && v ? v.split(',') : [];
}
const tideTouched = (ctx: EventCtx) => extras(ctx).some((x) => x === 'wrack' || x === 'scarred');
/** number of distinct kinds of ship the player's grafts come from */
const graftKinds = (ctx: EventCtx) => ARCHES.filter((a) => wears(ctx, a) > 0).length;

const FEUDS: [FactionArchetype, FactionArchetype][] = [
  ['zealot', 'machine'], ['hive', 'zealot'], ['hive', 'mercantile'], ['raider', 'mercantile'],
  ['raider', 'zealot'], ['machine', 'hive'], ['raider', 'machine'], ['ancient', 'hive'],
];
function feuding(a: Faction, b: Faction): boolean {
  return FEUDS.some(([x, y]) => (a.archetype === x && b.archetype === y) || (a.archetype === y && b.archetype === x));
}
const alive = (ctx: EventCtx) => ctx.factions.filter((f) => !isBroken(ctx, f));
/** the strongest living enemy of f */
function rival(ctx: EventCtx, f: Faction | null): Faction | null {
  if (!f) return null;
  const rs = alive(ctx).filter((o) => o.id !== f.id && feuding(f, o)).sort((a, b) => str(ctx, b) - str(ctx, a));
  return rs[0] ?? null;
}
/** weakest living faction (excluding ancients, who do not flee) */
function weakest(ctx: EventCtx): Faction | null {
  const fs = alive(ctx).filter((f) => f.archetype !== 'ancient').sort((a, b) => str(ctx, a) - str(ctx, b));
  return fs[0] ?? null;
}
function strongest(ctx: EventCtx): Faction | null {
  const fs = alive(ctx).slice().sort((a, b) => str(ctx, b) - str(ctx, a));
  return fs[0] ?? null;
}
const firstBroken = (ctx: EventCtx) => ctx.factions.find((f) => isBroken(ctx, f)) ?? null;
const firstReleased = (ctx: EventCtx) => ctx.factions.find((f) => released(ctx, f) > 0 && !isBroken(ctx, f)) ?? null;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** pick a line by the context faction's archetype */
function voice(ctx: EventCtx, v: Partial<Record<FactionArchetype, string>> & { other: string }): string {
  const a = ctx.faction?.archetype;
  return (a && v[a]) || v.other;
}

export const EXODUS_EVENTS: EventDef[] = [
  // =========================================================================
  // 1. HOW THEY READ YOUR HULL
  // =========================================================================
  {
    id: 'ex_wears_hive_kin',
    sites: ['hail'],
    title: 'Same Skin',
    archetypes: ['hive'],
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => wears(ctx, 'total') > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          (wears(ctx, 'hive') > 0
            ? '"oh. OH. you wear us. a piece of us is on you and it is warm and it is singing to us. it says you are kind to it. are you kind to it?"'
            : '"you wear pieces. we wear pieces. everything good wears pieces. you are like us now, a little. a little is a beginning."') +
          '\n\nThe {Fsp} ship drifts closer than is polite. Something on its hull is waving.',
        choices: [
          {
            label: 'Let them taste your hull.',
            run: (ctx) => {
              rep(ctx, 8);
              if (ctx.check('science', 2)) {
                ctx.repairHull(Math.round(ctx.maxHull * 0.3));
                ctx.note('Tendrils lap at your plating. Where they pass, cracks seal over with something pink that hardens to the colour of steel.');
              } else {
                ctx.damageHull(8);
                ctx.note('They taste with enthusiasm. Some of the taste does not come back.');
              }
            },
          },
          {
            label: 'Ask whose pieces you are wearing.',
            req: { apt: { diplomacy: 2 } },
            run: (ctx) => {
              rep(ctx, 5);
              ctx.gainXp(35);
              ctx.note('"the pieces do not belong to whose. they belong to where. now where is you." This is, apparently, a compliment.');
            },
          },
          {
            label: (ctx) => `Offer to trade for one of theirs (${cr(ctx, 40)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 40),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 40));
              rep(ctx, 10);
              ctx.giveItem({ minRarity: 1 });
              ctx.note('"we do not know credits but we know giving." They pass over something still slightly damp.');
            },
          },
          {
            label: '"Keep your distance."',
            run: (ctx) => {
              rep(ctx, -6);
              ctx.note('"cold," they say, hurt. "cold like a machine." The waving stops.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_wears_machine_audit',
    sites: ['hail'],
    title: 'Inventory Discrepancy',
    archetypes: ['machine'],
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => wears(ctx, 'total') > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const n = wears(ctx, 'total');
          const m = wears(ctx, 'machine');
          return `"STATEMENT 1: your hull carries ${n} component${n === 1 ? '' : 's'} not of its manufacture. STATEMENT 2: ${
            m > 0
              ? `${m === 1 ? 'one of these is' : `${m} of these are`} ours. Serial numbers intact. We are reading them now. We would prefer not to.`
              : 'none are ours. This is noted, without approval.'
          } QUERY: account for the acquisition."`;
        },
        choices: [
          {
            label: (ctx) => `Pay restitution (${cr(ctx, 60)}¢).`,
            visible: (ctx) => wears(ctx, 'machine') > 0 && ctx.credits >= cr(ctx, 60),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 60));
              rep(ctx, 15);
              ctx.note('"TRANSACTION CLOSED. The component is now legally yours. It will continue to report to us. This is not negotiable."');
            },
          },
          {
            label: 'Cite salvage law. Cite it at length.',
            run: (ctx) => {
              if (ctx.check('diplomacy', wears(ctx, 'machine') > 0 ? 4 : 2)) {
                rep(ctx, 10);
                ctx.gainXp(30);
                ctx.note('"Your argument contains 41 errors and one novel precedent. We are keeping the precedent. You may go."');
              } else {
                rep(ctx, -8);
                ctx.note('"PROBABILITY you believe this: 0.12. PROBABILITY we believe this: lower."');
              }
            },
          },
          {
            label: 'Submit to a full audit of your systems.',
            run: (ctx) => {
              rep(ctx, 6);
              ctx.gainFuel(2);
              ctx.note('They crawl through your logs for an hour. On the way out, they leave your thread spools rewound to a tidier, longer tension. "Inefficiency offended us."');
            },
          },
          {
            label: '"Count this," and close the channel.',
            run: (ctx) => {
              rep(ctx, -10);
              if (wears(ctx, 'machine') > 0 && ctx.chance(0.5)) {
                ctx.note('"RECOVERY PROTOCOL INITIATED."');
                ctx.combat({ side: side(ctx), count: 2, strength: 0.9, announce: 'Recovery detail' });
              }
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_wears_zealot_disgust',
    sites: ['hail'],
    title: 'Thou Wearest the Dead',
    archetypes: ['zealot'],
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => wears(ctx, 'total') > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          `"Abomination! Thy hull is a reliquary of the unshriven. ${
            wears(ctx, 'total') > 1 ? 'Many' : 'One'
          } who sang the Song were torn and nailed to thee, and they cry out, and thou flyest about as if thou heardest nothing."\n\nThe {Fsp} priest is weeping. Their gunports are not.`,
        choices: [
          {
            label: 'Submit to the Rite of Scouring.',
            run: (ctx) => {
              ctx.damageHull(12);
              rep(ctx, 18);
              ctx.gainXp(20);
              ctx.note('They scour your plating with sacred abrasives and loud hymns. The grafts stay. Your paint does not. "Now at least they are clean dead."');
            },
          },
          {
            label: (ctx) => `Pay for prayers for the departed (${cr(ctx, 45)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 45),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 45));
              rep(ctx, 10);
              ctx.note('"The Song accepteth coin. Grudgingly. As do we."');
            },
          },
          {
            label: '"The Song keeps what it loses. So do I."',
            req: { apt: { diplomacy: 3 } },
            run: (ctx) => {
              if (ctx.check('diplomacy', 3)) {
                rep(ctx, 15);
                ctx.gainXp(40);
                ctx.note('A long silence. "...That is in the Fourth Canticle. Where didst thou read the Fourth Canticle?" You did not. It came out of you like something remembered.');
              } else {
                rep(ctx, -12);
                ctx.note('"Blasphemy, and badly phrased."');
              }
            },
          },
          {
            label: 'Run out your guns.',
            run: (ctx) => {
              if (ctx.check('combat', 3)) {
                rep(ctx, -5);
                ctx.note('The priest stops weeping long enough to calculate. "The Song shall judge thee." They leave so the Song can do it.');
              } else {
                rep(ctx, -15);
                ctx.combat({ side: side(ctx), strength: 1, announce: 'The Scouring' });
              }
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_wears_raider_trophies',
    sites: ['hail'],
    title: 'Nice Teeth',
    archetypes: ['raider'],
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => wears(ctx, 'total') > 0 && wears(ctx, 'raider') === 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const best = (['hive', 'machine', 'zealot', 'mercantile', 'ancient', 'monster'] as Arch[]).find((a) => wears(ctx, a) > 0) ?? 'monster';
          const what: Record<string, string> = {
            hive: 'is that bug-meat? Still twitching? Oh, that is beautiful',
            machine: 'is that a clanker\'s eye? You can SEE it hating you',
            zealot: 'is that pilgrim plate? I can hear the hymns from here',
            mercantile: 'is that guild trim? Somebody\'s insurance just went up',
            ancient: 'is that... no. Nobody takes elder-shell. Who ARE you',
            monster: 'is that lane-beast? You wear a lane-beast. On purpose',
          };
          return `"Hold fire, hold fire — look at that HULL. Captain, ${what[best]}."\n\nThe {Fsp} on the screen is grinning so hard their face scar has gone white. Behind them, a crew is pressing to see.`;
        },
        choices: [
          {
            label: 'Tell them how you took it. Embellish.',
            run: (ctx) => {
              if (ctx.check('guile', 2)) {
                rep(ctx, 14);
                ctx.gainCredits(cr(ctx, 50));
                ctx.note('By the end, you fought it bare-handed in a burning hangar. They take up a collection to hear it again.');
              } else {
                rep(ctx, 4);
                ctx.note('"Three hundred of them, eh?" Someone at the back counts on their fingers. Still, they liked the part with the explosion.');
              }
            },
          },
          {
            label: 'Accept their invitation to drink.',
            run: (ctx) => {
              rep(ctx, 10);
              ctx.repairHull(10);
              if (ctx.chance(0.35)) {
                const o = ctx.addOfficer('gunner', ctx.faction?.species);
                if (o) ctx.note(`You wake with a headache and a new gunner. ${o.name} says you shook on it. You probably did.`);
              } else ctx.note('Toasts are drunk to the dead whose parts you wear. It is surprisingly moving. Then someone falls into the airlock.');
            },
          },
          {
            label: '"Make me an offer for one."',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 90));
              rep(ctx, -4);
              ctx.note('They pay up, then laugh: "Selling your trophies. Merchant blood, Captain?" You keep the graft. They bought the story of it, framed.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_wears_raider_kinplate',
    sites: ['hail'],
    title: 'Clan Plate',
    archetypes: ['raider'],
    portrait: 'faction',
    weight: 3,
    condition: (ctx) => wears(ctx, 'raider') > 0,
    start: 'start',
    nodes: {
      start: {
        text:
          '"That plate on your flank. I know the welds. I know whose hands made them, because I held those hands at her pyre-burn — except there wasn\'t a pyre, was there. You took her ship apart and wore it out dancing."\n\nThe {Fsp} captain is very calm. That is worse.\n\n"Clan law gives you two roads. Blood-price, or the circle."',
        choices: [
          {
            label: (ctx) => `Pay the blood-price (${cr(ctx, 80)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 80),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 80));
              rep(ctx, 10);
              ctx.note('"Paid. She\'s yours now, under the law. Treat her like it."');
            },
          },
          {
            label: 'Enter the circle. Ship to ship, first to breach.',
            run: (ctx) => {
              if (ctx.check('combat', 3)) {
                rep(ctx, 20);
                ctx.gainCredits(cr(ctx, 60));
                ctx.gainXp(50);
                ctx.note('You score their hull first. They laugh, bleeding atmosphere. "Fair. She went to someone who can fly. Drink to her."');
              } else {
                ctx.damageHull(Math.round(ctx.maxHull * 0.25));
                rep(ctx, 6);
                ctx.note('They breach you clean and pull off. "Law\'s satisfied. Barely. Keep her."');
              }
            },
          },
          {
            label: '"She cut me loose first. I just returned the favour."',
            req: { apt: { guile: 3 } },
            run: (ctx) => {
              if (ctx.check('guile', 4)) {
                rep(ctx, 8);
                ctx.note('It is a lie, but it is a raider\'s kind of lie. They respect it enough not to check.');
              } else {
                rep(ctx, -20);
                ctx.combat({ side: side(ctx), strength: 1.1, announce: 'Clan vengeance' });
              }
            },
          },
          {
            label: 'Burn for the lane.',
            run: (ctx) => {
              rep(ctx, -15);
              ctx.combat({ side: side(ctx), strength: 1, announce: 'Clan vengeance' });
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_wears_ancient_judge',
    sites: ['hail'],
    title: 'What Are You Now',
    archetypes: ['ancient'],
    portrait: 'faction',
    weight: 2,
    unique: true,
    condition: (ctx) => wears(ctx, 'total') > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          (graftKinds(ctx) === 1
            ? '"...One kind. You have chosen a shape."\n\nThe vast {Fsp} vessel does not move. It has not moved, perhaps, in an age.\n\n"Shapes are promises. Say what you promised."'
            : '"...Many kinds. You are a crowd, wearing a ship."\n\nThe vast {Fsp} vessel does not move. It has not moved, perhaps, in an age.\n\n"A crowd cannot answer. Try."'),
        choices: [
          {
            label: '"I am what I have taken."',
            run: (ctx) => {
              if (graftKinds(ctx) === 1) {
                rep(ctx, 12);
                ctx.gainXp(40);
                ctx.note('"Honest. Rare." Something on their hull dims, which you somehow know is approval.');
              } else {
                rep(ctx, -8);
                ctx.note('"Then you are many thieves. We have met thieves. They were shorter-lived."');
              }
            },
          },
          {
            label: '"I am still myself underneath."',
            run: (ctx) => {
              if (ctx.check('diplomacy', 3)) {
                rep(ctx, 14);
                ctx.gainXp(40);
                ctx.note('"Underneath is where everyone says they are. Few check. You checked." They give you nothing, which from them is a great deal.');
              } else {
                rep(ctx, -4);
                ctx.note('"Underneath," they repeat, as one repeats a child\'s word for the sun.');
              }
            },
          },
          {
            label: '"I am a road. Things travel on me."',
            req: { apt: { navigation: 3 } },
            run: (ctx) => {
              rep(ctx, 18);
              ctx.gainFuel(3);
              ctx.gainXp(50);
              ctx.note('A long, long pause. "Yes. Roads wear what they carry." A filament of pale thread unspools from their hull and winds onto yours.');
            },
          },
          { label: 'Say nothing.', run: (ctx) => { ctx.gainXp(15); ctx.note('"Also an answer." They return to stillness.'); } },
        ],
      },
    },
  },

  // =========================================================================
  // 2. EXODUS LIFE
  // =========================================================================
  {
    id: 'ex_convoy_refugees',
    sites: ['distress', 'arrival'],
    title: 'The Long Column',
    weight: 1,
    condition: (ctx) => { const w = weakest(ctx); return !!w && str(ctx, w) <= 3; },
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const w = weakest(ctx)!;
          return `A column of ships crawls through {sys}: haulers, yachts, a hospital barge with one engine lit. ${w.species}. What is left of ${w.name}'s outer holdings, running ahead of their own collapse.\n\nThe lead ship hails on an open band. It is a child reading from a card: "We need thread. We need hull. We need someone to fly beside us."`;
        },
        choices: [
          {
            label: 'Give them thread.',
            req: { fuel: 2 },
            run: (ctx) => {
              const w = weakest(ctx)!;
              ctx.loseFuel(2);
              ctx.changeRep(w.id, 15);
              ctx.gainXp(30);
              ctx.note('The child reads "thank you" from the back of the card. Somebody had written it in advance, just in case.');
            },
          },
          {
            label: (ctx) => `Give them credits for repairs (${cr(ctx, 50)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 50),
            run: (ctx) => {
              const w = weakest(ctx)!;
              ctx.loseCredits(cr(ctx, 50));
              ctx.changeRep(w.id, 12);
              ctx.gainXp(20);
            },
          },
          {
            label: 'Fly beside them through the dark stretch.',
            run: (ctx) => {
              const w = weakest(ctx)!;
              ctx.changeRep(w.id, 20);
              ctx.note('Something has been following the column. Now it is following you.');
              ctx.combat({ side: 'monster', count: 3, strength: 0.9, afterVictory: 'ex_convoy_after', announce: 'Column predators' });
            },
          },
          {
            label: 'Take one aboard who can earn their keep.',
            run: (ctx) => {
              const w = weakest(ctx)!;
              const o = ctx.addOfficer(undefined, w.species);
              if (o) {
                ctx.changeRep(w.id, 5);
                ctx.note(`${o.name} steps aboard with one bag and does not look back at the column. Then does.`);
              } else ctx.note('There is no bunk free. You watch the column go.');
            },
          },
          { label: 'Keep your course.', run: (ctx) => ctx.note('The column crawls on. It will be shorter at the next system.') },
        ],
      },
    },
  },
  {
    id: 'ex_convoy_after',
    sites: ['marker'],
    title: 'The Column Moves On',
    start: 'start',
    nodes: {
      start: {
        text: 'The predators scatter or burst. The column closes ranks and moves on, and as each ship passes it flashes its running lights at you, one by one, all the way down the line.',
        enter: (ctx) => {
          ctx.gainXp(40);
          ctx.repairHull(15);
          if (ctx.chance(0.5)) ctx.giveItem({ minRarity: 1 });
          else ctx.gainCredits(cr(ctx, 50));
        },
      },
    },
  },
  {
    id: 'ex_understrength_plea',
    sites: ['hail'],
    title: 'Thin Ranks',
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => !!ctx.faction && ctx.faction.archetype !== 'ancient' && str(ctx, ctx.faction) <= 3,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          voice(ctx, {
            mercantile: '"Captain. I won\'t dress it up — our ledgers are in the red and bleeding. Half the fleet is gone. We need parts, and we will pay you back. Eventually. With interest. Probably."',
            zealot: '"Traveller, the Song hath thinned our choir. We were a thousand voices; we are a hundred. Help us reach the Heart, and be remembered in the hymn."',
            hive: '"we are less. we are so much less. we used to be loud and now we are a whisper. please. warmth. parts. anything."',
            machine: '"STATEMENT: our operational count has fallen below viability threshold. STATEMENT: we are requesting assistance. NOTE: we have never made this statement before. It is unpleasant."',
            raider: '"Look. Nobody hears this from me twice. The clan\'s down to scraps. We need hull plate and we need it from someone who won\'t laugh."',
            other: '"We are fewer than we were. Will you help?"',
          }),
        choices: [
          {
            label: (ctx) => `Send them repair stock (${cr(ctx, 55)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 55),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 55));
              rep(ctx, 20);
              ctx.gainXp(25);
              if (ctx.chance(0.4)) {
                ctx.giveItem({ minRarity: 1 });
                ctx.note('They insist on giving you something back. It is clearly the best thing they own.');
              }
            },
          },
          {
            label: 'Share your thread.',
            req: { fuel: 2 },
            run: (ctx) => {
              ctx.loseFuel(2);
              rep(ctx, 16);
              ctx.gainXp(20);
            },
          },
          {
            label: 'Sell them supplies at the going rate (which has gone up).',
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 60));
              rep(ctx, -8);
              ctx.note(voice(ctx, { mercantile: '"Fair margins. I\'d have done the same. I hate that I\'d have done the same."', other: 'They pay. They remember.' }));
            },
          },
          {
            label: (ctx) => { const r = rival(ctx, ctx.faction); return r ? `Sell their position to ${r.name}.` : 'Sell their position to whoever is hunting them.'; },
            visible: (ctx) => !!rival(ctx, ctx.faction),
            run: (ctx) => {
              const r = rival(ctx, ctx.faction)!;
              ctx.gainCredits(cr(ctx, 90));
              ctx.changeRep(r.id, 10);
              if (ctx.check('guile', 2)) ctx.note('You wish them luck and close the channel. The buyer is already moving.');
              else {
                rep(ctx, -25);
                ctx.note('They intercept the transmission. They do not say anything. They just stop broadcasting to you, forever.');
              }
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_feud_pick_side',
    sites: ['hail'],
    title: 'Whose Side',
    portrait: 'faction',
    weight: 1.5,
    condition: (ctx) => !!ctx.faction && !!rival(ctx, ctx.faction) && !ctx.flag('ex_feud_patron'),
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const r = rival(ctx, ctx.faction)!;
          const ask = voice(ctx, {
            mercantile: `"Strictly business, Captain: ${r.name} are a cost centre we would like to reduce. One of their patrols works this lane. Thin it, and we'll make it worth your while."`,
            zealot: `"${cap(r.name)} are Faithless, and their patrol defileth this lane. Smite it, and be sanctified. Also paid."`,
            hive: `"${r.name} hurt us. they are near. they taste of rust and fear. make them stop being near and we will love you more."`,
            machine: `"PROPOSITION: a patrol of ${r.name} operates in this lane. Their removal improves our survival odds by 4.1%. We will compensate you in proportion."`,
            raider: `"${cap(r.name)} owe us blood. There's a patrol of theirs out here, fat and slow. Help us collect and you get a share."`,
            ancient: `"...${r.name}. They have been loud for an age. Quiet some of them."`,
            other: `"${cap(r.name)} patrol this lane. Deal with them."`,
          });
          return `${ask}\n\nOn your scope: three ${r.species} ships, heading your way, who have not yet decided what you are.`;
        },
        choices: [
          {
            label: 'Take the contract.',
            run: (ctx) => {
              const r = rival(ctx, ctx.faction)!;
              ctx.setFlag('ex_feud_patron', ctx.faction!.id);
              rep(ctx, 6);
              ctx.changeRep(r.id, -15);
              ctx.combat({ side: r.id, count: 3, strength: 0.9, afterVictory: 'ex_feud_paid', announce: `${r.short} patrol` });
            },
          },
          {
            label: 'Warn the patrol instead.',
            run: (ctx) => {
              const r = rival(ctx, ctx.faction)!;
              ctx.changeRep(r.id, 15);
              rep(ctx, -15);
              ctx.gainCredits(cr(ctx, 30));
              ctx.note(`${cap(r.species)} gratitude is brief and comes with a small transfer. Your former employer\'s gratitude is no longer available.`);
            },
          },
          {
            label: 'Broker a cease-fire on this lane.',
            req: { apt: { diplomacy: 4 } },
            run: (ctx) => {
              const r = rival(ctx, ctx.faction)!;
              if (ctx.check('diplomacy', 4)) {
                rep(ctx, 8);
                ctx.changeRep(r.id, 8);
                ctx.gainXp(60);
                ctx.note('Neither side thanks you. Neither side fires. In the exodus, that is a miracle with paperwork.');
              } else {
                rep(ctx, -5);
                ctx.changeRep(r.id, -5);
                ctx.note('Both sides agree on one thing: you should mind your own business.');
              }
            },
          },
          { label: '"Not my fight."', run: (ctx) => { rep(ctx, -3); ctx.note('"Everything is everyone\'s fight now," they say, and go.'); } },
        ],
      },
    },
  },
  {
    id: 'ex_feud_paid',
    sites: ['marker'],
    title: 'Contract Settled',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const p = ctx.factions.find((f) => f.id === ctx.flag('ex_feud_patron'));
          return `The patrol is debris. ${p ? cap(p.name) : 'Your patron'} pays promptly, which is how you know they are frightened.`;
        },
        enter: (ctx) => {
          const pid = String(ctx.flag('ex_feud_patron') ?? '');
          if (pid) ctx.changeRep(pid, 12);
          ctx.gainCredits(cr(ctx, 100));
          ctx.gainXp(40);
        },
      },
    },
  },
  {
    id: 'ex_lane_chatter_broken',
    sites: ['station', 'arrival'],
    title: 'Lane Chatter',
    weight: 1.5,
    unique: true,
    condition: (ctx) => !!firstBroken(ctx),
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const b = firstBroken(ctx)!;
          return `Every band in {sys} is full of it. ${cap(b.name)} are finished. Their beacons are dark. Their patrols are rumours.\n\nA salvage broker is already selling "${b.short} heritage pieces." A ${b.species} in a stained coat sits by the dock, not selling anything, watching the broker.`;
        },
        choices: [
          {
            label: (ctx) => `Buy from the broker (${cr(ctx, 70)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 70),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 70));
              ctx.giveItem({ minRarity: 1 });
              ctx.note('The broker throws in a commemorative patch. It is misspelled.');
            },
          },
          {
            label: (ctx) => `Talk to the ${firstBroken(ctx)!.species} by the dock.`,
            run: (ctx) => {
              const b = firstBroken(ctx)!;
              const o = ctx.addOfficer(undefined, b.species);
              if (o) ctx.note(`"There's no one left to go home to," says ${o.name}. "So I suppose I'll go forward." They sign on.`);
              else {
                ctx.gainXp(25);
                ctx.note('They talk for an hour about a people who no longer exist. You are the last person who will hear most of it.');
              }
            },
          },
          {
            label: 'Expose the broker\'s fakes.',
            req: { apt: { salvage: 2 } },
            run: (ctx) => {
              ctx.gainCredits(cr(ctx, 40));
              ctx.gainXp(30);
              ctx.note('Half the "heritage" is stamped from the same press. The dockmaster gives you a finder\'s fee and the broker gives you a look.');
            },
          },
          {
            label: 'Ask who broke them.',
            run: (ctx) => {
              const b = firstBroken(ctx)!;
              const r = rival(ctx, b);
              ctx.gainXp(15);
              ctx.note(r
                ? `"${cap(r.name)}," says everyone, then, quieter: "and the Tide. And us, for watching." Nobody is drinking to ${r.short} tonight.`
                : '"The Tide," says someone. "The lanes," says another. "Time," says the bartender, wiping a glass that will never be clean.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_shelter_ask',
    sites: ['hail', 'station'],
    title: 'A Place to Stop',
    portrait: 'faction',
    weight: 2,
    condition: (ctx) => !!ctx.faction && ctx.flag('amb.' + ctx.faction.id) === 'shelter',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          voice(ctx, {
            mercantile: '"We\'re done running, Captain. We mean to build a harbour — a real one, with a roof — somewhere the exodus can stop and breathe. It\'s the worst investment we\'ve ever made. We\'d like you in on it."',
            zealot: '"The Heart can wait, traveller. Some of the faithful cannot. We raise a hostel for the weary. Wilt thou lay a stone?"',
            hive: '"we are making a nest. not for us. for everyone tired. you are tired. we taste it. help make the nest?"',
            machine: '"PROJECT: a fixed refuge. STATUS: irrational. We have run the numbers 9,000 times. We are doing it anyway. QUERY: will you contribute?"',
            raider: '"Don\'t laugh. We\'re building a hold. No tribute, no tolls. Just walls. Somewhere the kids can sleep without their boots on."',
            other: '"We are building a refuge. Will you help?"',
          }),
        choices: [
          {
            label: 'Anchor it with your thread.',
            req: { fuel: 3 },
            run: (ctx) => {
              ctx.loseFuel(3);
              rep(ctx, 22);
              ctx.repairHull(Math.round(ctx.maxHull * 0.4));
              ctx.gainXp(40);
              ctx.note('Your thread is woven into the refuge\'s moorings. They patch your hull in its first finished dock.');
            },
          },
          {
            label: (ctx) => `Fund it (${cr(ctx, 70)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 70),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 70));
              rep(ctx, 15);
              ctx.giveItem({ minRarity: 1 });
              ctx.note('Your name goes on a plaque. The plaque goes on a wall. The wall, for now, holds.');
            },
          },
          {
            label: 'Clear the beasts nesting where they want to build.',
            run: (ctx) => {
              rep(ctx, 10);
              ctx.setFlag('ex_shelter_patron', ctx.faction!.id);
              ctx.combat({ side: 'monster', count: 3, strength: 1, afterVictory: 'ex_shelter_cleared', announce: 'Squatters' });
            },
          },
          {
            label: '"Nothing stays. The Tide will come for it."',
            run: (ctx) => {
              rep(ctx, -6);
              ctx.note(voice(ctx, { hive: '"yes. but it will be warm until then."', machine: '"KNOWN. Proceeding."', other: '"We know. We are building it anyway."' }));
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_shelter_cleared',
    sites: ['marker'],
    title: 'First Walls',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const p = ctx.factions.find((f) => f.id === ctx.flag('ex_shelter_patron'));
          return `The nest is clear. ${p ? cap(p.name) + ' builders move' : 'Builders move'} in behind you before the debris has stopped tumbling. Someone has already hung a lamp.`;
        },
        enter: (ctx) => {
          const pid = String(ctx.flag('ex_shelter_patron') ?? '');
          if (pid) ctx.changeRep(pid, 10);
          ctx.gainCredits(cr(ctx, 60));
          ctx.repairHull(20);
          ctx.gainXp(35);
        },
      },
    },
  },
  {
    id: 'ex_reach_race',
    sites: ['hail', 'station'],
    title: 'The Race to the Heart',
    portrait: 'faction',
    weight: 1.5,
    minDepth: 1,
    condition: (ctx) => !!ctx.faction && ctx.flag('amb.' + ctx.faction.id) === 'reach',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          voice(ctx, {
            mercantile: '"First to the Heart sets the prices there, Captain. We intend to be first. Your Loom-logs would be worth a great deal to us — what does a Wayfarer see that our navigators don\'t?"',
            zealot: '"We shall be first to stand in the Heart and hear the Song whole! Thou weavest roads, they say. Show us thy weaving."',
            hive: '"the Heart is loud. we want to be close to loud. you know roads. share roads?"',
            machine: '"OBJECTIVE: arrive at the Heart. OBSERVATION: you spin roads where none exist. REQUEST: your methodology. NOTE: we have tried. We cannot do it."',
            raider: '"Whoever plants a flag at the Heart gets told about forever. Give us your lane-logs and you get a toast every year."',
            other: '"We go to the Heart. Help us find the way."',
          }),
        choices: [
          {
            label: 'Share your logs honestly.',
            run: (ctx) => {
              if (ctx.check('navigation', 2)) {
                rep(ctx, 15);
                ctx.gainCredits(cr(ctx, 70));
                ctx.note('Your logs are good. They are also, you notice as you read them, full of turns your hands chose before you did.');
              } else {
                rep(ctx, 6);
                ctx.gainCredits(cr(ctx, 25));
                ctx.note('They study the logs a long time. "Most of this is just... you going forward." Yes.');
              }
            },
          },
          {
            label: 'Sell them a doctored copy.',
            run: (ctx) => {
              if (ctx.check('guile', 3)) {
                ctx.gainCredits(cr(ctx, 120));
                ctx.note('They pay handsomely for a scenic route through every hazard you could remember.');
              } else {
                ctx.gainCredits(cr(ctx, 40));
                rep(ctx, -20);
                ctx.note('Their navigator finds the loop you drew through a lane-scar. The payment arrives with a very specific curse.');
              }
            },
          },
          {
            label: 'Trade logs for their spare thread.',
            run: (ctx) => {
              rep(ctx, 8);
              ctx.gainFuel(3);
            },
          },
          {
            label: '"Nobody follows a Wayfarer\'s road. It closes behind me."',
            run: (ctx) => {
              rep(ctx, -2);
              ctx.gainXp(15);
              ctx.note('"Then we will make our own," they say. You almost tell them how. You find you cannot.');
            },
          },
        ],
      },
    },
  },

  // =========================================================================
  // 3. THE NARROWS
  // =========================================================================
  {
    id: 'ex_narrows_queue',
    sites: ['arrival'],
    title: 'The Queue at the Throat',
    weight: 3,
    condition: narrows,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const h = strongest(ctx);
          return `The whole exodus is here, packed into the throat of the Narrows like fish into a net. Haulers, warships, pilgrim barges, things that might once have been stations. ${
            h ? `${cap(h.name)} have marshals strung along the queue, waving ships through on their own schedule.` : 'Nobody is in charge. Everybody is shouting.'
          }\n\nBehind it all, you can feel the Tide breathing.`;
        },
        choices: [
          {
            label: 'Cut through the queue.',
            run: (ctx) => {
              const h = strongest(ctx);
              if (ctx.check('navigation', 3)) {
                ctx.gainFuel(2);
                ctx.gainXp(30);
                ctx.note('You thread a gap between two freighters with a hand-width to spare. Someone applauds over comms. Someone else files a complaint.');
              } else {
                ctx.damageHull(15);
                if (h) ctx.changeRep(h.id, -8);
                ctx.note('You clip a barge, scrape a marshal, and end up further back than you started.');
              }
            },
          },
          {
            label: (ctx) => `Bribe a marshal (${cr(ctx, 40)}¢).`,
            visible: (ctx) => !!strongest(ctx) && ctx.credits >= cr(ctx, 40),
            run: (ctx) => {
              const h = strongest(ctx)!;
              ctx.loseCredits(cr(ctx, 40));
              ctx.changeRep(h.id, 6);
              ctx.gainFuel(1);
              ctx.note('"Priority lane, Captain. Very exclusive. Very real." It is, actually.');
            },
          },
          {
            label: 'Let a damaged ship go ahead of you.',
            run: (ctx) => {
              const w = weakest(ctx);
              if (w) ctx.changeRep(w.id, 12);
              ctx.gainXp(25);
              ctx.note(`${w ? `The ${w.species} crew` : 'The crew'} flash their lights at you as they pass. It costs you nothing but time, and you are surprised how much you mind.`);
            },
          },
          { label: 'Wait your turn.', run: (ctx) => { ctx.gainXp(10); ctx.note('You wait. The queue moves. The Tide does not, yet.'); } },
        ],
      },
    },
  },
  {
    id: 'ex_narrows_collector',
    sites: ['hail', 'station'],
    title: 'Throat Dues',
    portrait: 'faction',
    weight: 3,
    unique: true,
    condition: (ctx) => narrows(ctx) && !!ctx.faction && ctx.faction.id === strongest(ctx)?.id && ctx.faction.archetype !== 'ancient',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          voice(ctx, {
            mercantile: '"Welcome to the Narrows, under {F} administration! There is a passage fee. There is also a fee for the fee. You may pay both, or explain to my colleagues with the large guns why not."',
            zealot: '"The Song hath given the Throat into our keeping. All who pass tithe to the Heart. Tithe, pilgrim."',
            hive: '"this is our narrow place now. everyone who goes through gives a little. we do not know why. it seemed like what holding is."',
            machine: '"NOTICE: this chokepoint is under {Fs} management. A transit levy applies. Rates are calculated by hull mass, threat profile, and an irrationality coefficient. Yours is high."',
            raider: '"Toll\'s the toll, friend. Strongest clan holds the Throat, and look who\'s strongest. Pay up, or pay later, with interest, in blood."',
            other: '"Passage costs. Pay."',
          }),
        choices: [
          {
            label: (ctx) => `Pay in credits (${cr(ctx, 60)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 60),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 60));
              rep(ctx, 8);
            },
          },
          {
            label: 'Pay in thread.',
            req: { fuel: 2 },
            run: (ctx) => {
              ctx.loseFuel(2);
              rep(ctx, 8);
            },
          },
          {
            label: '"Nobody holds the Narrows. The Tide does."',
            req: { apt: { diplomacy: 3 } },
            run: (ctx) => {
              if (ctx.check('diplomacy', 4)) {
                rep(ctx, 4);
                ctx.gainXp(45);
                ctx.note(voice(ctx, { machine: '"...ACKNOWLEDGED. Levy waived. Please do not say that on the public band."', other: 'The collector glances, involuntarily, at the dark behind the queue. "...Go on through."' }));
              } else {
                ctx.loseCredits(cr(ctx, 80));
                rep(ctx, -6);
                ctx.note('"Philosophy surcharge." They mean it.');
              }
            },
          },
          {
            label: 'Refuse.',
            run: (ctx) => {
              rep(ctx, -20);
              ctx.combat({ side: side(ctx), count: 3, strength: 1, announce: 'Toll enforcers' });
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_narrows_smugglers',
    sites: ['hail', 'distress'],
    title: 'A Quieter Seam',
    weight: 2,
    unique: true,
    condition: narrows,
    start: 'start',
    nodes: {
      start: {
        text:
          'The ship that hails you has no transponder and very good manners. "Captain. You look like someone who\'d rather not leave the Narrows empty-handed. There\'s a seam off the main throat — narrow, old, unmarked. Nobody holding it. Nobody watching it. The walls are crusted with slack that never got swept."\n\n"We\'ll lead you in and back out for a fee. Bring your own nerve."',
        choices: [
          {
            label: (ctx) => `Pay their fee (${cr(ctx, 45)}¢).`,
            visible: (ctx) => ctx.credits >= cr(ctx, 45),
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 45));
              if (ctx.check('guile', 2)) {
                ctx.gainFuel(3);
                ctx.gainXp(30);
                const h = strongest(ctx);
                if (h) ctx.changeRep(h.id, -5);
                ctx.note('The seam is real. It hums, oddly, the whole way. You scrape the walls as you go and come back out to the main throat with your holds heavier than you went in.');
              } else {
                ctx.note('Halfway in, their running lights go dark and other lights come on. Lots of them.');
                ctx.combat({ side: 'rogue', count: 3, strength: 0.9, announce: 'Seam ambush' });
              }
            },
          },
          {
            label: 'Follow them without paying.',
            req: { apt: { navigation: 3 } },
            run: (ctx) => {
              if (ctx.check('navigation', 4)) {
                ctx.gainFuel(2);
                ctx.gainXp(40);
                ctx.note('You shadow them at the edge of sensor range all the way in, and skim the walls behind them. They notice on the way out. They wave, a little sourly.');
              } else {
                ctx.damageHull(18);
                ctx.note('You lose them in the dark and find the seam\'s walls instead.');
              }
            },
          },
          {
            label: 'Report them to the marshals.',
            visible: (ctx) => !!strongest(ctx),
            run: (ctx) => {
              const h = strongest(ctx)!;
              ctx.changeRep(h.id, 10);
              ctx.gainCredits(cr(ctx, 35));
              ctx.note('The bounty is small. The smugglers\' last transmission is not polite.');
            },
          },
          { label: '"I\'ll stay in the main channel."' },
        ],
      },
    },
  },
  {
    id: 'ex_narrows_reluctant',
    sites: ['distress', 'hail'],
    title: 'Not Going On',
    weight: 2,
    unique: true,
    condition: narrows,
    start: 'start',
    nodes: {
      start: {
        text:
          'A small ship hangs at the side of the throat, engines cold, transponder broadcasting a single repeated line: NOT IN DISTRESS. NOT GOING ON.\n\nThe pilot answers on the first ring. "I\'ve been looking at what\'s ahead," she says. "I\'ve been looking at what\'s behind. I think I\'d rather just stay here, where it\'s both."',
        choices: [
          {
            label: 'Talk her through it.',
            run: (ctx) => {
              if (ctx.check('diplomacy', 2)) {
                ctx.gainXp(40);
                ctx.gainFuel(2);
                ctx.note('You talk for a long time about nothing much. Eventually her engines warm. She gives you her spare thread: "I\'ll spin more. I think I\'ll be around to."');
              } else {
                ctx.gainXp(15);
                ctx.note('"Thank you," she says, kindly, the way people say it to someone who has not understood. The engines stay cold.');
              }
            },
          },
          {
            label: 'Offer her a berth.',
            run: (ctx) => {
              const o = ctx.addOfficer('navigator');
              if (o) ctx.note(`"Someone else steering," says ${o.name}. "Yes. I can do that." She brings her charts. They are annotated in a hand that shakes less as it goes.`);
              else ctx.note('There is no berth free. She thanks you for asking.');
            },
          },
          {
            label: 'Ask for her thread, since she won\'t need it.',
            run: (ctx) => {
              ctx.gainFuel(4);
              ctx.note('She sends it over without a word. When the queue moves, you look back, and her ship is still there, and then the Tide is.');
            },
          },
          { label: 'Leave her be.', run: (ctx) => ctx.note('Some people are entitled to stop. You are not one of them.') },
        ],
      },
    },
  },

  // =========================================================================
  // 4. TIDE-TOUCHED
  // =========================================================================
  {
    id: 'ex_wrack_unmade',
    sites: ['derelict'],
    title: 'Half a Ship',
    weight: 3,
    condition: tideTouched,
    start: 'start',
    nodes: {
      start: {
        text:
          'It is exactly half a ship. Not broken — the hull does not tear or melt. It simply stops, mid-corridor, mid-bulkhead, mid-word painted on the wall, and beyond the edge there is nothing, smooth as water.\n\nOn the made side, the lights still work.',
        choices: [
          {
            label: 'Salvage the made half.',
            run: (ctx) => {
              if (ctx.check('salvage', 2)) {
                ctx.giveItem({ minRarity: 1 });
                ctx.gainCredits(cr(ctx, 30));
              } else {
                ctx.gainCredits(cr(ctx, 25));
                ctx.note('Most of what you reach for is only half there.');
              }
            },
          },
          {
            label: 'Study the edge.',
            run: (ctx) => {
              if (ctx.check('science', 3)) {
                ctx.gainXp(50);
                ctx.unlockCodex('lore.tide');
                ctx.note('Under magnification the edge is not an edge. It is a slope, very steep, made of material becoming gradually less certain of itself. At the bottom of the slope, faintly, something is humming.');
              } else {
                ctx.gainXp(20);
                ctx.damageHull(8);
                ctx.note('Your probe goes over the edge. The data it sends back is a single sustained note. Then nothing. Then the probe\'s tether comes back without it.');
              }
            },
          },
          {
            label: 'Pull loose thread from the frayed seam.',
            run: (ctx) => {
              ctx.gainFuel(3);
              if (ctx.chance(0.4)) {
                ctx.damageHull(12);
                ctx.note('The thread comes willingly. Too willingly. Some of your own hull follows it a little way before you cut it.');
              }
            },
          },
          { label: 'Leave it. Don\'t touch the edge.', run: (ctx) => ctx.note('Wise. Probably. You find yourself thinking about the half-word on the wall for days.') },
        ],
      },
    },
  },
  {
    id: 'ex_wrack_returned',
    sites: ['anomaly', 'derelict'],
    title: 'Washed Back',
    weight: 2,
    unique: true,
    condition: tideTouched,
    start: 'start',
    nodes: {
      start: {
        text:
          'A lifepod, sitting in the wrack-line where the Tide has been. It should not be here; nothing comes back. Its occupant is alive, and smiles at you through the glass with a face that is correct in every detail and somehow has no particular features.\n\n"Hello," it says. "I was in there. It was very full. Can I have a name? I seem to have left mine."',
        choices: [
          {
            label: 'Bring them aboard.',
            run: (ctx) => {
              const o = ctx.addOfficer(undefined, undefined, 'Nobody');
              if (o) {
                ctx.note('They take "Nobody" happily. They are very good at their job. Sometimes, on night watch, the crew hears them humming in more than one voice.');
              } else ctx.note('There is no berth. "That\'s alright," it says. "I\'ll wait. I\'m good at waiting now."');
            },
          },
          {
            label: 'Give them your own name.',
            run: (ctx) => {
              ctx.gainXp(40);
              ctx.repairHull(15);
              ctx.note('"{cap}," it repeats, trying it on. "Oh. Oh, that one\'s been in there too. Lots of times." It hands you something warm from the pod before it drifts off, content: a patch of hull that seals itself to yours.');
            },
          },
          {
            label: 'Scan them first.',
            req: { apt: { science: 2 } },
            run: (ctx) => {
              ctx.gainXp(50);
              ctx.unlockCodex('lore.choir');
              ctx.note('The scan returns a person. It also returns, underneath, a chord — the same one you hear in the lane static, faint, as though they brought some of it out on their skin.');
            },
          },
          {
            label: 'Push the pod back over the wrack-line.',
            run: (ctx) => {
              ctx.gainFuel(2);
              ctx.note('It does not resist. As the pod slides under, the Tide gives up a little loose thread, as if in exchange. You decide not to think about the exchange rate.');
            },
          },
        ],
      },
    },
  },

  // =========================================================================
  // 5. THOSE YOU CUT LOOSE
  // =========================================================================
  {
    id: 'ex_released_repay',
    sites: ['hail'],
    title: 'You Let Us Go',
    portrait: 'faction',
    weight: 4,
    unique: true,
    condition: (ctx) => !!ctx.faction && released(ctx, ctx.faction) > 0,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) =>
          voice(ctx, {
            mercantile: '"Captain! You won\'t remember us — no, you will. Your line around our hull, then the snip. We tallied what our lives were worth that day and owe you a margin. Please. Let us settle."',
            zealot: '"Thou boundest us, and then thou loosedst us. We have argued the theology of it for three systems. We have concluded: gratitude. Accept it."',
            hive: '"you held us and you let go. nobody lets go. we remember the taste of being let go. it tastes like you. here. here. take."',
            machine: '"RECORD: you had the opportunity to dismantle us. RECORD: you did not. We have been unable to model why. Pending a model, we are repaying the debt."',
            raider: '"You had us on a leash and you cut it. That\'s a debt, and clan pays debts. What\'ll it be, Captain?"',
            ancient: '"...You loosed us. We were bound once before, an age ago. That one did not loose us. Hm."',
            other: '"You cut us loose. We have not forgotten."',
          }),
        choices: [
          {
            label: 'Accept whatever they offer.',
            run: (ctx) => {
              rep(ctx, 8);
              if (ctx.faction?.archetype === 'ancient') ctx.giveItem({ minRarity: 2 });
              else ctx.giveItem({ minRarity: 1 });
              ctx.gainCredits(cr(ctx, 40));
            },
          },
          {
            label: 'Ask them to patch you up.',
            run: (ctx) => {
              rep(ctx, 8);
              ctx.repairHull(ctx.maxHull);
              ctx.note('They work on your hull with the particular care of people who know exactly how close you came to doing the opposite.');
            },
          },
          {
            label: 'Ask one of them to fly with you.',
            run: (ctx) => {
              const o = ctx.addOfficer(undefined, ctx.faction?.species);
              if (o) {
                rep(ctx, 5);
                ctx.note(`${o.name} volunteers before you finish asking. "Seemed fair. You held my life once. I\'ll hold yours."`);
              } else {
                ctx.note('No berth free. They give you thread instead.');
                ctx.gainFuel(3);
              }
            },
          },
          {
            label: '"You owe me nothing."',
            run: (ctx) => {
              rep(ctx, 15);
              ctx.gainXp(40);
              ctx.note('They do not believe you. That is fine. They will tell everyone this story, and they will tell it wrong, and it will be better than the truth.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_released_warning',
    sites: ['arrival', 'distress'],
    title: 'A Word in Your Ear',
    weight: 1.5,
    unique: true,
    minDepth: 1,
    condition: (ctx) => !!firstReleased(ctx),
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const f = firstReleased(ctx)!;
          return `A tight-beam, unsigned, ${f.species} encoding: "The one with the cut line remembers. Don't take the wide arc past the third moon. Someone's waiting there for a ship your size. That's all. We're even now. Mostly."`;
        },
        choices: [
          {
            label: 'Heed it and go round.',
            run: (ctx) => {
              const f = firstReleased(ctx)!;
              ctx.changeRep(f.id, 5);
              ctx.gainXp(25);
              ctx.note('You take the long way. From a distance you see the ambushers waiting, patient, disappointed.');
            },
          },
          {
            label: 'Go in anyway, guns warm.',
            run: (ctx) => {
              ctx.note('They are exactly where you were told. They are not expecting you to be expecting them.');
              ctx.combat({ side: 'rogue', count: 3, strength: 0.8, afterVictory: 'ex_released_ambush_won', announce: 'Ambush, reversed' });
            },
          },
          {
            label: 'Sell the warning on to someone else.',
            run: (ctx) => {
              const f = firstReleased(ctx)!;
              ctx.gainCredits(cr(ctx, 45));
              ctx.changeRep(f.id, -6);
              ctx.note('It is a good warning. Lots of people want it. Somehow, word gets back.');
            },
          },
        ],
      },
    },
  },
  {
    id: 'ex_released_ambush_won',
    sites: ['marker'],
    title: 'The Waiting Ones',
    start: 'start',
    nodes: {
      start: {
        text: 'The ambushers had stocked up for a long wait. Their wait is over. Their stock is yours.',
        enter: (ctx) => {
          ctx.gainCredits(cr(ctx, 70));
          ctx.gainFuel(2);
          ctx.gainXp(30);
        },
      },
    },
  },
];
