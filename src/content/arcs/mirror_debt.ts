import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, bindFaction, factionAt, fragment, is, lore, pickFaction, placeMarkers, rep, sideOf, staged } from './util';

const A = 'md';
const SITE = { eventId: 'md_site', label: 'Your own trail', kind: 'station' as const };
const STAGES = 3;

/** The double flies your previous life's ship (or, on a first run, your own ship's name). */
function dShip(c: EventCtx): string {
  const p = c.metaFlag('prev_ship');
  return typeof p === 'string' && p !== c.shipName ? p : c.shipName;
}
const host = (c: EventCtx) => factionAt(c, 'arc.md.f', ['mercantile', 'raider']);

function mirrorStrength(c: EventCtx): number {
  let s = 1.3;
  if (is(c, 'arc.md.mercy')) s -= 0.2;
  if (is(c, 'arc.md.ruthe')) s -= 0.1;
  if (is(c, 'arc.md.recording')) s -= 0.05;
  return s;
}

export const MIRROR_DEBT: ArcDef = {
  id: 'mirror_debt',
  title: 'The Mirror Debt',
  kind: 'main',
  weight: 1,
  begin(ctx) {
    bindFaction(ctx, 'arc.md.f', pickFaction(ctx, ['mercantile', 'raider', 'zealot']));
    ctx.setFinale('md_finale');
    placeMarkers(ctx, SITE, [1, 2, 4]);
    ctx.journal('mirror_debt', 'Someone flying ahead of you is using your name and your face. Catch up.');
    ctx.chain('md_intro');
  },
};

const intro: EventDef = {
  id: 'md_intro',
  sites: ['marker'],
  title: 'Message Waiting',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `Your comms buffer has one message waiting. It was sent to ${c.shipName} before ${c.shipName} existed.\n\nIt's video. The face in it is yours. Thinner, tired, smiling crookedly at the camera.\n\n"Hi," it says. "Sorry about the mess. Don't follow me." Then it cuts out.`,
      choices: [{ label: 'Follow it' }],
    },
  },
};

const site: EventDef = {
  id: 'md_site',
  sites: ['marker'],
  title: 'Your Trail',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        {
          text: (c) =>
            `The bartender sees you come in and puts down the glass she's polishing very slowly.\n\n"You. You've got a nerve. You owe this house three hundred credits, a window, and an apology to my cousin."\n\nWhen you explain you've never been here, she laughs. "Same face, same voice. You flew in on the ${dShip(c)}, drank like the lanes were closing, and asked everyone the fastest way to the Heart."`,
          choices: [
            {
              label: 'Pay the debt (300 cr)',
              req: { credits: 300 },
              run: (c) => {
                c.loseCredits(300);
                c.setFlag('arc.md.paid', true);
                rep(c, host(c), 15);
                advance(c, A, SITE, STAGES);
                return 'paid';
              },
            },
            {
              label: '"That was my evil twin." (It\'s true.)',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('guile', 2)) return 'conned';
                c.combat({ side: sideOf(host(c)), count: 2, strength: 0.8, announce: 'The bouncers object' });
                return 'brawl';
              },
            },
            {
              label: 'Buy a round and ask what else "you" said (50 cr)',
              req: { apt: { diplomacy: 2 } },
              run: (c) => {
                c.loseCredits(50);
                advance(c, A, SITE, STAGES);
                return 'gossip';
              },
            },
          ],
        },
        {
          text: (c) =>
            `A freighter, gutted. Raider wrecks scattered around it, all shot clean through the reactor with the kind of shooting you'd be proud of.\n\nThe survivors can't agree. One says the ${dShip(c)} came out of nowhere and saved them. Another says the same ship took their reactor core afterward, apologised, and left.\n\nOn the freighter's log, a message flagged for "whoever comes next with my face".`,
          choices: [
            {
              label: 'Decrypt the message',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('science', 2) || c.check('engineering', 3)) {
                  c.setFlag('arc.md.recording', true);
                  return 'message';
                }
                return 'messageFail';
              },
            },
            {
              label: 'Give the survivors a working core (lose a module)',
              run: (c) => {
                const it = c.loseItem();
                if (!it) c.loseCredits(150);
                c.setFlag('arc.md.repaid', true);
                c.gainXp(40);
                advance(c, A, SITE, STAGES);
                return 'repay';
              },
            },
            {
              label: 'Salvage the raider wrecks',
              run: (c) => {
                c.giveItem({ minRarity: 1 });
                advance(c, A, SITE, STAGES);
                c.journal('mirror_debt', 'Your double fights like you. Keep after them.');
              },
            },
          ],
        },
        {
          text: `A distress beacon on a dead moon. Under it, a woman in a patched suit is sitting on a supply crate, eating a ration bar. She sees your face and goes very still.\n\n"Captain? You came back." Her voice cracks. "You said you wouldn't. You said where you were going, I couldn't follow."\n\nHer name, she reminds you, is Ruthe Calder. She was your quartermaster, for four years. You have never seen her before.`,
          choices: [
            {
              label: 'Tell her the truth',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.check('diplomacy', 2)) {
                  if (c.addOfficer('quartermaster', 'human', 'Ruthe Calder')) c.setFlag('arc.md.ruthe', true);
                  return 'truth';
                }
                return 'truthFail';
              },
            },
            {
              label: 'Be the captain she lost',
              run: (c) => {
                advance(c, A, SITE, STAGES);
                if (c.addOfficer('quartermaster', 'human', 'Ruthe Calder')) {
                  c.setFlag('arc.md.ruthe', true);
                  c.setFlag('arc.md.lie', true);
                }
                return 'lie';
              },
            },
            {
              label: 'Leave her supplies and go',
              run: (c) => {
                c.loseFuel(1);
                advance(c, A, SITE, STAGES);
                c.journal('mirror_debt', 'The double abandoned their own crew. They are heading for the Heart. Catch them.');
              },
            },
          ],
        },
      ],
      {
        text: `Someone has scratched your name into the bulkhead here, and under it, a tally. You don't count the marks.`,
        choices: [{ label: 'Move on', run: (c) => c.gainXp(10) }],
      },
    ),
    paid: {
      text: `She takes the money, looks at it, looks at you. "Funny. The other one said someone would come along and settle up. I thought it was a joke."`,
      enter: (c) => c.journal('mirror_debt', 'You are paying your double\'s debts. They are heading for the Heart. Follow.'),
    },
    conned: {
      text: `She squints at you, then laughs. "You know, you're nicer than the other one. Drink's on the house. The window isn't."`,
      enter: (c) => c.journal('mirror_debt', 'Your double is heading for the Heart, fast. Follow.'),
    },
    brawl: {
      text: `The bouncers have been waiting a long time to hit your face. They don't much care which one of you it is.`,
      enter: (c) => c.journal('mirror_debt', 'Your double is heading for the Heart, fast. Follow.'),
    },
    gossip: {
      text: `"Said they were paying off a debt. Not money. Said they owed the Heart a life and were going to settle it in person." She shrugs. "Then they threw a chair."`,
      enter: (c) => c.journal('mirror_debt', 'Your double says they owe the Heart a life. Catch them before they pay it.'),
    },
    message: {
      text: `Your face again, closer to the camera this time.\n\n"If you're seeing this, you're the one after me. I'm the one who didn't let go, last time. I held on so hard I came back without a body. I've been borrowing ships.\n\nI think if I get to the Heart before you, I can pay what we owe, and you won't have to keep doing this. Don't follow. Please."`,
      enter: (c) => c.journal('mirror_debt', 'Your double is a past life that refused to end. They think reaching the Heart will save you. Catch them.'),
    },
    messageFail: {
      text: `The message is half corrupted. You get your own voice saying "...don't..." and "...the Heart..." and a laugh that you recognise, uncomfortably, as the one you do when you're scared.`,
      enter: (c) => c.journal('mirror_debt', 'Your double left you a warning. Catch them at the Heart.'),
    },
    repay: {
      text: `You pull a module and cable it into their reactor housing. It's not a core, but it'll get them to port.\n\nThe survivor who called you a thief hesitates, then shakes your hand. "Square, then," she says. "Whichever one you are."`,
      enter: (c) => c.journal('mirror_debt', 'You are settling your double\'s debts as you go. Catch them at the Heart.'),
    },
    truth: {
      text: `She listens to the whole thing without interrupting. Then she says, "That tracks, honestly," and picks up her crate.\n\n"You've got their face and worse coffee. I'm coming. I want to see them again. Either of you."`,
      enter: (c) => c.journal('mirror_debt', 'Ruthe knew your double for years. With her aboard, you might reach them as more than an enemy. Go to the Heart.'),
    },
    truthFail: {
      text: `She doesn't believe you. Or she does, and it's worse. She asks you to leave. You leave her the beacon still blinking.`,
      enter: (c) => c.journal('mirror_debt', 'The double abandoned their own crew. Catch them at the Heart.'),
    },
    lie: {
      text: `"I came back," you say. She cries, briefly, angrily, and then she's all business, checking your cargo manifest and swearing about your thread discipline.\n\nIt's nice to be known. Even if it's someone else she knows.`,
      enter: (c) => c.journal('mirror_debt', 'Ruthe thinks you are her captain. Your double is heading for the Heart. Catch them.'),
    },
  },
};

const finale: EventDef = {
  id: 'md_finale',
  sites: ['marker'],
  title: 'The Mirror',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `It is waiting for you at the Heart. The ${dShip(c)}, or something wearing it: every plate of it wrong in the same way a reflection is wrong.\n\nIt hails. Your face. Your voice.\n\n"You followed. Of course you did. I would have." A tired laugh. "I'm what's left of the last one of us who refused to let go. Every time you wake, I'm the part of you that didn't. I came to pay us out. One of us has to go into the Heart and stay there."`,
      choices: [
        {
          label: '"What do we owe?"',
          next: 'debt',
        },
        {
          label: 'Let Ruthe talk',
          visible: (c) => c.officers.some((o) => o.name === 'Ruthe Calder'),
          next: 'ruthe',
        },
        {
          label: 'Fire',
          run: (c) => c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'md_epilogue', announce: 'The mirror' }),
        },
      ],
    },
    debt: {
      text: `"Everything. Every life we didn't finish. They don't go anywhere, you know. They go into the singing. I've heard it, from the inside. It's us. All of us. All the ones who didn't make it."\n\n"I thought if I gave it one whole life, freely, it'd stop needing to take the rest."\n\nIt pauses. "I'm not sure anymore. You could talk me out of it. Or you could take my place. Or you could do what we always do."`,
      enter: (c) => fragment(c, 4, 2),
      choices: [
        {
          label: '"Come home. We\'ll carry it together."',
          req: { apt: { diplomacy: 3 } },
          run: (c) => {
            if (c.check('diplomacy', 3)) {
              c.setFlag('arc.md.mercy', true);
              return 'mercy';
            }
            c.note('Your own voice laughs at you. "You never could lie to me."');
            c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'md_epilogue', announce: 'The mirror' });
          },
        },
        {
          label: 'Do what we always do',
          run: (c) => c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'md_epilogue', announce: 'The mirror' }),
        },
      ],
    },
    ruthe: {
      text: (c) =>
        `Ruthe leans over your shoulder to the mic. "Captain. Either of you. You left me on a moon."\n\nThe mirror goes quiet for a long moment. "I know," it says. "I'm sorry. I didn't want you to watch."\n\n${is(c, 'arc.md.lie') ? `"This one pretended to be you," she says. "They were bad at it. They were kind about it."` : `"This one told me the truth," she says. "It's an improvement."`}\n\nThe mirror's guns, very slightly, lower.`,
      enter: (c) => c.setFlag('arc.md.mercy', true),
      choices: [
        { label: '"What do we owe?"', next: 'debt' },
        {
          label: 'End it now, while it\'s listening',
          run: (c) => c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'md_epilogue', announce: 'The mirror' }),
        },
      ],
    },
    mercy: {
      text: `"Together," it says, as if tasting the word. "We've never tried that."\n\nThen its hull begins to shudder. "It won't let me. The thing I borrowed this ship from. It's not done with me." Your own face, frightened. "You'll have to cut me out of it. Gently, if you can."`,
      choices: [
        {
          label: 'Cut it free',
          run: (c) => c.combat({ side: 'rogue', boss: 'mirror', strength: mirrorStrength(c), afterVictory: 'md_epilogue', announce: 'The mirror' }),
        },
      ],
    },
  },
};

const epilogue: EventDef = {
  id: 'md_epilogue',
  sites: ['marker'],
  title: 'Settled',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        is(c, 'arc.md.mercy')
          ? `The wrong ship falls away from something small and bright, and the bright thing drifts across the gap between you and comes through your hull like it isn't there.\n\nFor a moment you remember a life you didn't live: four years, a quartermaster, a bar with a broken window. Then it settles, quietly, behind your eyes.`
          : `The mirror breaks. There's no other word for it. Your face shatters on a hundred screens and goes dark.\n\nIn the debris, a single recording, looping: "Don't follow. Please."`,
      enter: (c) => {
        lore(c, 'arc.mirror_debt');
        fragment(c, 4, 2);
        c.setMetaFlag('mirror.met', true);
        if (is(c, 'arc.md.mercy')) c.setMetaFlag('mirror.mercy', true);
      },
      choices: [
        {
          label: 'Settle the account',
          run: (c) => {
            let e = is(c, 'arc.md.mercy')
              ? `You carry the other one home, or as close to home as a Wayfarer gets. Some nights you laugh at jokes you don't remember hearing.\n\n`
              : `The debt, whatever it was, goes unpaid. You find you don't miss it.\n\n`;
            if (c.officers.some((o) => o.name === 'Ruthe Calder')) e += `Ruthe stays on as quartermaster. She calls you "Captain" in a slightly different tone than she used to. You both pretend not to notice. `;
            if (is(c, 'arc.md.paid') || is(c, 'arc.md.repaid')) e += `Across the Shoal, people who were owed something by a face like yours find their accounts quietly settled.`;
            c.victory(e);
          },
        },
      ],
    },
  },
};

export const MIRROR_DEBT_EVENTS: EventDef[] = [intro, site, finale, epilogue];
