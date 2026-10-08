import { describe, expect, it, vi } from 'vitest';
import type { Deck } from '@livediagram/document';
import { slideFitOptions } from './presentation-config';
import { pageDeckControls } from './page-deck-controls';

// docs/specs/007-editor/illustrate-pages.md "Slides": a slide page's deck button, and a page slide
// presenting full screen.
const deck: Deck = {
  slides: [
    { id: 's1', tabId: 't', elementIds: [], pageId: 'p1' },
    { id: 's2', tabId: 't', elementIds: [], pageId: 'p2', hidden: true },
    { id: 's3', tabId: 'other', elementIds: [], pageId: 'p3' },
  ],
};

describe('pageDeckControls', () => {
  const verbs = { newPageSlide: vi.fn(), toggleSlideHidden: vi.fn() };

  it('is absent for someone who cannot change the deck', () => {
    expect(pageDeckControls(deck, 't', false, verbs)).toBeUndefined();
  });

  it("finds this tab's slide of a page, hidden or not", () => {
    const c = pageDeckControls(deck, 't', true, verbs)!;
    expect(c.slideOf('p1')).toEqual({ id: 's1', hidden: false });
    expect(c.slideOf('p2')).toEqual({ id: 's2', hidden: true });
    // Another tab's page of the same id is not this page.
    expect(c.slideOf('p3')).toBeUndefined();
  });

  it('adds through the deck and toggles through it', () => {
    const c = pageDeckControls(deck, 't', true, verbs)!;
    c.add('p9');
    c.toggleHidden('s1');
    expect(verbs.newPageSlide).toHaveBeenCalledWith('p9');
    expect(verbs.toggleSlideHidden).toHaveBeenCalledWith('s1');
  });
});

describe('slideFitOptions', () => {
  const config = { zoom: 'fill' } as Parameters<typeof slideFitOptions>[1];
  it('fits a page slide with no margin, any other with the usual one', () => {
    expect(slideFitOptions({ pageId: 'p1' }, config)).toEqual({ maxZoom: 2.5, padding: 0 });
    expect(slideFitOptions({}, config)).toEqual({ maxZoom: 2.5 });
  });
});
