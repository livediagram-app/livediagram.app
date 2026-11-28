// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  elementsOnPage,
  layOutPages,
  newWireframePage,
  pagesOf,
  themedForTab,
  type Element,
  type Tab,
} from '@livedesign/design';
import { buildPageLayout, buildPageLayoutOver } from '@livedesign/templates';
import { buildPageLayoutOver as builtOnHover } from '@livedesign/templates/page-layout-build';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { LAYOUT_PREVIEW_SETTLE_MS } from '@liveworkspace/workbench/lib/layout-preview-settle';
import { PageLayoutsButton } from '@/components/canvas/PageLayoutsButton';
import { pageEdits } from './page-edits';
import { layoutPlacedTab, showLayout, shownLayoutElements } from './page-layout-place';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The builder a hover and a press load, watched to count how many placements a sweep pays for.
vi.mock('@livedesign/templates/page-layout-build', async (actual) => {
  const m = await actual<typeof import('@livedesign/templates/page-layout-build')>();
  return { ...m, buildPageLayoutOver: vi.fn(m.buildPageLayoutOver) };
});

// docs/specs/007-editor/pages-mode.md "Hover previews the layout on the page, exactly as it lands" (Work Tracker
// 1507): a hover and a press take one path, and a press on the layout shown lands the very elements shown, in the
// tab's theme. The hover once drew its own picture of the raw layout, missing the theme the press then filled in.

// A themed tab of a dark logo artboard (its layout takes the theme's dark half) and a wireframe phone.
const tab = (): Tab =>
  ({
    id: 't',
    name: 'T',
    theme: 'ocean',
    elements: [],
    pages: [
      {
        id: 'page-1',
        orientation: 'portrait',
        size: 'logo',
        kind: 'logo',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
      { ...newWireframePage('page-2') },
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
  it("builds the layout for the page and colours it from the tab's theme for its half, as the press always did", () => {
    const t = tab();
    const placed = layoutPlacedTab(t, 'page-1', 'logo-stacked', buildPageLayoutOver)!;
    const pages = layOutPages(pagesOf(t));
    const onPage = elementsOnPage(placed.elements, pages, 'page-1');
    const raw = buildPageLayoutOver('logo-stacked', pages[0]!, []);
    expect(withoutIds(onPage)).toEqual(withoutIds(themedForTab(raw, 'ocean', { dark: true })));
    // The theme changes what the raw layout draws: the old hover's picture of it was not what a press lands.
    expect(withoutIds(onPage)).not.toEqual(withoutIds(raw));
  });

  it('carries the page words into the layout', () => {
    const t = tab();
    const [page] = layOutPages(pagesOf(t));
    const written = buildPageLayout('logo-icon-above', page!).map((el) =>
      el.type === 'text' && el.label === 'Brand' ? { ...el, label: 'Acme' } : el,
    );
    const placed = layoutPlacedTab(
      { ...t, elements: written },
      'page-1',
      'logo-stacked',
      buildPageLayoutOver,
    )!;
    const labels = placed.elements.flatMap((el) => (el.type === 'text' ? [el.label] : []));
    expect(labels).toContain('Acme');
    expect(labels).not.toContain('Brand');
  });

  it('places nothing on a page that is gone or locked', () => {
    expect(layoutPlacedTab(tab(), 'nope', 'logo-stacked', buildPageLayoutOver)).toBeNull();
    const locked = {
      ...tab(),
      pages: [{ id: 'page-1', orientation: 'portrait', size: 'logo', kind: 'logo', locked: true }],
    };
    expect(
      layoutPlacedTab(locked as unknown as Tab, 'page-1', 'logo-stacked', buildPageLayoutOver),
    ).toBeNull();
  });
});

describe('a hovered layout is what a press lands', () => {
  const cases = [
    ['page-1', 'logo-stacked'],
    ['page-1', 'logo-icon-above'],
    ['page-2', 'wf-onboarding'],
    ['page-2', 'wf-checkout'],
  ] as const;
  for (const [pageId, layout] of cases) {
    it(`${layout}: the press commits exactly the elements the hover showed, ids and all`, async () => {
      const h = harness(tab());
      const board = h.tab().elements;
      h.edits().previewLayout(pageId, layout);
      await vi.waitFor(() => expect(shownNow()).not.toBeNull());
      const previewed = shownOver();
      // Nothing written while it shows.
      expect(h.tab().elements).toBe(board);
      await h.edits().applyLayout(pageId, layout);
      expect(h.tab().elements).toEqual(previewed);
      // Landed: the preview is gone, the canvas draws the design's board.
      expect(shownNow()).toBeNull();
    });
  }

  it('builds one preview for a pointer sweep across the tiles: the tile it settles on', async () => {
    const h = harness(tab());
    h.edits().previewLayout('page-2', 'wf-onboarding');
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    vi.mocked(builtOnHover).mockClear();
    for (const layout of [
      'wf-checkout',
      'wf-onboarding',
      'wf-checkout',
      'wf-onboarding',
    ] as const) {
      h.edits().previewLayout('page-2', layout, 'pointer');
      await new Promise((r) => setTimeout(r, LAYOUT_PREVIEW_SETTLE_MS / 4));
    }
    expect(builtOnHover).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(builtOnHover).toHaveBeenCalledTimes(1));
    expect(vi.mocked(builtOnHover).mock.calls[0]![0]).toBe('wf-onboarding');
  });

  it("a press through a wireframe page's Layout popover lands the hover's elements, ids and all", async () => {
    const h = harness(tab());
    const page = layOutPages(pagesOf(h.tab()))[1]!;
    render(
      <PageLayoutsButton
        page={page}
        labelled
        onApply={(layout) => void h.edits().applyLayout('page-2', layout)}
        onPreview={(layout, how) => h.edits().previewLayout('page-2', layout, how)}
      />,
    );
    fireEvent.click(document.querySelector('button[aria-label="Layout"]')!);
    const tile = await vi.waitFor(() => {
      const el = document.querySelector('[data-layout-tile="wf-checkout"]');
      if (!el) throw new Error('no tile yet');
      return el;
    });
    fireEvent.pointerEnter(tile);
    await vi.waitFor(() => expect(shownNow()).not.toBeNull());
    const previewed = shownOver();
    fireEvent.click(tile);
    await vi.waitFor(() => expect(h.tab().elements).toEqual(previewed));
    await vi.waitFor(() => expect(shownNow()).toBeNull());
  });

  it('previews nothing on a locked page', async () => {
    const locked = {
      ...tab(),
      pages: [{ id: 'page-1', orientation: 'portrait', size: 'logo', kind: 'logo', locked: true }],
    } as unknown as Tab;
    const h = harness(locked);
    h.edits().previewLayout('page-1', 'logo-stacked');
    await new Promise((r) => setTimeout(r, 30));
    expect(shownNow()).toBeNull();
  });
});

// A hover places the layout on the tile it settles on: it must stay cheap on a long design (40 wireframe screens,
// 1,600 elements).
describe('a hovered layout stays cheap on a long design', () => {
  const PAGES = 40;
  const PER_PAGE = 40;
  const PLACE_BUDGET_MS = 25;

  it(`places a layout on a ${PAGES}-page design within budget`, () => {
    const pages = Array.from({ length: PAGES }, (_, i) => newWireframePage(`p${i}`));
    const laid = layOutPages(pagesOf({ pages }));
    const elements = laid.flatMap((p) =>
      Array.from({ length: PER_PAGE }, (_, j) => ({
        id: `${p.id}-${j}`,
        type: 'shape',
        shape: 'square',
        x: p.rect.x + 10 + (j % 8) * 20,
        y: p.rect.y + 40 + Math.floor(j / 8) * 30,
        width: 16,
        height: 16,
      })),
    );
    const big = { id: 't', name: 'T', theme: 'ocean', elements, pages } as unknown as Tab;
    layoutPlacedTab(big, 'p20', 'wf-checkout', buildPageLayoutOver);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) layoutPlacedTab(big, 'p20', 'wf-checkout', buildPageLayoutOver);
    });
    expect(ms / 10).toBeLessThan(cpuBudgetMs(PLACE_BUDGET_MS));
  });
});
