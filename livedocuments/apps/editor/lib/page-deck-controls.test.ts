import { describe, expect, it, vi } from 'vitest';
import type { Deck } from '@livedocuments/document';
import { slideFitOptions } from './presentation-config';
import { pageDeckControls } from './page-deck-controls';

// docs/specs/007-editor/pages-mode.md "Slides": a page's place in the deck, and a page slide
// presenting full screen.
const deck: Deck = {
  slides: [
    { id: 's1', tabId: 't', elementIds: [], pageId: 'p1' },
    { id: 's2', tabId: 't', elementIds: [], pageId: 'p2', hidden: true, notes: 'Old note' },
    { id: 's3', tabId: 'other', elementIds: [], pageId: 'p3' },
  ],
};

describe('pageDeckControls', () => {
  const verbs = { newPageSlide: vi.fn(), toggleSlideHidden: vi.fn(), setSlideNoteCards: vi.fn() };

  it('is absent for someone who cannot change the deck', () => {
    expect(pageDeckControls(deck, 't', false, verbs)).toBeUndefined();
  });

  it("finds this tab's slide of a page, hidden or not", () => {
    const c = pageDeckControls(deck, 't', true, verbs)!;
    expect(c.slideOf('p1')).toEqual({ id: 's1', hidden: false, noteCards: [] });
    // A note written before note cards reads as one card (docs/specs/012-collaboration/speaker-note-cards.md).
    expect(c.slideOf('p2')).toEqual({
      id: 's2',
      hidden: true,
      noteCards: [{ id: 'notes', text: 'Old note' }],
    });
    // Another tab's page of the same id is not this page.
    expect(c.slideOf('p3')).toBeUndefined();
  });

  it('adds through the deck and toggles through it', () => {
    const c = pageDeckControls(deck, 't', true, verbs)!;
    c.add('p9');
    c.toggleHidden('s1');
    expect(verbs.newPageSlide).toHaveBeenCalledWith('p9');
    expect(verbs.toggleSlideHidden).toHaveBeenCalledWith('s1');
    const cards = [{ id: 'c1', text: 'Say hello' }];
    c.setNoteCards('s1', cards);
    expect(verbs.setSlideNoteCards).toHaveBeenCalledWith('s1', cards);
  });
});

describe('slideFitOptions', () => {
  const config = { zoom: 'fill' } as Parameters<typeof slideFitOptions>[1];
  it('fits a page slide with no margin, any other with the usual one', () => {
    expect(slideFitOptions({ pageId: 'p1' }, config)).toEqual({ maxZoom: 2.5, padding: 0 });
    expect(slideFitOptions({}, config)).toEqual({ maxZoom: 2.5 });
  });
});
