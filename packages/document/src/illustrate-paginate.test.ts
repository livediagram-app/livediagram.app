import { describe, expect, it } from 'vitest';
import {
  contentClusters,
  pageAround,
  withContentOnAPage,
  withPageSplit,
} from './illustrate-paginate';
import { elementIdsOnPage } from './illustrate-page-content';
import {
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  pageMargin,
  type IllustratePage,
} from './illustrate-page';
import { FIT_PAGE_MAX_SIDE } from './illustrate-page-fit';
import type { Element } from './index';

// docs/specs/007-editor/illustrate-pages.md "Into pages".
const box = (id: string, x: number, y: number, w = 100, h = 60) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h }) as Element;
const arrow = (id: string, from: string, to: string) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'e' },
    to: { kind: 'pinned', elementId: to, anchor: 'w' },
  }) as Element;
type Boxed = Element & { x: number; y: number; width: number; height: number };

// Every element of `out` lies inside the page it is on (edges included).
const insideItsPage = (out: { elements: Element[]; pages: IllustratePage[] }) => {
  const laid = layOutIllustratePages(illustratePagesOf(out));
  for (const el of out.elements as Boxed[]) {
    if (el.type === 'arrow') continue;
    const page = laid.find((p) => elementIdsOnPage(out.elements, laid, p.id).has(el.id))!;
    expect(el.x).toBeGreaterThanOrEqual(page.rect.x);
    expect(el.y).toBeGreaterThanOrEqual(page.rect.y);
    expect(el.x + el.width).toBeLessThanOrEqual(page.rect.x + page.rect.width);
    expect(el.y + el.height).toBeLessThanOrEqual(page.rect.y + page.rect.height);
  }
};

describe('contentClusters', () => {
  it('joins what arrows connect and what sits close, in reading order', () => {
    const els = [
      box('b1', 3000, 0),
      box('b2', 3600, 0),
      arrow('ab', 'b1', 'b2'),
      box('a1', 0, 0),
      box('a2', 150, 0),
      box('c1', 0, 2000),
    ];
    expect(contentClusters(els)).toEqual([['a1', 'a2'], ['b1', 'b2', 'ab'], ['c1']]);
  });
});

describe('pageAround', () => {
  const at = (x: number, y: number, r: number, b: number) => ({ x, y, r, b });

  it('is A4, turned to the content, when it fits the margin box', () => {
    expect(pageAround(at(0, 0, 900, 400), 'p')).toEqual({
      id: 'p',
      orientation: 'landscape',
      kind: 'infographic',
    });
    expect(pageAround(at(0, 0, 400, 900), 'p').orientation).toBe('portrait');
  });

  it('is Fit to Content, the content plus its own margin all round, when A4 is too small', () => {
    const page = pageAround(at(0, 0, 2284, 1147), 'p');
    expect(page).toMatchObject({ size: 'fit', orientation: 'landscape', kind: 'infographic' });
    const m = pageMargin(page);
    expect(page.fit!.width).toBeGreaterThanOrEqual(2284 + 2 * m);
    expect(page.fit!.height).toBeGreaterThanOrEqual(1147 + 2 * m);
  });

  it('stops growing at the largest side', () => {
    const page = pageAround(at(0, 0, 50_000, 300), 'p');
    expect(page.fit!.width).toBe(FIT_PAGE_MAX_SIDE);
  });
});

describe('withContentOnAPage', () => {
  it('puts a board that spills off the first page onto a page around it, moving nothing', () => {
    const elements = [box('wide', 3000, 0, 1600, 200), box('tall', 0, 3000, 100, 900)];
    const out = withContentOnAPage({ elements })!;
    expect(out.elements).toEqual(elements);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]).toMatchObject({ size: 'fit', kind: 'infographic' });
    // The row anchor is the content's centre, so the page sits over the content.
    expect(out.pages[0]!.rowAt).toEqual({ x: 2300, y: 1950 });
    insideItsPage(out);
  });

  it('uses A4 where the content fits it, anchored on the content', () => {
    const out = withContentOnAPage({ elements: [box('a', 5000, 5000, 300, 200)] })!;
    expect(out.pages[0]).toMatchObject({ orientation: 'landscape', rowAt: { x: 5150, y: 5100 } });
    expect(out.pages[0]!.size).toBeUndefined();
    insideItsPage(out);
  });

  it('drops the legacy orientation once pages are stored', () => {
    const out = withContentOnAPage({
      elements: [box('a', 5000, 0)],
      pageOrientation: 'landscape',
    })!;
    expect('pageOrientation' in out).toBe(false);
  });

  it('leaves alone a tab already inside its first page, or one with nothing', () => {
    expect(withContentOnAPage({ elements: [box('a', -50, -30)] })).toBeNull();
    expect(withContentOnAPage({ elements: [], pages: [] })).toBeNull();
  });

  it('with pages stored and nothing on them, replaces them with a page around the content', () => {
    const out = withContentOnAPage({
      elements: [box('a', 5000, 0, 60, 200)],
      pages: [{ id: 'page-1', orientation: 'landscape' }],
    })!;
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]!.id).not.toBe('page-1');
    expect(out.elements[0]).toMatchObject({ x: 5000, y: 0 });
  });

  it('with pages in use, leaves content off them where it is', () => {
    expect(
      withContentOnAPage({
        elements: [box('kept', -50, -30), box('stray', 5000, 0)],
        pages: [{ id: 'page-1', orientation: 'portrait' }],
      }),
    ).toBeNull();
  });

  it('never replaces a locked page or an article page', () => {
    const stray = [box('s', 9000, 9000, 40, 40)];
    expect(
      withContentOnAPage({
        elements: stray,
        pages: [{ id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' }],
      }),
    ).toBeNull();
    expect(
      withContentOnAPage({
        elements: stray,
        pages: [{ id: 'l', orientation: 'portrait', locked: true }],
      }),
    ).toBeNull();
  });

  it('never replaces a page someone made something of: a slide, a logo, a name, a paint', () => {
    const stray = [box('s', 9000, 9000, 40, 40)];
    const kept: IllustratePage[] = [
      { id: 's', orientation: 'landscape', kind: 'slide', size: 'slide' },
      { id: 'g', orientation: 'portrait', kind: 'logo', size: 'logo' },
      { id: 'n', orientation: 'portrait', name: 'Cover' },
      {
        id: 'b',
        orientation: 'portrait',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
    ];
    for (const page of kept) {
      expect(withContentOnAPage({ elements: stray, pages: [page] })).toBeNull();
    }
    // An infographic page chosen but otherwise untouched is still replaced.
    expect(
      withContentOnAPage({
        elements: stray,
        pages: [{ id: 'i', orientation: 'portrait', kind: 'infographic' }],
      }),
    ).not.toBeNull();
  });

  it('counts a lone straight line on a page as on it', () => {
    const line = {
      id: 'rule',
      type: 'arrow',
      from: { kind: 'free', x: -200, y: 0 },
      to: { kind: 'free', x: 200, y: 0 },
    } as Element;
    expect(
      withContentOnAPage({ elements: [line], pages: [{ id: 'page-1', orientation: 'portrait' }] }),
    ).toBeNull();
  });
});

describe('withPageSplit', () => {
  const board = () =>
    withContentOnAPage({
      elements: [
        box('a1', 0, 0, 1600, 200),
        box('a2', 0, 250, 300, 60),
        box('b1', 3000, 0, 100, 900),
        box('b2', 3200, 0),
        arrow('ab', 'b1', 'b2'),
      ],
    })!;

  it('splits a Fit to Content page into a page per cluster, nothing scaled', () => {
    const tab = board();
    const out = withPageSplit(tab, tab.pages[0]!.id)!;
    expect(out.pages).toHaveLength(2);
    const sizes = (els: Element[]) =>
      (els as Boxed[]).filter((e) => e.type !== 'arrow').map((e) => [e.id, e.width, e.height]);
    expect(sizes(out.elements)).toEqual(sizes(tab.elements));
    const laid = layOutIllustratePages(out.pages);
    expect([...elementIdsOnPage(out.elements, laid, laid[0]!.id)].sort()).toEqual(['a1', 'a2']);
    expect([...elementIdsOnPage(out.elements, laid, laid[1]!.id)].sort()).toEqual([
      'ab',
      'b1',
      'b2',
    ]);
    insideItsPage(out);
  });

  it('keeps the row where it was', () => {
    const tab = board();
    const out = withPageSplit(tab, tab.pages[0]!.id)!;
    expect(out.pages.find((p) => p.rowAt)?.rowAt).toEqual(tab.pages[0]!.rowAt);
  });

  it('moves the pages after it along, their content with them', () => {
    const tab = board();
    const after: IllustratePage = { id: 'next', orientation: 'portrait' };
    const before = layOutIllustratePages([...tab.pages, after])[1]!.rect;
    const withNext = {
      ...tab,
      pages: [...tab.pages, after],
      elements: [...tab.elements, box('n', before.x + 100, before.y + 100)],
    };
    const out = withPageSplit(withNext, tab.pages[0]!.id)!;
    const laid = layOutIllustratePages(out.pages);
    expect(laid.at(-1)!.id).toBe('next');
    expect(elementIdsOnPage(out.elements, laid, 'next').has('n')).toBe(true);
  });

  it('refuses a page with one cluster, a page in another size, a locked page', () => {
    const one = withContentOnAPage({ elements: [box('a', 0, 0, 3000, 200)] })!;
    expect(withPageSplit(one, one.pages[0]!.id)).toBeNull();
    expect(
      withPageSplit(
        {
          elements: [box('a', 0, 0), box('b', 300, 300)],
          pages: [{ id: 'p', orientation: 'portrait' }],
        },
        'p',
      ),
    ).toBeNull();
    const tab = board();
    const locked = { ...tab, pages: [{ ...tab.pages[0]!, locked: true as const }] };
    expect(withPageSplit(locked, tab.pages[0]!.id)).toBeNull();
    expect(withPageSplit(tab, 'missing')).toBeNull();
  });

  it('makes at most twenty pages: the clusters past the last share it', () => {
    const many = Array.from({ length: 30 }, (_, i) => box(`b${i}`, i * 400, 0));
    const tab = withContentOnAPage({ elements: many })!;
    const out = withPageSplit(tab, tab.pages[0]!.id)!;
    expect(out.pages).toHaveLength(20);
    insideItsPage(out);
  });

  it("keeps the split page's paint and name on every new page, numbered after the first", () => {
    const tab = board();
    const fill = { kind: 'solid' as const, color: '#0f172a' };
    const named = {
      ...tab,
      pages: [
        { ...tab.pages[0]!, name: 'Overview', background: { fill, pattern: 'dots' as const } },
      ],
    };
    const out = withPageSplit(named, tab.pages[0]!.id)!;
    expect(out.pages.map((p) => p.name)).toEqual(['Overview', 'Overview 2']);
    for (const p of out.pages) expect(p.background).toEqual({ fill, pattern: 'dots' });
  });

  it('refuses at the page limit, where a split has no room for a second page', () => {
    const tab = board();
    const rest = Array.from({ length: MAX_ILLUSTRATE_PAGES - 1 }, (_, i) => ({
      id: `p${i}`,
      orientation: 'portrait' as const,
    }));
    expect(withPageSplit({ ...tab, pages: [...tab.pages, ...rest] }, tab.pages[0]!.id)).toBeNull();
  });

  it('never passes the page limit', () => {
    const tab = board();
    const rest = Array.from({ length: MAX_ILLUSTRATE_PAGES - 2 }, (_, i) => ({
      id: `p${i}`,
      orientation: 'portrait' as const,
    }));
    const out = withPageSplit({ ...tab, pages: [...tab.pages, ...rest] }, tab.pages[0]!.id)!;
    expect(out.pages).toHaveLength(MAX_ILLUSTRATE_PAGES);
  });
});

// Entering the mode runs on every switch: linear, never the O(n²) clustering (measured ~2 ms at
// 3000 elements; the budget is generous so a loaded CI machine never flakes).
describe('withContentOnAPage: cost', () => {
  it('handles a 5000-element board well inside a frame budget', () => {
    const elements = Array.from({ length: 5000 }, (_, i) =>
      box(`e${i}`, (i % 50) * 180, Math.floor(i / 50) * 120, 150, 92),
    );
    const start = performance.now();
    withContentOnAPage({ elements });
    withContentOnAPage({ elements, pages: [{ id: 'x', orientation: 'portrait' }] });
    expect(performance.now() - start).toBeLessThan(150);
  });
});
