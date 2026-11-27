import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  newSlidePage,
  SLIDE_PAGE_SIZE_IDS,
  type Element,
  type Page,
} from '@livedocuments/document';
import { buildPageLayout, PAGE_LAYOUTS, SLIDE_LAYOUTS } from '@livedocuments/templates';

// docs/specs/007-editor/pages-mode.md "Layouts", "No stray bars" (Work Tracker 1481): no layout draws a short
// word-less accent bar. A line stays only where it does a job, and those are long (a divider, a header rule, a
// track) or a hairline; a bar thicker than a hairline and shorter than this share of the page's short side is an
// accent rule, which no layout carries.
const ACCENT_BAR_MAX_SHARE = 0.18;

function accentBars(els: readonly Element[], shortSide: number): string[] {
  return els.flatMap((el) => {
    if (el.type !== 'shape' || (el.shape !== 'square' && el.shape !== 'banner')) return [];
    if (el.label) return [];
    const across = el.width > el.height;
    const short = el.width < shortSide * ACCENT_BAR_MAX_SHARE;
    const thin = el.height <= shortSide * 0.025;
    return across && short && thin && el.height > 1 ? [`${el.width}x${el.height}`] : [];
  });
}

const a4: Page = { id: 'p', orientation: 'portrait', size: 'a4', kind: 'infographic' };

describe('layouts draw no stray accent bars', () => {
  it('on an A4 page, every infographic layout', () => {
    const [page] = layOutPages([a4]);
    const short = Math.min(page!.rect.width, page!.rect.height);
    const found = PAGE_LAYOUTS.flatMap((l) =>
      accentBars(buildPageLayout(l.id, page!), short).map((b) => `${l.id} ${b}`),
    );
    expect(found).toEqual([]);
  });

  it('on every slide size, every slide layout', () => {
    for (const size of SLIDE_PAGE_SIZE_IDS) {
      const [page] = layOutPages([newSlidePage('s', size)]);
      const short = Math.min(page!.rect.width, page!.rect.height);
      const found = SLIDE_LAYOUTS.flatMap((l) =>
        accentBars(buildPageLayout(l.id, page!), short).map((b) => `${l.id} ${b}`),
      );
      expect(found, size).toEqual([]);
    }
  });

  it('would catch one: the bar the Title Page used to draw under its headline', () => {
    const bar = {
      id: 'r',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 95,
      height: 8,
      label: '',
    };
    const words = { ...bar, id: 'w', label: 'Pill' };
    const hairline = { ...bar, id: 'h', height: 1 };
    const divider = { ...bar, id: 'd', width: 400 };
    const down = { ...bar, id: 'v', width: 8, height: 95 };
    expect(accentBars([bar, words, hairline, divider, down] as Element[], 794)).toEqual(['95x8']);
  });
});
