/** Side arcs: the sealed contract, the missing officer, the cartographer, the lantern rot. */
import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, bindFaction, bump, factionAt, finish, fragment, is, lore, num, pickFaction, placeMarkers, rep, sideOf, staged } from './util';

// ===========================================================================
// The Sealed Contract
// ===========================================================================
const CT = 'ct';
const CT_SITE = { eventId: 'ct_site', label: 'Contract waypoint', kind: 'station' as const };
const broker = (c: EventCtx) => factionAt(c, 'arc.ct.broker', ['mercantile', 'raider']);
const patrol = (c: EventCtx) => factionAt(c, 'arc.ct.patrol', ['zealot', 'machine']);

export const CONTRACT: ArcDef = {
  id: 'contract',
  title: 'The Sealed Contract',
  kind: 'side',
  activateAt: 1,
  begin(ctx) {
    const b = bindFaction(ctx, 'arc.ct.broker', pickFaction(ctx, ['mercantile', 'raider']));
    bindFaction(ctx, 'arc.ct.patrol', pickFaction(ctx, ['zealot', 'machine', 'hive', 'ancient'], [b.id]));
    ctx.chain('ct_intro');
  },
};

const ctIntro: EventDef = {
  id: 'ct_intro',
  sites: ['marker'],
  title: 'A Quiet Job',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `A factor of ${broker(c).name} catches you at the dock: a soft-spoken ${broker(c).species} called Orrin Vale, with very clean hands.\n\n"One crate, captain. Sealed. Deliver it a couple of jumps deeper and the buyer pays you five hundred. You will not open it. You will not scan it. You will not, if I may be frank, wonder about it."\n\nThe crate is warm to the touch.`,
      choices: [
        {
          label: 'Take the job',
          run: (c) => {
            c.setFlag('arc.ct.on', true);
            placeMarkers(c, CT_SITE, [1, 2, 3]);
            c.journal('contract', 'Deliver Orrin Vale\'s sealed crate deeper into the Shoal. Don\'t open it. Don\'t wonder about it.');
          },
        },
        {
          label: 'Decline',
          run: (c) => c.journal('contract', ''),
        },
      ],
    },
  },
};

const ctSite: EventDef = {
  id: 'ct_site',
  sites: ['marker'],
  title: 'The Sealed Contract',
  start: 'start',
  nodes: {
    start: staged(
      CT,
      [
        {
          text: (c) =>
            `A ${patrol(c).short} patrol cutter swings in across your bow. "Routine inspection. Open your hold."\n\nIn the hold, the crate has started, very faintly, to glow.`,
          choices: [
            {
              label: 'Hide the crate under the scrap',
              run: (c) => {
                advance(c, CT, CT_SITE, 2, [1, 2]);
                if (c.check('guile', 2)) return 'hidden';
                c.loseCredits(150);
                rep(c, patrol(c), -10);
                c.setFlag('arc.ct.flagged', true);
                return 'fined';
              },
            },
            {
              label: 'Bribe them (120 cr)',
              req: { credits: 120 },
              run: (c) => {
                c.loseCredits(120);
                advance(c, CT, CT_SITE, 2, [1, 2]);
                return 'bribed';
              },
            },
            {
              label: 'Open the crate before they do',
              run: (c) => {
                c.setFlag('arc.ct.opened', true);
                advance(c, CT, CT_SITE, 2, [1, 2]);
                return 'opened';
              },
            },
          ],
        },
        {
          text: (c) =>
            `The buyer is waiting: a private yacht, gilded and armed, its owner a collector of rare living things. "The crate, captain. Vale assured me it would be... intact."\n\n${is(c, 'arc.ct.opened') ? 'In your hold, the star-calf is curled against the crate wall, humming to itself. It has learned your voice.' : 'In your hold, the crate is humming.'}`,
          choices: [
            {
              label: 'Deliver it and take the money',
              run: (c) => {
                c.gainCredits(500);
                rep(c, broker(c), 15);
                c.journal('contract', ''); finish(c, CT);
                return 'delivered';
              },
            },
            {
              label: 'Let it go free',
              visible: (c) => is(c, 'arc.ct.opened'),
              run: (c) => {
                rep(c, broker(c), -20);
                c.giveRelic('starlit_compass') ?? c.revealMap(3);
                c.journal('contract', ''); finish(c, CT);
                c.combat({ side: 'rogue', count: 2, announce: 'The collector\'s guards' });
                return 'freed';
              },
            },
            {
              label: 'Keep it',
              visible: (c) => is(c, 'arc.ct.opened'),
              run: (c) => {
                rep(c, broker(c), -10);
                c.giveRelic('gravity_pearl');
                c.journal('contract', ''); finish(c, CT);
                return 'kept';
              },
            },
            {
              label: 'Open it, here, in front of him',
              visible: (c) => !is(c, 'arc.ct.opened'),
              run: (c) => {
                c.setFlag('arc.ct.opened', true);
                return 'lateOpen';
              },
            },
          ],
        },
      ],
      {
        text: `An empty drop point. The buyer has moved on.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    hidden: {
      text: `The inspector pokes at your scrap pile with a stick, sneezes, and leaves. The crate glows a little brighter, as if amused.`,
      enter: (c) => c.journal('contract', 'Past the patrol. Deliver the crate to its buyer.'),
    },
    fined: {
      text: `They find the crate but can't open it, which offends them. They fine you for "unregistered luminous cargo" and let you go, muttering.`,
      enter: (c) => c.journal('contract', 'The patrol made a note of you. Deliver the crate to its buyer.'),
    },
    bribed: {
      text: `Credits change hands. The cutter suddenly remembers a pressing appointment elsewhere.`,
      enter: (c) => c.journal('contract', 'Past the patrol. Deliver the crate to its buyer.'),
    },
    opened: {
      text: `The seal hisses. Inside, curled in packing foam, is a creature made of light: a calf of some vast star-swimming species, eyes shut, no bigger than a dog.\n\nIt opens one eye, looks at you, and hums. The patrol takes one look and decides they don't want the paperwork.`,
      enter: (c) => c.journal('contract', 'The crate holds a living star-calf. You still have a buyer waiting. Decide what it\'s worth.'),
    },
    lateOpen: {
      text: `The collector goes pale. Inside is a calf of light, no bigger than a dog, which opens its eyes, looks at you both, and hums.\n\n"That is mine," the collector says. "I paid for it."`,
      choices: [
        {
          label: 'Hand it over',
          run: (c) => {
            c.gainCredits(500);
            rep(c, broker(c), 10);
            c.journal('contract', ''); finish(c, CT);
            return 'delivered';
          },
        },
        {
          label: 'Let it go free',
          run: (c) => {
            rep(c, broker(c), -20);
            c.giveRelic('starlit_compass') ?? c.revealMap(3);
            c.journal('contract', ''); finish(c, CT);
            c.combat({ side: 'rogue', count: 2, announce: 'The collector\'s guards' });
            return 'freed';
          },
        },
      ],
    },
    delivered: {
      text: `The crate goes. The money comes. As the yacht pulls away, you could swear you hear humming through two hulls.\n\nYou are a professional. You do not wonder about it. Much.`,
    },
    freed: {
      text: `You open the cargo doors. The calf drifts out, unsure, then sees the stars and goes, fast, a streak of light toward the deep.\n\nAs it passes your bow it pauses and hums once, and something in your navigation computer simply understands the Shoal a little better.\n\nThe collector, behind you, is screaming for his guards.`,
    },
    kept: {
      text: `The collector shouts. You close the channel. The calf curls up on your bridge, and over the next few days, loose objects drift toward it, gently, as if wanting to be near.`,
    },
  },
};

// ===========================================================================
// The Missing Officer
// ===========================================================================
const MO = 'mo';
const MO_SITE = { eventId: 'mo_site', label: 'Varro\'s trail', kind: 'wreck' as const };
const commune = (c: EventCtx) => factionAt(c, 'arc.mo.f', ['zealot', 'hive', 'ancient']);

export const MISSING_OFFICER: ArcDef = {
  id: 'missing_officer',
  title: 'The Missing Navigator',
  kind: 'side',
  activateAt: 1,
  begin(ctx) {
    bindFaction(ctx, 'arc.mo.f', pickFaction(ctx, ['zealot', 'hive', 'ancient', 'machine']));
    placeMarkers(ctx, MO_SITE, [1, 2]);
    ctx.journal('missing_officer', 'A distress recording from a navigator called Ilse Varro. Her survey ship went silent somewhere ahead.');
    ctx.chain('mo_intro');
  },
};

const moIntro: EventDef = {
  id: 'mo_intro',
  sites: ['marker'],
  title: 'A Voice on the Band',
  start: 'a',
  nodes: {
    a: {
      text: `A recording, three weeks old, on a band nobody uses anymore:\n\n"This is Lieutenant Ilse Varro, navigator, survey ship Patience. Our captain's dead. The rest are... going quiet. I keep hearing a song in the lanes and I think I know where it's coming from. If anyone gets this, don't come after me. Or do. I don't know anymore."\n\nThe recording ends with her humming.`,
      choices: [{ label: 'Mark her last position' }],
    },
  },
};

const moSite: EventDef = {
  id: 'mo_site',
  sites: ['marker'],
  title: 'The Missing Navigator',
  start: 'start',
  nodes: {
    start: staged(
      MO,
      [
        {
          text: `The Patience drifts with her running lights still on. Inside, the crew are in their bunks, and they are all asleep, and none of them will wake up. They look peaceful.\n\nThe navigator's chair is empty. Her charts are covered in handwriting: the same thirteen-bar phrase, over and over, and a heading.`,
          choices: [
            {
              label: 'Read her charts',
              run: (c) => {
                advance(c, MO, MO_SITE, 3);
                if (c.check('navigation', 2)) c.revealMap(2);
                c.journal('missing_officer', 'Ilse Varro left her ship on her own, following the singing. Follow her heading.');
              },
            },
            {
              label: 'Give the crew a proper burial',
              run: (c) => {
                c.setFlag('arc.mo.buried', true);
                c.gainXp(25);
                advance(c, MO, MO_SITE, 3);
                c.journal('missing_officer', 'You laid the Patience\'s crew to rest. Their navigator is still out there. Follow her heading.');
              },
            },
            {
              label: 'Salvage the Patience',
              run: (c) => {
                c.gainCredits(120);
                c.giveItem();
                advance(c, MO, MO_SITE, 3);
                c.journal('missing_officer', 'Ilse Varro left her ship on her own, following the singing. Follow her heading.');
              },
            },
          ],
        },
        {
          text: (c) =>
            `A ${commune(c).short} outpost. The ${commune(c).species} here remember Ilse well.\n\n"She came asking about the Song," says the one who tends the gate. "Where it begins. Who sings it. She stayed nine days and slept for none of them. Then she went on, deeper. She left you something. She said someone would come."\n\nIt is a navigator's compass, its needle pointing nowhere you can see.`,
          choices: [
            {
              label: 'Take the compass',
              run: (c) => {
                c.setFlag('arc.mo.compass', true);
                rep(c, commune(c), 5);
                advance(c, MO, MO_SITE, 3);
                c.journal('missing_officer', 'Ilse is still ahead, and she knew someone would follow. Find her.');
              },
            },
            {
              label: 'Ask what she was afraid of',
              req: { apt: { diplomacy: 2 } },
              run: (c) => {
                c.setFlag('arc.mo.knew', true);
                advance(c, MO, MO_SITE, 3);
                return 'afraid';
              },
            },
          ],
        },
        {
          text: (c) => {
            const known = c.runNumber > 1;
            return `She is sitting on the hull of a dead buoy in an EVA suit, tethered, looking at nothing. Her suit radio is tuned to the singing.\n\nShe turns as your ship approaches, and through her visor you see her face go white.\n\n${
              known
                ? `"Captain?" she whispers. "No. No, I watched you die. I was your navigator. I held your hand. It was a life ago, it wasn't this life, I know that, I know that. Why do I remember it?"`
                : `"You," she says. "I know you. I don't know you. Why do I know you?"`
            }`;
          },
          choices: [
            {
              label: '"Come aboard. You can figure it out with us."',
              run: (c) => {
                const o = c.addOfficer('navigator');
                finish(c, MO);
                if (o) return 'joined';
                c.giveRelic('old_map');
                return 'noroom';
              },
            },
            {
              label: '"Stay, if this is where you need to be."',
              run: (c) => {
                c.giveRelic('navigators_eye') ?? c.giveItem({ minRarity: 2 });
                finish(c, MO);
                return 'stayed';
              },
            },
            {
              label: 'Ask what she remembers',
              visible: (c) => c.runNumber > 1,
              run: (c) => {
                c.setMetaFlag('varro.met', true);
                fragment(c, 2, 1);
                finish(c, MO);
                return 'remember';
              },
            },
          ],
        },
      ],
      {
        text: `A tether cut loose, drifting. Someone sat here a long while, listening.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    afraid: {
      text: `"Of being right," says the gatekeeper. "She thought the singing was the voices of the dead. She thought she heard her captain in it. She thought she heard you."\n\nIt tilts its head. "She described you very precisely."`,
      enter: (c) => c.journal('missing_officer', 'Ilse thinks she heard you in the singing. Find her.'),
    },
    joined: {
      text: `She comes aboard and goes straight to the nav console like it's hers. She stops, hand hovering. "Sorry. Habit. A habit I shouldn't have."\n\nShe plots your next jump without asking. It's a good one.`,
      enter: (c) => {
        c.journal('missing_officer', '');
        lore(c, 'arc.missing_officer');
      },
    },
    noroom: {
      text: `You don't have a bunk for her. She doesn't seem to mind. She presses her old survey map into your hands. "Better routes than you'll find anywhere. Go on. I'll catch up. I always do."`,
      enter: (c) => c.journal('missing_officer', ''),
    },
    stayed: {
      text: `She nods slowly and turns back to the dark. "Take this," she says, and unscrews the lens from her helmet's nav array. "I won't need to see where I'm going anymore."`,
      enter: (c) => c.journal('missing_officer', ''),
    },
    remember: {
      text: `"Everything," she says. "Your last words, which were a terrible joke. The ship, which was on fire. And after, before I woke up here, a long time of hearing you sing, very far away, in a crowd of a thousand others, all of you trying to reach the same place."\n\n"I don't think they let you stop, captain. I think that's the point of you."`,
      enter: (c) => c.journal('missing_officer', 'She remembers you dying. Decide what to do with her.'),
      choices: [
        {
          label: '"Come with me anyway."',
          run: (c) => {
            if (c.addOfficer('navigator')) return 'joined';
            c.giveRelic('old_map');
            return 'noroom';
          },
        },
        {
          label: '"Then stay, and don\'t listen to me singing."',
          run: (c) => {
            c.giveRelic('navigators_eye') ?? c.giveItem({ minRarity: 2 });
            return 'stayed';
          },
        },
      ],
    },
  },
};

// ===========================================================================
// The Cartographer
// ===========================================================================
const CG = 'cg';
const CG_SITE = { eventId: 'cg_site', label: 'Uncharted lane', kind: 'anomaly' as const };
const charts = (c: EventCtx) => num(c, 'arc.cg.charts');
const cgName = (c: EventCtx) => {
  const m = c.factionOf('machine');
  return m ? `a ${m.species} survey-mind` : 'a survey-mind of no allegiance';
};

export const CARTOGRAPHER: ArcDef = {
  id: 'cartographer',
  title: 'Index-of-Shores',
  kind: 'side',
  activateAt: 1,
  begin(ctx) {
    placeMarkers(ctx, CG_SITE, [1, 2]);
    ctx.journal('cartographer', 'A machine cartographer wants charts of three uncharted lanes. It will meet you deeper to collect.');
    ctx.chain('cg_intro');
  },
};

const cgIntro: EventDef = {
  id: 'cg_intro',
  sites: ['marker'],
  title: 'Index-of-Shores',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `A message arrives, signed INDEX-OF-SHORES, ${cgName(c)}.\n\n"Statement one: the Shoal reshuffles. Statement two: every map of it is wrong within a year. Statement three: I have been making maps for nine hundred years anyway, because the alternative is to stop.\n\nRequest: survey three lanes I have not reached. I will find you deeper in, and pay."`,
      choices: [{ label: 'Agree to survey' }],
    },
  },
};

function chartStage(apt: 'navigation' | 'salvage' | 'science', text: string, okText: string): import('../../game/api').EventNode {
  return {
    text,
    choices: [
      {
        label: 'Run the survey',
        run: (c) => {
          if (c.check(apt, 2)) {
            bump(c, 'arc.cg.charts');
            c.gainXp(20);
            c.note(okText);
          } else c.note('The data comes back incomplete. Index-of-Shores will have to make do.');
          advance(c, CG, CG_SITE, 4, [1, 2]);
          c.journal('cartographer', `Charts gathered: ${charts(c)}. Index-of-Shores will meet you deeper in.`);
        },
      },
      {
        label: 'Skip it',
        run: (c) => {
          advance(c, CG, CG_SITE, 4, [1, 2]);
          c.journal('cartographer', `Charts gathered: ${charts(c)}. Index-of-Shores will meet you deeper in.`);
        },
      },
    ],
  };
}

const cgSite: EventDef = {
  id: 'cg_site',
  sites: ['marker'],
  title: 'Uncharted Lane',
  start: 'start',
  nodes: {
    start: staged(
      CG,
      [
        chartStage(
          'navigation',
          `A lane that doubles back on itself, a hyperspace Möbius strip. Mapping it means flying it, carefully, twice.`,
          'You fly the loop twice and come out where you started, with a perfect chart and a mild headache.',
        ),
        chartStage(
          'salvage',
          `A graveyard of survey probes, all dead, all pointed the same way. Their memory banks might hold a chart, if you can pull them intact.`,
          'You stitch together a chart from six dead probes. The last one was still transmitting, very faintly: "Hello?"',
        ),
        chartStage(
          'science',
          `The lane's edge here is thin, the wall between hyperspace and something else. Charting it means listening to it.`,
          'The edge hums a chord as you chart it. Your scanner records the chord too, though you never asked it to.',
        ),
        {
          text: (c) =>
            `Index-of-Shores is waiting, a ring of instruments the size of a station, slowly rotating. It extends a data probe with something like eagerness.\n\n"You bring ${charts(c)} of 3. ${charts(c) >= 3 ? 'Statement: this is complete. I have not said that in some time.' : 'Statement: incomplete. But more than I had.'}"`,
          choices: [
            {
              label: 'Hand them over',
              run: (c) => {
                const n = charts(c);
                c.gainCredits(80 + 90 * n);
                if (n >= 3) {
                  c.giveRelic('navigators_eye') ?? c.giveItem({ minRarity: 2 });
                  fragment(c, 1);
                }
                lore(c, 'arc.cartographer');
                c.journal('cartographer', ''); finish(c, CG);
                return n >= 3 ? 'complete' : 'partial';
              },
            },
            {
              label: 'Keep the charts for yourself',
              run: (c) => {
                c.revealMap(2 + charts(c));
                if (charts(c) >= 2) c.giveRelic('old_map');
                c.journal('cartographer', ''); finish(c, CG);
                return 'kept';
              },
            },
          ],
        },
      ],
      {
        text: `A lane that has already been charted, by you. It has already changed.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    complete: {
      text: `It overlays your charts on its own, nine hundred years of them, and pauses.\n\n"Observation: under every map I have ever made, the lanes trace one road. A single path from the edge to the Heart. Someone walked it first, and the Shoal remembers." It gives you a lens. "Look down the lanes with this. You may see their footprints."`,
    },
    partial: {
      text: `"Insufficient for a complete map. Sufficient for a better one. That is all any map is." It pays you, precisely, and turns back to its work.`,
    },
    kept: {
      text: `"Statement: disappointing. Statement: understandable. Statement: you will discover the charts are wrong within a year." It turns away.\n\nThey're very good charts, though.`,
    },
  },
};

// ===========================================================================
// The Lantern Rot
// ===========================================================================
const PL = 'pl';
const PL_SITE = { eventId: 'pl_site', label: 'Rot source', kind: 'wreck' as const };
const stationF = (c: EventCtx) => factionAt(c, 'arc.pl.f', ['mercantile', 'machine', 'zealot']);

export const PLAGUE: ArcDef = {
  id: 'plague',
  title: 'The Lantern Rot',
  kind: 'side',
  begin(ctx) {
    bindFaction(ctx, 'arc.pl.f', ctx.faction && ctx.faction.archetype !== 'raider' ? ctx.faction : pickFaction(ctx, ['mercantile', 'zealot', 'machine']));
    ctx.chain('pl_intro');
  },
};

const plIntro: EventDef = {
  id: 'pl_intro',
  sites: ['marker'],
  title: 'Quarantine',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `A ${stationF(c).short} station hangs in the system with its docking lights strobing yellow: quarantine.\n\nThe doctor who answers your hail has a faint glow under her skin, like a candle behind paper. "Lantern rot," she says. "It came in on a freighter three weeks ago. We don't have a cure. We barely have a name for it."\n\n"If you have a medic, please. If you don't, please go."`,
      choices: [
        {
          label: 'Send your medic over',
          req: { officer: 'medic' },
          run: (c) => {
            c.setFlag('arc.pl.helped', true);
            c.gainXp(30);
            rep(c, stationF(c), 10);
            return 'helped';
          },
        },
        {
          label: 'Help them study it yourself',
          run: (c) => {
            if (c.check('science', 3)) {
              c.setFlag('arc.pl.helped', true);
              rep(c, stationF(c), 10);
              return 'helped';
            }
            c.damageHull(5);
            c.setFlag('arc.pl.exposed', true);
            return 'exposed';
          },
        },
        {
          label: 'Take on the healthy ones who want out',
          run: (c) => {
            c.setFlag('arc.pl.refugees', true);
            c.loseFuel(1);
            rep(c, stationF(c), 5);
            return 'refugees';
          },
        },
        {
          label: 'Keep your distance',
          run: (c) => {
            c.setFlag('arc.pl.left', true);
            return 'left';
          },
        },
      ],
    },
    helped: {
      text: `You work the samples for a day. The rot isn't natural. Its proteins are folded by something that knew what it was doing.\n\nThe freighter's logs point to its last port of call, deeper in. If there's a cure, it starts there.`,
      enter: (c) => {
        placeMarkers(c, PL_SITE, [1, 2]);
        c.journal('plague', 'The lantern rot was made, not born. Find the freighter\'s origin deeper in.');
      },
    },
    exposed: {
      text: `Something goes wrong with a sample seal. You get the hatch closed in time, mostly. That evening your fingertips glow, faintly.\n\nThe freighter's logs point deeper in. You'd better find a cure.`,
      enter: (c) => {
        placeMarkers(c, PL_SITE, [1, 2]);
        c.journal('plague', 'You might be infected. The rot came from somewhere deeper. Find it.');
      },
    },
    refugees: {
      text: `Eleven people, three children, one very old dog. They crowd into your cargo bay and thank you in four languages.\n\nOne of them, a freight clerk, says quietly: "The ship that brought the rot. I logged it. I know where it came from."`,
      enter: (c) => {
        placeMarkers(c, PL_SITE, [1, 2]);
        c.journal('plague', 'You carry survivors of the lantern rot. One of them knows where it came from.');
      },
    },
    left: {
      text: `You leave. The yellow lights strobe behind you for a long time, then stop.`,
      enter: (c) => {
        placeMarkers(c, PL_SITE, [2]);
        c.journal('plague', 'You left the rot station behind. It may not leave you behind.');
      },
    },
  },
};

const plSite: EventDef = {
  id: 'pl_site',
  sites: ['marker'],
  title: 'The Lantern Rot',
  start: 'start',
  nodes: {
    start: staged(
      PL,
      [
        {
          text: (c) =>
            `A research hulk, abandoned in a hurry. Its labs are still warm. Inside a sealed vat, glowing cultures turn slowly, and a terminal displays a sales manifest: the rot, sold by the litre, buyer ${pickFaction(c, ['raider']).name}.\n\n${is(c, 'arc.pl.left') ? 'You weren\'t looking for this. It found you anyway.' : 'This is where it started.'}`,
          choices: [
            {
              label: 'Synthesise a cure from the master culture',
              run: (c) => {
                advance(c, PL, PL_SITE, 2, [1, 2]);
                const bonus = c.officer('medic') ? 1 : 0;
                if (c.check('science', 3 - bonus)) {
                  c.setFlag('arc.pl.cure', true);
                  return 'cure';
                }
                return 'nocure';
              },
            },
            {
              label: 'Burn the lab to slag',
              run: (c) => {
                c.setFlag('arc.pl.burned', true);
                c.gainXp(30);
                advance(c, PL, PL_SITE, 2, [1, 2]);
                return 'burned';
              },
            },
            {
              label: 'Sell the cultures yourself',
              req: { apt: { guile: 2 } },
              run: (c) => {
                c.setFlag('arc.pl.sold', true);
                c.gainCredits(450);
                advance(c, PL, PL_SITE, 2, [1, 2]);
                return 'sold';
              },
            },
          ],
        },
        {
          text: (c) => {
            if (is(c, 'arc.pl.sold'))
              return `A ship drifts across the lane, hull flickering with a soft yellow glow. Raiders. Every one of them shining like a lantern.\n\nThey're not hailing. They're not sane anymore. They're coming at you.`;
            if (is(c, 'arc.pl.cure'))
              return `A message catches up with you, relayed through four stations: the doctor, no longer glowing.\n\n"Your cure worked. We're alive. All of us. We took up a collection. It isn't much, but there's something else, too. Something we found in the freighter's hold."`;
            if (is(c, 'arc.pl.refugees'))
              return `Your refugees disembark at a safe port. The old dog goes last, then turns, comes back, and sits by your boots.\n\nThe freight clerk shrugs. "He's decided. Also, some of us have decided."`;
            return `A broadcast on every band: the rot station's final log, auto-transmitting. The doctor's voice, calm, thanking whoever tried.\n\nAttached is the station's entire cargo manifest, unlocked, with a note: "Take what helps."`;
          },
          choices: [
            {
              label: 'Fight the lanterns',
              visible: (c) => is(c, 'arc.pl.sold'),
              run: (c) => {
                c.journal('plague', ''); finish(c, PL);
                c.combat({ side: sideOf(pickFaction(c, ['raider'])), count: 4, strength: 1.2, announce: 'The lantern ships' });
              },
            },
            {
              label: 'Accept their thanks',
              visible: (c) => is(c, 'arc.pl.cure'),
              run: (c) => {
                c.gainCredits(200);
                c.giveRelic('saints_tooth') ?? c.giveItem({ minRarity: 2 });
                rep(c, stationF(c), 20);
                lore(c, 'arc.plague');
                c.journal('plague', ''); finish(c, PL);
              },
            },
            {
              label: 'Welcome aboard',
              visible: (c) => !is(c, 'arc.pl.sold') && !is(c, 'arc.pl.cure') && is(c, 'arc.pl.refugees'),
              run: (c) => {
                if (!c.addOfficer('medic')) c.gainCredits(150);
                c.repairHull(20);
                lore(c, 'arc.plague');
                c.journal('plague', ''); finish(c, PL);
              },
            },
            {
              label: 'Take what helps',
              visible: (c) => !is(c, 'arc.pl.sold') && !is(c, 'arc.pl.cure') && !is(c, 'arc.pl.refugees'),
              run: (c) => {
                c.giveItem({ minRarity: 1 });
                if (is(c, 'arc.pl.exposed')) c.damageHull(15);
                lore(c, 'arc.plague');
                c.journal('plague', ''); finish(c, PL);
              },
            },
          ],
        },
      ],
      {
        text: `An empty quarantine buoy, blinking yellow at nobody.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    cure: {
      text: `It takes thirty hours, and at the end of it you have a vial of something clear that makes the cultures stop glowing.\n\nYou transmit the formula back toward the station on every band you have.`,
      enter: (c) => c.journal('plague', 'You sent the cure. Wait for word.'),
    },
    nocure: {
      text: `The cultures fight you every step. By the time you admit defeat, the lab's reactor is failing. You get out with nothing but the manifest.`,
      enter: (c) => c.journal('plague', 'No cure. Only the knowledge of who bought the rot. Move on.'),
    },
    burned: {
      text: `It goes up beautifully. Nobody will make the rot again from here. That will have to be enough.`,
      enter: (c) => c.journal('plague', 'The source is ash. Whatever is already out there, is out there.'),
    },
    sold: {
      text: `You find a buyer in under an hour. That should probably worry you more than it does.`,
      enter: (c) => c.journal('plague', 'You sold the rot. It will be used. Somewhere.'),
    },
  },
};

export const SIDES_A: ArcDef[] = [CONTRACT, MISSING_OFFICER, CARTOGRAPHER, PLAGUE];
export const SIDES_A_EVENTS: EventDef[] = [ctIntro, ctSite, moIntro, moSite, cgIntro, cgSite, plIntro, plSite];
