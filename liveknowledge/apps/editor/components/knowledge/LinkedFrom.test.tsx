// @vitest-environment jsdom

// Linked From (docs/specs/030-knowledgebase/links-and-embeds.md "Backlinks"): chips in the order the route gives
// (tree order), absent with none, read when the page opens and after a saved change to the page's links.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArticleBlock, Tab } from '@liveknowledge/document';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import {
  LINKS_SETTLE_MS,
  createBacklinksStore,
  linkTargetsKey,
} from '@/lib/knowledge/backlinks-store';

const api = vi.hoisted(() => ({ apiPageBacklinks: vi.fn() }));
vi.mock('@/lib/api/knowledge', () => api);
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { LinkedFrom, LinkedFromView } from './LinkedFrom';

const para = (id: string, runs: object[]) => ({ id, type: 'paragraph', runs }) as ArticleBlock;
const page = (id: string, name: string, runs: object[] = [{ text: 'Words' }]): Tab => ({
  id,
  name,
  elements: [],
  articles: { 'art-1': { blocks: [para('b', runs)] } },
});

let n = 0;
function mount(level: 'edit' | 'participate' | 'view' = 'view') {
  const documentId = `d${++n}`;
  const tabs = [page('here', 'Rollbacks'), page('a', 'Handbook'), page('b', 'Release Process')];
  const setActiveId = vi.fn();
  const fields: Record<string, unknown> = {
    documentId,
    tabs,
    activeId: 'here',
    activeTab: tabs[0],
    selfParticipant: { id: 'u1', name: 'Priya' },
    sessionShareCode: null,
    sessionRole: level,
    setActiveId,
  };
  const valueOf = (over: Record<string, unknown> = {}) =>
    new Proxy(
      { ...fields, ...over },
      { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
    ) as unknown as EditorContextValue;
  const store = createEditorChromeStore(valueOf());
  const renders = { count: 0 };
  render(
    <EditorChromeContext.Provider value={store}>
      <Profiler id="linked" onRender={() => renders.count++}>
        <LinkedFrom />
      </Profiler>
    </EditorChromeContext.Provider>,
  );
  return { store, valueOf, tabs, setActiveId, renders, documentId };
}

beforeEach(() => {
  api.apiPageBacklinks.mockResolvedValue([
    { tab: 'a', title: 'Handbook' },
    { tab: 'b', title: 'Old Title' },
    { tab: 'gone', title: 'Deleted Since' },
  ]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Linked From', () => {
  it('is absent with no backlinks: no heading, no empty state', () => {
    const { container } = render(<LinkedFromView backlinks={[]} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('counts the pages in its label, one page or several', () => {
    const view = render(
      <LinkedFromView backlinks={[{ tab: 'a', title: 'Handbook' }]} onOpen={vi.fn()} />,
    );
    expect(screen.getByText('Linked From 1 Page')).toBeTruthy();
    view.rerender(
      <LinkedFromView
        backlinks={[
          { tab: 'a', title: 'Handbook' },
          { tab: 'b', title: '' },
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('Linked From 2 Pages')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Untitled Page' })).toBeTruthy();
  });

  it.each(['edit', 'participate', 'view'] as const)(
    'a %s session sees the chips in the route’s order, each with its page’s current title, and follows one',
    async (level) => {
      const { setActiveId, documentId } = mount(level);
      await waitFor(() =>
        expect(screen.getByRole('navigation', { name: 'Linked From' })).toBeTruthy(),
      );
      expect(api.apiPageBacklinks.mock.calls[0]!.slice(1)).toEqual([documentId, 'here']);
      // The title as it is now, and no chip for a page deleted since the read.
      expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
        'Handbook',
        'Release Process',
      ]);
      const chip = screen.getByRole('link', { name: 'Release Process' });
      expect(chip.getAttribute('href')).toBe('#t=b');
      fireEvent.click(chip);
      expect(setActiveId).toHaveBeenCalledWith('b');
    },
  );

  it('reads once when the page opens; a typing commit reads nothing and renders nothing', async () => {
    const { store, valueOf, renders } = mount('edit');
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    vi.useFakeTimers();
    renders.count = 0;
    act(() =>
      store.set(valueOf({ activeTab: page('here', 'Rollbacks', [{ text: 'Words typed' }]) })),
    );
    act(() => void vi.advanceTimersByTime(LINKS_SETTLE_MS * 2));
    expect(api.apiPageBacklinks).toHaveBeenCalledTimes(1);
    expect(renders.count).toBe(0);
  });

  it('reads again once a commit that changed the page’s links has had time to save', async () => {
    const { store, valueOf } = mount('edit');
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    vi.useFakeTimers();
    const linked = page('here', 'Rollbacks', [{ text: 'See ' }, { text: 'Handbook', page: 'a' }]);
    act(() => store.set(valueOf({ activeTab: linked })));
    act(() => void vi.advanceTimersByTime(LINKS_SETTLE_MS - 1));
    expect(api.apiPageBacklinks).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(api.apiPageBacklinks).toHaveBeenCalledTimes(2);
  });
});

describe('the store', () => {
  it('shares one request a page, keeps the last answer on a failure, and tells readers only of a change', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce([{ tab: 'a', title: 'Handbook' }])
      .mockResolvedValueOnce([{ tab: 'a', title: 'Handbook' }])
      .mockRejectedValueOnce(new Error('down'));
    const store = createBacklinksStore(read);
    const seen = vi.fn();
    store.subscribe(seen);
    const who = { ownerId: 'u1', shareCode: null };
    await Promise.all([store.load(who, 'd', 't'), store.load(who, 'd', 't')]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.of('d', 't')).toEqual([{ tab: 'a', title: 'Handbook' }]);
    const held = store.of('d', 't');
    await store.load(who, 'd', 't');
    await store.load(who, 'd', 't');
    expect(store.of('d', 't')).toBe(held);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.of('d', 'other')).toEqual([]);
  });

  it('reads a page’s link targets once per block list', () => {
    const blocks = [
      para('b', [{ text: 'x', page: 'p2' }, { text: 'y', page: 'p1' }, { text: 'z' }]),
    ];
    expect(linkTargetsKey(blocks)).toBe('p1\u0000p2');
    expect(
      linkTargetsKey([
        para('b', [
          { text: 'other words', page: 'p2' },
          { text: 'y', page: 'p1' },
        ]),
      ]),
    ).toBe(linkTargetsKey(blocks));
    expect(linkTargetsKey(undefined)).toBe('');
  });
});
