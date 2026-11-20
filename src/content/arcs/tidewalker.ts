/** Side arc: The Tidewalker. SPOILERS: the owner plays blind. */
import type { ArcDef, EventCtx, EventDef } from '../../game/api';
import { advance, finish, is, num, staged, placeMarkers } from './util';

const A = 'tw';
const ARC = 'tidewalker';
const SITE = { eventId: 'tw_site', label: 'Tide\'s edge', kind: 'anomaly' as const };
const NAME = 'Hesper Dunlin';

const weight = (c: EventCtx) => Number(c.metaFlag('choir.weight') ?? 0);
const aboard = (c: EventCtx) => {
  const id = c.flag('arc.tw.id');
  return typeof id === 'string' && c.officers.some((o) => o.id === id);
};
function letGo(c: EventCtx, reason: string): void {
  const id = c.flag('arc.tw.id');
  if (typeof id === 'string' && aboard(c)) c.removeOfficer(id, reason);
}
const wearing = (c: EventCtx) => num(c, 'wears.total');

export const TIDEWALKER: ArcDef = {
  id: ARC,
  title: 'The Tidewalker',
  kind: 'side',
  activateAt: 2,
  begin(ctx) {
    ctx.chain('tw_intro');
  },
};

const intro: EventDef = {
  id: 'tw_intro',
  sites: ['marker'],
  title: 'A Woman on Foot',
  start: 'a',
  nodes: {
    a: {
      text: `Your scope picks up a figure in a pressure suit, alone, kilometres from any hull. She is walking: one slow suit-jet burst after another, in a perfectly straight line, toward the side of the system the Tide will come from.\n\nWhen you hail, she answers at once, as if she has been expecting someone.\n\n"Hesper Dunlin. Ship's surgeon, once. My family's ship went into the Tide three systems back and I'm going after it. No, I don't want rescuing. Yes, I'm sure. Would you like to give me a lift, or shall I keep walking?"`,
      choices: [
        {
          label: 'Give her a lift to the edge',
          run: (c) => {
            const o = c.addOfficer('medic', 'human', NAME);
            if (o) c.setFlag('arc.tw.id', o.id);
            else c.setFlag('arc.tw.hold', true);
            placeMarkers(c, SITE, [1, 2]);
            c.journal(ARC, `${NAME} wants to walk into the Tide after her family. Take her to its edge.`);
            return o ? 'aboard' : 'hold';
          },
        },
        {
          label: 'Try to talk her round',
          run: (c) => {
            if (c.check('diplomacy', 2)) {
              c.setFlag('arc.tw.doubt', true);
              const o = c.addOfficer('medic', 'human', NAME);
              if (o) c.setFlag('arc.tw.id', o.id);
              else c.setFlag('arc.tw.hold', true);
              placeMarkers(c, SITE, [1, 2]);
              c.journal(ARC, `${NAME} has agreed to look at the Tide before she walks into it. Take her to its edge.`);
              return 'doubt';
            }
            c.journal(ARC, '');
            finish(c, A);
            return 'walks';
          },
        },
        {
          label: 'Wish her well and leave her to it',
          run: (c) => {
            c.journal(ARC, '');
            finish(c, A);
            return 'walks';
          },
        },
      ],
    },
    aboard: {
      text: `She comes aboard, unclips her helmet and immediately starts reorganising your medbay. "You've been stitching people with engineering wire," she says. "Don't."\n\nShe will be useful until she isn't here any more. She is very clear about that.`,
    },
    hold: {
      text: `There is no free berth, so she rides in the cargo hold with her helmet on, perfectly content, humming.\n\nShe will not say what she's humming.`,
    },
    doubt: {
      text: `It takes a long time. She is not stupid and she is not, exactly, sad. She is certain.\n\nBut in the end she agrees to one thing: to look at the Tide first, properly, before she walks into it. "Fine. A look. I'm a surgeon. I can look."`,
    },
    walks: {
      text: `She thanks you, sincerely, and keeps walking.\n\nWhen you jump out, the suit's beacon is still blinking, a little smaller, a little further toward the side of the sky that will soon not be there.`,
    },
  },
};

const site: EventDef = {
  id: 'tw_site',
  sites: ['marker'],
  title: 'The Tidewalker',
  start: 'start',
  nodes: {
    start: staged(
      A,
      [
        // 0: the edge
        {
          text: (c) => {
            let t = `The edge of the Tide, close enough to see. It is not a wall. It is more like the place where a painting stops: the stars just end, and after them is a grey that hurts to focus on.\n\nHesper suits up without a word and stands at the airlock. "I can hear them," she says. "My sister. Her boy. They're arguing about dinner."`;
            if (is(c, 'arc.tw.doubt')) t += `\n\nShe hesitates. "I said I'd look. I'm looking."`;
            if (wearing(c) > 0)
              t += `\n\nShe glances back at you. "Your hull's wearing pieces of other people's ships, captain. The Tide likes that. It thinks you're already halfway to being its."`;
            return t;
          },
          choices: [
            {
              label: 'Open the airlock',
              run: (c) => {
                letGo(c, 'has walked into the Tide');
                c.setFlag('arc.tw.fate', 'gone');
                c.gainXp(30);
                advance(c, A, SITE, 2, [1, 2]);
                return 'gone';
              },
            },
            {
              label: 'Keep the airlock shut',
              run: (c) => {
                advance(c, A, SITE, 2, [1, 2]);
                const d = (is(c, 'arc.tw.doubt') ? 1 : 3) + (wearing(c) >= 3 ? 1 : 0);
                if (c.check('diplomacy', d)) {
                  c.setFlag('arc.tw.fate', 'stayed');
                  return 'stayed';
                }
                letGo(c, 'has cut her way out through the cargo lock');
                c.damageHull(12);
                c.setFlag('arc.tw.fate', 'gone');
                return 'brokeOut';
              },
            },
            {
              label: 'Suit up and walk to the edge with her',
              run: (c) => {
                advance(c, A, SITE, 2, [1, 2]);
                if (c.check('science', 3)) {
                  c.setFlag('arc.tw.seen', true);
                  c.setFlag('arc.tw.fate', 'gone');
                  letGo(c, 'has walked into the Tide');
                  c.damageHull(10);
                  c.giveRelic('saints_tooth') ?? c.gainXp(40);
                  return 'walkedWith';
                }
                c.damageHull(25);
                c.setFlag('arc.tw.fate', 'stayed');
                return 'pulledBack';
              },
            },
            {
              label: 'Let the Hollow Idol listen for her',
              req: { relic: 'hollow_idol' },
              hideIfUnmet: true,
              run: (c) => {
                advance(c, A, SITE, 2, [1, 2]);
                c.setFlag('arc.tw.fate', 'stayed');
                c.setFlag('arc.tw.idol', true);
                return 'idol';
              },
            },
          ],
        },
        // 1: afterwards
        {
          text: (c) => {
            if (c.flag('arc.tw.fate') === 'gone') {
              const w = weight(c);
              let t = `A lump of Tide-wrack bobs up in front of your bow, the way debris surfaces after a ship goes down. Your comms light up.\n\n"Captain? It's Hesper. Don't be alarmed. Well. Be a bit alarmed."\n\n"I found them. It's not like you'd think in here. It's crowded."`;
              if (w >= 5)
                t += `\n\nShe pauses. "There are a lot of ships in here that came from you, you know. More than one life's worth. They're not angry. They're cold. They asked me to ask you to stop."`;
              else if (w > 0) t += `\n\n"Some of the ships in here have your thread on them. They say hello. I think it's hello."`;
              return t;
            }
            let t = `Hesper has been quiet since the edge. She does her job: she sets bones, she rations painkillers, she tells {off} to sit down and stop bleeding on things.\n\nTonight she finds you on the bridge.`;
            if (is(c, 'arc.tw.idol')) t += `\n\n"The idol told me they're not in there," she says. "Not like I hoped. I believe it. I wish I didn't."`;
            t += `\n\n"So. What do I do now, captain? You stopped me. Your problem."`;
            return t;
          },
          choices: [
            // she walked in
            {
              label: 'Ask her to guide you through',
              visible: (c) => c.flag('arc.tw.fate') === 'gone',
              run: (c) => {
                c.setMetaFlag('tw.hesper', true);
                if (c.check('navigation', 2)) c.gainFuel(4);
                else c.gainFuel(2);
                c.journal(ARC, '');
                finish(c, A);
                return 'guided';
              },
            },
            {
              label: 'Haul in the wrack she came up on',
              visible: (c) => c.flag('arc.tw.fate') === 'gone',
              run: (c) => {
                c.giveItem({ minRarity: c.check('salvage', 2) ? 3 : 2 });
                c.journal(ARC, '');
                finish(c, A);
                return 'hauled';
              },
            },
            {
              label: '"Tell them I heard."',
              visible: (c) => c.flag('arc.tw.fate') === 'gone' && weight(c) > 0,
              run: (c) => {
                c.setMetaFlag('tw.vow', true);
                c.repairHull(40);
                c.gainXp(40);
                c.journal(ARC, '');
                finish(c, A);
                return 'heard';
              },
            },
            // she stayed
            {
              label: 'Put her ashore at the next safe harbour',
              visible: (c) => c.flag('arc.tw.fate') !== 'gone',
              run: (c) => {
                letGo(c, 'has gone ashore to start again');
                c.gainCredits(180);
                c.journal(ARC, '');
                finish(c, A);
                return 'ashore';
              },
            },
            {
              label: '"Stay. We need a surgeon."',
              visible: (c) => c.flag('arc.tw.fate') !== 'gone',
              run: (c) => {
                c.journal(ARC, '');
                finish(c, A);
                if (!aboard(c) && !c.addOfficer('medic', 'human', NAME)) return 'noBerth';
                c.repairHull(20);
                return 'stays';
              },
            },
            {
              label: 'Take her back to the edge. Her choice, this time.',
              visible: (c) => c.flag('arc.tw.fate') !== 'gone',
              run: (c) => {
                letGo(c, 'has walked into the Tide');
                c.setMetaFlag('tw.hesper', true);
                c.giveRelic('mourning_bell') ?? c.gainXp(40);
                c.journal(ARC, '');
                finish(c, A);
                return 'second';
              },
            },
          ],
        },
      ],
      {
        text: `A smear of Tide-wrack. For a moment, on an open band, someone is humming. Then it is just static.`,
        choices: [{ label: 'Move on' }],
      },
    ),
    gone: {
      text: `She steps out, gives you a little wave, and jets toward the grey. She does not slow down at the edge.\n\nYou watch her suit beacon until it stops being a thing that can be watched.`,
      enter: (c) => c.journal(ARC, `${NAME} walked into the Tide. Keep an ear on the static.`),
    },
    stayed: {
      text: `You keep it shut. She argues. Then she shouts. Then, worst of all, she goes quiet, takes off her helmet, and sits down on the deck with her back to the airlock.\n\n"Fine," she says. "Fine. Not today."`,
      enter: (c) => c.journal(ARC, `You stopped ${NAME} at the edge of the Tide. She hasn't forgiven you yet.`),
    },
    brokeOut: {
      text: `You keep it shut. She is a surgeon. She knows exactly where to cut.\n\nThe cargo lock blows. By the time {off} has the bulkhead sealed, her suit beacon is already halfway to the grey.`,
      enter: (c) => c.journal(ARC, `${NAME} cut her way out and walked into the Tide. Keep an ear on the static.`),
    },
    walkedWith: {
      text: `You walk her to the edge, two suit-jets in the dark. Up close the grey is not empty. It is full: hulls and faces and running lights, pressed together like pages in a closed book.\n\nAt the very edge she takes off the old tooth she wore on a cord and puts it in your glove. "My grandmother's. It refuses to let you go. I don't need it any more."\n\nThen she steps through, and you go home with your suit smoking.`,
      enter: (c) => c.journal(ARC, `You walked ${NAME} to the Tide and saw what is inside it. Keep an ear on the static.`),
    },
    pulledBack: {
      text: `You get too close. The grey takes the paint off your suit, then the outer layer, and then it starts on you.\n\nSomething yanks you back by the tether. Hesper, braced in the airlock, hauling, swearing.\n\n"Idiot," she says, stitching your arm. "I'm not going anywhere till you're fixed. Idiot."`,
      enter: (c) => c.journal(ARC, `${NAME} pulled you back from the Tide. She's staying, for now.`),
    },
    idol: {
      text: `You hold the idol up to the viewport. It is very cold. Then it is warm, and then it whispers something to Hesper that you do not hear.\n\nShe goes white. She takes off her helmet. She does not open the airlock.`,
      enter: (c) => c.journal(ARC, `Something told ${NAME} not to go. She's staying, for now.`),
    },
    guided: {
      text: `"Left a bit. No, your left." Her voice threads through the static, steering you through the slack in the lanes like a pilot through a reef.\n\nYou spin more freely for it. When you finally lose her signal, she is laughing at something one of the others said.`,
    },
    hauled: {
      text: `You winch the wrack aboard. Her voice cuts off mid-sentence the moment it clears the airlock. Inside the lump of grey: a module, beautifully kept, still warm.\n\nShe doesn't call again.`,
    },
    heard: {
      text: `"I'll tell them," she says. "I don't know if it helps. I think it does."\n\nA long pause. Then, gently, the way she'd speak to a patient: "Go on, captain. Go and be careful with your thread."\n\nYour hull feels sounder. You can't say why.`,
    },
    ashore: {
      text: `She shakes your hand at the airlock. She takes most of your painkillers and leaves you a set of excellent instructions.\n\n"If you ever find yourself at the edge," she says, "look first. That's all. Look first."`,
    },
    stays: {
      text: `She considers it for a very long time.\n\n"All right," she says. "But I'm not stitching anyone with engineering wire."`,
    },
    noBerth: {
      text: `There is no berth for her, and she will not take one from anyone else. She stays in the cargo hold, humming the song she still won't name, and gets off at the next port without saying goodbye.`,
    },
    second: {
      text: `You take her back to the grey. This time she stops at the edge for a long moment, looking. Then she presses a small black bell into your hand.\n\n"For when it gets close," she says. "So you know to look first."\n\nShe steps through.`,
    },
  },
};

export const TIDEWALKER_EVENTS: EventDef[] = [intro, site];
