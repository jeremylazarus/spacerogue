import type { CodexEntry } from '../game/api';

const FRAG = 'Fragments of the First Voyage';
const ARC = 'Voyages';

export const CODEX: CodexEntry[] = [
  // --- origin fragments: each a puzzle piece; together, the truth -------------
  {
    id: 'frag.origin.1',
    category: FRAG,
    title: 'I. The Lamp-Lighter',
    body: `"The first of you came this way. She lit lamps so the rest could follow."\n\nThe lanes of the Shoal run one way, toward the Heart. Nobody asks why. Old charts, overlaid across centuries, show the same thing under every reshuffle: a single road, walked once, that the Shoal has never stopped remembering.\n\nSomeone went first. Everyone since has been following her footprints.`,
  },
  {
    id: 'frag.origin.2',
    category: FRAG,
    title: 'II. Correction',
    body: `"A note held too long becomes a dissonance. We correct dissonance."\n\nThe wardens are not soldiers. They have no crews, only cradles, empty and warm. They come for travellers who linger, and for travellers who return too many times.\n\nThey are hands. Something larger is moving them. Something that is trying to stay in tune.`,
  },
  {
    id: 'frag.origin.3',
    category: FRAG,
    title: 'III. Many, Singing Alone',
    body: `The hives hear the singing in the lanes more clearly than anyone, and they say what no one else will: it is not one voice.\n\nIt is thousands. Each singing alone, each calling out, none of them answered.\n\n"They are so lonely in there," said one queen. "We wanted to answer them with one voice."`,
  },
  {
    id: 'frag.origin.4',
    category: FRAG,
    title: 'IV. The Ones Who Did Not Finish',
    body: `"Every life we didn't finish. They don't go anywhere. They go into the singing. I've heard it, from the inside. It's us."\n\nSpoken by a thing wearing a Wayfarer's face: a past life that would not let go.\n\nThe dead of the Shoal are not gone. They are kept.`,
  },
  {
    id: 'frag.origin.5',
    category: FRAG,
    title: 'V. The Keel',
    body: `At the Heart drifts the spine of a ship older than any people in the Shoal. Wars have been fought over it. Nobody has read what is carved along it.\n\nIt is a ship's name. Every Wayfarer who reads it recognises it as their own.\n\nThe first ship to reach the Heart never left. Its captain didn't either.`,
  },
  {
    id: 'frag.origin.6',
    category: FRAG,
    title: 'VI. The Same Pattern',
    body: `A machine that keeps records of travellers found the same mind, again and again, in different bodies, different ships, different centuries. It had flagged them as errors.\n\nThe cradles do not make new captains. They rebuild an old one from somewhere: a pattern kept safe, sung back into flesh.\n\nThe singing remembers you. That is how you come back.`,
  },
  {
    id: 'frag.origin.7',
    category: FRAG,
    title: 'VII. The Binder',
    body: `From a pilgrim's prayer-book, in a hand not his own:\n\n"When I reached the Heart I found every traveller who ever died out here, lost, alone. I could not bear it. So I bound them, all of them, all of us, into a choir that remembers. And I made it bring us back.\n\nAgain and again, until one of us reaches me and can tell me whether I was right. Choose differently than I did. Or the same. But choose."`,
  },

  // --- arc lore -------------------------------------------------------------
  {
    id: 'arc.silent_beacon',
    category: ARC,
    title: 'The Silent Beacon',
    body: `A beacon of thirteen notes, lit long ago to keep a song-eating leviathan fed and far from the Heart. It lured travellers to their deaths for an age, tended by a hermit who grew very tired.\n\nWhether it still sings depends on who came last.`,
  },
  {
    id: 'arc.schism',
    category: ARC,
    title: 'The Keel War',
    body: `Two peoples went to war over a bone-white wreck at the Heart. One called it holy inheritance, the other salvage. A third party sold guns to both.\n\nThe Keel outlasted the war. It will outlast the peace.`,
  },
  {
    id: 'arc.the_hunt',
    category: ARC,
    title: 'Warden Prime',
    body: `The wardens have a commander, and it can speak. It marks travellers who return too often and herds them toward the Heart.\n\nIt said: "You are its question. Questions are not permitted to go unanswered forever."`,
  },
  {
    id: 'arc.hive_bloom',
    category: ARC,
    title: 'The Bloom',
    body: `A hive that wanted everyone to be one voice, so no one would ever be lonely again. Its flowers were warm, and its welcome sincere, and nobody it touched ever wanted to leave.\n\nThat was the problem. Or the point.`,
  },
  {
    id: 'arc.mirror_debt',
    category: ARC,
    title: 'The Mirror',
    body: `A past life that refused to end came back without a body, borrowed ships, ran up debts, and raced you to the Heart to pay what it thought you owed.\n\nIt flew the ship you died in last time.`,
  },
  {
    id: 'arc.origin.freed',
    category: ARC,
    title: 'Ending: The Choir Freed',
    body: `You untied the knot, one loop at a time. The voices went, each pausing to look back. The lanes loosened. The cradle was not supposed to open again.`,
  },
  {
    id: 'arc.origin.bound',
    category: ARC,
    title: 'Ending: The New Binder',
    body: `You took her place in the light. Somewhere at the edge of the Shoal, a cradle opens, and you sing a note to let them know someone is listening.`,
  },
  {
    id: 'arc.origin.broken',
    category: ARC,
    title: 'Ending: The Choir Broken',
    body: `You cut the knot. The voices scattered into the dark between lanes, neither freed nor kept. The wardens fell silent. The Shoal became only a place.`,
  },
  {
    id: 'arc.missing_officer',
    category: ARC,
    title: 'Ilse Varro',
    body: `Navigator of the survey ship Patience, who followed the singing alone and found, at the end of it, a captain she remembered watching die.`,
  },
  {
    id: 'arc.cartographer',
    category: ARC,
    title: 'Index-of-Shores',
    body: `A survey-mind that has mapped the Shoal for nine hundred years, knowing every map is wrong within one. Under all of them, it found a single road.`,
  },
  {
    id: 'arc.plague',
    category: ARC,
    title: 'The Lantern Rot',
    body: `A made plague that glows under the skin like a candle behind paper. Sold by the litre. Cured, once, by a stranger passing through.`,
  },
  {
    id: 'arc.ace_bounty',
    category: ARC,
    title: 'Kestrel "Nine-Lives" Oduya',
    body: `Raider ace. Burns a toast into the hull of every hunter she kills. Wanted for robbing a convoy of indentured children, and letting them go.`,
  },
  {
    id: 'arc.pilgrimage',
    category: ARC,
    title: 'Ashvel Doon',
    body: `A pilgrim who walked to the edge of the Shoal on foot and by begging, and asked to be carried the rest of the way. He wanted to know if the Song was a god or a grave.`,
  },
  {
    id: 'arc.philosopher',
    category: ARC,
    title: 'Clear Reckoning',
    body: `A machine that has observed 41,233 travellers and asks the ones it cannot model three questions. It does not like being lied to. It is learning to like being wrong.`,
  },
];
