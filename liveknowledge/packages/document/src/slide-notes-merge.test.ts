import { describe, expect, it } from 'vitest';
import type { Slide, StoredPresentation } from './slide-deck';
import { mergeNoteCards, mergePresentationNoteCards } from './slide-notes-merge';
import { NOTE_CARDS_MAX, type NoteCard } from './slide-notes';

// docs/specs/012-collaboration/speaker-note-cards.md "Two people writing at once".

const c = (id: string, text: string): NoteCard => ({ id, text });
const base = [c('a', 'One'), c('b', 'Two'), c('c', 'Three')];
const show = (cards: readonly NoteCard[]) => cards.map((x) => `${x.id}:${x.text}`).join('|');

describe('mergeNoteCards', () => {
  it('keeps both people’s edits to different cards', () => {
    const mine = [c('a', 'One, mine'), c('b', 'Two'), c('c', 'Three')];
    const theirs = [c('a', 'One'), c('b', 'Two, theirs'), c('c', 'Three')];
    expect(show(mergeNoteCards(base, mine, theirs))).toBe('a:One, mine|b:Two, theirs|c:Three');
  });

  it('lets the later save win on the same card', () => {
    const mine = [c('a', 'Mine'), c('b', 'Two'), c('c', 'Three')];
    const theirs = [c('a', 'Theirs'), c('b', 'Two'), c('c', 'Three')];
    expect(show(mergeNoteCards(base, mine, theirs))).toBe('a:Mine|b:Two|c:Three');
  });

  it('places a card the other person added after the card it followed, or first', () => {
    const mine = [c('a', 'One'), c('b', 'Two'), c('c', 'Three'), c('m', 'Mine')];
    const theirs = [
      c('t0', 'First'),
      c('a', 'One'),
      c('t1', 'After one'),
      c('b', 'Two'),
      c('c', 'Three'),
    ];
    expect(show(mergeNoteCards(base, mine, theirs))).toBe(
      't0:First|a:One|t1:After one|b:Two|c:Three|m:Mine',
    );
  });

  it('skips back past a neighbour the result no longer holds', () => {
    // b is removed here and unchanged there, so their new card lands after a.
    const theirs = [c('a', 'One'), c('b', 'Two'), c('t', 'New'), c('c', 'Three')];
    expect(show(mergeNoteCards(base, [c('a', 'One'), c('c', 'Three')], theirs))).toBe(
      'a:One|t:New|c:Three',
    );
  });

  it('removes a card either person removed, unless the other changed it since', () => {
    // I removed b; they left it: gone. They removed c; I left it: gone.
    expect(
      show(mergeNoteCards(base, [c('a', 'One'), c('c', 'Three')], [c('a', 'One'), c('b', 'Two')])),
    ).toBe('a:One');
    // I removed b; they changed it: kept, in its place.
    expect(
      show(
        mergeNoteCards(
          base,
          [c('a', 'One'), c('c', 'Three')],
          [c('a', 'One'), c('b', 'Two!'), c('c', 'Three')],
        ),
      ),
    ).toBe('a:One|b:Two!|c:Three');
    // They removed c; I changed it: mine stays.
    expect(
      show(mergeNoteCards(base, [...base.slice(0, 2), c('c', 'Three!')], base.slice(0, 2))),
    ).toBe('a:One|b:Two|c:Three!');
  });

  it('keeps my order and stays within the card limit', () => {
    expect(show(mergeNoteCards(base, [base[2]!, base[0]!, base[1]!], base))).toBe(
      'c:Three|a:One|b:Two',
    );
    const many = (p: string) => Array.from({ length: NOTE_CARDS_MAX }, (_, i) => c(`${p}${i}`, p));
    expect(mergeNoteCards([], many('m'), many('t'))).toHaveLength(NOTE_CARDS_MAX);
  });

  it('with nothing to build on, keeps every card of both', () => {
    expect(show(mergeNoteCards([], [c('m', 'Mine')], [c('t', 'Theirs')]))).toBe('t:Theirs|m:Mine');
  });
});

const slide = (id: string, cards?: NoteCard[], extra: Partial<Slide> = {}): Slide => ({
  id,
  tabId: 'tab',
  elementIds: [],
  ...(cards ? { noteCards: cards } : {}),
  ...extra,
});
const deck = (...slides: Slide[]): StoredPresentation => ({ decks: [{ slides }] });

describe('mergePresentationNoteCards', () => {
  it('merges each slide’s cards, keeps the notes mirror, and the rest of the deck as mine', () => {
    const was = deck(slide('s1', base), slide('s2', [c('x', 'X')]));
    const mine = deck(
      slide('s1', [c('a', 'One, mine'), c('b', 'Two'), c('c', 'Three')], { name: 'Renamed' }),
      slide('s2', [c('x', 'X')]),
    );
    const theirs = deck(
      slide('s1', [c('a', 'One'), c('b', 'Two, theirs'), c('c', 'Three')]),
      slide('s2', [c('x', 'X')]),
    );
    const out = mergePresentationNoteCards(mine, was, theirs);
    const [s1, s2] = out.decks[0]!.slides;
    expect(show(s1!.noteCards!)).toBe('a:One, mine|b:Two, theirs|c:Three');
    expect(s1!.notes).toBe('One, mine\n\nTwo, theirs\n\nThree');
    expect(s1!.name).toBe('Renamed');
    // Nothing to merge: the very same slide.
    expect(s2).toBe(mine.decks[0]!.slides[1]);
  });

  it('reads an old notes slide as its one card', () => {
    const was = deck(slide('s1', undefined, { notes: 'Old' }));
    const mine = deck(slide('s1', undefined, { notes: 'Old' }));
    const theirs = deck(slide('s1', [c('notes', 'Old'), c('t', 'New')]));
    expect(
      show(mergePresentationNoteCards(mine, was, theirs).decks[0]!.slides[0]!.noteCards!),
    ).toBe('notes:Old|t:New');
  });

  it('writes mine as it is with no stored deck, and a slide the store lacks as mine', () => {
    const mine = deck(slide('s1', base));
    expect(mergePresentationNoteCards(mine, null, null)).toBe(mine);
    const out = mergePresentationNoteCards(mine, null, { decks: [] });
    expect(out.decks[0]!.slides[0]).toBe(mine.decks[0]!.slides[0]);
  });

  it('builds on an empty base when there was none', () => {
    const mine = deck(slide('s1', [c('m', 'Mine')]));
    const theirs = deck(slide('s1', [c('t', 'Theirs')]));
    expect(
      show(mergePresentationNoteCards(mine, null, theirs).decks[0]!.slides[0]!.noteCards!),
    ).toBe('t:Theirs|m:Mine');
  });
});
