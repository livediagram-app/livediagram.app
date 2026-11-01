// Speaker note cards (docs/specs/012-collaboration/speaker-note-cards.md): a slide's speaker notes as a short
// stack of plain-text cards, the smaller form of flashcards. Reading the stored cards (and a slide written before
// cards existed, whose one `notes` string reads as one card), the mirror older readers keep reading, and each
// card's speaking time. Pure.
import { speakingSecondsFor, spokenWordCount } from './flashcards';
import type { Slide } from './slide-deck';

export type NoteCard = { id: string; text: string };

// At most this many cards a slide (blueprint NC1): a long slide's talking points, and a bound on the deck's size.
export const NOTE_CARDS_MAX = 20;
// The most characters a card takes as typed (blueprint NC2): about 170 words, over a minute spoken. Longer text from
// an old note or an imported notes page is kept whole; the box only stops it growing.
export const NOTE_CARD_TEXT_MAX = 1000;

// The id an old single `notes` string reads with, as one card.
export const LEGACY_NOTE_CARD_ID = 'notes';

// What the readers need of a slide: its old notes and its cards (a read-only list will do).
type NotesOf = { notes?: string | undefined; noteCards?: readonly NoteCard[] | undefined };

const hasWords = (text: string) => /\S/.test(text);

/** A card with nothing but spaces on it: kept while it is written, left out of what is shown and exported. */
export function isBlankNoteCard(card: NoteCard): boolean {
  return !hasWords(card.text);
}

/** Stored cards, cleaned: entries that are not `{ id, text }` dropped, a repeated id kept once, cut to
 *  NOTE_CARDS_MAX. Undefined when the value is not a list or nothing is left. */
export function parseNoteCards(raw: unknown): NoteCard[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: NoteCard[] = [];
  for (const entry of raw) {
    if (out.length >= NOTE_CARDS_MAX) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, text } = entry as Partial<NoteCard>;
    if (typeof id !== 'string' || id.length === 0 || typeof text !== 'string' || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({ id, text });
  }
  return out.length > 0 ? out : undefined;
}

/** A slide's note cards in order: its cards, else its old `notes` as one card, else none. */
export function slideNoteCards(slide: NotesOf): readonly NoteCard[] {
  if (slide.noteCards) return slide.noteCards;
  return slide.notes && hasWords(slide.notes)
    ? [{ id: LEGACY_NOTE_CARD_ID, text: slide.notes }]
    : [];
}

/** The cards the presenter sees and the export writes: not blank, in order. */
export function spokenNoteCards(slide: NotesOf): NoteCard[] {
  return slideNoteCards(slide).filter((c) => !isBlankNoteCard(c));
}

/** Whether a slide has anything to say: a card that is not blank. */
export function slideHasNotes(slide: NotesOf): boolean {
  return slideNoteCards(slide).some((c) => !isBlankNoteCard(c));
}

/** The cards as one script, the mirror kept in `notes`: each card's text trimmed, blank ones left out, a blank
 *  line between. */
export function noteCardsText(cards: readonly NoteCard[]): string {
  return cards
    .map((c) => c.text.trim())
    .filter((t) => t.length > 0)
    .join('\n\n');
}

/** The slide with these cards: `noteCards` and its `notes` mirror, both gone when there are no cards (and the mirror
 *  gone while every card is blank). */
export function withNoteCards(slide: Slide, cards: readonly NoteCard[]): Slide {
  const next: Slide = { ...slide };
  if (cards.length === 0) {
    delete next.noteCards;
    delete next.notes;
    return next;
  }
  next.noteCards = [...cards];
  const text = noteCardsText(cards);
  if (text) next.notes = text;
  else delete next.notes;
  return next;
}

/** An id no card in the list has: `c` and a base-36 number past the highest such id there. */
export function newNoteCardId(cards: readonly NoteCard[]): string {
  let high = 0;
  for (const c of cards) {
    const m = /^c([0-9a-z]+)$/.exec(c.id);
    if (m) high = Math.max(high, parseInt(m[1]!, 36));
  }
  return `c${(high + 1).toString(36)}`;
}

/** How long a card's words take to say aloud, in seconds (0 for none), at a flashcard's pace. */
export function noteCardSpeakingSeconds(text: string): number {
  return speakingSecondsFor(spokenWordCount(text));
}
