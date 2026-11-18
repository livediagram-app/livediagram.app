// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  articlesOf,
  createShape,
  layOutPages,
  pagesOf,
  type ArticleZoneBlock,
  type Tab,
} from '@livedocuments/document';
import type { FlowLayout } from '@/components/canvas/article/article-editor-types';
import { clearArticleGrow } from '@/lib/article/article-grow-store';
import { useArticles } from './useArticles';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => null,
  markZoneReleased: vi.fn(),
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// Work Tracker 1177 (docs/specs/007-editor/article-pages.md "Only the writer of a change"): an article no writer here
// is settling has its zones settled by the first Editor to lay it out, so a written template's chart stands in its
// zone from the first open; never by a Viewer, never on a locked page, and once.
const chart = {
  ...createShape('bar-chart', 0, 0),
  id: 'chart',
  x: 20,
  y: 20,
  width: 80,
  height: 60,
};
const zone: ArticleZoneBlock = {
  id: 'z',
  type: 'zone',
  zone: 'object',
  width: 100,
  height: 100,
  at: { page: 'a1', x: 0, y: 0 },
};
const tabWith = (opts: { locked?: boolean; articles?: boolean } = {}): Tab => {
  const pages = [
    { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a' },
    {
      id: 'a2',
      orientation: 'portrait',
      kind: 'article',
      flow: 'a',
      ...(opts.locked ? { locked: true } : {}),
    },
  ];
  const base = { id: 't', name: 'Tab', pages } as unknown as Tab;
  const first = layOutPages(pagesOf(base))[0]!.rect;
  return {
    ...base,
    elements: [{ ...chart, x: first.x + 20, y: first.y + 20 }],
    ...(opts.articles === false
      ? {}
      : {
          articles: {
            a: { blocks: [{ id: 'p', type: 'paragraph', runs: [{ text: 'Hi' }] }, zone] },
          },
        }),
  } as unknown as Tab;
};
const laidOut: FlowLayout = {
  flow: 'a',
  pagesNeeded: 2,
  zones: [{ id: 'z', index: 1, x: 40, y: 50, width: 100, height: 100 }],
  notes: [],
  local: false,
};

function setup(tab: Tab, canEdit = true) {
  const tickTabs = vi.fn();
  const hook = renderHook(
    ({ activeTab }) =>
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
    { initialProps: { activeTab: tab } },
  );
  // What a tick makes of the tab.
  const ticked = (t: Tab): Tab => {
    const map = tickTabs.mock.calls.at(-1)![0] as (ts: Tab[]) => Tab[];
    return map([t])[0]!;
  };
  return { hook, tickTabs, ticked };
}

beforeEach(() => clearArticleGrow('t', 'a'));

describe('zones settled for an absent writer', () => {
  it('settles a zone where the writing laid it out, its chart moving with it, once', () => {
    const tab = tabWith();
    const { hook, tickTabs, ticked } = setup(tab);
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).toHaveBeenCalledTimes(1);
    const next = ticked(tab);
    const settled = articlesOf(next).a!.blocks[1] as ArticleZoneBlock;
    expect(settled.at).toEqual({ page: 'a2', x: 40, y: 50 });
    const [p1, p2] = layOutPages(pagesOf(tab));
    const moved = next.elements[0] as typeof chart;
    expect([moved.x, moved.y]).toEqual([p2!.rect.x + 40 + 20, p2!.rect.y + 50 + 20]);
    expect(p1).toBeDefined();
    // Settled: the next layout is left to the writer.
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).toHaveBeenCalledTimes(1);
  });

  it('changes nothing when every zone already stands where the writing put it', () => {
    const tab = tabWith();
    const { hook, tickTabs, ticked } = setup(tab);
    hook.result.current!.onLayout({
      ...laidOut,
      zones: [{ ...laidOut.zones[0]!, index: 0, x: 0, y: 0 }],
    });
    expect(tickTabs).toHaveBeenCalledTimes(1);
    expect(ticked(tab)).toBe(tab);
    hook.result.current!.onLayout({ ...laidOut, zones: [] });
    expect(tickTabs).toHaveBeenCalledTimes(1);
  });

  it('leaves the zones to a writer, a Viewer and a locked page', () => {
    const viewer = setup(tabWith(), false);
    viewer.hook.result.current!.onLayout(laidOut);
    expect(viewer.tickTabs).not.toHaveBeenCalled();
    const locked = setup(tabWith({ locked: true }));
    locked.hook.result.current!.onLayout(laidOut);
    expect(locked.tickTabs).not.toHaveBeenCalled();
  });

  it('grows the pages first, and settles the zones once they are right', () => {
    const tab = tabWith();
    const { hook, tickTabs } = setup(tab);
    hook.result.current!.onLayout({ ...laidOut, pagesNeeded: 3 });
    expect(tickTabs).toHaveBeenCalledTimes(1);
    const grown = (tickTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[])([tab])[0]!;
    expect(pagesOf(grown).length).toBe(3);
    hook.rerender({ activeTab: grown });
    hook.result.current!.onLayout({ ...laidOut, pagesNeeded: 3 });
    const settled = (tickTabs.mock.calls.at(-1)![0] as (ts: Tab[]) => Tab[])([grown])[0]!;
    expect((articlesOf(settled).a!.blocks[1] as ArticleZoneBlock).at?.page).toBe('a2');
  });

  it('counts an article that arrives after the tab (a template applied to it) as loading then', () => {
    const empty = tabWith({ articles: false });
    const { hook, tickTabs } = setup(empty);
    const tab = tabWith();
    hook.rerender({ activeTab: tab });
    hook.result.current!.onLayout(laidOut);
    expect(tickTabs).toHaveBeenCalledTimes(1);
  });
});
