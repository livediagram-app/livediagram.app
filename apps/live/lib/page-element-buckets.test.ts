import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import {
  createPinnedArrow,
  createShape,
  elementIdsOnPage,
  layOutPages,
  type Element,
  type Page,
  type Tab,
} from '@liveplanner/document';
import { pageElementBuckets } from './page-element-buckets';
import { slideThumbFor, tabArrowLabels } from './slide-thumb';

// docs/specs/007-editor/pages-mode.md "Contents" "Cost": each page's picture draws from its own
// elements, found in one walk, and draws exactly what the whole tab would.

function deck(pageCount: number, perPage: number): Tab {
  const pages = Array.from({ length: pageCount }, (_, i): Page => ({
    id: `p${i}`,
    orientation: 'landscape',
    kind: 'slide',
    size: 'slide',
  }));
  const laid = layOutPages(pages);
  const elements: Element[] = [];
  for (const page of laid) {
    for (let k = 0; k < perPage; k++) {
      elements.push({
        ...createShape(
          'square',
          page.rect.x + 40 + (k % 8) * 110,
          page.rect.y + 40 + Math.floor(k / 8) * 90,
        ),
        id: `${page.id}-n${k}`,
        label: `Box ${k}`,
      });
      // A connector to the box before, on the same page.
      if (k > 0)
        elements.push({
          ...createPinnedArrow(`${page.id}-n${k - 1}`, 'e', `${page.id}-n${k}`, 'w'),
          id: `${page.id}-a${k}`,
        });
    }
  }
  return { id: 't', name: 'Deck', elements, pages };
}

describe('pageElementBuckets', () => {
  it('puts each element on the page elementIdsOnPage reads, in the tab order', () => {
    const tab = deck(4, 5);
    const laid = layOutPages(tab.pages!);
    const buckets = pageElementBuckets(tab.elements, laid);
    for (const page of laid) {
      const own = elementIdsOnPage(tab.elements, laid, page.id);
      const ids = buckets.get(page.id)!.map((el) => el.id);
      expect(ids).toEqual(tab.elements.filter((el) => own.has(el.id)).map((el) => el.id));
    }
  });

  it("brings an arrow's ends from another page, through an arrow pinned to an arrow", () => {
    const tab = deck(2, 2);
    // A connector from page 0's first box to page 1's: its middle lies between the pages, so a
    // second arrow pinned to it, on page 1, needs it and both its ends.
    const across = { ...createPinnedArrow('p0-n0', 'e', 'p1-n1', 'w'), id: 'across' } as Element;
    const laid = layOutPages(tab.pages!);
    const onArrow = {
      id: 'onArrow',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'across', t: 0.5 },
      to: { kind: 'pinned', elementId: 'p1-n0', anchor: 'n' },
    } as unknown as Element;
    const elements = [...tab.elements, across, onArrow];
    const buckets = pageElementBuckets(elements, laid);
    const ids = new Set(buckets.get('p1')!.map((el) => el.id));
    if (ids.has('onArrow')) {
      expect(ids.has('across')).toBe(true);
      expect(ids.has('p0-n0')).toBe(true);
    }
    // Every arrow in any bucket has its ends with it.
    for (const bucket of buckets.values()) {
      const here = new Set(bucket.map((el) => el.id));
      for (const el of bucket) {
        if (el.type !== 'arrow') continue;
        for (const end of [el.from, el.to]) {
          if (end.kind === 'pinned') expect(here.has(end.elementId)).toBe(true);
          if (end.kind === 'on-arrow') expect(here.has(end.arrowId)).toBe(true);
        }
      }
    }
  });

  it('draws every page exactly as from the whole tab', () => {
    const tab = deck(3, 6);
    const laid = layOutPages(tab.pages!);
    const buckets = pageElementBuckets(tab.elements, laid);
    const labels = tabArrowLabels(tab);
    for (const page of laid) {
      const whole = slideThumbFor(page.id, tab, { iconsLoaded: false, labels });
      const own = slideThumbFor(
        page.id,
        { ...tab, elements: buckets.get(page.id)! },
        { iconsLoaded: false, labels },
      );
      expect(own).toEqual(whole);
    }
  });

  // The worst case: a full tab of busy pages, walked once when the Contents sidebar redraws.
  const WORST_PAGES = 100;
  const WORST_PER_PAGE = 30;
  const BUCKET_BUDGET_MS = 25;
  it(`walks ${WORST_PAGES} pages of ${WORST_PER_PAGE} boxes and their connectors inside ${cpuBudgetMs(BUCKET_BUDGET_MS)} ms`, () => {
    const tab = deck(WORST_PAGES, WORST_PER_PAGE);
    const laid = layOutPages(tab.pages!);
    for (let pass = 0; pass < 3; pass++) pageElementBuckets(tab.elements, laid);
    const best = Math.min(
      ...[0, 1, 2].map(() => cpuMsOf(() => void pageElementBuckets(tab.elements, laid))),
    );
    expect(best).toBeLessThan(cpuBudgetMs(BUCKET_BUDGET_MS));
  });
});
