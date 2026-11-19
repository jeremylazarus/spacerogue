import type { EventDef } from '../../game/api';
import { cr, prevShip, rep, side } from './util';

export const ARRIVAL_EVENTS: EventDef[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: 'ev_arrive_tide',
    sites: ['arrival'],
    title: 'The Lane Closes',
    weight: 0.3,
    unique: true,
    minDepth: 1,
    start: 'start',
    nodes: {
      start: {
        text:
          'As you drop out of the lane into {sys}, the rear sensors catch it: the lane behind you folding shut, like a seam being stitched. The system you just left goes dim on the scope. Then it goes out.\n\nYou can never go back. You knew that. It is different to see it.',
        choices: [
          {
            label: 'Record the collapse.',
            run: (ctx) => {
              if (ctx.check('science', 1)) ctx.unlockCodex('lore.tide');
              ctx.gainXp(20);
            },
          },
          {
            label: 'Scoop the lane-residue before it dissipates.',
            req: { apt: { navigation: 2 } },
            run: (ctx) => {
              ctx.gainFuel(3);
              ctx.unlockCodex('lore.tide');
            },
          },
          { label: 'Face forward.' },
        ],
      },
    },
  },

  // 2 -----------------------------------------------------------------------
  {
    id: 'ev_arrive_welcome',
    sites: ['arrival'],
    title: 'Welcome Committee',
    weight: 0.3,
    portrait: 'faction',
    condition: (ctx) => ctx.faction !== null && ctx.faction.archetype !== 'ancient',
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          switch (ctx.faction?.archetype) {
            case 'mercantile':
              return '"Welcome to {sys}, a {F} free-trade zone! Please enjoy our complimentary arrival tariff, and declare any goods, wants, or feelings of financial curiosity."';
            case 'zealot':
              return '"Thou enterest {sys}, holy to {Fl}. Declare thy faith, or declare thy faithlessness, but declare."';
            case 'hive':
              return '"NEW WARMTH ENTERS {sys}. we taste you from very far away. hello. hello. we are pleased. are you pleased?"';
            case 'machine':
              return '"ENTRY LOGGED: {ship}. STATEMENT: you are the 1,207th vessel this cycle. QUERY: state purpose. NOTE: all purposes are acceptable. We are curious."';
            case 'raider':
              return '"Well well well. Fresh meat in {sys}. Clan rules: entry toll, or entertain us. Make it good."';
            default:
              return 'A patrol hails you as you enter {sys}.';
          }
        },
        choices: [
          {
            label: 'Answer politely and pay any fees.',
            run: (ctx) => {
              ctx.loseCredits(cr(ctx, 20));
              rep(ctx, 8);
            },
          },
          {
            label: 'Answer in their own idiom.',
            req: { apt: { diplomacy: 2 } },
            run: (ctx) => {
              rep(ctx, 15);
              ctx.gainXp(20);
              ctx.note('They are delighted. Word spreads ahead of you through {sys}.');
            },
          },
          {
            label: 'Ignore them and fly on.',
            run: (ctx) => {
              rep(ctx, -6);
              if (ctx.faction?.archetype === 'raider' && ctx.chance(0.5))
                ctx.combat({ side: side(ctx), count: 2, strength: 0.8, announce: 'Toll collectors' });
            },
          },
        ],
      },
    },
  },

  // 3 -----------------------------------------------------------------------
  {
    id: 'ev_arrive_you_again',
    sites: ['arrival'],
    title: 'A Voice on the Comm',
    weight: 0.5,
    unique: true,
    condition: (ctx) => ctx.runNumber > 1,
    start: 'start',
    nodes: {
      start: {
        text: (ctx) => {
          const p = prevShip(ctx);
          return `A tired voice on an open channel, the moment you enter {sys}: "...You again? Hm. Last time you were flying ${p ? `the ${p}` : 'a different ship'}. Didn't end well. Want to know where it went wrong, or do you want to find out yourself?"\n\nThe signal comes from a small buoy. There is no ship.`;
        },
        choices: [
          {
            label: '"Tell me."',
            run: (ctx) => {
              ctx.revealMap(2);
              ctx.unlockCodex('lore.echoes');
              ctx.note('"Fine. Don\'t take the left fork after the burning world. And for pity\'s sake, don\'t linger." The buoy goes silent.');
            },
          },
          {
            label: '"I\'ll find out myself."',
            run: (ctx) => {
              ctx.gainXp(40);
              ctx.note('"Thought you\'d say that. You always say that." A soft laugh, and the buoy goes dark.');
            },
          },
          {
            label: '"Who are you?"',
            run: (ctx) => {
              ctx.unlockCodex('lore.choir');
              ctx.note('A long pause. "One of the ones who didn\'t make it, kid. Like you, eventually. Like you, right now, for all I know." Static.');
              ctx.gainXp(25);
            },
          },
        ],
      },
    },
  },
];
