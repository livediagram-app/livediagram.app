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
import { isIconId } from '@livediagram/icons/search';

// docs/specs/007-editor/illustrate-pages.md "Slide layouts": a slide page's own catalogue, every
// layout fitting a 16:9 and a 4:3 slide inside its margins.
describe('slide layouts', () => {
  it('are the forty-six of the spec, at least nine to a category, each unique', () => {
    expect(SLIDE_LAYOUTS).toHaveLength(46);
    expect(new Set(SLIDE_LAYOUTS.map((l) => l.id)).size).toBe(SLIDE_LAYOUTS.length);
    for (const c of SLIDE_LAYOUT_CATEGORIES) {
      expect(
        SLIDE_LAYOUTS.filter((l) => l.category === c.id).length,
        c.label,
      ).toBeGreaterThanOrEqual(9);
    }
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
        // Every icon is one the catalogue draws.
        for (const el of els) {
          if (el.type === 'shape' && el.shape === 'icon')
            expect(isIconId(el.iconId!), el.iconId).toBe(true);
        }
        // No two text boxes overlap: each line has its own room.
        const texts = els.filter((e) => e.type === 'text');
        for (let a = 0; a < texts.length; a += 1) {
          for (let c = a + 1; c < texts.length; c += 1) {
            const p = texts[a]!;
            const q = texts[c]!;
            const overlap =
              Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x) > 1 &&
              Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y) > 1;
            expect(overlap, `${p.label} / ${q.label}`).toBe(false);
          }
        }
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
