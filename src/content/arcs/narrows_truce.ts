/** Side arc: Terms at the Narrows. SPOILERS: the owner plays blind. */
import type { ArcDef, EventCtx, EventDef, Faction, FactionArchetype } from '../../game/api';
import { factionAt, finish, is, num, pickFaction, placeMarkers, rep, staged, advance } from './util';

const A = 'nt';
const ARC = 'narrows_truce';
const SITE = { eventId: 'nt_site', label: 'Parley', kind: 'beacon' as const };

/** mirrors the engine's feud table (design/DESIGN.md, Exodus) */
const FEUDS: [FactionArchetype, FactionArchetype][] = [
  ['zealot', 'machine'],
  ['hive', 'zealot'],
  ['hive', 'mercantile'],
  ['raider', 'mercantile'],
  ['raider', 'zealot'],
  ['machine', 'hive'],
  ['raider', 'machine'],
  ['ancient', 'hive'],
];

const feuding = (a: Faction, b: Faction) =>
  FEUDS.some(([x, y]) => (a.archetype === x && b.archetype === y) || (a.archetype === y && b.archetype === x));

const str = (c: EventCtx, f: Faction) => num(c, 'str.' + f.id);
const weak = (c: EventCtx) => factionAt(c, 'arc.nt.weak', ['mercantile', 'hive']);
const strong = (c: EventCtx) => factionAt(c, 'arc.nt.strong', ['zealot', 'machine', 'raider']);
const third = (c: EventCtx) => factionAt(c, 'arc.nt.third', ['raider']);
const outcome = (c: EventCtx) => c.flag('arc.nt.out');
const terms = (c: EventCtx) => c.flag('arc.nt.terms');

/** Narrows sit at steps 4 and 8. Markers land 1-2 steps ahead of the offer. */
const NARROWS_STEPS = [4, 8];
/** Where the parley markers will fall, relative to the next Narrows (journal text at offer time). */
const parleyWhere = (c: EventCtx) => {
  const s = num(c, 'here.step');
  const hit = NARROWS_STEPS.some((n) => n > s && n <= s + 2);
  return hit ? 'around the Narrows' : 'before the Narrows';
};
/** Where the parley is happening, at site time. */
const siteWhere = (c: EventCtx) => {
  if (is(c, 'here.narrows')) return 'in the throat of the Narrows';
  const s = num(c, 'here.step');
  return NARROWS_STEPS.some((n) => s > n && s <= n + 2) ? "in the Narrows' wake" : 'at the staging ground before the Narrows';
};

function say(f: Faction, lines: Record<FactionArchetype, string>): string {
  return lines[f.archetype];
}

export const NARROWS_TRUCE: ArcDef = {
  id: ARC,
  title: 'Terms at the Narrows',
  kind: 'side',
  activateAt: 1,
  begin(ctx) {
    const live = ctx.factions.filter((f) => !is(ctx, 'broken.' + f.id));
    let best: [Faction, Faction] | null = null;
    let gap = -1;
    for (const a of live)
      for (const b of live) {
        if (a.id >= b.id || !feuding(a, b)) continue;
        const g = Math.abs(str(ctx, a) - str(ctx, b));
        if (g > gap) {
          gap = g;
          best = str(ctx, a) <= str(ctx, b) ? [a, b] : [b, a];
        }
      }
    const w = best?.[0] ?? pickFaction(ctx, ['mercantile', 'hive', 'ancient']);
    const s = best?.[1] ?? pickFaction(ctx, ['raider', 'zealot', 'machine'], [w.id]);
    ctx.setFlag('arc.nt.weak', w.id);
    ctx.setFlag('arc.nt.strong', s.id);
    const t = live.find((f) => f.id !== w.id && f.id !== s.id && (feuding(f, s) || feuding(f, w))) ?? live.find((f) => f.id !== w.id && f.id !== s.id);
    if (t) ctx.setFlag('arc.nt.third', t.id);
    ctx.chain('nt_intro');
  },
};

const intro: EventDef = {
  id: 'nt_intro',
  sites: ['marker'],
  title: 'An Envoy',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        const w = weak(c);
        const s = strong(c);
        return `A ${w.short} courier matches your vector, running dark. The envoy aboard does not waste time.\n\n"${say(w, {
          mercantile: `The ${s.species} will hold the Narrows, captain, and they will not let us through at any price we can afford. We have drafted terms. Carry them. Our gratitude is, I assure you, fully collateralised.`,
          zealot: `The ${s.species} will stand in the Narrows like a stone in the Song. We would speak to them without blades. Carry our words, pilgrim, and be blessed for it.`,
          hive: `The ${s.species} are in the Narrows. They bite us. We would stop biting too, if they stop. Carry the warm words to them. We cannot. They bite.`,
          machine: `Item one: the ${s.species} will hold the Narrows. Item two: we will not survive forcing it. Item three: you are neutral, statistically. Carry these terms.`,
          raider: `Here's the deal. ${s.species} are sitting on the Narrows and we can't take 'em. Not this time. So we talk. You carry the talk. No shame in it. Some shame. Carry it anyway.`,
          ancient: `The ${s.species} hold the narrow place. We are few now. Carry this. Speak it as we would.`,
        })}"\n\nThe terms are fair. Generous, even, for a fleet that is losing.`;
      },
      choices: [
        {
          label: 'Carry the terms as written',
          run: (c) => {
            c.setFlag('arc.nt.terms', 'honest');
            placeMarkers(c, SITE, [1, 2]);
            c.journal(ARC, `Carry ${weak(c).name}'s terms to ${strong(c).name} ${parleyWhere(c)}.`);
          },
        },
        {
          label: 'Carry them, and quietly sweeten them in the telling',
          run: (c) => {
            c.setFlag('arc.nt.terms', 'forged');
            placeMarkers(c, SITE, [1, 2]);
            c.journal(ARC, `Carry ${weak(c).name}'s terms to ${strong(c).name}. You plan to promise more than they offered.`);
          },
        },
        {
          label: (c) => `Sell the courier's route to ${strong(c).name}`,
          run: (c) => {
            c.setFlag('arc.nt.terms', 'sold');
            c.gainCredits(120);
            rep(c, strong(c), 10);
            rep(c, weak(c), -15);
            placeMarkers(c, SITE, [1, 2]);
            c.journal(ARC, `You sold ${weak(c).name}'s route. ${strong(c).name} want to see you ${parleyWhere(c)}.`);
          },
        },
        {
          label: 'Not your war',
          run: (c) => {
            c.journal(ARC, '');
            finish(c, A);
          },
        },
      ],
    },
  },
};

const site: EventDef = {
  id: 'nt_site',
  sites: ['marker'],
  title: 'Terms at the Narrows',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        // 0: the parley
        {
          text: (c) => {
            const s = strong(c);
            const w = weak(c);
            const where = siteWhere(c);
            if (terms(c) === 'sold')
              return `The ${s.short} flagship waits ${where}, guns warm. Somewhere behind you, the ${w.species} convoy is coming, along exactly the route you sold.\n\n${s.leader} hails, delighted. "Our friend the cartographer. Stay and watch. Or help, if you like. There's a share in it."`;
            return `The ${s.short} flagship waits ${where}, guns warm. ${s.leader} receives you on an open channel, so that everyone can hear.\n\n"${say(s, {
              mercantile: `The ${w.species} send terms? How novel. Read them out. Slowly. I like to savour a bargain.`,
              zealot: `The Faithless send a messenger. Speak, then, and let the Song judge your words.`,
              hive: `They send you. Not them. We taste their fear on you. Speak.`,
              machine: `Proceed. We are recording. Deception will be detected with probability 0.7.`,
              raider: `Ha! They send a go-between. Fine. Talk. If it's good I'll drink to it. If it's bad I'll drink to it anyway, later, over their wreckage.`,
              ancient: `Speak.`,
            })}"`;
          },
          choices: [
            {
              label: 'Present the terms',
              visible: (c) => terms(c) !== 'sold',
              run: (c) => {
                const forged = terms(c) === 'forged';
                const ok = forged ? c.check('guile', 2) : c.check('diplomacy', 3);
                advance(c, A, SITE, 2, [2, 3]);
                if (ok) {
                  c.setFlag('arc.nt.out', 'truce');
                  if (forged) c.setFlag('arc.nt.lie', true);
                  rep(c, weak(c), 15);
                  rep(c, strong(c), 10);
                  if (c.flag('arc.nt.third')) rep(c, third(c), -10);
                  c.gainXp(30);
                  return 'truce';
                }
                c.setFlag('arc.nt.out', 'refused');
                rep(c, strong(c), -5);
                return 'refused';
              },
            },
            {
              label: 'Tell them the convoy is better armed than it looks',
              visible: (c) => terms(c) !== 'sold',
              run: (c) => {
                advance(c, A, SITE, 2, [2, 3]);
                if (c.check('combat', 3)) {
                  c.setFlag('arc.nt.out', 'cowed');
                  rep(c, strong(c), -10);
                  rep(c, weak(c), 20);
                  return 'cowed';
                }
                c.setFlag('arc.nt.out', 'refused');
                rep(c, strong(c), -15);
                c.combat({ side: strong(c).id || 'rogue', count: 2, strength: 0.9, announce: 'They call your bluff' });
                return 'called';
              },
            },
            {
              label: 'Switch sides: tell them where the convoy waits',
              visible: (c) => terms(c) !== 'sold',
              run: (c) => {
                advance(c, A, SITE, 2, [2, 3]);
                c.setFlag('arc.nt.out', 'betrayed');
                rep(c, weak(c), -30);
                rep(c, strong(c), 20);
                c.gainCredits(200);
                return 'betrayed';
              },
            },
            {
              label: 'Take your share of the ambush',
              visible: (c) => terms(c) === 'sold',
              run: (c) => {
                advance(c, A, SITE, 2, [2, 3]);
                c.setFlag('arc.nt.out', 'betrayed');
                rep(c, strong(c), 15);
                rep(c, weak(c), -15);
                c.giveItem({ minRarity: 1 });
                return 'ambush';
              },
            },
            {
              label: 'Warn the convoy at the last moment',
              visible: (c) => terms(c) === 'sold',
              run: (c) => {
                advance(c, A, SITE, 2, [2, 3]);
                if (c.check('guile', 2)) {
                  c.setFlag('arc.nt.out', 'cowed');
                  rep(c, weak(c), 25);
                  rep(c, strong(c), -15);
                  return 'warned';
                }
                c.setFlag('arc.nt.out', 'refused');
                rep(c, weak(c), 10);
                rep(c, strong(c), -25);
                c.combat({ side: strong(c).id || 'rogue', count: 3, strength: 0.9, announce: 'Caught double-dealing' });
                return 'caught';
              },
            },
          ],
        },
        // 1: what came of it
        {
          text: (c) => {
            const s = strong(c);
            const w = weak(c);
            const o = outcome(c);
            const wb = is(c, 'broken.' + w.id);
            if (wb)
              return `You find what is left of ${w.name}: three hulls lashed together, drifting, their running lights spelling an old distress code nobody uses any more.\n\n${o === 'betrayed' ? `They know who you are. They hail you anyway. There is nobody else left to hail.` : `They hail you by name. They remember you tried.`}`;
            if (o === 'truce' && is(c, 'arc.nt.lie'))
              return `A ${s.short} enforcer intercepts you, and ${s.leader} is on the line, cold. "The ${w.species} have delivered what they promised. It is a great deal less than what *you* promised."\n\n"The truce stands until I decide otherwise. Persuade me."`;
            if (o === 'truce')
              return `Past the Narrows, two ships fly in formation: one ${w.short}, one ${s.short}, both a little stiff about it, like old enemies at a wedding.\n\nThe truce has held. Both of them want to thank you, and both of them want you to remember that they were the reasonable ones.`;
            if (o === 'cowed')
              return `The ${w.species} got through. The ${s.species} let them, and have spent every jump since working out exactly how they were tricked.\n\nA ${s.short} interceptor is waiting for you. Behind it, at a careful distance, a single ${w.short} escort.`;
            if (o === 'betrayed')
              return `What is left of the ${w.short} convoy finds you. ${str(c, w) <= 2 ? 'There is not much of it.' : 'There is more of it than you expected.'}\n\nThey do not open fire. They just want you to look at them.`;
            return `No truce. The ${w.species} tried to force the Narrows anyway, and it went the way these things go.\n\nThey are regrouping here, ragged, for one more try. Their commander asks if you would care to make it less hopeless.`;
          },
          choices: [
            // broken weak faction
            {
              label: 'Tow them somewhere the Tide will not reach for a while (4 thread)',
              visible: (c) => is(c, 'broken.' + weak(c).id),
              req: { fuel: 1 },
              run: (c) => {
                c.loseFuel(1);
                rep(c, weak(c), 25);
                rep(c, strong(c), -5);
                c.gainXp(30);
                c.journal(ARC, '');
                finish(c, A);
                return 'sheltered';
              },
            },
            {
              label: 'Strip the hulks. They will not need them.',
              visible: (c) => is(c, 'broken.' + weak(c).id),
              run: (c) => {
                c.check('salvage', 2) ? c.giveItem({ minRarity: 2 }) : c.gainCredits(150);
                rep(c, weak(c), -20);
                c.journal(ARC, '');
                finish(c, A);
                return 'stripped';
              },
            },
            // forged truce
            {
              label: 'Make up the difference (200 cr)',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'truce' && is(c, 'arc.nt.lie'),
              req: { credits: 200 },
              run: (c) => {
                c.loseCredits(200);
                rep(c, strong(c), 10);
                rep(c, weak(c), 10);
                c.journal(ARC, '');
                finish(c, A);
                return 'paid';
              },
            },
            {
              label: (c) => `Confess to the ${weak(c).species} and ask them to cover it`,
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'truce' && is(c, 'arc.nt.lie'),
              run: (c) => {
                c.journal(ARC, '');
                finish(c, A);
                if (c.check('diplomacy', 2)) {
                  rep(c, weak(c), -10);
                  rep(c, strong(c), 5);
                  return 'confessed';
                }
                rep(c, weak(c), -20);
                rep(c, strong(c), -15);
                return 'collapsed';
              },
            },
            {
              label: 'Let it collapse',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'truce' && is(c, 'arc.nt.lie'),
              run: (c) => {
                rep(c, weak(c), -10);
                rep(c, strong(c), -20);
                c.gainFuel(2);
                c.journal(ARC, '');
                finish(c, A);
                return 'collapsed';
              },
            },
            // honest truce
            {
              label: 'Stand witness for the truce, all the way to the Heart',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'truce' && !is(c, 'arc.nt.lie'),
              run: (c) => {
                rep(c, weak(c), 10);
                rep(c, strong(c), 10);
                c.repairHull(30);
                c.gainXp(30);
                c.journal(ARC, '');
                finish(c, A);
                return 'witness';
              },
            },
            {
              label: (c) => (c.flag('arc.nt.third') ? `Sell the truce's codes to ${third(c).name}` : 'Sell the truce\'s codes to the highest bidder'),
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'truce' && !is(c, 'arc.nt.lie'),
              run: (c) => {
                c.gainCredits(260);
                if (c.flag('arc.nt.third')) rep(c, third(c), 20);
                rep(c, weak(c), -15);
                rep(c, strong(c), -15);
                c.journal(ARC, '');
                finish(c, A);
                return 'soldCodes';
              },
            },
            // cowed
            {
              label: 'Face the interceptor',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'cowed',
              run: (c) => {
                rep(c, weak(c), 10);
                c.combat({ side: strong(c).id || 'rogue', count: 2, strength: 1, announce: 'A grudge settled' });
                c.giveItem({ minRarity: 1 });
                c.journal(ARC, '');
                finish(c, A);
                return 'faced';
              },
            },
            {
              label: 'Apologise, publicly and at length',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'cowed',
              run: (c) => {
                rep(c, strong(c), 15);
                rep(c, weak(c), -10);
                c.journal(ARC, '');
                finish(c, A);
                return 'apology';
              },
            },
            // betrayed
            {
              label: 'Look at them',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'betrayed',
              run: (c) => {
                c.journal(ARC, '');
                finish(c, A);
                c.gainXp(20);
                return 'looked';
              },
            },
            {
              label: 'Offer them passage, and mean it this time',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'betrayed',
              run: (c) => {
                c.journal(ARC, '');
                finish(c, A);
                if (c.check('diplomacy', 4)) {
                  rep(c, weak(c), 25);
                  rep(c, strong(c), -10);
                  return 'forgiven';
                }
                rep(c, weak(c), -10);
                c.combat({ side: weak(c).id || 'rogue', count: 2, strength: 0.8, announce: 'Not forgiven' });
                return 'unforgiven';
              },
            },
            // refused
            {
              label: 'Fly with them',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'refused',
              run: (c) => {
                rep(c, weak(c), 25);
                rep(c, strong(c), -20);
                if (c.flag('arc.nt.third')) rep(c, third(c), 5);
                c.combat({ side: strong(c).id || 'rogue', count: 3, strength: 0.9, announce: 'One more try' });
                c.journal(ARC, '');
                finish(c, A);
                return 'flewWith';
              },
            },
            {
              label: 'Wish them luck',
              visible: (c) => !is(c, 'broken.' + weak(c).id) && outcome(c) === 'refused',
              run: (c) => {
                c.journal(ARC, '');
                finish(c, A);
                return 'luck';
              },
            },
          ],
        },
      ],
      {
        text: `An old parley beacon, still broadcasting a ceasefire nobody is observing.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    truce: {
      text: (c) =>
        `${is(c, 'arc.nt.lie') ? 'You lay it on thick. Better rates, longer terms, a few concessions the envoy never mentioned.' : 'You read the terms out plainly, and you do not hurry.'}\n\nA long silence on the open channel. Then ${strong(c).leader}: "Acceptable."\n\nThe ${weak(c).species} come through the Narrows in single file, under the ${strong(c).short} guns, and nobody fires.`,
      enter: (c) =>
        c.journal(ARC, is(c, 'arc.nt.lie') ? `A truce holds at the Narrows, built on promises you made up. It will be tested.` : `A truce holds at the Narrows. See how it fares deeper in.`),
    },
    refused: {
      text: (c) => `${strong(c).leader} hears you out, and laughs, and cuts the channel.\n\nThe Narrows stay shut to the ${weak(c).species}.`,
      enter: (c) => c.journal(ARC, `${strong(c).name} refused the terms. ${weak(c).name} will try the Narrows anyway.`),
    },
    cowed: {
      text: (c) => `You describe a convoy bristling with weapons it does not have. You are very convincing. You are, frankly, a little frightening.\n\n${strong(c).leader} decides this is not worth the losses, and opens the way.`,
      enter: (c) => c.journal(ARC, `You bluffed ${strong(c).name} into opening the Narrows. They will work that out eventually.`),
    },
    called: {
      text: (c) => `${strong(c).leader} listens to the whole thing, very politely, and then says: "No, they aren't."\n\nTheir escorts break formation toward you.`,
      enter: (c) => c.journal(ARC, `${strong(c).name} called your bluff. The Narrows stay shut.`),
    },
    betrayed: {
      text: (c) => `You give them the coordinates. ${strong(c).leader} thanks you warmly and sincerely and pays you on the spot.\n\nThe envoy's courier is still in your hold's manifest. You delete it.`,
      enter: (c) => c.journal(ARC, `You sold out ${weak(c).name} at the Narrows. Some of them may survive it.`),
    },
    ambush: {
      text: (c) => `You watch from a careful distance. It is short. The ${strong(c).species} send your share over afterwards, still warm, with a note of appreciation.`,
      enter: (c) => c.journal(ARC, `${weak(c).name} walked into the ambush you sold. Some of them may survive it.`),
    },
    warned: {
      text: (c) => `You fire one tight-beam burst down the convoy's route on a frequency the ${strong(c).species} aren't watching. The convoy scatters and slips through three different gaps.\n\n${strong(c).leader} is still waiting for an ambush that never comes. You are very far away by the time they work out why.`,
      enter: (c) => c.journal(ARC, `You double-crossed ${strong(c).name} and got ${weak(c).name} through. Both will remember.`),
    },
    caught: {
      text: (c) => `Your tight-beam goes out on exactly the frequency ${strong(c).leader} is watching.\n\n"Oh, captain," they say. "Oh, that's disappointing."`,
      enter: (c) => c.journal(ARC, `${strong(c).name} caught you double-dealing. ${weak(c).name} will try the Narrows anyway.`),
    },
    sheltered: {
      text: `You tow them three systems out of the Tide's way, which costs you thread you didn't really have. It will not save them. It buys them time.\n\nThey give you their faction's last song, recorded, so somebody remembers it.`,
    },
    stripped: {
      text: `They do not fight. They don't have anything left to fight with. You take what is worth taking and leave the rest for the Tide.`,
    },
    paid: {
      text: (c) => `You pay the difference out of your own accounts. ${strong(c).leader} accepts, with the air of someone who will be telling this story for years.\n\nThe truce holds, now on your money.`,
    },
    confessed: {
      text: (c) => `The ${weak(c).species} are furious with you. Then, after a while, quietly, they pay.\n\nThe truce holds. Nobody trusts you, but everybody is alive.`,
    },
    collapsed: {
      text: (c) => `The truce collapses inside a day. The ${weak(c).species} and the ${strong(c).species} go back to killing each other with real enthusiasm, and both blame you, which is fair.`,
    },
    witness: {
      text: (c) => `You fly between them for a while, a neutral hull both sides can point at. The ${weak(c).short} engineers patch your plates. The ${strong(c).short} gunners say nothing, which you are told is high praise.`,
    },
    soldCodes: {
      text: (c) => `You sell the truce codes. The truce lasts precisely as long as it takes ${c.flag('arc.nt.third') ? third(c).name : 'the buyer'} to use them.\n\nYou are a long way off by then. You hear about it later.`,
    },
    faced: {
      text: (c) => `The interceptor comes at you, and the ${weak(c).short} escort comes with you. Afterwards, the escort leaves a gift on your hull and goes home without a word.`,
    },
    apology: {
      text: (c) => `You apologise to ${strong(c).leader}, on an open channel, for some time. They are mollified. The ${weak(c).species} are listening too, and are less pleased to hear what their rescue was worth to you.`,
    },
    looked: {
      text: `You look. They let you. Then they turn around, together, and fly back toward the Tide to find whoever else is left.`,
    },
    forgiven: {
      text: (c) => `It takes a long time and a great deal of honesty, most of it unflattering. In the end, the ${weak(c).species} let you fly at their head.\n\nNone of them say they forgive you. They let you lead anyway.`,
    },
    unforgiven: {
      text: `They hear you out. Then they open fire.`,
    },
    flewWith: {
      text: `You throw in with them. It is a terrible idea and it nearly works.`,
    },
    luck: {
      text: (c) => `You wish them luck. The ${weak(c).species} accept it with good grace and then go and need it.`,
    },
  },
};

export const NARROWS_TRUCE_EVENTS: EventDef[] = [intro, site];
