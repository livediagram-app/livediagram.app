import { describe, expect, it } from 'vitest';
import {
  layOutIllustratePages,
  newSlidePage,
  pageMargin,
  SLIDE_PAGE_SIZE_IDS,
  type Element,
} from '@livediagram/document';
import {
  layoutCatalogueFor,
  PAGE_LAYOUT_CATEGORIES,
  PAGE_LAYOUTS,
  pageLayoutById,
  SLIDE_LAYOUT_CATEGORIES,
  SLIDE_LAYOUTS,
} from '@livediagram/templates';
import { buildPageLayout } from '@livediagram/templates';

// docs/specs/007-editor/illustrate-pages.md "Slide layouts": a slide page's own catalogue, every
// layout fitting a 16:9 and a 4:3 slide inside its margins.
describe('slide layouts', () => {
  it('are the seventeen of the spec, by category, each unique', () => {
    expect(SLIDE_LAYOUTS.map((l) => [l.category, l.id])).toEqual([
      ['slide-openers', 'slide-title'],
      ['slide-openers', 'slide-section'],
      ['slide-openers', 'agenda'],
      ['slide-content', 'slide-bullets'],
      ['slide-content', 'slide-two-columns'],
      ['slide-content', 'slide-image-text'],
      ['slide-content', 'slide-statement'],
      ['slide-content', 'quote'],
      ['slide-data', 'big-number'],
      ['slide-data', 'key-stats'],
      ['slide-data', 'chart-story'],
      ['slide-data', 'comparison'],
      ['slide-steps', 'process'],
      ['slide-steps', 'timeline'],
      ['slide-steps', 'roadmap'],
      ['slide-closers', 'slide-closing'],
      ['slide-closers', 'team'],
    ]);
    expect(SLIDE_LAYOUT_CATEGORIES.map((c) => c.label)).toEqual([
      'Openers',
      'Content',
      'Data',
      'Steps and Time',
      'Closers',
    ]);
  });

  it('reuse an infographic layout as the very same build', () => {
    for (const l of SLIDE_LAYOUTS) {
      const original = PAGE_LAYOUTS.find((p) => p.id === l.id);
      if (original) expect(l.build).toBe(original.build);
    }
  });

  it('are what a slide page offers; every other kind gets the infographic layouts', () => {
    expect(layoutCatalogueFor('slide')).toEqual({
      categories: SLIDE_LAYOUT_CATEGORIES,
      layouts: SLIDE_LAYOUTS,
    });
    expect(layoutCatalogueFor('infographic')).toEqual({
      categories: PAGE_LAYOUT_CATEGORIES,
      layouts: PAGE_LAYOUTS,
    });
    expect(layoutCatalogueFor('article').layouts).toBe(PAGE_LAYOUTS);
  });

  it('are found by id, a slide-only one too', () => {
    expect(pageLayoutById('slide-bullets').label).toBe('Title and Bullets');
    expect(pageLayoutById('quote').label).toBe('Quote');
  });

  const boxes = (els: Element[]) =>
    els.flatMap((el) =>
      el.type === 'arrow' ? [] : [{ x: el.x, y: el.y, r: el.x + el.width, b: el.y + el.height }],
    );
  for (const size of SLIDE_PAGE_SIZE_IDS) {
    const [page] = layOutIllustratePages([newSlidePage('s', size)]);
    const m = pageMargin(page!);
    const box = {
      x: page!.rect.x + m,
      y: page!.rect.y + m,
      width: page!.rect.width - 2 * m,
      height: page!.rect.height - 2 * m,
    };
    for (const layout of SLIDE_LAYOUTS) {
      it(`${layout.id} fits a ${size} slide`, () => {
        const els = buildPageLayout(layout.id, page!);
        expect(els.length).toBeGreaterThan(2);
        expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
        for (const b of boxes(els)) {
          expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
          expect(b.y).toBeGreaterThanOrEqual(box.y - 1);
          expect(b.r).toBeLessThanOrEqual(box.x + box.width + 1);
          expect(b.b).toBeLessThanOrEqual(box.y + box.height + 1);
          expect(b.r - b.x).toBeGreaterThan(0);
          expect(b.b - b.y).toBeGreaterThan(0);
        }
      });
    }
  }
});
