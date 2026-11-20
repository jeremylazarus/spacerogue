import type { CodexEntry, EventDef } from '../../game/api';
import { ANOMALY_EVENTS } from './anomalies';
import { ARRIVAL_EVENTS } from './arrivals';
import { ASTEROID_EVENTS } from './asteroids';
import { DERELICT_EVENTS } from './derelicts';
import { DISTRESS_EVENTS } from './distress';
import { EXODUS_EVENTS } from './exodus';
import { HAIL_EVENTS } from './hails';
import { PLANET_EVENTS } from './planets';
import { STATION_EVENTS } from './stations';
import { withMemory } from './util';

export const EVENTS: EventDef[] = [
  ...PLANET_EVENTS,
  ...DERELICT_EVENTS,
  ...ANOMALY_EVENTS,
  ...HAIL_EVENTS,
  ...STATION_EVENTS,
  ...DISTRESS_EVENTS,
  ...ASTEROID_EVENTS,
  ...ARRIVAL_EVENTS,
  ...EXODUS_EVENTS,
].map(withMemory);

export const EVENT_CODEX: CodexEntry[] = [
  {
    id: 'lore.choir',
    category: 'The Shoal',
    title: 'The Singing in the Lanes',
    body:
      'Every spacer in the Shoal has heard it: a chord beneath the hyperspace static, sustained and patient. Most call it superstition. Zealots call it the Song. Machines log it as an unclassified signal of improbable complexity. Hives say only that it is "loud" and "sad." Listen long enough and the chord resolves into voices. Thousands. Some of them say names.',
  },
  {
    id: 'lore.choir_moss',
    category: 'Xenobiology',
    title: 'Humming Moss',
    body:
      'A lichen-like organism found on quiet worlds. It does not produce sound; it resonates with ambient hyperspace static and amplifies it. Spectral analysis of the hum reveals compressed human-range voices holding a single pitch. The moss is harmless. Researchers who study it tend to request transfers.',
  },
  {
    id: 'lore.tide',
    category: 'The Shoal',
    title: 'The Tide',
    body:
      'The Shoal exhales. Lanes behind a traveller fold shut; systems once left fade from every scope. Old inscriptions treat this as weather. Navigators treat it as a rule: you can only go deeper. Nobody alive has seen a lane reopen.',
  },
  {
    id: 'lore.ledger',
    category: 'Wayfarers',
    title: 'The Ledgers',
    body:
      'Across the Shoal, in places that should not share anything, the same kind of book appears: a ledger of ships and captains, written in many hands. Some entries repeat. Some captains appear dozens of times, each under a different name, each in the same handwriting.',
  },
  {
    id: 'lore.echoes',
    category: 'Wayfarers',
    title: 'Echoes',
    body:
      'Wayfarers wake in cradle-pods with nothing but fragments. Yet they recognize hulls they never flew, voices they never heard, and their hands know controls before their minds do. Whatever brings them back does not bring them back clean. It brings back echoes.',
  },
  {
    id: 'lore.wardens',
    category: 'The Shoal',
    title: 'The Wardens',
    body:
      'Faceless ships with no heat signature and no engines anyone can find. They climb out of the Tide behind those who stay too long in one place. Their victims are not destroyed so much as smoothed: names scrubbed, weapons folded, as though corrected. The pattern of erasure is regular enough to be a signature.',
  },
  {
    id: 'lore.mimic',
    category: 'Xenobiology',
    title: 'Hull Mimics',
    body:
      'Ambush predators that grow skin in the shape of ships and broadcast lures learned from previous prey. Tell-tales: perfect condition, open airlocks, offers of free cargo, and a faint thermal pulse that is not a reactor. Rule of thumb: nothing in the Shoal is free.',
  },
  {
    id: 'lore.ancients',
    category: 'Peoples',
    title: 'The Elders',
    body:
      'Reclusive species older than the lanes themselves. They speak slowly, ask questions, and keep things: memories, mostly, which they accept as payment and never explain. They seem to remember the first Wayfarer. They do not volunteer what they remember.',
  },
  {
    id: 'lore.perseverance',
    category: 'History',
    title: 'The Perseverance',
    body:
      'A colony ship lost centuries ago with four thousand aboard. Its beacon promised to wait for rescue as long as it took. Its people did more than wait: they lived, for generations, inside the hull. Some say they were finally answered.',
  },
  {
    id: 'lore.thread',
    category: 'The Exodus',
    title: 'Thread',
    body:
      'Every ship in the Shoal burns thread: the pale, faintly warm filament that lanes are made of, wound on spools and fed to drives so a hull can pull itself from one knot of space to the next. Everyone buys it, hoards it, steals it, and prays over it. Nobody makes it. Mills have tried. Hives have tried to grow it. Machines have run the problem for centuries and filed it under "impossible, pending." Then a Wayfarer wakes in a cradle-pod, holds out a hand in the dark, and it spins. Wayfarers rarely find this as remarkable as everyone else does. They tend to say their hands remember. Nobody asks what else the hands remember.',
  },
  {
    id: 'lore.unravel',
    category: 'The Exodus',
    title: 'What the Tide Takes',
    body:
      'Drag something across the Tide-line and it comes apart, not violently, but the way a knot comes apart when someone patient pulls the right end. Hull first, then the shape of the hull, then the names painted on it. A little loose thread floats back out, which is how spacers justify doing it. What happens to the rest is a matter of taste. Mercantile actuaries list it as "total loss." Zealots say it is gathered up. Hives say it goes somewhere loud. Navigators who have done it more than a few times report that the singing in the lanes is fuller afterward, by a voice or two, and that they would rather not discuss it.',
  },
  {
    id: 'lore.narrows',
    category: 'The Exodus',
    title: 'The Narrows',
    body:
      'However you weave, however far you stray, some lanes have only one way through. The Narrows are where the Shoal pinches shut around a single throat, and every ship in the exodus must squeeze through it: refugees, warfleets, pilgrims, smugglers, you. Whoever is strongest holds the throat and charges accordingly. The Tide waits at the back of the queue like a creditor, and it always asks for something you would rather keep. Old spacers say the Narrows are where the Shoal checks its accounts. Young spacers say that is superstition. Both pay.',
  },
  {
    id: 'lore.grafts',
    category: 'The Exodus',
    title: 'Grafts',
    body:
      'Strip a bound ship and some of it can be fitted to your own: a sensor eye, a stretch of living plate, a fin that still twitches when the lanes sing. Grafts work. They also announce themselves. Every captain in the Shoal reads a hull before they read a transponder, and what you wear tells them who you have taken from. Hives find it charming; everyone wears pieces. Machines count the parts and remember the serial numbers. Pilgrims see a reliquary of the unshriven. Raiders admire anyone else\'s trophies and kill you over their own. The elders only want to know whether you are one thing or a crowd. A hull is a biography. Write carefully.',
  },
  {
    id: 'lore.loom',
    category: 'The Exodus',
    title: 'The Loom',
    body:
      'There is no map of the Shoal because there is nothing to map. Lanes drift, knot, and close behind you. A Wayfarer does not follow roads; a Wayfarer makes one. Gather strands from the places you pass, a planet\'s pull, a station\'s noise, a faction\'s beacon, and the Loom weaves them into the shape of where you go next. Weave with nothing and the Shoal decides for you, carelessly. Weave with care and you can choose your company. Nobody else can do it. Nobody else can follow. The road is gone before your wake settles, which some Wayfarers find lonely and others find very convenient.',
  },
  {
    id: 'lore.remnant',
    category: 'Wayfarers',
    title: 'Former Selves',
    body:
      'Sometimes, out in the drift, a Wayfarer meets a ship they recognize and have never seen: a hull they flew in another life, flying on without them. What is aboard is hard to describe. It knows your habits. It finishes your sentences, a beat early. It remembers dying, and does not seem to mind as much as you would like. Those who die in the Shoal do not entirely leave it. Listen to the singing in the lanes long enough and you may hear a voice that sounds a great deal like your own, holding a note, waiting for the rest of you to catch up.',
  },
];
