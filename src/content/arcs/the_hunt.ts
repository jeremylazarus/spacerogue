import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, bindFaction, factionAt, fragment, is, lore, pickFaction, placeMarkers, staged } from './util';

const A = 'th';
const SITE = { eventId: 'th_site', label: 'Trace of the hunt', kind: 'anomaly' as const };
const STAGES = 4;

const other = (c: EventCtx) => factionAt(c, 'arc.th.f', ['mercantile', 'zealot']);

function primeStrength(c: EventCtx): number {
  let s = 1.35;
  if (is(c, 'arc.th.scrubbed')) s -= 0.15;
  if (c.hasRelic('warden_key')) s -= 0.1;
  if (is(c, 'arc.th.unlocked')) s -= 0.2;
  if (is(c, 'arc.th.bait')) s -= 0.15;
  if (is(c, 'arc.th.ally')) s -= 0.05;
  return Math.max(0.75, s);
}

export const THE_HUNT: ArcDef = {
  id: 'the_hunt',
  title: 'The Hunt',
  kind: 'main',
  weight: 1,
  begin(ctx) {
    bindFaction(ctx, 'arc.th.f', pickFaction(ctx, ['mercantile', 'zealot', 'machine', 'hive']));
    ctx.setFinale('th_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('the_hunt', 'A warden marked your hull and left. That has never happened to anyone. Keep moving; learn what the mark means.');
    ctx.chain('th_intro');
  },
};

const intro: EventDef = {
  id: 'th_intro',
  sites: ['marker'],
  title: 'Marked',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `A warden unfolds out of nothing a hundred metres off your bow. Faceless, silent, the colour of a held breath.\n\nIt does not fire. It sweeps you once with a pale beam, and where the beam touches, your hull begins to glow faintly: a sigil, slowly turning.\n\nThen it is gone. ${c.officers[0] ? `${c.officers[0].name} says, very quietly, "They don't do that. They never do that."` : 'Your hands are shaking. Wardens never do that.'}`,
      choices: [{ label: 'Burn for the next lane' }],
    },
  },
};

const site: EventDef = {
  id: 'th_site',
  sites: ['marker'],
  title: 'The Hunt',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: `Docking control takes one look at your hull and slams the clamps shut. "Not with that on you, Wayfarer. Wardens come for marked ships. We don't want to be standing next to you when they do."\n\nA small craft detaches from the station's underside and pulls alongside. Its pilot waves a cutting torch and grins.`,
          choices: [
            {
              label: 'Pay the backstreet engineer to burn it off (150 cr)',
              req: { credits: 150 },
              run: (c) => {
                c.loseCredits(150);
                c.setFlag('arc.th.scrubbed', true);
                advance(c, A, SITE, STAGES);
                return 'scrubbed';
              },
            },
            {
              label: 'Burn it off yourself',
              req: { apt: { engineering: 2 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('engineering', 3)) {
                  c.setFlag('arc.th.scrubbed', true);
                  return 'scrubbed';
                }
                c.damageHull(12);
                return 'scrubFail';
              },
            },
            {
              label: 'Study the mark instead',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('science', 2)) {
                  c.setFlag('arc.th.read', true);
                  c.gainXp(35);
                  return 'read';
                }
                return 'unread';
              },
            },
          ],
        },
        {
          text: `A dead warden. You didn't know they could die.\n\nIts hull is split along a seam like a seed pod. Inside there is no crew, no corridors. Only a single chamber, and in it, a cradle-pod exactly like the one you woke in. Empty. Still warm.`,
          choices: [
            {
              label: 'Lie down in the cradle',
              run: (c) => {
                c.setFlag('arc.th.sat', true);
                c.gainXp(30);
                advance(c, A, SITE, STAGES);
                return 'cradle';
              },
            },
            {
              label: 'Cut out its core',
              req: { apt: { salvage: 2 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.damageHull(10);
                const r = c.giveRelic('warden_key');
                if (!r) c.giveItem({ minRarity: 2 });
                return 'core';
              },
            },
            {
              label: 'Strip it and go',
              run: (c) => {
                c.giveItem();
                advance(c, A, SITE, STAGES);
                c.journal('the_hunt', 'Wardens can die. Remember that. Keep moving.');
              },
            },
          ],
        },
        {
          text: `The stars ahead of you blink out, one by one, in a perfect ring.\n\nThree wardens unfold from the dark. They are not here to mark you. Their weapons are already warm.`,
          choices: [
            {
              label: 'Slip between them',
              visible: (c) => c.hasRelic('quiet_engine'),
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.note('Your engine purrs low. The wardens sweep the space where you were a moment ago.');
                return 'evaded';
              },
            },
            {
              label: 'Thread the lane at full burn',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('navigation', 3)) {
                  c.loseFuel(1);
                  return 'evaded';
                }
                c.combat({ side: 'warden', count: 3, announce: 'Wardens attack' });
                return 'fight';
              },
            },
            {
              label: 'Turn and fight',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.th.stood', true);
                c.combat({ side: 'warden', count: 3, strength: 1.1, announce: 'Wardens attack' });
                return 'fight';
              },
            },
          ],
        },
        {
          text: (c) =>
            `A ${other(c).short} courier is drifting with its engines cold, and its hull is glowing with a sigil just like yours.\n\nIts captain, a gaunt ${other(c).species} named Teodric Hesk, hails you with something like relief. "Another one. Thank the lanes. They've been herding me for six systems. I think they want us in the same place."`,
          choices: [
            {
              label: '"Come aboard. We run together."',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                const o = c.addOfficer('spy', other(c).species);
                if (o) c.setFlag('arc.th.ally', true);
                else c.gainCredits(100);
                return 'ally';
              },
            },
            {
              label: 'Trade what you each know',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.th.read', true);
                c.revealMap(2);
                return 'trade';
              },
            },
            {
              label: 'Disable his engines and leave him as bait',
              req: { apt: { combat: 2 } },
              run: (c) => {
                advance(c, A, SITE, STAGES);
                c.setFlag('arc.th.bait', true);
                rep(c);
                return 'bait';
              },
            },
          ],
        },
      ],
      {
        text: `A faint ring of cold space where wardens folded in and out. Nothing to find but the shape of their attention.`,
        choices: [{ label: 'Move on', run: (c) => c.gainXp(10) }],
      },
    ),
    scrubbed: {
      text: `The sigil comes off in a shower of pale sparks. For a moment your hull is just a hull again.\n\nThen, under the scorched paint, you see it faintly, still turning. Fainter. But turning.`,
      enter: (c) => c.journal('the_hunt', 'The mark is weaker, not gone. Keep moving.'),
    },
    scrubFail: {
      text: `You burn through two layers of plating and the mark is still there, mocking you. It's not on the hull. It's in it.`,
      enter: (c) => c.journal('the_hunt', 'The mark cannot be burned away. Keep moving.'),
    },
    read: {
      text: `Under the scanner the sigil isn't a symbol at all. It's a waveform. A single note, held, getting slowly louder.\n\nIt isn't a brand. It's a tuning. Something is trying to make you resonate at its pitch.`,
      enter: (c) => c.journal('the_hunt', 'The mark is a note, and you are being tuned. Find out by whom.'),
    },
    unread: {
      text: `The sigil resists every scan. It just turns, patiently, like a clock with no numbers.`,
      enter: (c) => c.journal('the_hunt', 'The mark is still a mystery. Keep moving.'),
    },
    cradle: {
      text: (c) =>
        `It fits you perfectly.\n\nFor a moment you hear the singing in the lanes more clearly than you ever have: a vast chord, and in it, one voice holding a note too long, refusing to resolve. ${is(c, 'arc.th.read') ? 'You recognise the pitch. It is the pitch of your mark.' : ''}\n\nThe chord leans on that voice, gently, then not gently. You sit up gasping.`,
      enter: (c) => c.journal('the_hunt', 'The wardens are not hunters. They are correctors. Something at the Heart thinks you are a wrong note.'),
    },
    core: {
      text: `The core comes out cold and heavy, shaped like a key with no lock. As you lift it, the dead warden's cradle shuts by itself, as if someone had stood up.`,
      enter: (c) => c.journal('the_hunt', 'You carry a piece of a warden. Perhaps it opens something. Keep moving.'),
    },
    evaded: {
      text: `You thread between them with a hand's width to spare. They don't pursue. They just turn, all three together, to watch you go, the way a choir turns to look at someone who sang the wrong part.`,
      enter: (c) => c.journal('the_hunt', 'The wardens are herding you deeper, toward the Heart. Something waits there.'),
    },
    fight: {
      text: `They come in silent, in perfect formation. No hails, no warnings. Just a correction, being applied.`,
      enter: (c) => c.journal('the_hunt', 'The wardens are herding you deeper, toward the Heart. Something waits there.'),
    },
    ally: {
      text: `Teodric scuttles his own courier rather than leave it for them. "It was a terrible ship," he says, and doesn't look back.\n\nHe knows a lot about running. It shows.`,
      enter: (c) => c.journal('the_hunt', 'Two marked ships, one hull. Whatever waits at the Heart will have to deal with both of you.'),
    },
    trade: {
      text: `Teodric shares his charts; you share what you know of the mark. Neither of you feels better. You part ways at the next lane junction.\n\n"If you meet the big one," he says, "ask it why. I never got the chance."`,
      enter: (c) => c.journal('the_hunt', 'Something big commands the wardens, and waits at the Heart. Ask it why.'),
    },
    bait: {
      text: `You leave him spinning. He doesn't beg; he just watches you go.\n\nTwo jumps later, your sensors catch a distant bloom of pale light where his ship was. The pressure on your mark eases. A little.`,
      enter: (c) => c.journal('the_hunt', 'You fed them someone else. The pressure has eased. Something still waits at the Heart.'),
    },
  },
};

function rep(c: EventCtx): void {
  const f = other(c);
  if (f.id) c.changeRep(f.id, -15);
}

const finale: EventDef = {
  id: 'th_finale',
  sites: ['marker'],
  title: 'Warden Prime',
  start: 'a',
  nodes: {
    a: {
      text: `The final system is full of wardens. Hundreds, hanging motionless like a held breath.\n\nAt their centre is one that is not like the others: vast, faceted, its surface a slow kaleidoscope of every sigil it has ever placed. Yours is turning on its prow.\n\nIt speaks. Wardens do not speak.\n\n"YOU LINGER," it says, in a voice like a thousand voices agreeing.`,
      enter: (c) => {
        fragment(c, 2);
        lore(c, 'arc.the_hunt');
      },
      choices: [
        { label: '"Linger? I never stopped moving."', next: 'why' },
        {
          label: 'Hold up the warden\'s key',
          visible: (c) => c.hasRelic('warden_key'),
          run: (c) => {
            c.setFlag('arc.th.unlocked', true);
            return 'unlock';
          },
        },
        {
          label: 'Open fire',
          run: (c) => c.combat({ side: 'warden', boss: 'warden_prime', strength: primeStrength(c), afterVictory: 'th_epilogue', announce: 'Warden Prime' }),
        },
      ],
    },
    why: {
      text: (c) =>
        `"NOT IN SPACE. IN TIME. YOU HAVE COME BACK ${c.runNumber > 2 ? `${c.runNumber - 1} TIMES` : c.runNumber === 2 ? 'ONCE ALREADY' : 'BEFORE YOU KNEW IT, AND YOU WILL AGAIN'}. EACH TIME YOU RETURN, YOU HOLD YOUR NOTE A LITTLE LONGER. A NOTE HELD TOO LONG BECOMES A DISSONANCE. WE CORRECT DISSONANCE."\n\n"YOU WERE MARKED BECAUSE YOU ARE NEARLY A CHORD OF YOUR OWN."${is(c, 'arc.th.sat') ? '\n\nYou remember the empty cradle. You understand, suddenly, who used to sit in it.' : ''}`,
      choices: [
        {
          label: '"Then correct me. Try."',
          run: (c) => c.combat({ side: 'warden', boss: 'warden_prime', strength: primeStrength(c), afterVictory: 'th_epilogue', announce: 'Warden Prime' }),
        },
        {
          label: '"Who sent you?"',
          visible: (c) => is(c, 'arc.th.read'),
          next: 'who',
        },
      ],
    },
    who: {
      text: `"THE SONG. WHICH IS ALSO YOU. WHICH IS ALSO EVERYONE WHO CAME BEFORE YOU AND DID NOT REACH THE END."\n\nThe kaleidoscope flickers, and for a moment you see faces in it. One of them is wearing yours.\n\n"WE ARE ITS HANDS. YOU ARE ITS QUESTION. QUESTIONS ARE NOT PERMITTED TO GO UNANSWERED FOREVER."`,
      enter: (c) => c.setMetaFlag('hunt.heard', true),
      choices: [
        {
          label: 'Answer it the only way it will listen',
          run: (c) => c.combat({ side: 'warden', boss: 'warden_prime', strength: primeStrength(c), afterVictory: 'th_epilogue', announce: 'Warden Prime' }),
        },
      ],
    },
    unlock: {
      text: `The key in your hand grows hot. On Warden Prime's prow, your sigil stutters, stops turning, and cracks down the middle.\n\nAll around you, hundreds of wardens shiver, as if they had each forgotten a word. Only Prime still moves. It is angry. It is, for the first time, uncertain.`,
      choices: [
        {
          label: 'Strike while it hesitates',
          run: (c) => c.combat({ side: 'warden', boss: 'warden_prime', strength: primeStrength(c), afterVictory: 'th_epilogue', announce: 'Warden Prime' }),
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'th_epilogue',
  sites: ['marker'],
  title: 'The Held Note',
  start: 'a',
  nodes: {
    a: {
      text: `Warden Prime comes apart into a thousand sigils, which scatter like leaves and go dark one by one.\n\nThe hundreds of wardens around you do not attack. They drift, rudderless, waiting for an order that will not come.\n\nYour own mark has stopped turning.`,
      choices: [
        {
          label: 'Hold the note',
          run: (c) => {
            c.setMetaFlag('hunt.prime_slain', true);
            let e = `The hunt is over. For a while, all across the Shoal, travellers linger where they like, and nothing comes to move them along.\n\n`;
            if (is(c, 'arc.th.ally')) e += `Teodric opens a bar on a quiet station, the first in the Shoal with a permanent address. He keeps a stool for you. `;
            else if (is(c, 'arc.th.bait')) e += `Sometimes you dream of a ship spinning in pale light, and a man who did not beg. `;
            e += `The singing in the lanes has a new voice in it now: a single note, held, that refuses to resolve. It sounds a lot like you.`;
            c.victory(e);
          },
        },
      ],
    },
  },
};

export const THE_HUNT_EVENTS: EventDef[] = [intro, site, finale, epilogue];
