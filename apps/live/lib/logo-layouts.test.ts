import { describe, expect, it } from 'vitest';
import {
  hasWordmarkType,
  layOutIllustratePages,
  newLogoPage,
  pageMargin,
  type Element,
} from '@livediagram/document';
import {
  layoutCatalogueFor,
  LOGO_LAYOUT_CATEGORIES,
  LOGO_LAYOUTS,
  pageLayoutById,
} from '@livediagram/templates';
import { buildPageLayout } from './page-layout-build';

// docs/specs/007-editor/logo-pages.md "Logo layouts": a logo page's own catalogue, each a mark
// fitting the artboard's safe area, its name in wordmark type.
describe('logo layouts', () => {
  it('are the twenty-five of the spec, by category, each unique', () => {
    expect(LOGO_LAYOUTS).toHaveLength(25);
    expect(new Set(LOGO_LAYOUTS.map((l) => l.id)).size).toBe(25);
    const count = (c: string) => LOGO_LAYOUTS.filter((l) => l.category === c).length;
    expect([
      count('logo-lockups'),
      count('logo-wordmarks'),
      count('logo-emblems'),
      count('logo-marks'),
    ]).toEqual([7, 6, 6, 6]);
    expect(LOGO_LAYOUT_CATEGORIES.map((c) => c.label)).toEqual([
      'Lockups',
      'Wordmarks',
      'Emblems',
      'Marks',
    ]);
  });

  it('are what a logo page offers, and found by id', () => {
    expect(layoutCatalogueFor('logo')).toEqual({
      categories: LOGO_LAYOUT_CATEGORIES,
      layouts: LOGO_LAYOUTS,
    });
    expect(pageLayoutById('logo-badge').label).toBe('Badge');
  });

  const [page] = layOutIllustratePages([newLogoPage('l')]);
  const m = pageMargin(page!);
  const safe = {
    x: page!.rect.x + m,
    y: page!.rect.y + m,
    r: page!.rect.x + page!.rect.width - m,
    b: page!.rect.y + page!.rect.height - m,
  };
  const boxed = (els: Element[]) => els.flatMap((el) => (el.type === 'arrow' ? [] : [el]));

  for (const layout of LOGO_LAYOUTS) {
    it(`${layout.id} fits the safe area, its words in wordmark type`, () => {
      const els = boxed(buildPageLayout(layout.id, page!));
      expect(els.length).toBeGreaterThanOrEqual(2);
      expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
      for (const el of els) {
        expect(el.x).toBeGreaterThanOrEqual(safe.x - 1);
        expect(el.y).toBeGreaterThanOrEqual(safe.y - 1);
        expect(el.x + el.width).toBeLessThanOrEqual(safe.r + 1);
        expect(el.y + el.height).toBeLessThanOrEqual(safe.b + 1);
        expect(el.width).toBeGreaterThan(0);
        expect(el.height).toBeGreaterThan(0);
      }
      // Every name, word and tagline is wordmark type; a mark alone may have none.
      const texts = els.filter((e) => e.type === 'text');
      if (layout.category !== 'logo-marks') expect(texts.length).toBeGreaterThan(0);
      expect(texts.every((t) => t.type === 'text' && hasWordmarkType(t))).toBe(true);
    });
  }

  it('arch the badge name over the top and its tagline under the bottom', () => {
    const els = boxed(buildPageLayout('logo-badge', page!));
    const arcs = els.flatMap((e) => (e.type === 'text' && e.textArc ? [e.textArc] : []));
    expect(arcs).toEqual([180, -180]);
  });
});
