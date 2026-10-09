// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArticleBlock, Tab } from '@livediagram/document';
import { articleEditRefused, useArticles } from './useArticles';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const handle = vi.hoisted(() => ({
  flow: 'a',
  insertZone: vi.fn(),
  caretCanvasPoint: vi.fn(),
  flush: vi.fn(),
  moveZone: vi.fn(),
  markNote: vi.fn(),
  claimLayout: vi.fn(),
}));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => handle,
  markZoneReleased: vi.fn(),
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// docs/specs/007-editor/illustrate-pages.md "Locking a page": locking any page of an article makes
// its writing read-only, holds its page count and zones, from every way into the writing.
const blocks: ArticleBlock[] = [
  { id: 'p', type: 'paragraph', runs: [{ text: 'Hello' }] },
  { id: 'z', type: 'zone', zone: 'drawing', width: 100, height: 100 },
];
const tabWith = (locked: boolean): Tab =>
  ({
    id: 't',
    name: 'Tab',
    elements: [],
    pages: [
      { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a' },
      {
        id: 'a2',
        orientation: 'portrait',
        kind: 'article',
        flow: 'a',
        ...(locked ? { locked: true } : {}),
      },
    ],
    articles: { a: { blocks } },
  }) as unknown as Tab;

function setup(tab: Tab) {
  const commitTabs = vi.fn();
  const tickTabs = vi.fn();
  const placeAt = vi.fn();
  const { result } = renderHook(() =>
    useArticles({
      activeTab: tab,
      on: true,
      pages: null,
      localEditSeq: { current: 0 },
      placeAt,
      canEdit: true,
      commitTabs,
      tickTabs,
      undo: vi.fn(),
      redo: vi.fn(),
      clearSelection: vi.fn(),
      openNote: vi.fn(),
    }),
  );
  return { view: result.current!, commitTabs, tickTabs, placeAt };
}

beforeEach(() => {
  track.mockClear();
  for (const fn of Object.values(handle)) if (typeof fn === 'function') fn.mockReset();
});

describe('a locked page holds its article', () => {
  it('refuses an edit for no rights, a locked tab, or any locked page of the article', () => {
    expect(articleEditRefused(true, tabWith(false), 'a')).toBe(false);
    expect(articleEditRefused(false, tabWith(false), 'a')).toBe(true);
    expect(articleEditRefused(true, { ...tabWith(false), locked: true }, 'a')).toBe(true);
    expect(articleEditRefused(true, tabWith(true), 'a')).toBe(true);
    expect(articleEditRefused(true, tabWith(true), 'other')).toBe(false);
  });

  it('refuses the writing, whatever page the commit came from', () => {
    const { view, commitTabs } = setup(tabWith(true));
    expect(view.onCommit('a', blocks)).toBe(false);
    expect(commitTabs).not.toHaveBeenCalled();
  });

  it('accepts the writing of an unlocked article, and refuses it in the commit when a lock lands', () => {
    const { view, commitTabs } = setup(tabWith(false));
    expect(view.onCommit('a', blocks)).toBe(true);
    const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    const locked = tabWith(true);
    expect(update([locked])[0]).toBe(locked);
  });

  it('settles no layout for it: no page added, no zone moved', () => {
    const { view, tickTabs } = setup(tabWith(true));
    view.onLayout({ flow: 'a', pagesNeeded: 5, zones: [], notes: [], local: true });
    expect(tickTabs).not.toHaveBeenCalled();
  });

  it('refuses the toolbar, zone bar, notes, moves, embeds and style', () => {
    const { view, commitTabs, placeAt } = setup(tabWith(true));
    act(() => {
      view.insertObject('a', 'drawing');
      view.insertObject('a', 'table');
      view.zoneAction('a', 'z', { remove: true });
      view.embed('a', ['x'], 'inline');
      view.addNote('a', 'comment');
      view.moveZone('a', 'z', { by: 1 });
      view.setStyle('a', { look: 'bold' });
    });
    expect(handle.insertZone).not.toHaveBeenCalled();
    expect(handle.markNote).not.toHaveBeenCalled();
    expect(handle.moveZone).not.toHaveBeenCalled();
    expect(placeAt).not.toHaveBeenCalled();
    expect(commitTabs).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/article-pages.md "Telemetry": an insert counts once it went in.
describe('insert telemetry', () => {
  it('counts nothing for an insert that found no caret or no room', () => {
    const { view } = setup(tabWith(false));
    handle.caretCanvasPoint.mockReturnValue(null);
    handle.insertZone.mockReturnValue(null);
    view.insertObject('a', 'table');
    view.insertObject('a', 'drawing');
    expect(track).not.toHaveBeenCalled();
  });

  it('counts an object placed at the caret', () => {
    const { view, placeAt } = setup(tabWith(false));
    handle.caretCanvasPoint.mockReturnValue({ x: 10, y: 20 });
    view.insertObject('a', 'table');
    expect(placeAt).toHaveBeenCalledWith({ type: 'table' }, 10, 50);
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'ArticleTable');
  });
});
