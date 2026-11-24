import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  clearPageDesignCache,
  layOutPages,
  pageDesignCacheSize,
  type Element,
  type Page,
} from '@livedocuments/document';
import { pageDesignViews } from './page-design-views';

// docs/specs/011-theme/page-designs.md "Performance": a fifty-slide deck draws its design once, shares it, keeps a
// page's view while nothing it reads changes, and stays within a CPU budget even flowing across every page.
const row = layOutPages(
  Array.from({ length: 50 }, (_, i): Page => ({
    id: `s${i}`,
    orientation: 'landscape',
    size: 'slide',
    kind: 'slide',
  })),
);
const elements = row.map(
  (p, i) =>
    ({
      id: `t${i}`,
      type: 'text',
      x: p.rect.x + 120,
      y: p.rect.y + 140,
      width: 1200,
      height: 120,
      label: 'A slide title',
    }) as unknown as Element,
);
const input = (tabDesign: {
  id: 'aurora' | 'topographic';
  flow?: true;
  animate?: true;
  scale?: number;
}) => ({
  tabDesign,
  pages: row,
  row,
  elements,
  theme: { elementStroke: '#2563eb' },
  paperDark: false,
  tabFont: undefined,
});

describe('a fifty-page deck’s designs', () => {
  it('draws one design for every page and keeps each page’s view while nothing changes', () => {
    clearPageDesignCache();
    const first = pageDesignViews(input({ id: 'aurora', animate: true }));
    expect(first.size).toBe(50);
    // The title page and the rest share a drawing (rhythm is off): one paint.
    expect(pageDesignCacheSize()).toBe(1);
    const again = pageDesignViews(input({ id: 'aurora', animate: true }));
    expect(again.get('s7')).toBe(first.get('s7'));
  });

  it('stays within its CPU budget, cold and flowing across every page', () => {
    const cold = () => {
      clearPageDesignCache();
      pageDesignViews(input({ id: 'aurora', animate: true }));
    };
    const flowing = () => {
      clearPageDesignCache();
      pageDesignViews(input({ id: 'topographic', flow: true }));
    };
    cold();
    flowing();
    let best = Infinity;
    let bestFlow = Infinity;
    for (let r = 0; r < 3; r += 1) {
      best = Math.min(best, cpuMsOf(cold));
      bestFlow = Math.min(bestFlow, cpuMsOf(flowing));
    }
    // Measured on an M-series laptop: about 1 ms cold and 75 ms flowing (fifty strips); the budgets leave CI room.
    expect(best).toBeLessThan(cpuBudgetMs(20));
    expect(bestFlow).toBeLessThan(cpuBudgetMs(250));
  });

  it('redraws only the pages on screen while a Fine Tune control moves a flowing design', () => {
    clearPageDesignCache();
    const before = pageDesignViews(input({ id: 'topographic', flow: true }));
    const redraw = new Set(['s0', 's1', 's2']);
    const during = pageDesignViews({
      ...input({ id: 'topographic', flow: true, scale: 1.4 }),
      redraw,
    });
    // The three on screen draw anew; the other forty-seven keep their drawing until the gesture settles.
    for (const id of redraw) expect(during.get(id)).not.toBe(before.get(id));
    expect(during.get('s30')).toBe(before.get('s30'));
    expect(during.size).toBe(50);
    const settled = pageDesignViews(input({ id: 'topographic', flow: true, scale: 1.4 }));
    expect(settled.get('s30')).not.toBe(before.get('s30'));
    expect(settled.get('s0')).toBe(during.get('s0'));
  });

  it('keeps a flowing fifty-page tick within its budget', () => {
    let scale = 1;
    const tick = () => {
      scale = scale >= 1.9 ? 1 : scale + 0.05;
      pageDesignViews({
        ...input({ id: 'topographic', flow: true, scale }),
        redraw: new Set(['s0', 's1', 's2']),
      });
    };
    clearPageDesignCache();
    pageDesignViews(input({ id: 'topographic', flow: true }));
    tick();
    let best = Infinity;
    for (let r = 0; r < 5; r += 1) best = Math.min(best, cpuMsOf(tick));
    // Measured on an M-series laptop: under 5 ms a tick for three pages on screen (was about 75 ms redrawing all fifty).
    expect(best).toBeLessThan(cpuBudgetMs(25));
  });
});
