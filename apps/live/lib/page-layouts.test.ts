import { describe, expect, it } from 'vitest';
import {
  layOutIllustratePages,
  pageMargin,
  PAGE_ORIENTATIONS,
  PAGE_SIZE_IDS,
  type Element,
} from '@livediagram/document';
import { PAGE_LAYOUT_CATEGORIES, PAGE_LAYOUTS } from '@livediagram/templates';

// docs/specs/007-editor/illustrate-pages.md "Layouts": every layout fits inside the page's
// margins at every size and orientation, and is a complete starting point.
const boxes = (els: Element[]) =>
  els.flatMap((el) =>
    el.type === 'arrow' ? [] : [{ x: el.x, y: el.y, r: el.x + el.width, b: el.y + el.height }],
  );

describe('page layouts', () => {
  it('are the twenty-one of the spec, each unique', () => {
    expect(PAGE_LAYOUTS.map((l) => l.id)).toEqual([
      'title',
      'big-number',
      'key-stats',
      'process',
      'timeline',
      'comparison',
      'chart-story',
      'top-tips',
      'quote',
      'team',
      'facts-grid',
      'checklist',
      'event',
      'section-divider',
      'poster',
      'survey-results',
      'progress-report',
      'roadmap',
      'agenda',
      'questions',
      'profile',
    ]);
  });

  it('each sit in one of the picker categories, every category used', () => {
    const ids = new Set(PAGE_LAYOUT_CATEGORIES.map((c) => c.id));
    for (const l of PAGE_LAYOUTS) expect(ids.has(l.category)).toBe(true);
    for (const c of PAGE_LAYOUT_CATEGORIES) {
      expect(PAGE_LAYOUTS.some((l) => l.category === c.id)).toBe(true);
    }
  });

  for (const size of PAGE_SIZE_IDS) {
    for (const orientation of PAGE_ORIENTATIONS) {
      const [page] = layOutIllustratePages([{ id: 'p', orientation, size }]);
      const m = pageMargin(page!);
      const box = {
        x: page!.rect.x + m,
        y: page!.rect.y + m,
        width: page!.rect.width - 2 * m,
        height: page!.rect.height - 2 * m,
      };
      for (const layout of PAGE_LAYOUTS) {
        it(`${layout.id} fits a ${size} ${orientation} page`, () => {
          const els = layout.build(box);
          expect(els.length).toBeGreaterThan(2);
          expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
          // Arrows only ever join two of the layout's own elements.
          const ids = new Set(els.map((e) => e.id));
          for (const el of els) {
            if (el.type !== 'arrow') continue;
            for (const end of [el.from, el.to]) {
              expect(end.kind === 'pinned' && ids.has(end.elementId)).toBe(true);
            }
          }
          for (const b of boxes(els)) {
            // Rounded to whole px: a pixel of slack.
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
  }
});
