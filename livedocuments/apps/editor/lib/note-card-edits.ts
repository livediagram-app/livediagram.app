// A slide's note cards edited as a list (docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards"):
// add a blank card (at the end or after one), write one, move one, remove one and put it back. Pure; the same array
// comes back when nothing changes, so a no-op never writes the deck.
import { NOTE_CARDS_MAX, newNoteCardId, type NoteCard } from '@livedocuments/document';

export type RemovedNoteCard = { card: NoteCard; index: number };

/** A blank card after `afterIndex` (null: at the end), and its id; null when the slide holds NOTE_CARDS_MAX. */
export function addNoteCard(
  cards: readonly NoteCard[],
  afterIndex: number | null,
): { cards: NoteCard[]; id: string } | null {
  if (cards.length >= NOTE_CARDS_MAX) return null;
  const id = newNoteCardId(cards);
  const at =
    afterIndex === null ? cards.length : Math.max(0, Math.min(cards.length, afterIndex + 1));
  const next = [...cards];
  next.splice(at, 0, { id, text: '' });
  return { cards: next, id };
}

/** The card `id` with this text. */
export function setNoteCardText(
  cards: readonly NoteCard[],
  id: string,
  text: string,
): readonly NoteCard[] {
  const at = cards.findIndex((c) => c.id === id);
  if (at < 0 || cards[at]!.text === text) return cards;
  const next = [...cards];
  next[at] = { id, text };
  return next;
}

/** The card at `from` moved to `to` (clamped to the list). */
export function moveNoteCard(
  cards: readonly NoteCard[],
  from: number,
  to: number,
): readonly NoteCard[] {
  const target = Math.max(0, Math.min(cards.length - 1, to));
  if (from < 0 || from >= cards.length || target === from) return cards;
  const next = [...cards];
  const [card] = next.splice(from, 1);
  next.splice(target, 0, card!);
  return next;
}

/** The list without card `id`, and what was removed (for Undo). */
export function removeNoteCard(
  cards: readonly NoteCard[],
  id: string,
): { cards: readonly NoteCard[]; removed: RemovedNoteCard | null } {
  const index = cards.findIndex((c) => c.id === id);
  if (index < 0) return { cards, removed: null };
  return {
    cards: cards.filter((c) => c.id !== id),
    removed: { card: cards[index]!, index },
  };
}

/** A removed card back at its place (clamped), unless the list is full or holds that id again. */
export function restoreNoteCard(
  cards: readonly NoteCard[],
  removed: RemovedNoteCard,
): readonly NoteCard[] {
  if (cards.length >= NOTE_CARDS_MAX || cards.some((c) => c.id === removed.card.id)) return cards;
  const next = [...cards];
  next.splice(Math.min(removed.index, next.length), 0, removed.card);
  return next;
}
