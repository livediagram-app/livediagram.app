import { describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livediagram/document';
import { layoutCardShows, type LayoutCardContext } from './page-layout-card';

const page = (over: Partial<LaidOutPage> = {}) =>
  ({
    id: 'p1',
    kind: 'infographic',
    rect: { x: 0, y: 0, width: 1200, height: 900 },
    ...over,
  }) as LaidOutPage;
const ok: LayoutCardContext = {
  editable: true,
  placing: false,
  contentCount: 0,
  offersKind: false,
  panelOpen: false,
  hidden: false,
  zoom: 1,
};

describe('layoutCardShows', () => {
  it('shows on an empty infographic page someone may edit', () => {
    expect(layoutCardShows(page(), ok)).toBe(true);
  });

  it('steps aside while a palette tile is armed, so the element can be placed on the page', () => {
    expect(layoutCardShows(page(), { ...ok, placing: true })).toBe(false);
  });

  it('never shows on a page with content, read-only, hidden, under its panel or offering its kind', () => {
    for (const c of [
      { contentCount: 1 },
      { editable: false },
      { hidden: true },
      { panelOpen: true },
      { offersKind: true },
    ])
      expect(layoutCardShows(page(), { ...ok, ...c }), JSON.stringify(c)).toBe(false);
  });

  it('never shows on an article, a locked or blank-started page, or one too small on screen', () => {
    expect(layoutCardShows(page({ kind: 'article' }), ok)).toBe(false);
    expect(layoutCardShows(page({ locked: true }), ok)).toBe(false);
    expect(layoutCardShows(page({ startedBlank: true }), ok)).toBe(false);
    expect(layoutCardShows(page(), { ...ok, zoom: 0.2 })).toBe(false);
  });
});
