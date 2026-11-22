// Speaking time (docs/specs/012-collaboration/speaker-note-cards.md): the words in a piece of plain text, how long
// they take to say aloud, and how a count of cards and their time is said. Pure.

// A steady speaking pace: talks run 120 to 150 words a minute; the middle of that, a little slow, as notes are spoken.
export const SPEAKING_WORDS_PER_MINUTE = 130;
// Under a minute, a card's time is said to the next this-many seconds.
const SPEAKING_STEP_S = 5;

// A word: a run of letters or digits (an apostrophe or hyphen inside keeps it one word).
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** How many words a piece of plain text holds (a note card's). */
export function spokenWordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** How long a number of words takes to say aloud, in seconds: at SPEAKING_WORDS_PER_MINUTE, rounded up. */
export function speakingSecondsFor(words: number): number {
  return Math.ceil((words * 60) / SPEAKING_WORDS_PER_MINUTE);
}

/** "3 cards · 2 min" (a slide's note cards): how many cards, and how long they take to say; null for no cards. A
 *  count with no time says the count alone. */
export function cardsSummary(count: number, seconds: number): string | null {
  if (count <= 0) return null;
  const cards = count === 1 ? '1 card' : `${count} cards`;
  const time = speakingTimeLabel(seconds);
  return time ? `${cards} · ${time}` : cards;
}

/** A speaking time as a card's footer says it: "25 sec" under a minute (to the next 5 s), then
 *  "3 min" (the nearest minute); null for no words. */
export function speakingTimeLabel(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 60) {
    return `${Math.min(55, Math.ceil(seconds / SPEAKING_STEP_S) * SPEAKING_STEP_S)} sec`;
  }
  return `${Math.round(seconds / 60)} min`;
}
