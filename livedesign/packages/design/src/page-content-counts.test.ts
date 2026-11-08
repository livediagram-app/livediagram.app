import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  elementAnchorPoint,
  elementIdsOnPage,
  elementPageTones,
  pageContentCounts,
} from './page-content';
import { createPinnedArrow } from './factories';
import { layOutPages, pageAt, type LaidOutPage, type Page } from './page';
import type { Element } from './index';

// pageContentCounts (docs/specs/008-canvas/canvas-performance.md "Whole-board passes stay linear and run
// once"): every page's count in one walk, the same as each page's own elementIdsOnPage scan.

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A row of mixed pages (portrait, landscape, a logo square) and elements scattered over and around them,
// a share of them arrows pinned between boxes.
function design(pageCount: number, count: number, seed = 1) {
  const rand = prng(seed);
  const pages: Page[] = Array.from({ length: pageCount }, (_, i) => ({
    id: `p${i}`,
    orientation: i % 3 === 1 ? 'landscape' : 'portrait',
    ...(i % 3 === 2 ? { size: 'logo' as const } : {}),
  }));
  const laidOut = layOutPages(pages);
  const left = laidOut[0]!.rect.x - 300;
  const right = laidOut[laidOut.length - 1]!.rect.x + laidOut[laidOut.length - 1]!.rect.width + 300;
  const boxes: Element[] = Array.from({ length: Math.round(count * 0.8) }, (_, i) => ({
    id: `b${i}`,
    type: 'shape',
    shape: 'square',
    x: left + rand() * (right - left),
    y: -900 + rand() * 1800,
    width: 20 + rand() * 120,
    height: 20 + rand() * 80,
  }));
  const arrows: Element[] = Array.from({ length: count - boxes.length }, (_, i) => ({
    ...createPinnedArrow(
      boxes[Math.floor(rand() * boxes.length)]!.id,
      'e',
      boxes[Math.floor(rand() * boxes.length)]!.id,
      'w',
    ),
    id: `a${i}`,
  }));
  return { elements: [...boxes, ...arrows], laidOut };
}

// The plain reading every walk must agree with: each element's page by a search of the row, its arrow ends by a
// search of the tab.
const naivePageOf = (elements: Element[], pages: readonly LaidOutPage[], el: Element) =>
  pageAt(pages, elementAnchorPoint(el, elements));

describe('pageContentCounts', () => {
  it("counts each page's elements as its own scan does", () => {
    for (const [pages, count, seed] of [
      [1, 50, 1],
      [7, 400, 2],
      [20, 1000, 3],
    ] as const) {
      const { elements, laidOut } = design(pages, count, seed);
      const counts = pageContentCounts(elements, laidOut);
      for (const page of laidOut) {
        const naive = elements.filter((el) => naivePageOf(elements, laidOut, el)?.id === page.id);
        expect(counts.get(page.id) ?? 0).toBe(naive.length);
        expect([...elementIdsOnPage(elements, laidOut, page.id)]).toEqual(naive.map((el) => el.id));
      }
      // Something landed on and off the pages, so the comparison means something.
      const on = [...counts.values()].reduce((a, b) => a + b, 0);
      expect(on).toBeGreaterThan(0);
      expect(on).toBeLessThan(elements.length);
    }
  });

  it('counts nothing with no pages, and leaves an empty page out', () => {
    const { elements, laidOut } = design(3, 10);
    expect(pageContentCounts(elements, []).size).toBe(0);
    expect(pageContentCounts([], laidOut).size).toBe(0);
  });

  // 100 pages (MAX_PAGES) and 3,000 elements, a fifth of them arrows: one walk, where a scan per page made
  // it pages x elements (and an arrow's ends a search of the tab each).
  it('counts the largest design in one walk, within budget', () => {
    const { elements, laidOut } = design(100, 3000);
    const ms = Math.min(
      ...[0, 1, 2].map(() => cpuMsOf(() => void pageContentCounts(elements, laidOut))),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(15));
  });
});

describe('elementPageTones', () => {
  it('finds the same page under each element as a search of the row does', () => {
    const { elements, laidOut } = design(12, 600, 4);
    const filled: LaidOutPage[] = laidOut.map((p, i) =>
      i % 2 ? { ...p, background: { fill: { kind: 'solid', color: '#0f172a' } } } : p,
    );
    const tones = elementPageTones(elements, filled);
    for (const el of elements) {
      const page = naivePageOf(elements, filled, el);
      expect(tones.has(el.id)).toBe(!!page?.background?.fill);
    }
    expect(tones.size).toBeGreaterThan(0);
  });
});
