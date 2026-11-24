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
const input = (tabDesign: { id: 'aurora' | 'topographic'; flow?: true; animate?: true }) => ({
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
});
