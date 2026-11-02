import { describe, expect, it } from 'vitest';
import { parseStoredPresentation, type Slide } from './slide-deck';
import {
  LEGACY_NOTE_CARD_ID,
  NOTE_CARDS_MAX,
  isBlankNoteCard,
  newNoteCardId,
  noteCardSpeakingSeconds,
  noteCardsText,
  parseNoteCards,
  slideHasNotes,
  slideNoteCards,
  spokenNoteCards,
  withNoteCards,
} from './slide-notes';

// docs/specs/012-collaboration/speaker-note-cards.md "The model".

const slide = (extra: Partial<Slide> = {}): Slide => ({
  id: 's1',
  tabId: 't',
  elementIds: [],
  ...extra,
});

describe('slideNoteCards', () => {
  it('reads a slide written before note cards as one card holding its notes', () => {
    expect(slideNoteCards(slide({ notes: 'Open with the numbers.' }))).toEqual([
      { id: LEGACY_NOTE_CARD_ID, text: 'Open with the numbers.' },
    ]);
  });

  it('reads no cards from no notes, or notes of spaces alone', () => {
    expect(slideNoteCards(slide())).toEqual([]);
    expect(slideNoteCards(slide({ notes: '  \n ' }))).toEqual([]);
  });

  it('reads the cards when there are some, never the mirror beside them', () => {
    const cards = [{ id: 'c1', text: 'One' }];
    expect(slideNoteCards(slide({ noteCards: cards, notes: 'stale' }))).toBe(cards);
  });
});

describe('spokenNoteCards and slideHasNotes', () => {
  it('leaves blank cards out', () => {
    const s = slide({
      noteCards: [
        { id: 'c1', text: ' ' },
        { id: 'c2', text: 'Two' },
      ],
    });
    expect(spokenNoteCards(s).map((c) => c.id)).toEqual(['c2']);
    expect(slideHasNotes(s)).toBe(true);
    expect(slideHasNotes(slide({ noteCards: [{ id: 'c1', text: '' }] }))).toBe(false);
    expect(slideHasNotes(slide({ notes: 'Old' }))).toBe(true);
  });

  it('calls a card of spaces blank', () => {
    expect(isBlankNoteCard({ id: 'a', text: ' \t\n' })).toBe(true);
    expect(isBlankNoteCard({ id: 'a', text: ' x ' })).toBe(false);
  });
});

describe('withNoteCards', () => {
  it('writes the cards and their mirror, a blank line between, blank cards left out', () => {
    const next = withNoteCards(slide(), [
      { id: 'c1', text: ' One ' },
      { id: 'c2', text: '' },
      { id: 'c3', text: 'Three\nlines' },
    ]);
    expect(next.noteCards).toHaveLength(3);
    expect(next.notes).toBe('One\n\nThree\nlines');
  });

  it('removes both fields when there are no cards, and the mirror while all are blank', () => {
    const before = slide({ noteCards: [{ id: 'c1', text: 'x' }], notes: 'x' });
    const none = withNoteCards(before, []);
    expect(none).not.toHaveProperty('noteCards');
    expect(none).not.toHaveProperty('notes');
    const blank = withNoteCards(before, [{ id: 'c1', text: '  ' }]);
    expect(blank.noteCards).toEqual([{ id: 'c1', text: '  ' }]);
    expect(blank).not.toHaveProperty('notes');
    // A copy: the slide given is untouched.
    expect(before.notes).toBe('x');
  });

  it('joins nothing to an empty script', () => {
    expect(noteCardsText([])).toBe('');
  });
});

describe('newNoteCardId', () => {
  it('counts past the highest c-number and ignores other ids', () => {
    expect(newNoteCardId([])).toBe('c1');
    expect(
      newNoteCardId([
        { id: LEGACY_NOTE_CARD_ID, text: '' },
        { id: 'cz', text: '' },
        { id: 'c3', text: '' },
      ]),
    ).toBe('c10');
  });
});

describe('noteCardSpeakingSeconds', () => {
  it('times the words at a flashcard pace', () => {
    expect(noteCardSpeakingSeconds('')).toBe(0);
    // 130 words is a minute.
    expect(noteCardSpeakingSeconds(Array.from({ length: 130 }, () => 'word').join(' '))).toBe(60);
    expect(noteCardSpeakingSeconds("it's well-known")).toBe(1);
  });
});

describe('parseNoteCards', () => {
  it('drops what is not a card, repeats and anything past the limit', () => {
    expect(parseNoteCards('nope')).toBeUndefined();
    expect(parseNoteCards([])).toBeUndefined();
    expect(
      parseNoteCards([
        { id: 'a', text: 'A' },
        null,
        'x',
        { id: '', text: 'no id' },
        { id: 'b', text: 3 },
        { id: 'a', text: 'again' },
        { id: 'c', text: '' },
      ]),
    ).toEqual([
      { id: 'a', text: 'A' },
      { id: 'c', text: '' },
    ]);
    const many = Array.from({ length: NOTE_CARDS_MAX + 5 }, (_, i) => ({ id: `c${i}`, text: 't' }));
    expect(parseNoteCards(many)).toHaveLength(NOTE_CARDS_MAX);
  });

  it('keeps a stored slide whose cards are unreadable, without them', () => {
    const stored = parseStoredPresentation(
      JSON.stringify({
        decks: [
          {
            slides: [
              { id: 's1', tabId: 't', elementIds: [], noteCards: 'bad', notes: 'kept' },
              { id: 's2', tabId: 't', elementIds: [], noteCards: [{ id: 'c1', text: 'Hi' }] },
              { id: 's3', tabId: 't', elementIds: [] },
            ],
          },
        ],
      }),
    );
    const [s1, s2, s3] = stored!.decks[0]!.slides;
    expect(s1).toEqual({ id: 's1', tabId: 't', elementIds: [], notes: 'kept' });
    expect(s2!.noteCards).toEqual([{ id: 'c1', text: 'Hi' }]);
    expect(s3).not.toHaveProperty('noteCards');
  });
});
