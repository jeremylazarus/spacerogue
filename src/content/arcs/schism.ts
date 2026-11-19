import type { ArcDef, EventCtx, EventDef, Faction } from '../../game/api';
import { advance, bindFaction, factionAt, fragment, is, lore, pickFaction, placeMarkers, rep, sideOf, staged } from './util';

const A = 'sc';
const SITE = { eventId: 'sc_site', label: 'War front', kind: 'station' as const };
const STAGES = 3;

const fa = (c: EventCtx): Faction => factionAt(c, 'arc.sc.a', ['zealot', 'mercantile']);
const fb = (c: EventCtx): Faction => factionAt(c, 'arc.sc.b', ['mercantile', 'machine']);
const prof = (c: EventCtx): Faction => factionAt(c, 'arc.sc.p', ['raider']);
const side = (c: EventCtx) => String(c.flag('arc.sc.side') ?? 'none');

/** The faction you sided with, and the one you're against. */
function ally(c: EventCtx): Faction {
  return side(c) === 'b' ? fb(c) : fa(c);
}
function enemy(c: EventCtx): Faction {
  return side(c) === 'b' ? fa(c) : fb(c);
}

function voice(f: Faction): string {
  switch (f.archetype) {
    case 'zealot':
      return `"The Song has chosen its Faithful, Wayfarer. Stand with us, or stand in the light when it burns."`;
    case 'mercantile':
      return `"Wars are bad for margins, captain, but losing one is worse. We would very much like you on our ledger."`;
    case 'machine':
      return `"Statement one: we will win. Statement two: your help raises the probability from 61 to 74 percent. Statement three: we find that difference worth paying for."`;
    case 'hive':
      return `"We are hurting, captain. We taste our own dying. Help us and be warm with us."`;
    case 'ancient':
      return `"Ages turn. Sides are chosen. Choose."`;
    default:
      return `"Pick a flag, star-hopper. Pick ours. We pour better."`;
  }
}

export const SCHISM: ArcDef = {
  id: 'schism',
  title: 'The Schism',
  kind: 'main',
  weight: 1,
  eligible: () => true,
  begin(ctx) {
    const a = bindFaction(ctx, 'arc.sc.a', pickFaction(ctx, ['zealot', 'mercantile', 'machine', 'ancient', 'hive']));
    const b = bindFaction(ctx, 'arc.sc.b', pickFaction(ctx, ['mercantile', 'machine', 'hive', 'zealot', 'ancient'], [a.id]));
    bindFaction(ctx, 'arc.sc.p', pickFaction(ctx, ['raider'], [a.id, b.id]));
    ctx.setFlag('arc.sc.lean', 0);
    ctx.setFinale('sc_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('schism', `War has broken out between ${a.name} and ${b.name} over a derelict at the Heart. Every lane deeper runs through the fighting.`);
    ctx.chain('sc_intro');
  },
};

const intro: EventDef = {
  id: 'sc_intro',
  sites: ['marker'],
  title: 'Two Flags',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `Two broadcasts hit your comms at once, each trying to drown out the other.\n\n${fa(c).leader} of ${fa(c).name} declares the Keel, a wreck adrift at the Heart, a holy inheritance. ${fb(c).leader} of ${fb(c).name} declares it salvage, theirs by right of first survey.\n\nThen the broadcasts stop, and the shooting starts.`,
      choices: [{ label: 'Keep your head down and fly' }],
    },
  },
};

const site: EventDef = {
  id: 'sc_site',
  sites: ['marker'],
  title: 'The Front',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: (c) =>
            `Fresh wreckage, still warm. Two ships drift nose to nose where they crippled each other: a ${fa(c).short} cutter venting atmosphere, and a ${fb(c).short} frigate with its engines dead.\n\nBoth are hailing you. Both are begging. You have the air and the time to help one.`,
          choices: [
            {
              label: (c) => `Help the ${fa(c).short} crew`,
              run: (c) => {
                rep(c, fa(c), 12);
                rep(c, fb(c), -6);
                c.setFlag('arc.sc.lean', 1);
                advance(c, A, SITE, STAGES);
                return 'helped';
              },
            },
            {
              label: (c) => `Help the ${fb(c).short} crew`,
              run: (c) => {
                rep(c, fb(c), 12);
                rep(c, fa(c), -6);
                c.setFlag('arc.sc.lean', -1);
                advance(c, A, SITE, STAGES);
                return 'helped';
              },
            },
            {
              label: 'Patch both ships together and save everyone',
              req: { apt: { engineering: 2 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('engineering', 3)) {
                  rep(c, fa(c), 8);
                  rep(c, fb(c), 8);
                  c.setFlag('arc.sc.mercy', true);
                  c.gainXp(40);
                  return 'both';
                }
                c.damageHull(12);
                return 'bothFail';
              },
            },
            {
              label: 'Wait for them both to die, then strip them',
              run: (c) => {
                c.setFlag('arc.sc.vulture', true);
                c.gainCredits(180);
                c.giveItem({ minRarity: 1 });
                rep(c, fa(c), -10);
                rep(c, fb(c), -10);
                advance(c, A, SITE, STAGES);
                return 'vulture';
              },
            },
          ],
        },
        {
          text: (c) =>
            `A neutral station, every docking arm bristling with guns pointed at every other docking arm. Envoys from both sides are waiting for you; word of what you did at the front has travelled.\n\nThe ${fa(c).species} envoy: ${voice(fa(c))}\n\nThe ${fb(c).species} envoy: ${voice(fb(c))}`,
          choices: [
            {
              label: (c) => `Swear to ${fa(c).name}`,
              run: (c) => {
                c.setFlag('arc.sc.side', 'a');
                rep(c, fa(c), 20);
                rep(c, fb(c), -25);
                c.gainCredits(150);
                advance(c, A, SITE, STAGES);
                c.journal('schism', `You fly for ${fa(c).name} now. Strike at ${fb(c).name} before the fleets meet at the Keel.`);
                return 'sworn';
              },
            },
            {
              label: (c) => `Swear to ${fb(c).name}`,
              run: (c) => {
                c.setFlag('arc.sc.side', 'b');
                rep(c, fb(c), 20);
                rep(c, fa(c), -25);
                c.gainCredits(150);
                advance(c, A, SITE, STAGES);
                c.journal('schism', `You fly for ${fb(c).name} now. Strike at ${fa(c).name} before the fleets meet at the Keel.`);
                return 'sworn';
              },
            },
            {
              label: 'Get them both in one room',
              req: { apt: { diplomacy: 3 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                const bonus = is(c, 'arc.sc.mercy') ? 2 : is(c, 'arc.sc.vulture') ? -1 : 0;
                if (c.check('diplomacy', 3 - bonus)) {
                  c.setFlag('arc.sc.side', 'peace');
                  c.journal('schism', 'Both sides will hold fire if you can prove who really profits from this war. Find the proof before the Keel.');
                  return 'peace';
                }
                c.setFlag('arc.sc.side', 'none');
                rep(c, fa(c), -10);
                rep(c, fb(c), -10);
                c.journal('schism', 'The talks collapsed and both sides blame you. Reach the Keel anyway.');
                return 'peaceFail';
              },
            },
            {
              label: 'Take both their advances. Promise both.',
              req: { apt: { guile: 3 } },
              run: (c) => {
                c.setFlag('arc.sc.side', 'none');
                c.setFlag('arc.sc.double', true);
                c.gainCredits(400);
                advance(c, A, SITE, STAGES);
                c.journal('schism', 'You sold your loyalty twice. Get to the Keel before either side compares notes.');
                return 'double';
              },
            },
          ],
        },
        {
          text: (c) => {
            const s = side(c);
            if (s === 'a' || s === 'b')
              return `Your ${ally(c).short} contact sends coordinates: a supply depot where ${enemy(c).name} is fuelling the warship they mean to hold the Keel with.\n\n"Hurt that ship," they say, "and the Keel is ours."`;
            if (s === 'peace')
              return `A fuel depot, technically neutral. The ledgers here are a mess of shell companies and false flags, and every one of them, if you squint, sells weapons to both sides at once.`;
            return `A depot on the edge of the war zone. It is very quiet. The kind of quiet that means someone has been waiting for you.`;
          },
          choices: [
            {
              label: 'Plant charges on the fuel lines',
              visible: (c) => side(c) === 'a' || side(c) === 'b',
              req: { apt: { engineering: 2 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('engineering', 3)) {
                  c.setFlag('arc.sc.op', true);
                  c.gainXp(40);
                  return 'sabotage';
                }
                c.combat({ side: sideOf(enemy(c)), count: 3, announce: 'Depot guards scramble' });
                return 'caught';
              },
            },
            {
              label: 'Hit the depot head on',
              visible: (c) => side(c) === 'a' || side(c) === 'b',
              run: (c) => {
                c.setFlag('arc.sc.op', true);
                advance(c, A, SITE, STAGES);
                rep(c, enemy(c), -10);
                c.combat({ side: sideOf(enemy(c)), count: 4, strength: 1.1, announce: 'Assault on the depot' });
                return 'raid';
              },
            },
            {
              label: 'Follow the money',
              visible: (c) => side(c) === 'peace',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                const ok = c.check('guile', 2) || c.check('science', 3);
                if (ok) {
                  c.setFlag('arc.sc.proof', true);
                  c.gainXp(50);
                  return 'proof';
                }
                return 'noProof';
              },
            },
            {
              label: 'Run',
              visible: (c) => side(c) === 'none',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (!c.check('navigation', 2)) c.combat({ side: sideOf(fa(c)), count: 3, strength: 1.1, announce: 'Bounty hunters' });
                return 'ambush';
              },
            },
          ],
        },
      ],
      {
        text: `Burned-out hulls and a drifting flag of truce someone forgot to take down. The war has moved on, deeper.`,
        choices: [{ label: 'Salvage a little', run: (c) => c.gainCredits(50) }],
      },
    ),
    helped: {
      text: `You get the crew aboard just as their ship goes dark. They look at you the way people look at someone who has chosen them over somebody else.\n\nBehind you, the other ship stops hailing.`,
    },
    both: {
      text: `You cable the two wrecks together, share one ship's air with the other's power, and tell both crews in no uncertain terms to sit still.\n\nThey do. For an hour, the war has an exception in it. Word of that will travel.`,
    },
    bothFail: {
      text: `The coupling blows. You save some of each crew and lose some of each, and both sides will remember which.`,
    },
    vulture: {
      text: `It takes forty minutes. Neither crew stops hailing until the very end.\n\nThe salvage is excellent. {off} doesn't speak to you for the rest of the shift.`,
    },
    sworn: {
      text: (c) => `The envoy of ${ally(c).name} presses a war-token into your hand. The other envoy is already leaving, and already sending messages to somebody about you.`,
    },
    peace: {
      text: (c) =>
        `It takes six hours and every ounce of tact you own. At the end, the two envoys agree on exactly one thing: the war is being fed by someone.\n\n"Bring us proof," says the ${fa(c).species}. "Bring us proof," says the ${fb(c).species}. They glare at each other for saying it at the same time.`,
    },
    peaceFail: {
      text: `Someone says the wrong word about someone's grandmother. Guns come out. You leave with both envoys shouting at your back.`,
    },
    double: {
      text: `You shake two hands, take two payments, and make two promises you cannot both keep.\n\n{off} asks which side you are actually on. You tell them: ours.`,
    },
    sabotage: {
      text: (c) => `The charges go off on a timer, long after you've left. Somewhere behind you, ${enemy(c).name}'s great warship is going to discover its fuel is mostly sand.`,
      enter: (c) => c.journal('schism', `The enemy warship is crippled. Reach the Keel at the Heart and finish this for ${ally(c).name}.`),
    },
    caught: {
      text: `A guard drone spots you halfway through the job. The charges are set, but not well. You'll have to fight your way out.`,
      enter: (c) => c.journal('schism', `You only half-crippled the enemy. Reach the Keel at the Heart and finish this for ${ally(c).name}.`),
    },
    raid: {
      text: `No subtlety. You come in guns first and leave the depot burning.`,
      enter: (c) => c.journal('schism', `The depot is burning. Reach the Keel at the Heart and finish this for ${ally(c).name}.`),
    },
    proof: {
      text: (c) =>
        `It takes a while, but every shell company resolves to the same name: ${prof(c).name}. They have been selling guns to both sides since before the first shot, and they have a warship of their own waiting at the Keel to collect the prize when everyone else is dead.\n\nYou broadcast the ledgers to both fleets.`,
      enter: (c) => c.journal('schism', `${prof(c).name} has been feeding the war. Both fleets know it now. Meet them at the Keel.`),
    },
    noProof: {
      text: `The ledgers are a maze, and you run out of time before you find the centre. You have suspicions. Suspicions do not stop wars.`,
      enter: (c) => c.journal('schism', 'You found no proof. Reach the Keel and hope the fleets listen.'),
    },
    ambush: {
      text: `Both sides have compared notes. There is a price on your ship now, payable by either.`,
      enter: (c) => c.journal('schism', 'Both sides want you dead. Reach the Keel anyway; it is the only way out.'),
    },
  },
};

function finaleBoss(c: EventCtx): { side: string; strength: number; announce: string } {
  const s = side(c);
  if (s === 'a' || s === 'b') {
    return { side: sideOf(enemy(c)), strength: is(c, 'arc.sc.op') ? 1.0 : 1.35, announce: `The ${enemy(c).short} dreadnought turns its guns on you` };
  }
  if (s === 'peace' && is(c, 'arc.sc.proof')) return { side: sideOf(prof(c)), strength: 1.0, announce: `${prof(c).short} dreadnought` };
  return { side: sideOf(fa(c)), strength: 1.4, announce: 'A dreadnought fires on you' };
}

const finale: EventDef = {
  id: 'sc_finale',
  sites: ['marker'],
  title: 'The Keel',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        const s = side(c);
        let t = `The Keel is not a ship. It is the spine of one, kilometres long, bone-white, older than any species in the Shoal. Both fleets have come for it.\n\n`;
        if (s === 'a' || s === 'b')
          t += `${ally(c).name}'s fleet holds the left flank, waiting on you. Between you and the Keel squats ${enemy(c).name}'s dreadnought${is(c, 'arc.sc.op') ? ', listing badly, its engines guttering' : ', fully fuelled and furious'}.`;
        else if (s === 'peace' && is(c, 'arc.sc.proof'))
          t += `Neither fleet is firing. Both are watching one ship: a dreadnought flying ${prof(c).name}'s colours, which has just realised the war it paid for is over.`;
        else if (s === 'peace')
          t += `You broadcast your appeal for peace. Without proof, it lands like a pebble in a storm. ${fa(c).name}'s dreadnought turns toward you, the meddler, first.`;
        else t += `Both fleets see you. For one lovely second they agree on something. ${fa(c).name}'s dreadnought moves first.`;
        return t;
      },
      choices: [
        {
          label: 'Engage the dreadnought',
          run: (c) => {
            const b = finaleBoss(c);
            c.combat({ side: b.side, boss: 'dreadnought', strength: b.strength, afterVictory: 'sc_epilogue', announce: b.announce });
          },
        },
        {
          label: 'Broadcast the truth one more time',
          visible: (c) => side(c) === 'peace' && !is(c, 'arc.sc.proof'),
          req: { apt: { diplomacy: 5 } },
          run: (c) => {
            if (c.check('diplomacy', 4)) {
              c.setFlag('arc.sc.proof', true);
              c.note('Someone, on both sides, believes you. It is enough. The guns swing toward the profiteer instead.');
            } else c.note('Nobody is listening.');
            const b = finaleBoss(c);
            c.combat({ side: b.side, boss: 'dreadnought', strength: b.strength, afterVictory: 'sc_epilogue', announce: b.announce });
          },
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'sc_epilogue',
  sites: ['marker'],
  title: 'After the Keel',
  start: 'a',
  nodes: {
    a: {
      text: `The dreadnought breaks apart against the Keel's white spine. In the silence afterward you drift close enough to read what is carved along it, in letters older than the war, older than both peoples.\n\nIt is a ship's name. It is, you realise with a lurch, a name you have answered to.`,
      enter: (c) => {
        fragment(c, 5, 2);
        lore(c, 'arc.schism');
      },
      choices: [
        {
          label: 'Leave the Keel to the living',
          run: (c) => {
            const s = side(c);
            let e: string;
            if (s === 'a' || s === 'b')
              e = `${ally(c).name} claims the Keel and the war. ${ally(c).leader} names a moon after you. ${enemy(c).name} names a curse after you. Both are used frequently.\n\nYears later, children of both peoples will dig at the Keel's base, looking for whoever carved that name. They will not find you. You will already be somewhere else.`;
            else if (s === 'peace')
              e = `The fleets stand down. ${fa(c).leader} and ${fb(c).leader} agree to share the Keel, which means arguing about it forever, which is better than the alternative.\n\n${prof(c).name} finds its credit no good anywhere in the Shoal. You find yours good everywhere.`;
            else if (is(c, 'arc.sc.double'))
              e = `You leave both fleets to their war and the Keel to whoever survives it. You are richer than you have ever been and nobody in the Shoal will sell you fuel.\n\nYou find, to your surprise, that you can live with that.`;
            else
              e = `Neither side won. Neither side lost. The Keel drifts, carved with your old name, while two exhausted fleets limp home.\n\nPeace, of a kind, by exhaustion. It holds longer than anyone expects.`;
            c.victory(e);
          },
        },
      ],
    },
  },
};

export const SCHISM_EVENTS: EventDef[] = [intro, site, finale, epilogue];
