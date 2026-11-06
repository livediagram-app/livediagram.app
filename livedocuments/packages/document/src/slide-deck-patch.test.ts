import { describe, expect, it } from 'vitest';
import { applyDeckSlidePatch, deckSlidePatch, parseDeckSlidePatch } from './slide-deck-patch';
import type { Slide, StoredPresentation } from './slide-deck';
import { withNoteCards, type NoteCard } from './slide-notes';

// docs/specs/012-collaboration/speaker-note-cards.md "Saving": a large deck's unload save sends only the slides this
// editor changed, and the server merges each into the stored deck card by card.

const slide = (id: string, cards: NoteCard[] = [], extra: Partial<Slide> = {}): Slide =>
  withNoteCards({ id, tabId: 't', elementIds: [], ...extra }, cards);
const deck = (...slides: Slide[]): StoredPresentation => ({ decks: [{ slides }] });
const card = (id: string, text: string): NoteCard => ({ id, text });

describe('deckSlidePatch', () => {
  const base = deck(slide('s1', [card('a', 'One')]), slide('s2'), slide('s3'));

  it('takes the changed slides, each with its base cards and the slide before it', () => {
    const mine = deck(
      slide('s1', [card('a', 'One more')]),
      slide('s2'),
      slide('s3', [], { hidden: true }),
    );
    expect(deckSlidePatch(mine, base)).toEqual({
      slides: [
        { slide: mine.decks[0]!.slides[0], baseCards: [card('a', 'One')], after: null },
        { slide: mine.decks[0]!.slides[2], baseCards: [], after: 's2' },
      ],
    });
  });

  it('has nothing to say when nothing changed, or when either deck is missing', () => {
    expect(deckSlidePatch(base, base)).toBeNull();
    expect(deckSlidePatch(null, base)).toBeNull();
    expect(deckSlidePatch(base, null)).toBeNull();
  });

  it('cannot say a slide added, removed or moved, or a second deck', () => {
    const [s1, s2, s3] = base.decks[0]!.slides as [Slide, Slide, Slide];
    expect(deckSlidePatch(deck(s1, s2, s3, slide('s4')), base)).toBeNull();
    expect(deckSlidePatch(deck(s1, s2), base)).toBeNull();
    expect(deckSlidePatch(deck(s2, s1, s3), base)).toBeNull();
    expect(deckSlidePatch({ decks: [...base.decks, ...base.decks] }, base)).toBeNull();
    expect(deckSlidePatch({ decks: [] }, base)).toBeNull();
  });
});

describe('parseDeckSlidePatch', () => {
  const entry = {
    slide: slide('s1', [card('a', 'One')]),
    baseCards: [card('a', 'On')],
    after: null,
  };

  it('reads a patch, cleaning its cards as the deck parse does', () => {
    expect(parseDeckSlidePatch({ slides: [entry] })).toEqual({ slides: [entry] });
    expect(
      parseDeckSlidePatch({ slides: [{ ...entry, baseCards: [{ id: 1 }], after: 's0' }] }),
    ).toEqual({ slides: [{ ...entry, baseCards: [], after: 's0' }] });
  });

  it('refuses the whole patch when any part is not one', () => {
    for (const bad of [
      null,
      'x',
      {},
      { slides: [] },
      { slides: [null] },
      { slides: [{ ...entry, slide: { id: 's1' } }] },
      { slides: [{ ...entry, baseCards: 'a' }] },
      { slides: [{ ...entry, after: '' }] },
      { slides: [{ ...entry, after: 3 }] },
      { slides: [entry, entry] },
    ]) {
      expect(parseDeckSlidePatch(bad)).toBeNull();
    }
  });
});

describe('applyDeckSlidePatch', () => {
  it('merges each patched slide by card and leaves the rest as stored', () => {
    // The base had card a; this editor changed it, and someone else added card b meanwhile and renamed slide 2.
    const stored = deck(
      slide('s1', [card('a', 'One'), card('b', 'Theirs')]),
      slide('s2', [], { name: 'Kept' }),
    );
    const out = applyDeckSlidePatch(stored, {
      slides: [
        { slide: slide('s1', [card('a', 'Mine')]), baseCards: [card('a', 'One')], after: null },
      ],
    });
    expect(out).toEqual(
      deck(
        slide('s1', [card('a', 'Mine'), card('b', 'Theirs')]),
        slide('s2', [], { name: 'Kept' }),
      ),
    );
  });

  it('keeps a slide whose cards merge to its own as sent', () => {
    const mine = slide('s1', [card('a', 'Mine')], { name: 'Intro' });
    const out = applyDeckSlidePatch(deck(slide('s1', [card('a', 'One')])), {
      slides: [{ slide: mine, baseCards: [card('a', 'One')], after: null }],
    });
    expect(out.decks[0]!.slides[0]).toBe(mine);
  });

  it('puts back a slide the stored deck lost after the slide before it, else first', () => {
    const stored = deck(slide('s1'), slide('s3'));
    const lost = slide('s2', [card('a', 'Mine')]);
    expect(
      applyDeckSlidePatch(stored, { slides: [{ slide: lost, baseCards: [], after: 's1' }] }),
    ).toEqual(deck(slide('s1'), lost, slide('s3')));
    expect(
      applyDeckSlidePatch(stored, { slides: [{ slide: lost, baseCards: [], after: 'gone' }] }),
    ).toEqual(deck(lost, slide('s1'), slide('s3')));
    expect(
      applyDeckSlidePatch(stored, { slides: [{ slide: lost, baseCards: [], after: null }] }),
    ).toEqual(deck(lost, slide('s1'), slide('s3')));
  });

  it('starts a deck when none is stored, and leaves other decks alone', () => {
    const s = slide('s1', [card('a', 'Mine')]);
    const patch = { slides: [{ slide: s, baseCards: [], after: null }] };
    expect(applyDeckSlidePatch(null, patch)).toEqual(deck(s));
    expect(applyDeckSlidePatch({ decks: [] }, patch)).toEqual(deck(s));
    const second = { slides: [slide('x')] };
    expect(applyDeckSlidePatch({ decks: [{ slides: [] }, second] }, patch).decks[1]).toBe(second);
  });
});
