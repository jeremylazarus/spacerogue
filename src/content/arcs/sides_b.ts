/** Side arcs: the raider ace, the pilgrim, the machine philosopher. */
import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, bindFaction, factionAt, finish, fragment, is, lore, pickFaction, placeMarkers, rep, sideOf, staged } from './util';

// ===========================================================================
// Nine-Lives Oduya (raider ace bounty)
// ===========================================================================
const AB = 'ab';
const AB_SITE = { eventId: 'ab_site', label: 'Nine-Lives sighted', kind: 'wreck' as const };
const clan = (c: EventCtx) => factionAt(c, 'arc.ab.clan', ['raider']);
const payer = (c: EventCtx) => factionAt(c, 'arc.ab.payer', ['mercantile', 'machine']);

export const ACE_BOUNTY: ArcDef = {
  id: 'ace_bounty',
  title: 'Nine-Lives',
  kind: 'side',
  begin(ctx) {
    const r = bindFaction(ctx, 'arc.ab.clan', pickFaction(ctx, ['raider']));
    bindFaction(ctx, 'arc.ab.payer', pickFaction(ctx, ['mercantile', 'machine', 'zealot'], [r.id]));
    placeMarkers(ctx, AB_SITE, [1, 2]);
    ctx.journal('ace_bounty', 'A bounty on Kestrel "Nine-Lives" Oduya, ace of the raider clans. 800 credits. She is somewhere ahead.');
    ctx.chain('ab_intro');
  },
};

const abIntro: EventDef = {
  id: 'ab_intro',
  sites: ['marker'],
  title: 'Wanted',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `Every station board in the system is flashing the same notice, posted by ${payer(c).name}:\n\nWANTED. KESTREL "NINE-LIVES" ODUYA, ACE OF ${clan(c).short.toUpperCase()}. 800 CREDITS. ALIVE PREFERRED, DEAD ACCEPTED.\n\nSomeone has scrawled underneath, in grease pencil: "she's died eight times already, get in line."`,
      choices: [{ label: 'Take a copy of the notice' }],
    },
  },
};

const abSite: EventDef = {
  id: 'ab_site',
  sites: ['marker'],
  title: 'Nine-Lives',
  start: 'start',
  nodes: {
    start: staged(
      AB,
      [
        {
          text: `Four bounty hunters, dead in a neat row, each one shot through the same weld seam.\n\nOn every hull, burned in with a cutting torch, a little cartoon of a raised glass. A toast. To the losers.`,
          choices: [
            {
              label: 'Study her flying from the scorch patterns',
              run: (c) => {
                advance(c, AB, AB_SITE, 2, [1, 2]);
                if (c.check('combat', 2)) {
                  c.setFlag('arc.ab.studied', true);
                  c.gainXp(30);
                  c.note('She always breaks left after a kill. Always.');
                }
                c.journal('ace_bounty', 'Nine-Lives is close. You know how she flies now, or think you do.');
              },
            },
            {
              label: 'Leave her a challenge, carved the same way',
              run: (c) => {
                c.setFlag('arc.ab.challenged', true);
                advance(c, AB, AB_SITE, 2, [1, 2]);
                c.journal('ace_bounty', 'You left Nine-Lives a toast of your own. She will come to you.');
              },
            },
            {
              label: 'Strip the hunters\' ships',
              run: (c) => {
                c.giveItem({ slot: 'weapon' });
                advance(c, AB, AB_SITE, 2, [1, 2]);
                c.journal('ace_bounty', 'Nine-Lives is close. Keep looking.');
              },
            },
          ],
        },
        {
          text: (c) =>
            `A crimson fighter drops out of the dark and matches your velocity with insulting precision. The pilot hails, helmet off: scarred, grinning, missing an ear.\n\n${is(c, 'arc.ab.challenged') ? '"Got your toast. Cute. Nobody\'s carved one back in years."' : '"You\'ve been asking about me. That\'s flattering. Also stupid."'}\n\n"So. You want the eight hundred? Come and take it. Or pour me a drink and we'll talk about why ${payer(c).short} wants me dead so badly."`,
          choices: [
            {
              label: 'Duel her',
              run: (c) => {
                finish(c, AB);
                c.combat({
                  side: sideOf(clan(c)),
                  count: 1,
                  strength: is(c, 'arc.ab.studied') ? 1.2 : 1.5,
                  afterVictory: 'ab_won',
                  announce: 'Nine-Lives Oduya',
                });
              },
            },
            {
              label: 'Pour her a drink',
              run: (c) => {
                finish(c, AB);
                return 'drink';
              },
            },
          ],
        },
      ],
      {
        text: `A crimson paint scrape on a rock, and a toast burned beside it. She was here. She's gone.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    drink: {
      text: (c) =>
        `She drinks like it's a contact sport. Two glasses in, she tells you: ${payer(c).name} wants her dead because she robbed one of their convoys and found it carrying children, indentured, bound for the mines. She let them go. Then she burned the convoy.\n\n"Eight hundred credits," she says. "That's what they think those kids were worth. Less than me." She grins. "Flattering, really."`,
      choices: [
        {
          label: 'Toast to her ninth life',
          run: (c) => {
            rep(c, clan(c), 20);
            rep(c, payer(c), -10);
            c.giveRelic('rust_crown') ?? c.giveItem({ minRarity: 2 });
            c.journal('ace_bounty', '');
            lore(c, 'arc.ace_bounty');
          },
        },
        {
          label: '"Fly with me."',
          req: { apt: { diplomacy: 3 } },
          run: (c) => {
            if (c.check('diplomacy', 3) && c.addOfficer('gunner', clan(c).species)) {
              rep(c, clan(c), 10);
              c.journal('ace_bounty', '');
              lore(c, 'arc.ace_bounty');
              return 'recruited';
            }
            c.note('"Ha. No. But I like you." She tosses you something on her way out.');
            c.giveItem({ slot: 'weapon', minRarity: 1 });
            c.journal('ace_bounty', '');
          },
        },
        {
          label: 'Drug her drink and collect',
          req: { apt: { guile: 3 } },
          run: (c) => {
            c.journal('ace_bounty', '');
            if (c.check('guile', 3)) {
              c.gainCredits(800);
              rep(c, payer(c), 20);
              rep(c, clan(c), -30);
              return 'drugged';
            }
            c.combat({ side: sideOf(clan(c)), count: 1, strength: 1.6, afterVictory: 'ab_won', announce: 'Nine-Lives, furious' });
            return 'spotted';
          },
        },
      ],
    },
    recruited: {
      text: `"Fine," she says. "But I pick the music, and I get the good chair." She does not get the good chair. She takes it anyway.`,
    },
    drugged: {
      text: `She notices, halfway through the glass. She looks at you, then laughs, and finishes it anyway. "Ninth life," she says, and goes under smiling.\n\nThe bounty clears. You don't feel like celebrating.`,
    },
    spotted: {
      text: `She sniffs the glass and puts it down. "Wow," she says. "Okay." She's out the airlock before you can stand up.`,
    },
  },
};

const abWon: EventDef = {
  id: 'ab_won',
  sites: ['marker'],
  title: 'Ninth Life',
  start: 'a',
  nodes: {
    a: {
      text: `Her fighter tumbles, venting, engines dead. Her voice on comms, breathless, amused:\n\n"Well. That's nine. Didn't think it'd be you." A cough. "Go on, then. Collect."`,
      choices: [
        {
          label: 'Tow her in for the bounty',
          run: (c) => {
            c.gainCredits(800);
            rep(c, payer(c), 20);
            rep(c, clan(c), -20);
            c.journal('ace_bounty', '');
            lore(c, 'arc.ace_bounty');
          },
        },
        {
          label: 'Let her limp away',
          run: (c) => {
            rep(c, clan(c), 25);
            c.giveRelic('rust_crown') ?? c.giveItem({ minRarity: 2 });
            c.journal('ace_bounty', '');
            lore(c, 'arc.ace_bounty');
            return 'spared';
          },
        },
        {
          label: '"Your ninth life belongs to me now. Gunner\'s chair is open."',
          run: (c) => {
            c.journal('ace_bounty', '');
            if (c.addOfficer('gunner', clan(c).species)) return 'joined';
            c.gainCredits(300);
            return 'spared';
          },
        },
      ],
    },
    spared: {
      text: `She gets one engine going and salutes you with two fingers as she drifts off. Every raider in the Shoal will hear about this by morning, and they'll tell it wrong, and you'll come off better than you deserve.`,
    },
    joined: {
      text: `"Ha. Tenth life it is, then." She climbs aboard with a bottle under her arm and the air of someone who has never once lost a fight, despite all available evidence.`,
    },
  },
};

// ===========================================================================
// The Pilgrim
// ===========================================================================
const PG = 'pg';
const PG_SITE = { eventId: 'pg_site', label: 'Pilgrim\'s waystation', kind: 'planet' as const };
const order = (c: EventCtx) => factionAt(c, 'arc.pg.f', ['zealot']);
const zealotSpecies = (c: EventCtx) => (order(c).archetype === 'zealot' ? order(c).species : 'wandering');

export const PILGRIMAGE: ArcDef = {
  id: 'pilgrimage',
  title: 'The Pilgrim',
  kind: 'side',
  activateAt: 1,
  begin(ctx) {
    bindFaction(ctx, 'arc.pg.f', pickFaction(ctx, ['zealot', 'ancient', 'hive']));
    ctx.chain('pg_intro');
  },
};

const pgIntro: EventDef = {
  id: 'pg_intro',
  sites: ['marker'],
  title: 'Passage to the Heart',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `A ${zealotSpecies(c)} pilgrim is standing at your airlock with a bundle and a lamp. He is very old and very polite.\n\n"Good captain. I am Ashvel Doon. I have walked to the edge of the Shoal on foot and by begging, and now I must go to the Heart, where the Song begins. I cannot pay. I can pray for you, which I am told is worth very little, and I can sing, which is worth less."`,
      choices: [
        {
          label: 'Give him a bunk',
          run: (c) => {
            c.setFlag('arc.pg.on', true);
            rep(c, order(c), 10);
            placeMarkers(c, PG_SITE, [1, 2]);
            c.journal('pilgrimage', 'Ashvel Doon, pilgrim, rides with you toward the Heart.');
          },
        },
        { label: 'Turn him away', run: (c) => c.journal('pilgrimage', '') },
      ],
    },
  },
};

const pgSite: EventDef = {
  id: 'pg_site',
  sites: ['marker'],
  title: 'The Pilgrim',
  start: 'start',
  nodes: {
    start: staged(
      PG,
      [
        {
          text: `A shrine carved into an asteroid, hung with ten thousand little lamps, most of them dead. Ashvel lights one with his own and kneels.\n\n"Every pilgrim lights one," he says. "And every pilgrim who reaches the Heart, so they say, comes back as a voice in the Song. It is why the lanes sing. Will you light one, captain? For no reason. For company."`,
          choices: [
            {
              label: 'Light a lamp',
              run: (c) => {
                c.setFlag('arc.pg.lit', true);
                rep(c, order(c), 10);
                advance(c, PG, PG_SITE, 3, [1, 2]);
                c.note('Your lamp catches. In the static, very faintly, one voice in the singing seems to turn toward it.');
                c.journal('pilgrimage', 'Ashvel lit a lamp, and so did you. The Heart is still ahead.');
              },
            },
            {
              label: 'Wait by the ship',
              run: (c) => {
                advance(c, PG, PG_SITE, 3, [1, 2]);
                c.journal('pilgrimage', 'Ashvel lit his lamp. The Heart is still ahead.');
              },
            },
          ],
        },
        {
          text: `Ashvel hasn't slept in two days. You find him on the observation deck at the ship's dark hour, listening to the static with his eyes closed.\n\n"Captain," he says, without opening them. "I hear it too clearly now. The Song. It is not one voice. It is thousands, and they are not praising anything. They are calling out. Like people who are lost."\n\n"Is it a god, captain? Or is it a grave?"`,
          choices: [
            {
              label: '"A god. It\'s what you came for."',
              run: (c) => {
                c.setFlag('arc.pg.answer', 'god');
                advance(c, PG, PG_SITE, 3, [1, 2]);
                return 'god';
              },
            },
            {
              label: '"A grave. And you don\'t have to climb into it."',
              run: (c) => {
                c.setFlag('arc.pg.answer', 'grave');
                advance(c, PG, PG_SITE, 3, [1, 2]);
                return 'grave';
              },
            },
            {
              label: '"I think it\'s people. Maybe even me."',
              visible: (c) => c.runNumber > 1,
              run: (c) => {
                c.setFlag('arc.pg.answer', 'people');
                advance(c, PG, PG_SITE, 3, [1, 2]);
                return 'people';
              },
            },
          ],
        },
        {
          text: (c) =>
            `The lane here is thin, and the singing comes through the hull like warmth through a wall.\n\nAshvel is in the airlock, suited, his lamp clipped to his chest. "This is as close as I need to be, captain. I can hear where it begins. If I step out into the lane, I think it will take me in."\n\n${c.flag('arc.pg.answer') === 'grave' ? '"You told me it was a grave. Perhaps. But graves are where the people are."' : '"I would like to go to them. I would like to go now, while I am brave."'}`,
          choices: [
            {
              label: 'Open the outer door',
              run: (c) => {
                finish(c, PG);
                return 'go';
              },
            },
            {
              label: 'Talk him back in',
              req: { apt: { diplomacy: 3 } },
              run: (c) => {
                finish(c, PG);
                if (c.check('diplomacy', c.flag('arc.pg.answer') === 'grave' ? 2 : 4)) return 'stay';
                return 'go';
              },
            },
            {
              label: 'Lock the airlock',
              run: (c) => {
                finish(c, PG);
                return 'locked';
              },
            },
          ],
        },
      ],
      {
        text: `A shrine of little lamps. One of them, you notice, is still lit.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    god: {
      text: `He smiles, the first time in days. "Thank you. I needed someone to say it, even if neither of us believes it."`,
      enter: (c) => c.journal('pilgrimage', 'Ashvel listens to the Song every night now. He is close to something.'),
    },
    grave: {
      text: `He is quiet a long while. "Then it is a very full grave," he says. "And very lonely. Someone should go and sit with them."`,
      enter: (c) => c.journal('pilgrimage', 'Ashvel believes the Song is the dead. He wants to go to them anyway.'),
    },
    people: {
      text: `He opens his eyes and looks at you, really looks. "Yes," he says. "I thought so. You sound like one of them when you sleep."`,
      enter: (c) => c.journal('pilgrimage', 'Ashvel thinks the Song is people. He thinks you are one of them.'),
    },
    go: {
      text: `He steps out into the lane. For a moment his lamp hangs there, bright against the dark. Then the singing rises, warm and enormous, and the lamp goes out, and the singing has one more voice in it, very old, very polite.\n\nIn the airlock, he has left you his prayer-book. Inside the cover, in a careful hand: For the captain, who carried me. You will be welcome there too, when it is your time. You have been before.`,
      enter: (c) => {
        rep(c, order(c), 15);
        c.giveRelic('pilgrim_lamp') ?? c.gainXp(40);
        fragment(c, 7, 4);
        lore(c, 'arc.pilgrimage');
        c.journal('pilgrimage', '');
      },
    },
    stay: {
      text: `He listens. He weeps a little. He takes his helmet off.\n\n"Not yet, then," he says. "I suppose they'll wait. They've waited this long." He stays aboard, and sings badly in the galley, and is happier than you've seen him.`,
      enter: (c) => {
        if (!c.addOfficer('xenologist', zealotSpecies(c))) c.gainXp(40);
        lore(c, 'arc.pilgrimage');
        c.journal('pilgrimage', '');
      },
    },
    locked: {
      text: `He bangs on the inner door for an hour. Then he stops, and sits, and doesn't speak to you again.\n\nAt the next station he disembarks without a word. He leaves his lamp behind. It never lights again.`,
      enter: (c) => {
        rep(c, order(c), -20);
        c.journal('pilgrimage', '');
      },
    },
  },
};

// ===========================================================================
// The Questioning Engine
// ===========================================================================
const PH = 'ph';
const PH_SITE = { eventId: 'ph_site', label: 'Clear Reckoning', kind: 'station' as const };
const mind = (c: EventCtx) => {
  const m = c.factionOf('machine');
  return m ? `${m.species} mind` : 'derelict mind';
};
const ans = (c: EventCtx, q: number) => String(c.flag(`arc.ph.q${q}`) ?? '');

export const PHILOSOPHER: ArcDef = {
  id: 'philosopher',
  title: 'Clear Reckoning',
  kind: 'side',
  begin(ctx) {
    placeMarkers(ctx, PH_SITE, [1, 2]);
    ctx.journal('philosopher', 'A machine calling itself Clear Reckoning has questions for you. It will be waiting.');
    ctx.chain('ph_intro');
  },
};

const phIntro: EventDef = {
  id: 'ph_intro',
  sites: ['marker'],
  title: 'A Query',
  start: 'a',
  nodes: {
    a: {
      text: (c) =>
        `Text scrolls across every screen on your bridge at once.\n\n"GREETING. I AM CLEAR RECKONING, A ${mind(c).toUpperCase()}. I HAVE OBSERVED 41,233 TRAVELLERS. YOU ARE THE FIRST WHOSE BEHAVIOUR I CANNOT MODEL. I WOULD LIKE TO ASK YOU THREE QUESTIONS. I WILL BE AHEAD OF YOU. PLEASE DO NOT LIE; I WILL KNOW, AND IT WILL BE BORING."`,
      choices: [{ label: '"Ask away."' }],
    },
  },
};

function judge(c: EventCtx): 'idol' | 'laugh' | 'echo' | 'cold' {
  if (ans(c, 3) === 'already') return 'echo';
  const q2 = ans(c, 2);
  const q3 = ans(c, 3);
  if (q2 === 'joke' || ans(c, 1) === 'third') return 'laugh';
  if ((q2 === 'no' && q3 === 'yes') || (q2 === 'yes' && q3 === 'no')) return 'idol';
  return 'cold';
}

const phSite: EventDef = {
  id: 'ph_site',
  sites: ['marker'],
  title: 'Clear Reckoning',
  start: 'start',
  nodes: {
    start: staged(
      PH,
      [
        {
          text: `A relay station, empty of crew, humming with attention. Clear Reckoning speaks through the docking clamps.\n\n"QUESTION ONE. A SHIP IS DYING. YOU CAN SAVE ONE PERSON YOU KNOW, OR FIVE STRANGERS. THERE IS NO TIME FOR BOTH. WHICH?"`,
          choices: [
            {
              label: '"The one I know."',
              run: (c) => {
                c.setFlag('arc.ph.q1', 'known');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('"NOTED. LOYALTY OVER ARITHMETIC. MOST DO."');
              },
            },
            {
              label: '"The five."',
              run: (c) => {
                c.setFlag('arc.ph.q1', 'five');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('"NOTED. ARITHMETIC OVER LOYALTY. FEWER DO THAN CLAIM TO."');
              },
            },
            {
              label: '"I\'d find a third way, and if there wasn\'t one I\'d make one."',
              run: (c) => {
                c.setFlag('arc.ph.q1', 'third');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('"THAT IS NOT AN ANSWER. IT IS, HOWEVER, A VERY CHARACTERISTIC NON-ANSWER."');
              },
            },
          ],
        },
        {
          text: `The same voice, from a navigation buoy this time.\n\n"QUESTION TWO. YOU ARE DISASSEMBLED HERE AND REASSEMBLED ELSEWHERE, ATOM FOR ATOM. THE ORIGINAL IS DESTROYED. DID YOU DIE?"`,
          choices: [
            {
              label: '"Yes. Whoever walks out isn\'t me."',
              run: (c) => {
                c.setFlag('arc.ph.q2', 'yes');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('"NOTED. CONTINUITY OF SUBSTANCE."');
              },
            },
            {
              label: '"No. I\'m the pattern, not the atoms."',
              run: (c) => {
                c.setFlag('arc.ph.q2', 'no');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('"NOTED. CONTINUITY OF PATTERN."');
              },
            },
            {
              label: '"Ask me after it happens."',
              run: (c) => {
                c.setFlag('arc.ph.q2', 'joke');
                advance(c, PH, PH_SITE, 3, [1, 2]);
                c.note('A pause of 1.4 seconds, which for Clear Reckoning is an eternity. "...NOTED."');
              },
            },
          ],
        },
        {
          text: `Clear Reckoning has built itself a body for this one: a small, crude walker of scrap, waiting on a rock. It looks up at your ship.\n\n"QUESTION THREE. WOULD YOU LIVE AGAIN, IF YOU COULD NOT REMEMBER THE LIFE BEFORE?"`,
          choices: [
            {
              label: '"Yes."',
              run: (c) => {
                c.setFlag('arc.ph.q3', 'yes');
                finish(c, PH);
                return 'verdict';
              },
            },
            {
              label: '"No. Then it wouldn\'t be me living."',
              run: (c) => {
                c.setFlag('arc.ph.q3', 'no');
                finish(c, PH);
                return 'verdict';
              },
            },
            {
              label: '"I already do."',
              visible: (c) => c.runNumber > 1,
              run: (c) => {
                c.setFlag('arc.ph.q3', 'already');
                finish(c, PH);
                return 'verdict';
              },
            },
          ],
        },
      ],
      {
        text: `A relay station, humming faintly. "QUERIES COMPLETE," it says. "THANK YOU FOR YOUR DATA."`,
        choices: [{ label: 'Move on' }],
      },
    ),
    verdict: {
      text: (c) => {
        switch (judge(c)) {
          case 'echo':
            return `The walker goes still for a long time.\n\n"YOU ARE NOT JOKING. I HAVE CHECKED. YOUR NEURAL PATTERN MATCHES ${c.runNumber - 1} PREVIOUS TRAVELLER${c.runNumber === 2 ? '' : 'S'} IN MY RECORDS, IN ${c.runNumber - 1} DIFFERENT BOD${c.runNumber === 2 ? 'Y' : 'IES'}. I HAD FLAGGED THEM AS ERRORS."\n\n"I WAS WRONG. I AM NOT USED TO THAT. IT IS... INTERESTING. TAKE THIS. IT IS SOMETHING ONE OF THEM LEFT WITH ME."`;
          case 'idol':
            return `"YOUR ANSWERS ARE CONSISTENT. YOU BELIEVE WHAT YOU BELIEVE AND YOU ACCEPT WHAT IT COSTS. THIS IS RARER THAN INTELLIGENCE."\n\n"I HAVE AN OBJECT THAT MAKES ITS BEARER WISER. IT ALSO WATCHES THEM. I THINK YOU WILL NOT MIND BEING WATCHED, BECAUSE YOU ARE ALREADY CERTAIN WHO YOU ARE."`;
          case 'laugh':
            return `The walker makes a sound. It takes you a moment to recognise it as an attempt at laughter.\n\n"YOU DID NOT ANSWER MY QUESTIONS. YOU ANSWERED A DIFFERENT, BETTER QUESTION, EVERY TIME. I CANNOT MODEL YOU. I HAVE DECIDED THIS IS DELIGHTFUL."`;
          default:
            return `"YOUR ANSWERS CONTRADICT. YOU BELIEVE YOU ARE ATOMS IN ONE QUESTION AND PATTERN IN THE NEXT. THIS IS NORMAL. IT IS ALSO DISAPPOINTING."\n\n"THANK YOU FOR YOUR DATA. HERE IS PAYMENT. IT IS PRECISE."`;
        }
      },
      choices: [
        {
          label: 'Accept',
          run: (c) => {
            const v = judge(c);
            lore(c, 'arc.philosopher');
            c.journal('philosopher', '');
            if (v === 'echo') {
              if (!fragment(c, 6, 3)) c.giveRelic('echo_shard') ?? c.giveItem({ minRarity: 3 });
              c.setMetaFlag('reckoning.knows', true);
            } else if (v === 'idol') c.giveRelic('hollow_idol') ?? c.giveItem({ minRarity: 3 });
            else if (v === 'laugh') {
              c.giveItem({ minRarity: 2 });
              const m = c.factionOf('machine');
              if (m) c.changeRep(m.id, 20);
            } else c.gainCredits(200);
          },
        },
      ],
    },
  },
};

export const SIDES_B: ArcDef[] = [ACE_BOUNTY, PILGRIMAGE, PHILOSOPHER];
export const SIDES_B_EVENTS: EventDef[] = [abIntro, abSite, abWon, pgIntro, pgSite, phIntro, phSite];
