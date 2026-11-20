/** Main arc: The Last Weaver. SPOILERS: the owner plays blind. */
import type { ArcDef, EventCtx, EventDef, Faction, FactionArchetype } from '../../game/api';
import { advance, bump, finish, is, num, pickFaction, placeMarkers, rep, staged } from './util';

const A = 'lw';
const ARC = 'last_weaver';
const SITE = { eventId: 'lw_site', label: 'Loose thread', kind: 'anomaly' as const };
const STAGES = 5;

// --- helpers ---------------------------------------------------------------

const alive = (c: EventCtx) => c.factions.filter((f) => !is(c, 'broken.' + f.id));
const str = (c: EventCtx, f: Faction) => num(c, 'str.' + f.id);

function strongest(c: EventCtx, exclude: string[] = []): Faction {
  const xs = alive(c).filter((f) => !exclude.includes(f.id)).sort((a, b) => str(c, b) - str(c, a));
  return xs[0] ?? pickFaction(c, ['machine', 'zealot', 'mercantile'], exclude);
}

function weakest(c: EventCtx, exclude: string[] = []): Faction {
  const xs = alive(c).filter((f) => !exclude.includes(f.id)).sort((a, b) => str(c, a) - str(c, b));
  return xs[0] ?? pickFaction(c, ['hive', 'mercantile', 'raider'], exclude);
}

function byId(c: EventCtx, key: string): Faction | null {
  const id = c.flag(key);
  return c.factions.find((f) => f.id === id) ?? null;
}

function carriedIds(c: EventCtx): string[] {
  const v = c.flag('arc.lw.carried');
  return typeof v === 'string' && v ? v.split(',') : [];
}

function carry(c: EventCtx, f: Faction): void {
  if (!f.id) return;
  const ids = carriedIds(c);
  if (!ids.includes(f.id)) ids.push(f.id);
  c.setFlag('arc.lw.carried', ids.join(','));
}

/** factions you opened the way for that are still standing */
function carriedAlive(c: EventCtx): Faction[] {
  const ids = carriedIds(c);
  return alive(c).filter((f) => ids.includes(f.id));
}

/** ships fed to the Tide during this run (meta counter delta) plus how far you leaned toward it */
function tideScore(c: EventCtx): number {
  const fed = Math.max(0, Number(c.metaFlag('choir.weight') ?? 0) - num(c, 'arc.lw.choir0'));
  return fed + (is(c, 'arc.lw.listened') ? 2 : 0) + (is(c, 'arc.lw.tidegift') ? 1 : 0);
}

const woven = (c: EventCtx) => num(c, 'arc.lw.woven');
const taken = (c: EventCtx) => num(c, 'arc.lw.taken');

function say(f: Faction, lines: Record<FactionArchetype, string>): string {
  return lines[f.archetype];
}

function names(fs: Faction[]): string {
  const n = fs.map((f) => f.name);
  if (n.length <= 1) return n[0] ?? '';
  return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}

// --- arc ---------------------------------------------------------------------

export const LAST_WEAVER: ArcDef = {
  id: ARC,
  title: 'The Last Weaver',
  kind: 'main',
  weight: 1,
  begin(ctx) {
    ctx.setFinale('lw_finale');
    ctx.setFlag('arc.lw.choir0', Number(ctx.metaFlag('choir.weight') ?? 0));
    placeMarkers(ctx, SITE, [1, 2]);
    ctx.journal(ARC, 'Someone spun thread before you. A strand of their work is caught on the lanes ahead. Find where it leads.');
    ctx.chain('lw_intro');
  },
};

const intro: EventDef = {
  id: 'lw_intro',
  sites: ['marker'],
  title: 'Someone Else\'s Thread',
  start: 'a',
  nodes: {
    a: {
      text: `Your spinneret catches on something it did not make.\n\nA strand, finer than yours and older, strung taut across the lane ahead. It hums when your hull brushes it. The note is a question you almost recognise.\n\n{off} reads the tension off the gauges and goes quiet. "Captain. That's spun thread. Somebody else's. I didn't think there was anybody else."`,
      choices: [
        {
          label: 'Pluck it',
          run: (c) => {
            c.note('The strand sings all the way down the lane and out of hearing. Somewhere deep in the Shoal, something pauses, listening.');
            c.setFlag('arc.lw.plucked', true);
          },
        },
        { label: 'Leave it be and note the bearing' },
      ],
    },
  },
};

// --- staged site ---------------------------------------------------------------

const site: EventDef = {
  id: 'lw_site',
  sites: ['marker'],
  title: 'The Unfinished Weave',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        // 0: the spool
        {
          text: `The strand ends at a spool-buoy: a drum of wound thread the size of a cargo pod, anchored to nothing, holding the strain of a lane that isn't there yet.\n\nStencilled on the drum, in a steady hand: Y. MARROW. HOLD THIS.\n\nThe thread on it is warm. It has been waiting a long time for somebody to pick it up.`,
          choices: [
            {
              label: 'Follow the strand along its length',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                const d = c.officer('navigator') ? 1 : 2;
                if (c.check('navigation', d)) {
                  c.setFlag('arc.lw.notes', true);
                  c.gainXp(25);
                  return 'followed';
                }
                c.damageHull(10);
                c.gainXp(10);
                return 'lost';
              },
            },
            {
              label: 'Wind it onto your own loom',
              run: (c) => {
                bump(c, 'arc.lw.taken');
                c.gainFuel(3);
                advance(c, A, SITE, STAGES);
                return 'wound';
              },
            },
            {
              label: 'Tie your thread to hers and hold the strain (4 thread)',
              req: { fuel: 1 },
              run: (c) => {
                c.loseFuel(1);
                bump(c, 'arc.lw.woven');
                c.gainXp(15);
                advance(c, A, SITE, STAGES);
                return 'tied';
              },
            },
          ],
        },
        // 1: the snag
        {
          text: (c) => {
            const s = strongest(c);
            const w = weakest(c, [s.id]);
            return `Her weave has snagged across the lane like a net across a river mouth. Behind it, a crush of ${w.short} hulls, patched and overloaded, bumping against threads they cannot see.\n\nIn front of it, a ${s.short} picket, idling.\n\nThe ${w.species} hail first: "${say(w, {
              mercantile: 'Captain, the margin on our survival is very thin. Open that, and our ledgers are yours.',
              zealot: 'The Song calls us to the Heart, and this web of the Faithless bars our way. Unbind it, pilgrim.',
              hive: 'We are stuck. We taste the Tide behind. It tastes of being finished. Open, please. Open.',
              machine: 'Statement one: we cannot pass. Statement two: the Tide arrives soon. Statement three: you can spin. Request follows.',
              raider: 'I don\'t beg. This isn\'t begging. This is a toast to whoever cuts us a hole, and it\'s a very sincere toast.',
              ancient: 'We have waited ages. We cannot wait one hour more.',
            })}"\n\nThe ${s.species} answer on the same band: "${say(s, {
              mercantile: 'The snag is a natural tariff, captain. Leave it. We will make it worth your while.',
              zealot: 'The Heart is for the worthy. Let the web judge them.',
              hive: 'Fewer mouths at the Heart. More warmth for us. Leave it shut. We will remember your kindness, in our way.',
              machine: 'Probability the Heart shelters every arriving fleet: 0.31. Leave the obstruction. Compensation is available.',
              raider: 'That knot\'s the best thing that\'s happened to us all voyage. Leave it tied and drink with us.',
              ancient: 'Let it be. Not all should pass.',
            })}"`;
          },
          enter: (c) => {
            const s = strongest(c);
            c.setFlag('arc.lw.s', s.id);
            c.setFlag('arc.lw.w', weakest(c, [s.id]).id);
          },
          choices: [
            {
              label: (c) => `Weave a gap for the ${weakest(c, [strongest(c).id]).short} (4 thread)`,
              req: { fuel: 1 },
              run: (c) => {
                const s = byId(c, 'arc.lw.s') ?? strongest(c);
                const w = byId(c, 'arc.lw.w') ?? weakest(c, [s.id]);
                c.loseFuel(1);
                bump(c, 'arc.lw.woven');
                carry(c, w);
                rep(c, w, 15);
                rep(c, s, -10);
                advance(c, A, SITE, STAGES);
                if (c.check('engineering', 3)) return 'gapClean';
                c.damageHull(18);
                return 'gapRough';
              },
            },
            {
              label: (c) => `Leave it shut and take the ${strongest(c).short} payment`,
              run: (c) => {
                const s = byId(c, 'arc.lw.s') ?? strongest(c);
                const w = byId(c, 'arc.lw.w') ?? weakest(c, [s.id]);
                rep(c, s, 15);
                rep(c, w, -20);
                c.gainCredits(160);
                bump(c, 'arc.lw.taken');
                advance(c, A, SITE, STAGES);
                return 'shut';
              },
            },
            {
              label: 'Unpick the whole net for yourself',
              run: (c) => {
                const s = byId(c, 'arc.lw.s') ?? strongest(c);
                const w = byId(c, 'arc.lw.w') ?? weakest(c, [s.id]);
                bump(c, 'arc.lw.taken');
                advance(c, A, SITE, STAGES);
                rep(c, w, -5);
                rep(c, s, -12);
                c.gainFuel(c.check('salvage', 2) ? 5 : 3);
                if (s.id) c.combat({ side: s.id, count: 2, strength: 0.85, announce: 'The picket objects' });
                return 'unpicked';
              },
            },
          ],
        },
        // 2: the hand
        {
          text: `A cradle-skiff hangs from her weave like a kite on a string. Inside is a young man in a tattered weaver's harness, both hands knotted into the line.\n\nHis fingers are coming undone. Not bleeding: unspooling, a fine pale thread running from each knuckle into the weave.\n\n"Pell," he says. "Pell Ashgrove. Her hand. She said hold this end till someone comes. Are you someone?" He laughs, badly. "I think I've been holding it a while."`,
          choices: [
            {
              label: 'Cut him out of the harness and bring him aboard',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.lw.pattern', true);
                const o = c.addOfficer('navigator', 'human', 'Pell Ashgrove');
                if (o) {
                  c.setFlag('arc.lw.hand', 'aboard');
                  c.setFlag('arc.lw.handId', o.id);
                  return 'handAboard';
                }
                c.setFlag('arc.lw.hand', 'left');
                return 'handNoRoom';
              },
            },
            {
              label: 'Try to stop the unravelling',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                const d = c.officer('medic') ? 2 : 3;
                if (c.check('science', d)) {
                  c.setFlag('arc.lw.hand', 'freed');
                  c.giveRelic('navigators_eye') ?? c.gainXp(40);
                  return 'handHealed';
                }
                c.setFlag('arc.lw.hand', 'lost');
                bump(c, 'arc.lw.taken');
                c.gainFuel(3);
                return 'handLost';
              },
            },
            {
              label: 'Let him keep holding. Ask for her pattern.',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.lw.hand', 'holding');
                c.setFlag('arc.lw.pattern', true);
                bump(c, 'arc.lw.woven');
                return 'handHolds';
              },
            },
          ],
        },
        // 3: the hem
        {
          text: (c) => {
            const weight = Number(c.metaFlag('choir.weight') ?? 0);
            let t = `Here her weave runs straight into the Tide, and the Tide is eating it.\n\nNot fast. Thoughtfully. The threads go grey at the edge of the front and then simply stop being, and from the place where they stop comes a sound like a crowd in another room.`;
            if (weight > 0) t += `\n\nSome of the voices in that crowd are pitched like ships you have tethered. They seem to know your thread. They are not angry. They are patient.`;
            else t += `\n\nNone of the voices are words. All of them are close.`;
            return t;
          },
          choices: [
            {
              label: 'Hold up the Warden\'s Key',
              req: { relic: 'warden_key' },
              hideIfUnmet: true,
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.lw.listened', true);
                bump(c, 'arc.lw.woven');
                return 'keyed';
              },
            },
            {
              label: 'Listen to it',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.damageHull(10);
                if (c.check('science', 2)) {
                  c.setFlag('arc.lw.listened', true);
                  c.gainXp(35);
                  return 'listened';
                }
                c.gainXp(15);
                return 'deafened';
              },
            },
            {
              label: 'Splice the weave around the front (8 thread)',
              req: { fuel: 2 },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.loseFuel(2);
                if (c.check('engineering', 3)) {
                  bump(c, 'arc.lw.woven');
                  return 'spliced';
                }
                c.damageHull(20);
                return 'spliceFail';
              },
            },
            {
              label: 'Let it have this stretch, and see what it gives back',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                bump(c, 'arc.lw.taken');
                c.setFlag('arc.lw.tidegift', true);
                c.giveItem({ minRarity: 2 });
                return 'gift';
              },
            },
          ],
        },
        // 4: the banner
        {
          text: (c) => {
            const s = strongest(c);
            const w = weakest(c, [s.id]);
            return `Word travels faster than ships. By the time you reach the last of her weave before the Heart, the lane is crowded with envoys.\n\nThey have heard there is a weaver finishing Marrow's lane. Whoever's banner it carries goes through first, while the Heart still has room.\n\n${s.leader} of ${s.name} sends a gilded data-packet and a gunship to deliver it. ${w.leader} of ${w.name} sends one battered courier, and an apology for the courier.`;
          },
          enter: (c) => {
            const s = strongest(c);
            c.setFlag('arc.lw.s2', s.id);
            c.setFlag('arc.lw.w2', weakest(c, [s.id]).id);
          },
          choices: [
            {
              label: (c) => `Promise it to ${strongest(c).name}`,
              run: (c) => {
                const s = byId(c, 'arc.lw.s2') ?? strongest(c);
                c.setFlag('arc.lw.banner', s.id || 'none');
                rep(c, s, 20);
                for (const f of alive(c)) if (f.id !== s.id) rep(c, f, -6);
                c.giveItem({ minRarity: 2 });
                advance(c, A, SITE, STAGES);
                return 'bannerStrong';
              },
            },
            {
              label: (c) => `Promise it to ${weakest(c, [strongest(c).id]).name}`,
              run: (c) => {
                const s = byId(c, 'arc.lw.s2') ?? strongest(c);
                const w = byId(c, 'arc.lw.w2') ?? weakest(c, [s.id]);
                c.setFlag('arc.lw.banner', w.id || 'none');
                carry(c, w);
                rep(c, w, 20);
                rep(c, s, -15);
                c.repairHull(25);
                advance(c, A, SITE, STAGES);
                return 'bannerWeak';
              },
            },
            {
              label: '"It carries everyone, or it carries no one."',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('diplomacy', 3)) {
                  c.setFlag('arc.lw.banner', 'all');
                  for (const f of alive(c)) {
                    rep(c, f, 5);
                    carry(c, f);
                  }
                  return 'bannerAll';
                }
                c.setFlag('arc.lw.banner', 'none');
                for (const f of alive(c)) rep(c, f, -5);
                return 'bannerNone';
              },
            },
            {
              label: 'Auction the right of way',
              run: (c) => {
                const s = byId(c, 'arc.lw.s2') ?? strongest(c);
                advance(c, A, SITE, STAGES);
                bump(c, 'arc.lw.taken');
                c.setFlag('arc.lw.banner', 'sold');
                if (c.check('guile', 2)) c.gainCredits(380);
                else c.gainCredits(200);
                rep(c, s, 8);
                for (const f of alive(c)) if (f.id !== s.id) rep(c, f, -10);
                return 'bannerSold';
              },
            },
          ],
        },
      ],
      {
        text: `A stretch of her weave, drifting slack. It leads nowhere now except deeper, toward the Heart, where it has always led.`,
        choices: [
          {
            label: 'Draw a little thread from it',
            run: (c) => c.gainFuel(1),
          },
        ],
      },
    ),
    followed: {
      text: `You fly the strand like a handrail. It is beautifully spun, even, patient, with a slight left twist your own hands would never make.\n\nEvery few hundred kilometres she has tied a knot, and every knot is the same: a little loop that closes back on itself. A signature. You learn to read it.`,
      enter: (c) => c.journal(ARC, 'Y. Marrow spun a lane toward the Heart and never finished it. Her work runs deeper. Follow it.'),
    },
    lost: {
      text: `The strand crosses a lane scar and you lose it in the static. When you find it again you have scraped half a hull plate off on it.\n\nIt is very strong, her thread. Stronger than yours.`,
      enter: (c) => c.journal(ARC, 'Y. Marrow spun a lane toward the Heart and never finished it. Her work runs deeper. Follow it.'),
    },
    wound: {
      text: `It comes off the drum easily. Too easily, as if it wanted to be used.\n\nThe buoy, relieved of its strain, drifts loose. Somewhere ahead, a length of unfinished lane sags.`,
      enter: (c) => c.journal(ARC, 'You took some of Y. Marrow\'s thread for your own. The rest of her weave runs deeper, toward the Heart.'),
    },
    tied: {
      text: `You splice your thread to hers. It costs you, and for a moment your whole loom groans with the weight of a lane that goes on far past where you can see.\n\nThen the weight settles, shared. Somewhere ahead, something takes the strain.`,
      enter: (c) => c.journal(ARC, 'You tied your thread to Y. Marrow\'s weave. It runs deeper, toward the Heart. Follow it.'),
    },
    gapClean: {
      text: (c) => {
        const w = byId(c, 'arc.lw.w');
        return `You open a seam the way she would have: a long loop, closed back on itself. The net parts like a curtain.\n\n${w ? `The ${w.species} pour through, every hull flashing its running lights at you at once.` : 'The stranded fleet pours through.'} The picket's guns track you a long, long moment, and do not fire.`;
      },
      enter: (c) => c.journal(ARC, 'You opened Marrow\'s snag for a fleet that needed it. Someone will remember. Her weave runs on toward the Heart.'),
    },
    gapRough: {
      text: (c) => {
        const w = byId(c, 'arc.lw.w');
        return `It is not elegant. The snag fights you, and her thread is stronger than yours; it saws through two hull plates before the seam finally gives.\n\nBut it gives. ${w ? `The ${w.species} squeeze through, scraping, one by one.` : 'The stranded fleet squeezes through.'} The picket watches and makes a note of your name.`;
      },
      enter: (c) => c.journal(ARC, 'You tore a gap in Marrow\'s snag for a fleet that needed it. Her weave runs on toward the Heart.'),
    },
    shut: {
      text: (c) => {
        const w = byId(c, 'arc.lw.w');
        return `You fly past without touching the net. The payment arrives before you clear the system.\n\nBehind you, ${w ? `the ${w.species}` : 'the stranded fleet'} stop hailing. Then, much later, the Tide arrives, and there is nobody left to hail.`;
      },
      enter: (c) => c.journal(ARC, 'You left Marrow\'s snag shut. The strong go on to the Heart. So does her weave. Follow it.'),
    },
    unpicked: {
      text: `You loop the whole snag and haul. It comes apart into a glorious tangle of free thread, more than you have ever held, and every ship on both sides of it surges forward at once into the gap.\n\nNobody thanks you. Several people shoot at you.`,
      enter: (c) => c.journal(ARC, 'You unpicked Marrow\'s snag for the thread. Her weave runs on, thinner now, toward the Heart.'),
    },
    handAboard: {
      text: `He comes out of the harness in pieces, and then in one piece, shaking. The unspooling slows once he is off the line. It does not stop.\n\nOn your bridge he stares at your loom and starts, without asking, to correct your tension. "She'd hate that," he says. "Left twist. Always left."\n\nHe knows her pattern. He knows where she went.`,
      enter: (c) => c.journal(ARC, 'Pell Ashgrove, Marrow\'s apprentice, is aboard. She went to the Heart to finish her lane. Follow her weave.'),
    },
    handNoRoom: {
      text: `There is no berth for him. He looks at your crowded bridge and laughs, kinder this time.\n\n"Then I'll hold it a bit longer," he says, and before you can argue, he dictates her pattern into your loom from memory: every twist, every closing loop. "Tell her I held it."`,
      enter: (c) => c.journal(ARC, 'Marrow\'s apprentice gave you her pattern and stayed at his post. She went to the Heart. Follow her weave.'),
    },
    handHealed: {
      text: `It takes hours. You splice the loose ends of him back into him, which is a sentence you never expected to think, and the unspooling stops.\n\nHe forgets her pattern in the process. He forgets a great deal. He keeps one thing, a small lens he wore over his left eye, and presses it on you.\n\n"She went to the Heart," he says. "I remember that. I think I'll go the other way."`,
      enter: (c) => c.journal(ARC, 'You saved Marrow\'s apprentice from her weave. She went to the Heart. Follow it.'),
    },
    handLost: {
      text: `You try. He comes undone in your hands, all at once, a soft heap of fine pale thread on the deck.\n\nIt is very good thread. Your loom takes it without being asked. Nobody on the bridge says anything for a while.`,
      enter: (c) => c.journal(ARC, 'Marrow\'s apprentice is part of your loom now. She went to the Heart. Follow her weave.'),
    },
    handHolds: {
      text: `"Good," he says, relieved. "Good. Someone has to."\n\nHe gives you her pattern, every twist of it, and you add a few turns of your own thread to his line so that he has a little longer. He is still smiling when you pull away. He will be smiling, you think, when the Tide comes.`,
      enter: (c) => c.journal(ARC, 'Marrow\'s apprentice still holds his end. You carry her pattern. She went to the Heart. Follow her weave.'),
    },
    keyed: {
      text: `You hold the key to the viewport, feeling foolish. The crowd-sound stops mid-breath.\n\nThe Tide leans back from the weave, the way a dog leans back from a familiar boot. In the quiet, a single voice, a woman's, very tired: "Not yet. I said not yet."\n\nThe weave is whole here. You did not have to do anything.`,
      enter: (c) => c.journal(ARC, 'The Tide knows Marrow. It is waiting for her to finish something. She is at the Heart.'),
    },
    listened: {
      text: `You open the band and let it in. It hurts. Then it makes sense.\n\nShe was here. She made a bargain at this spot, the Tide and the weaver: her lane would carry every fleet to the Heart, and in exchange the Tide would get the hem. Everything behind. Everything left over.\n\nShe never finished. The Tide is still waiting for its half.`,
      enter: (c) => c.journal(ARC, 'Marrow bargained with the Tide. It is still waiting for its half. She is at the Heart.'),
    },
    deafened: {
      text: `You open the band and let it in, and it is far too much. When {off} pulls the plug you are on the floor and your nose is bleeding.\n\nYou caught one word, maybe, in a woman's voice. Hem.`,
      enter: (c) => c.journal(ARC, 'The Tide is eating Marrow\'s weave, and it seems to know her. She is at the Heart.'),
    },
    spliced: {
      text: `You thread a detour around the grey, looping wide and closing tight, the way she would. The weave holds. The crowd-sound rises to a howl and then, offended, falls away.\n\nOne stretch of her lane will survive the Tide. That has to be worth something.`,
      enter: (c) => c.journal(ARC, 'You saved a stretch of Marrow\'s weave from the Tide. She is at the Heart. Finish what she started, or don\'t.'),
    },
    spliceFail: {
      text: `The front shifts while you work. You pull back with grey creeping up your own spinneret, and the splice drifts into the Tide and stops being.\n\nYou wasted the thread. The weave is a little shorter.`,
      enter: (c) => c.journal(ARC, 'The Tide took a stretch of Marrow\'s weave. She is at the Heart.'),
    },
    gift: {
      text: `You back off and let the front take the stretch. It does so gratefully.\n\nA moment later something bobs up out of the grey, the way a river gives up a boot: a ship's module, intact, warm, still bearing a stranger's serials. A trade.\n\nYou have the strangest sense of having been thanked by something enormous.`,
      enter: (c) => c.journal(ARC, 'You gave the Tide a stretch of Marrow\'s weave and it paid you for it. She is at the Heart.'),
    },
    bannerStrong: {
      text: (c) => {
        const s = byId(c, 'arc.lw.s2');
        return `${s ? s.leader : 'Their leader'} accepts with no surprise whatsoever. The gunship leaves you a gift and an escort beacon.\n\nThe battered courier waits a while longer, in case you change your mind, and then turns around.`;
      },
      enter: (c) => c.journal(ARC, 'You promised Marrow\'s lane to the strongest. Now reach the Heart and find her.'),
    },
    bannerWeak: {
      text: (c) => {
        const w = byId(c, 'arc.lw.w2');
        return `The courier's pilot cries, briefly and with dignity, and then patches your hull with ${w ? `${w.species}` : 'their'} sealant as a gift because it is the only thing aboard worth giving.\n\nThe gunship powers its guns, considers the matter, and powers them down. For now.`;
      },
      enter: (c) => c.journal(ARC, 'You promised Marrow\'s lane to the weakest. Now reach the Heart and find her.'),
    },
    bannerAll: {
      text: `You say it on every band at once. There is a long silence.\n\nThen, grudgingly, one at a time, the envoys agree. Nobody likes it. Everybody prefers it to the alternative, which is everybody else getting there first.`,
      enter: (c) => c.journal(ARC, 'Every fleet agreed: Marrow\'s lane carries all of them or none. Reach the Heart and find her.'),
    },
    bannerNone: {
      text: `You say it on every band at once, and every band laughs.\n\nThe envoys leave without a deal. Each of them, you suspect, is now planning to get there first by other means.`,
      enter: (c) => c.journal(ARC, 'No fleet would share Marrow\'s lane. Reach the Heart and find her before they do.'),
    },
    bannerSold: {
      text: `The bidding is lively, vicious and short. You end up richer and roundly despised, which {off} notes is the usual outcome of an auction.\n\nThe winners are already arguing with each other about what exactly they bought.`,
      enter: (c) => c.journal(ARC, 'You sold the right of way on a lane that isn\'t finished. Reach the Heart and find Marrow.'),
    },
  },
};

// --- finale ------------------------------------------------------------------

function wideStrength(c: EventCtx): number {
  let s = 1.35 - 0.08 * carriedAlive(c).length;
  if (is(c, 'arc.lw.pattern')) s -= 0.1;
  if (c.flag('arc.lw.banner') === 'all') s -= 0.1;
  return Math.max(0.8, s);
}

function mirrorStrength(c: EventCtx): number {
  let s = 1.15 + 0.05 * taken(c);
  if (is(c, 'arc.lw.pattern')) s -= 0.2;
  if (is(c, 'arc.lw.notes')) s -= 0.1;
  return Math.max(0.75, Math.min(1.5, s));
}

function claimant(c: EventCtx): Faction {
  return strongest(c);
}

const finale: EventDef = {
  id: 'lw_finale',
  sites: ['marker'],
  title: 'The Frame',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        let t = `Across the mouth of the Heart hangs a loom the size of a moon: a frame of black spars, and on it a lane three-quarters woven, wide enough for every fleet in the Shoal. It ends, mid-row, in nothing.\n\nIn the frame, tied into it at a dozen points, is a woman who is mostly thread. Her ship hangs beside her. It has started to look like yours.\n\n"You came the long way," says Ysolde Marrow. "Good. Let me see your hands."`;
        const w = woven(c);
        const tk = taken(c);
        if (w >= 3) t += `\n\nShe reads your thread and smiles. "You held. Every time, you held."`;
        else if (tk >= 2) t += `\n\nShe reads your thread and goes very still. "Half my lane is in your loom."`;
        else t += `\n\nShe reads your thread and sighs. "Some of each. Like everybody."`;
        if (c.officers.some((o) => o.id === c.flag('arc.lw.handId'))) t += `\n\nPell is at your shoulder, staring at her, saying nothing at all.`;
        if (tideScore(c) >= 2) t += `\n\nBehind you, though the Tide never comes this far, you hear a crowd in another room.`;
        return t;
      },
      choices: [
        {
          label: 'Finish her weave',
          visible: (c) => woven(c) >= 3,
          next: 'finish',
        },
        {
          label: 'Take the frame for yourself',
          visible: (c) => taken(c) >= 2,
          next: 'seize',
        },
        {
          label: 'Give the Tide its half',
          visible: (c) => tideScore(c) >= 2,
          next: 'hem',
        },
        {
          label: 'Cut her out of the frame and let the weave fall',
          next: 'cut',
        },
      ],
    },
    finish: {
      text: (c) => {
        const cs = carriedAlive(c);
        let t = `"It won't let you," she says. "The Tide. I promised it the hem, and a finished lane leaves no hem. The moment you throw the last row, it sends its warden."\n\n"I'm too tired to fight it. Are you?"`;
        if (cs.length) t += `\n\nOn the long-range band, ${names(cs)} are hailing: they've seen the frame, and they're coming to stand with you.`;
        return t;
      },
      choices: [
        {
          label: 'Let Pell take her place in the frame',
          visible: (c) => c.flag('arc.lw.hand') === 'aboard' && c.officers.some((o) => o.id === c.flag('arc.lw.handId')),
          run: (c) => {
            const id = c.flag('arc.lw.handId');
            if (typeof id === 'string') c.removeOfficer(id, 'has taken his place in the frame');
            c.setFlag('arc.lw.pell', 'frame');
            c.setFlag('arc.lw.end', 'wide');
            c.note('He ties himself in, knot by knot, left twist. She falls out of the frame into your airlock, light as a sack of feathers.');
            c.combat({ side: 'warden', boss: 'warden_prime', strength: Math.max(0.75, wideStrength(c) - 0.1), afterVictory: 'lw_epilogue', announce: 'The Tide\'s warden' });
          },
        },
        {
          label: 'Throw the last row',
          run: (c) => {
            c.setFlag('arc.lw.end', 'wide');
            c.combat({ side: 'warden', boss: 'warden_prime', strength: wideStrength(c), afterVictory: 'lw_epilogue', announce: 'The Tide\'s warden' });
          },
        },
        { label: 'Not yet', next: 'a' },
      ],
    },
    seize: {
      text: `"No," she says, quite calmly. "I spun this for everyone. I'll not hand it to one loom."\n\nHer ship turns toward you. It has your lines now, your silhouette, your weapons, as if the weave has been copying whoever touched it. Perhaps it has.\n\n"Come and take it, then, weaver."`,
      choices: [
        {
          label: 'Take it',
          run: (c) => {
            c.setFlag('arc.lw.end', 'loom');
            c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'lw_epilogue', announce: 'The Last Weaver' });
          },
        },
        { label: 'Not yet', next: 'a' },
      ],
    },
    hem: {
      text: `"Ah," she says. "You've been talking to it."\n\n"It will finish the lane its own way, if you hand it the free end. Straight back through everything behind us. Every fleet arrives at once, carried in on the Tide. All of them. Even the ones it already took."\n\n"It needs a hem, though. Something to stop the weave unravelling. It wanted me." She looks at you. "It'll take you instead. It likes you better."`,
      choices: [
        {
          label: 'Hand the Tide the free end',
          run: (c) => {
            c.setMetaFlag('lw.ending.tide', true);
            c.victory(
              `You put the free end of the weave into the grey, and the Tide takes it like a hand.\n\nIt finishes the lane in one long breath: straight back through every system you erased, every ship you fed it, every hulk and wrack and drifting voice. They come in on the current, all of them, the living and the rest, and pour into the Heart together.\n\nYou are the hem. You feel every one of them pass through you, and you hold. Somewhere in the crowd, a tired woman is laughing.`,
            );
          },
        },
        { label: 'Not yet', next: 'a' },
      ],
    },
    cut: {
      text: (c) => {
        const k = claimant(c);
        const escorted = c.flag('arc.lw.banner') === k.id;
        let t = `You cut her free, knot by knot. The frame groans. Without her holding it, the weave begins to sag, row by row, into the Heart's glow, where it will keep nobody's lanes but its own.\n\nShe weighs almost nothing in your arms.`;
        if (k.id && !escorted)
          t += `\n\nOn the band: ${k.leader} of ${k.name}. "${say(k, {
            mercantile: 'An unattended loom at the Heart is an asset, captain. We are recovering it. Do step aside.',
            zealot: 'The Frame belongs to the faithful. Stand aside, or be unwoven.',
            hive: 'Empty nest. We will fill it. You are in the nest.',
            machine: 'Object of maximum strategic value detected, unclaimed. Claiming. Your survival is not a variable we are solving for.',
            raider: 'Finders keepers, weaver. And we found it.',
            ancient: 'We have wanted this for an age. Move.',
          })}"`;
        else if (escorted) t += `\n\n${k.name} hold off, keeping their promise. Their guns face outward, at everybody else.`;
        return t;
      },
      choices: [
        {
          label: 'Stand over her',
          visible: (c) => !!claimant(c).id && c.flag('arc.lw.banner') !== claimant(c).id,
          run: (c) => {
            const k = claimant(c);
            c.setFlag('arc.lw.end', 'cut');
            c.combat({ side: k.id, boss: 'dreadnought', strength: Math.min(1.45, 0.9 + 0.06 * str(c, k)), afterVictory: 'lw_epilogue', announce: `${k.short} flagship` });
          },
        },
        {
          label: 'Carry her home',
          visible: (c) => !claimant(c).id || c.flag('arc.lw.banner') === claimant(c).id,
          run: (c) => {
            c.setFlag('arc.lw.end', 'cut');
            c.chain('lw_epilogue');
          },
        },
        { label: 'Not yet', next: 'a' },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'lw_epilogue',
  sites: ['marker'],
  title: 'The Last Row',
  start: 'a',
  nodes: {
    a: {
      text: (c) => {
        const e = c.flag('arc.lw.end');
        if (e === 'wide') return `The warden comes apart, and the Tide's crowd-sound falls silent all across the Shoal, as if a door had been shut.\n\nYou throw the last row. The lane closes on itself in one long, perfect loop, left twist.`;
        if (e === 'loom') return `Her ship breaks, and she comes loose from the frame with it, drifting, still tied by a single thread to the weave.\n\n"Well," she says. "Somebody had to want it." Then the thread parts, and the frame is yours.`;
        return `The frame is quiet. The weave goes on sagging, slow as a sunset, into the Heart.\n\nYsolde Marrow opens her eyes and asks you what year it is. You don't know either.`;
      },
      choices: [
        {
          label: 'Let it be done',
          run: (c) => {
            const e = c.flag('arc.lw.end');
            finish(c, A);
            if (e === 'wide') {
              c.setMetaFlag('lw.ending.wide', true);
              const cs = carriedAlive(c);
              const pell = c.flag('arc.lw.pell') === 'frame';
              let t = `Marrow's lane opens across the Shoal like a river breaking its banks, and the exodus comes down it, fleet after fleet, into the Heart.${cs.length ? ` ${names(cs)} come first: you held the way for them, once, and they have not forgotten.` : ''}\n\n`;
              t += pell
                ? `Pell hangs in the frame, holding. He waves when you pass. She sits on your bridge wrapped in a blanket, correcting your tension, and does not look back at him even once, because if she did she would never stop.`
                : `She stays in the frame. Someone has to hold it. "Go on," she says. "Go and see what's in there. Write and tell me." You do. She never writes back, but the lane never frays.`;
              c.victory(t);
            } else if (e === 'loom') {
              c.setMetaFlag('lw.ending.loom', true);
              c.victory(
                `You tie yourself into the frame. It fits you terribly well.\n\nFrom here every lane to the Heart is yours to open or close. The fleets come and hail you, one by one, and ask; and you decide. It is a great deal of power and almost none of it is pleasant.\n\nSometimes, late, you catch yourself spinning with a left twist. You do not know whose hands those are.`,
              );
            } else {
              c.setMetaFlag('lw.ending.cut', true);
              c.victory(
                `You bring her into the Heart in your own hold, the slow way, the way everyone else comes: by their own thread, at their own risk.\n\nHer lane is gone. Nobody gets carried. Everybody who arrives, arrives because they made it, and the Heart takes them as they come.\n\nShe teaches your crew to spin, in the end. Left twist. It never catches on.`,
              );
            }
          },
        },
      ],
    },
  },
};

export const LAST_WEAVER_EVENTS: EventDef[] = [intro, site, finale, epilogue];
