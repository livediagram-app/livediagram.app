import { describe, expect, it } from 'vitest';
import { NOTE_CARDS_MAX, type NoteCard } from '@livedocuments/document';
import {
  addNoteCard,
  moveNoteCard,
  removeNoteCard,
  restoreNoteCard,
  setNoteCardText,
} from './note-card-edits';

// docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards".

const cards: NoteCard[] = [
  { id: 'c1', text: 'One' },
  { id: 'c2', text: 'Two' },
  { id: 'c3', text: 'Three' },
];
const ids = (list: readonly NoteCard[]) => list.map((c) => c.id);
const full = Array.from({ length: NOTE_CARDS_MAX }, (_, i) => ({ id: `c${i + 1}`, text: 'x' }));

describe('addNoteCard', () => {
  it('adds a blank card at the end, or straight after one', () => {
    const end = addNoteCard(cards, null)!;
    expect(end.id).toBe('c4');
    expect(end.cards.at(-1)).toEqual({ id: 'c4', text: '' });
    const after = addNoteCard(cards, 0)!;
    expect(ids(after.cards)).toEqual(['c1', 'c4', 'c2', 'c3']);
    expect(ids(addNoteCard(cards, 99)!.cards).at(-1)).toBe('c4');
    expect(ids(addNoteCard(cards, -5)!.cards)[0]).toBe('c4');
  });

  it('adds nothing once the slide holds the most cards', () => {
    expect(addNoteCard(full, null)).toBeNull();
  });
});

describe('setNoteCardText', () => {
  it('writes the card, and hands back the same list for no change', () => {
    expect(setNoteCardText(cards, 'c2', 'Deux')[1]).toEqual({ id: 'c2', text: 'Deux' });
    expect(setNoteCardText(cards, 'c2', 'Two')).toBe(cards);
    expect(setNoteCardText(cards, 'nope', 'x')).toBe(cards);
  });
});

describe('moveNoteCard', () => {
  it('moves a card, clamped, and leaves the list alone for no move', () => {
    expect(ids(moveNoteCard(cards, 0, 2))).toEqual(['c2', 'c3', 'c1']);
    expect(ids(moveNoteCard(cards, 2, -4))).toEqual(['c3', 'c1', 'c2']);
    expect(moveNoteCard(cards, 1, 1)).toBe(cards);
    expect(moveNoteCard(cards, 7, 0)).toBe(cards);
  });
});

describe('removeNoteCard and restoreNoteCard', () => {
  it('removes a card and puts it back where it was', () => {
    const { cards: rest, removed } = removeNoteCard(cards, 'c2');
    expect(ids(rest)).toEqual(['c1', 'c3']);
    expect(removed).toEqual({ card: cards[1], index: 1 });
    expect(ids(restoreNoteCard(rest, removed!))).toEqual(['c1', 'c2', 'c3']);
    // A list that has shrunk since takes it at its end.
    expect(ids(restoreNoteCard([], removed!))).toEqual(['c2']);
  });

  it('removes nothing for an unknown id, and restores nothing into a full list or over itself', () => {
    expect(removeNoteCard(cards, 'nope')).toEqual({ cards, removed: null });
    const removed = { card: { id: 'zz', text: 'x' }, index: 0 };
    expect(restoreNoteCard(full, removed)).toBe(full);
    expect(restoreNoteCard(cards, { card: cards[0]!, index: 0 })).toBe(cards);
  });
});
