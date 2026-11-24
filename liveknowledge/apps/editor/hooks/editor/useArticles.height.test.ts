// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  articleNoteCorner,
  CONTINUOUS_PAGE_WIDTH,
  KNOWLEDGEBASE_FLOW,
  layOutPages,
  newArticleNote,
  newKnowledgebasePageContent,
  withArticlePageHeight,
  pagesOf,
  type Tab,
} from '@liveknowledge/document';
import type { FlowLayout } from '@/components/canvas/article/article-editor-types';
import { clearArticleGrow, isArticleGrowPending } from '@/lib/article/article-grow-store';
import { pageViewLens } from '@/lib/page-surface/page-view-lens';
import {
  drawnPageHeight,
  resetMeasuredPageHeights,
} from '@/lib/page-surface/page-measured-height-store';
import { useArticles } from './useArticles';
import { NARROW_ESTIMATE_DELAY_MS } from './useNarrowHeightEstimate';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => null,
  markZoneReleased: vi.fn(),
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// Work Tracker 1413 (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Who settles the stored height" and "The
// page is drawn as tall as its writing here"): a page stored 240 px tall for 2,600 px of writing.
const FLOW = KNOWLEDGEBASE_FLOW;
const stale = (opts: { locked?: boolean } = {}): Tab => ({
  id: 't',
  name: 'Page',
  elements: [],
  ...newKnowledgebasePageContent(),
  ...(opts.locked ? { locked: true } : {}),
});
const heightOf = (t: Tab) => pagesOf(t).find((p) => p.flow === FLOW)!.fit!.height;
const laidOut: FlowLayout = {
  flow: FLOW,
  pagesNeeded: 1,
  heightNeeded: 2600,
  zones: [],
  notes: [],
  local: false,
};

function setup(tab: Tab, canEdit = true) {
  const tickTabs = vi.fn();
  const hook = renderHook(
    ({ activeTab, canEdit }) =>
      useArticles({
        activeTab,
        on: true,
        pages: null,
        localEditSeq: { current: 0 },
        placeAt: vi.fn(),
        canEdit,
        canWrite: false,
        commitTabs: vi.fn(),
        tickTabs,
        undo: vi.fn(),
        redo: vi.fn(),
        clearSelection: vi.fn(),
        openNote: vi.fn(),
        reveal: vi.fn(),
      }),
    { initialProps: { activeTab: tab, canEdit } },
  );
  const written = (ts: Tab[]): Tab[] =>
    (tickTabs.mock.calls as [(ts: Tab[]) => Tab[]][]).reduce((acc, [map]) => map(acc), ts);
  return { hook, tickTabs, written };
}

beforeEach(() => {
  clearArticleGrow('t', FLOW);
  resetMeasuredPageHeights();
});

describe('who settles the stored height', () => {
  it('starts stale: the page stores the least height', () => {
    expect(heightOf(stale())).toBe(240);
  });

  it('an Editor in read mode writes nothing, and the mark waits for Edit', () => {
    const { hook, tickTabs, written } = setup(stale({ locked: true }));
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).not.toHaveBeenCalled();
    expect(isArticleGrowPending('t', FLOW)).toBe(true);
    // Edit lifts the read lens's lock: the next layout settles the page.
    const editing = stale();
    hook.rerender({ activeTab: editing, canEdit: true });
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).toHaveBeenCalledTimes(1);
    expect(heightOf(written([editing])[0]!)).toBe(2600);
  });

  // The real open path: the session's role arrives after the page's first layout (a layout before it clears the
  // mark, as a Viewer's does), the page opens in read mode, then Edit lifts the read lens's lock. No mark is set by hand.
  it('settles on Edit after the role arrived late and the page opened in read mode', () => {
    const { hook, tickTabs, written } = setup(stale({ locked: true }), false);
    hook.result.current!.onLayout(laidOut);
    expect(isArticleGrowPending('t', FLOW)).toBe(false);
    hook.rerender({ activeTab: stale({ locked: true }), canEdit: true });
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).not.toHaveBeenCalled();
    const editing = stale();
    hook.rerender({ activeTab: editing, canEdit: true });
    expect(isArticleGrowPending('t', FLOW)).toBe(true);
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).toHaveBeenCalledTimes(1);
    expect(heightOf(written([editing])[0]!)).toBe(2600);
  });

  it('marks again on every Edit, so a mark spent earlier settles a page edited later', () => {
    const { hook, tickTabs, written } = setup(stale({ locked: true }));
    clearArticleGrow('t', FLOW);
    const editing = stale();
    hook.rerender({ activeTab: editing, canEdit: true });
    hook.result.current!.onLayout(laidOut);
    expect(heightOf(written([editing])[0]!)).toBe(2600);
    // Back to read mode and a page already right: nothing more is written.
    tickTabs.mockClear();
    hook.rerender({ activeTab: stale({ locked: true }), canEdit: true });
    hook.rerender({ activeTab: editing, canEdit: true });
    hook.result.current!.onLayout({ ...laidOut, heightNeeded: 240 });
    expect(tickTabs).not.toHaveBeenCalled();
  });

  it('a Viewer is never marked again, however its tab changes', () => {
    const { hook, tickTabs } = setup(stale({ locked: true }), false);
    hook.result.current!.onLayout(laidOut);
    hook.rerender({ activeTab: stale(), canEdit: false });
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).not.toHaveBeenCalled();
    expect(isArticleGrowPending('t', FLOW)).toBe(false);
  });

  // Work Tracker 1418: a page read wider than it was written has its margin notes moved across only; the first layout
  // of the right height stands each beside its text, as it settles the zones.
  it('settles the margin notes beside their text once the height is right', () => {
    const note = newArticleNote('n1', 'comment', { x: 0, y: 0 });
    const tab: Tab = { ...stale(), elements: [note] };
    const { hook, written } = setup(tab);
    const settledHeight = withArticlePageHeight(tab, FLOW, 2600);
    hook.rerender({ activeTab: settledHeight, canEdit: true });
    hook.result.current!.onLayout({
      ...laidOut,
      notes: [{ id: 'n1', index: 0, y: 300, height: 24 }],
    });
    const page = layOutPages(pagesOf(settledHeight))[0]!;
    const moved = written([settledHeight])[0]!.elements[0] as { x: number; y: number };
    expect(moved).toMatchObject(articleNoteCorner(page, 48, { y: 300, height: 24 }));
    expect(isArticleGrowPending('t', FLOW)).toBe(false);
  });

  it('settles a page that opens unlocked on its first layout', () => {
    const tab = stale();
    const { hook, written } = setup(tab);
    hook.result.current!.onLayout(laidOut);
    expect(heightOf(written([tab])[0]!)).toBe(2600);
  });

  it('a Viewer never writes it, and its mark goes', () => {
    const { hook, tickTabs } = setup(stale(), false);
    hook.result.current!.onLayout(laidOut);
    hook.result.current!.onLayout({ ...laidOut, local: true });
    expect(tickTabs).not.toHaveBeenCalled();
    expect(isArticleGrowPending('t', FLOW)).toBe(false);
  });

  it('the narrow view never writes its own measure, nor notes a full-width one', () => {
    vi.useFakeTimers();
    try {
      const narrow = pageViewLens(stale(), 300);
      expect(narrow).not.toBe(stale());
      const { hook, tickTabs } = setup(narrow);
      hook.result.current!.onLayout({ ...laidOut, heightNeeded: 4000 });
      hook.result.current!.onLayout({ ...laidOut, heightNeeded: 4000, local: true });
      expect(tickTabs).not.toHaveBeenCalled();
      expect(hook.result.current!.measured.size).toBe(0);
      expect(isArticleGrowPending('t', FLOW)).toBe(true);
      // Only the full-width estimate is asked for, once the writing rests (useNarrowHeightEstimate.test.ts).
      vi.advanceTimersByTime(NARROW_ESTIMATE_DELAY_MS);
      expect(tickTabs).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a Viewer in the narrow view asks for no estimate', () => {
    vi.useFakeTimers();
    try {
      const { hook, tickTabs } = setup(pageViewLens(stale(), 300), false);
      hook.result.current!.onLayout({ ...laidOut, local: true });
      vi.advanceTimersByTime(NARROW_ESTIMATE_DELAY_MS * 2);
      expect(tickTabs).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the drawn height', () => {
  it('a reader draws the page as tall as its writing here, storing nothing', () => {
    const tab = stale();
    const { hook, tickTabs } = setup(tab, false);
    act(() => hook.result.current!.onLayout(laidOut));
    expect(tickTabs).not.toHaveBeenCalled();
    const measured = hook.result.current!.measured;
    expect(measured.get(FLOW)).toEqual({ width: CONTINUOUS_PAGE_WIDTH, height: 2600 });
    const page = layOutPages(pagesOf(tab))[0]!;
    expect(page.rect.height).toBe(240);
    expect(drawnPageHeight(page, measured)).toBe(2600);
  });

  it('an Editor in read mode draws it too', () => {
    const tab = stale({ locked: true });
    const { hook } = setup(tab);
    act(() => hook.result.current!.onLayout(laidOut));
    const page = layOutPages(pagesOf(tab))[0]!;
    expect(drawnPageHeight(page, hook.result.current!.measured)).toBe(2600);
  });
});
