import { describe, expect, it } from 'vitest';
import {
  illustratePagesOf,
  layOutIllustratePages,
  newSlidePage,
  pageDimensions,
  pageHasOrientation,
  pageKindOf,
  pageLabel,
  pageSizeLabel,
  pageSizesFor,
  SLIDE_PAGE_SIZE_IDS,
} from './illustrate-page';

// docs/specs/007-editor/illustrate-pages.md "Page kinds", "A page", "Sizes": a slide page is
// always landscape, in a slide size.
describe('slide pages', () => {
  it('are made landscape in 16:9 unless a slide size is given', () => {
    expect(newSlidePage('s')).toEqual({
      id: 's',
      orientation: 'landscape',
      size: 'slide',
      kind: 'slide',
    });
    expect(newSlidePage('s', 'slide-classic').size).toBe('slide-classic');
    expect(newSlidePage('s', 'a4').size).toBe('slide');
  });

  it('are read landscape in a slide size, whatever was stored, and never carry a flow', () => {
    const [p] = illustratePagesOf({
      pages: [{ id: 's', orientation: 'portrait', size: 'a4', kind: 'slide', flow: 'f' }],
    });
    expect(p).toEqual({ id: 's', orientation: 'landscape', size: 'slide', kind: 'slide' });
    const [q] = illustratePagesOf({
      pages: [
        { id: 's', orientation: 'landscape', size: 'slide-classic', kind: 'slide', name: 'Q' },
      ],
    });
    expect(q).toMatchObject({ size: 'slide-classic', name: 'Q', kind: 'slide' });
    expect(pageKindOf(q!)).toBe('slide');
  });

  it('draw a slide size landscape even when the page says portrait, with no turn offered', () => {
    for (const size of SLIDE_PAGE_SIZE_IDS) {
      expect(pageHasOrientation({ size })).toBe(false);
      const d = pageDimensions({ size, orientation: 'portrait' });
      expect(d.width).toBeGreaterThan(d.height);
    }
    expect(pageDimensions({ size: 'slide', orientation: 'portrait' })).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(pageDimensions({ size: 'slide-classic', orientation: 'landscape' })).toEqual({
      width: 1440,
      height: 1080,
    });
    expect(pageSizeLabel({ size: 'slide', orientation: 'portrait' })).toBe('Slide (16:9)');
    // An infographic page in the slide size keeps its own orientation for a turn back.
    const [laid] = layOutIllustratePages([{ id: 'p', orientation: 'portrait', size: 'slide' }]);
    expect(laid!.rect.width).toBe(1920);
  });

  it('offer only the slide sizes; an infographic page adds the 16:9 slide to the rest', () => {
    expect(pageSizesFor('slide')).toEqual(['slide', 'slide-classic']);
    expect(pageSizesFor('article')).toEqual(['a4', 'letter', 'a3', 'square', 'social', 'wide']);
    expect(pageSizesFor('infographic')).toEqual([
      'a4',
      'letter',
      'a3',
      'square',
      'social',
      'wide',
      'slide',
    ]);
  });

  it('are labelled as slides', () => {
    expect(pageLabel(newSlidePage('s'), 0, 1)).toBe('Slide (16:9) · Slide');
    expect(pageLabel({ ...newSlidePage('s', 'slide-classic'), name: 'Intro' }, 1, 3)).toBe(
      'Intro · Classic slide (4:3) · Slide',
    );
  });
});
