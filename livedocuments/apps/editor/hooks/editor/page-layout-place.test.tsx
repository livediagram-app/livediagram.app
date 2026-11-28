// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  elementsOnPage,
  layOutPages,
  pagesOf,
  themedForTab,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { buildPageLayoutOver } from '@livedocuments/templates';
import { buildPageLayoutOver as builtOnHover } from '@livedocuments/templates/page-layout-build';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { PageLayoutsButton } from '@/components/canvas/PageLayoutsButton';
import { LAYOUT_PREVIEW_SETTLE_MS } from '@liveworkspace/workbench/lib/layout-preview-settle';
import { pageEdits } from './page-edits';
import {
  layoutPlacedTab,
  showLayout,
  shownLayoutElements,
  shownLayoutFor,
  useShownLayoutElements,
} from './page-layout-place';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The builder a hover and a press load, watched to count how many placements a sweep pays for.
vi.mock('@livedocuments/templates/page-layout-build', async (actual) => {
  const m = await actual<typeof import('@livedocuments/templates/page-layout-build')>();
  return { ...m, buildPageLayoutOver: vi.fn(m.buildPageLayoutOver) };
});

// docs/specs/007-editor/pages-mode.md "Hover previews the layout on the page, exactly as it lands" (Work Tracker
// 1502): a hover and a press take one path, and a press on the layout shown lands the very elements shown.

const box = (id: string, cx: number) =>
  ({ id, type: 'shape', shape: 'square', x: cx - 10, y: -10, width: 20, height: 20 }) as Element;
const words = (id: string, label: string) =>
  ({ id, type: 'text', x: -300, y: -480, width: 400, height: 60, label }) as Element;

// A themed tab of two pages, the first dark (its layout takes the theme's dark half), some words on it.
const tab = (): Tab =>
  ({
    id: 't',
    name: 'T',
    theme: 'ocean',
    elements: [words('w', 'Q3 Results'), box('a', 0), box('b', 794 + 96)],
    pages: [
      {
        id: 'page-1',
        orientation: 'portrait',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
      { id: 'page-2', orientation: 'portrait' },
    ],
  }) as unknown as Tab;

function harness(start: Tab) {
  let tabs = [start];
  const edits = () =>
    pageEdits({
      tabId: start.id,
      tab: tabs[0]!,
      current: pagesOf(tabs[0]),
      elements: tabs[0]!.elements,
      commitTabs: (map) => {
        tabs = map(tabs);
      },
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
    });
  return { edits, tab: () => tabs[0]! };
}

// What the canvas draws while the tile is hovered: the tab with the layout placed, in place of its own elements.
const shownNow = () => shownLayoutElements('t');
const shownOver = () => {
  const els = shownNow();
  if (!els) throw new Error('no preview shown');
  return els;
};

// Ids aside (each build mints its own), two element lists alike.
const withoutIds = (els: readonly Element[]) =>
  els.map((el) => {
    const { id: _id, ...rest } = el;
    return rest;
  });

afterEach(() => {
  cleanup();
  showLayout(null);
});

describe('layoutPlacedTab', () => {
  it("builds the layout for the page, carries its words in and colours it from the tab's theme for its half", () => {
    const t = tab();
    const placed = layoutPlacedTab(t, 'page-1', 'title', buildPageLayoutOver)!;
    const pages = layOutPages(pagesOf(t));
    const onPage = elementsOnPage(placed.elements, pages, 'page-1');
    const by = buildPageLayoutOver('title', pages[0]!, elementsOnPage(t.elements, pages, 'page-1'));
    expect(withoutIds(onPage)).toEqual(withoutIds(themedForTab(by, 'ocean', { dark: true })));
    expect(onPage.some((el) => el.type === 'text' && el.label === 'Q3 Results')).toBe(true);
    // The other page is left as it was.
    expect(placed.elements.find((el) => el.id === 'b')).toBe(t.elements[2]);
  });

  it('places nothing on a page that is gone or locked', () => {
    expect(layoutPlacedTab(tab(), 'nope', 'title', buildPageLayoutOver)).toBeNull();
    const locked = { ...tab(), pages: [{ id: 'page-1', orientation: 'portrait', locked: true }] };
    expect(
      layoutPlacedTab(locked as unknown as Tab, 'page-1', 'title', buildPageLayoutOver),
    ).toBeNull();
  });
});

describe('a hovered layout is what a press lands', () => {
  for (const layout of ['title', 'key-stats', 'poster', 'top-tips'] as const) {
    it(`${layout}: the press commits exactly the elements the hover showed, ids and all`, async () => {
      const h = harness(tab());
      const board = h.tab().elements;
      h.edits().previewLayout('page-1', layout);
      await vi.waitFor(() => expect(shownNow()).not.toBeNull());
      const previewed = shownOver();
      // Nothing written while it shows.
      expect(h.tab().elements).toBe(board);
      await h.edits().applyLayout('page-1', layout);
      expect(h.tab().elements).toEqual(previewed);
      // Landed: the preview is gone, the canvas draws the document's board.
      expect(shownNow()).toBeNull();
    });
  }

  it('places afresh, by the same path, when the hover showed another layout or the page changed since', async () => {
    const h = harness(tab());
    h.edits().previewLayout('page-1', 'poster');
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    const shownPoster = shownOver();
    await h.edits().applyLayout('page-1', 'title');
    const fresh = layoutPlacedTab(tab(), 'page-1', 'title', buildPageLayoutOver)!;
    expect(withoutIds(h.tab().elements)).toEqual(withoutIds(fresh.elements));
    expect(h.tab().elements).not.toEqual(shownPoster);
    // A board that changed under the hover is never overwritten with what the hover showed over the old one.
    expect(shownLayoutFor('t', 'page-1', 'title', [...h.tab().elements])).toBeNull();
  });

  it('puts the page back when the hover ends, and draws nothing for a hover that has moved on', async () => {
    const h = harness(tab());
    h.edits().previewLayout('page-1', 'poster');
    h.edits().previewLayout('page-1', null);
    await new Promise((r) => setTimeout(r, 0));
    expect(shownNow()).toBeNull();
    h.edits().previewLayout('page-1', 'title');
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    h.edits().previewLayout('page-1', null);
    await vi.waitFor(() => expect(shownNow()).toBeNull());
  });

  it('builds one preview for a pointer sweep across the tiles: the tile it settles on', async () => {
    const h = harness(tab());
    // The builders in first, as after the gallery's first hover.
    h.edits().previewLayout('page-1', 'title');
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    vi.mocked(builtOnHover).mockClear();
    const sweep = [
      'poster',
      'key-stats',
      'top-tips',
      'title',
      'poster',
      'key-stats',
      'top-tips',
      'title',
    ] as const;
    for (const layout of sweep) {
      h.edits().previewLayout('page-1', layout, 'pointer');
      await new Promise((r) => setTimeout(r, LAYOUT_PREVIEW_SETTLE_MS / 4));
    }
    expect(builtOnHover).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(builtOnHover).toHaveBeenCalledTimes(1));
    expect(vi.mocked(builtOnHover).mock.calls[0]![0]).toBe('title');
    await new Promise((r) => setTimeout(r, LAYOUT_PREVIEW_SETTLE_MS * 2));
    expect(builtOnHover).toHaveBeenCalledTimes(1);
  });

  it("a press through the Layout popover lands the hover's elements, ids and all", async () => {
    const h = harness(tab());
    const [page] = layOutPages(pagesOf(h.tab()));
    render(
      <PageLayoutsButton
        page={page!}
        labelled
        onApply={(layout) => void h.edits().applyLayout('page-1', layout)}
        onPreview={(layout, how) => h.edits().previewLayout('page-1', layout, how)}
      />,
    );
    fireEvent.click(document.querySelector('button[aria-label="Layout"]')!);
    const tile = await vi.waitFor(() => {
      const el = document.querySelector('[data-layout-tile="key-stats"]');
      if (!el) throw new Error('no tile yet');
      return el;
    });
    fireEvent.pointerEnter(tile);
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    const previewed = shownOver();
    fireEvent.click(tile);
    await vi.waitFor(() => expect(h.tab().elements).toEqual(previewed));
    expect(document.querySelector('[data-page-layouts-popover]')).toBeNull();
    await vi.waitFor(() => expect(shownNow()).toBeNull());
  });

  it('previews nothing on a locked page', async () => {
    const locked = {
      ...tab(),
      pages: [{ id: 'page-1', orientation: 'portrait', locked: true }],
    } as unknown as Tab;
    const h = harness(locked);
    h.edits().previewLayout('page-1', 'title');
    await new Promise((r) => setTimeout(r, 0));
    expect(shownNow()).toBeNull();
  });
});

describe('useShownLayoutElements', () => {
  it("gives the canvas the hovered layout's board for its own tab only, and null once it ends", () => {
    const mine = renderHook(() => useShownLayoutElements('t'));
    const other = renderHook(() => useShownLayoutElements('u'));
    expect(mine.result.current).toBeNull();
    const elements = [box('x', 0)];
    act(() => showLayout({ tabId: 't', pageId: 'page-1', layout: 'title', over: [], elements }));
    expect(mine.result.current).toBe(elements);
    expect(other.result.current).toBeNull();
    act(() => showLayout(null));
    expect(mine.result.current).toBeNull();
  });
});

// A hover places the layout on every tile it crosses: it must stay cheap on a long tab (60 pages, 2,400 elements).
// Measured 2.5 ms a placement (2026-11-27).
describe('a hovered layout stays cheap on a long tab', () => {
  const PAGES = 60;
  const PER_PAGE = 40;
  const PLACE_BUDGET_MS = 25;

  it(`places a layout on a ${PAGES}-page tab within budget`, () => {
    const pages = Array.from({ length: PAGES }, (_, i) => ({
      id: `p${i}`,
      orientation: 'portrait',
    }));
    const laid = layOutPages(pagesOf({ pages }));
    const elements = laid.flatMap((p) =>
      Array.from({ length: PER_PAGE }, (_, j) => box(`${p.id}-${j}`, p.rect.x + 40 + j * 15)),
    );
    const big = { id: 't', name: 'T', theme: 'ocean', elements, pages } as unknown as Tab;
    layoutPlacedTab(big, 'p30', 'key-stats', buildPageLayoutOver);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) layoutPlacedTab(big, 'p30', 'key-stats', buildPageLayoutOver);
    });
    expect(ms / 10).toBeLessThan(cpuBudgetMs(PLACE_BUDGET_MS));
  });
});
