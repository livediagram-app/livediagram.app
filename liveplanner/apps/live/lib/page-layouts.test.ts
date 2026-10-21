import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  pageMargin,
  PAGE_ORIENTATIONS,
  PAGE_SIZE_IDS,
  type Element,
} from '@liveplanner/document';
import { PAGE_LAYOUT_CATEGORIES, PAGE_LAYOUTS } from '@liveplanner/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": every layout fits inside the page's
// margins at every size and orientation, and is a complete starting point.
const boxes = (els: Element[]) =>
  els.flatMap((el) =>
    el.type === 'arrow' ? [] : [{ x: el.x, y: el.y, r: el.x + el.width, b: el.y + el.height }],
  );

// The ninety-two of the spec, by category in the picker's order.
const BY_CATEGORY: Record<string, string[]> = {
  covers: [
    'title',
    'quote',
    'event',
    'section-divider',
    'report-cover',
    'magazine-cover',
    'book-cover',
    'proposal-cover',
    'case-study-cover',
    'newsletter-front',
    'contents',
    'certificate',
  ],
  posters: [
    'poster',
    'gig-poster',
    'research-poster',
    'coming-soon',
    'exhibition',
    'travel-poster',
    'workshop',
    'hiring',
    'big-sale',
    'notice',
    'motivational',
  ],
  data: [
    'big-number',
    'key-stats',
    'chart-story',
    'facts-grid',
    'survey-results',
    'progress-report',
    'pictogram',
    'ranking',
    'kpi-dashboard',
    'trend-story',
    'market-share',
    'stat-mosaic',
  ],
  steps: [
    'process',
    'timeline',
    'checklist',
    'roadmap',
    'agenda',
    'cycle',
    'funnel',
    'staircase',
    'customer-journey',
    'project-plan',
    'decision-flow',
    'how-to',
  ],
  compare: [
    'comparison',
    'pros-cons',
    'before-after',
    'feature-matrix',
    'versus',
    'pricing-tiers',
    'swot',
    'effort-impact',
    'scorecard',
    'spectrum',
    'venn',
    'three-options',
  ],
  people: [
    'top-tips',
    'team',
    'questions',
    'profile',
    'org-chart',
    'testimonials',
    'meet-the-speakers',
    'employee-spotlight',
    'values',
    'idea-board',
    'persona',
    'shout-outs',
  ],
  social: [
    'announcement',
    'did-you-know',
    'save-the-date',
    'carousel-cover',
    'tip-of-the-day',
    'milestone',
    'behind-the-scenes',
    'countdown',
    'product-spotlight',
    'giveaway',
    'welcome',
    'webinar',
  ],
  explainers: [
    'explain-how-it-works',
    'explain-anatomy',
    'explain-key-concepts',
    'explain-cheat-sheet',
    'explain-glossary',
    'explain-myths-facts',
    'explain-fact-file',
    'explain-lesson-summary',
    'explain-formula',
  ],
};

describe('page layouts', () => {
  it('are the ninety-two of the spec, by category, each unique, at most twelve to a category', () => {
    for (const c of PAGE_LAYOUT_CATEGORIES) {
      expect(
        PAGE_LAYOUTS.filter((l) => l.category === c.id).map((l) => l.id),
        c.id,
      ).toEqual(BY_CATEGORY[c.id]);
    }
    const ids = PAGE_LAYOUTS.map((l) => l.id);
    expect(ids).toHaveLength(92);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of PAGE_LAYOUT_CATEGORIES) {
      expect(PAGE_LAYOUTS.filter((l) => l.category === c.id).length).toBeLessThanOrEqual(12);
    }
  });

  it('each sit in one of the picker categories, every category used', () => {
    const ids = new Set(PAGE_LAYOUT_CATEGORIES.map((c) => c.id));
    for (const l of PAGE_LAYOUTS) expect(ids.has(l.category)).toBe(true);
    for (const c of PAGE_LAYOUT_CATEGORIES) {
      expect(PAGE_LAYOUTS.some((l) => l.category === c.id)).toBe(true);
    }
  });

  // A wireframe page's device size is its own, laid out from the wireframe layouts
  // (packages/templates wireframe-layouts.test.ts).
  for (const size of PAGE_SIZE_IDS.filter((s) => s !== 'device')) {
    for (const orientation of PAGE_ORIENTATIONS) {
      const [page] = layOutPages([{ id: 'p', orientation, size }]);
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
