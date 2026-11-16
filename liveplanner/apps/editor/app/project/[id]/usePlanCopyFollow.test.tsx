// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ItemStoreState } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import { PLAN_COPY_MAX_CARDS, PLAN_COPY_MAX_CELLS } from '@/lib/last-seen-plan';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": the copy follows the cards the board read and
// the first tab's sheets as they were read, never practice cards, an unloaded store or another tab's sheets; for a
// Dashboard first tab, the tabs its tiles show once each has loaded, a Sheet's with its sheets as read.

vi.mock('@/lib/last-seen', () => ({ lastSeenCopies: { followItem: vi.fn() } }));

import { usePlanCopyFollow } from './usePlanCopyFollow';

const storeOf = (n: number): ItemStoreState =>
  ({ items: Array.from({ length: n }, (_, i) => ({ id: `c${i}` })), rev: 1, nextKey: 1 }) as never;
const SHEETS = [{ id: 's1', tabId: 't1', cells: [] }] as unknown as SheetJson[];

type Props = Partial<Parameters<typeof usePlanCopyFollow>[0]>;
function mount(over: Props = {}) {
  const follower = { followItem: vi.fn() };
  const base = {
    reader: 'u',
    projectId: 'plan-1',
    following: true,
    loaded: true,
    store: storeOf(2),
    practiceCount: 0,
    tabs: [{ id: 't1' }, { id: 't2' }] as unknown as Tab[],
    loadedTabIds: new Set<string>() as ReadonlySet<string>,
    tabScope: null,
    follower,
  };
  const hook = renderHook((p: Props) => usePlanCopyFollow({ ...base, ...p }), {
    initialProps: over,
  });
  return { follower, hook, base };
}

describe('usePlanCopyFollow', () => {
  it('follows the cards on each change of the store, the store itself', () => {
    const { follower, hook, base } = mount();
    expect(follower.followItem).toHaveBeenCalledExactlyOnceWith('u', 'plan-1', {
      cards: base.store,
    });
    const next = storeOf(3);
    hook.rerender({ store: next });
    expect(follower.followItem).toHaveBeenLastCalledWith('u', 'plan-1', { cards: next });
  });

  it('keeps no cards past the cap', () => {
    const { follower } = mount({ store: storeOf(PLAN_COPY_MAX_CARDS + 1) });
    expect(follower.followItem).toHaveBeenCalledWith('u', 'plan-1', { cards: null });
  });

  it.each([
    ['not following', { following: false }],
    ['not loaded', { loaded: false }],
    ['no plan', { projectId: null }],
    ['practice cards on the board', { practiceCount: 1 }],
  ])('follows no cards when %s', (_why, over) => {
    const { follower } = mount(over);
    expect(follower.followItem).not.toHaveBeenCalled();
  });

  it("follows the first tab's sheets as they were read, and no other tab's", () => {
    const { follower, hook } = mount({ loaded: false });
    hook.result.current.onSheetsRead('t2', SHEETS);
    expect(follower.followItem).not.toHaveBeenCalled();
    hook.result.current.onSheetsRead('t1', SHEETS);
    expect(follower.followItem).toHaveBeenCalledExactlyOnceWith('u', 'plan-1', {
      sheets: { tabId: 't1', sheets: SHEETS },
    });
  });

  it("follows a tab-scoped link's tab as the first, and nothing while not following", () => {
    const { follower, hook } = mount({ loaded: false, tabScope: 't2' });
    hook.result.current.onSheetsRead('t2', SHEETS);
    expect(follower.followItem).toHaveBeenCalledOnce();
    hook.rerender({ loaded: false, tabScope: 't2', following: false });
    hook.result.current.onSheetsRead('t2', SHEETS);
    hook.rerender({ loaded: false, tabScope: 't2', projectId: null });
    hook.result.current.onSheetsRead('t2', SHEETS);
    expect(follower.followItem).toHaveBeenCalledOnce();
  });

  describe('a Dashboard first tab', () => {
    const slot = (id: string, tabId: string) => ({ id, span: 4, content: { type: 'tab', tabId } });
    const dash = {
      id: 'd1',
      name: 'Overview',
      kind: 'dashboard',
      elements: [],
      dashboard: {
        rows: [
          { id: 'r1', height: 300, slots: [slot('a', 'b1'), slot('b', 's1'), slot('c', 'gone')] },
        ],
      },
    } as unknown as Tab;
    const board = {
      id: 'b1',
      name: 'Timeline',
      kind: 'board',
      elements: [{ id: 'e1' }],
    } as unknown as Tab;
    const sheet = {
      id: 's1',
      name: 'Budget',
      kind: 'sheet',
      elements: [{ id: 'e2' }],
    } as unknown as Tab;
    const READ = [{ id: 'sh1', tabId: 's1', cells: [{}, {}] }] as unknown as SheetJson[];
    const tabs = [dash, board, sheet];
    const all = new Set(['d1', 'b1', 's1']);
    const refsCalls = (f: { followItem: ReturnType<typeof vi.fn> }): object[] =>
      (f.followItem.mock.calls as [string, string, object][])
        .map((c) => c[2])
        .filter((fields) => 'refs' in fields);

    it('keeps the tabs a Dashboard first tab shows once each has loaded, its Sheet with its read', () => {
      const { follower, hook } = mount({
        loaded: false,
        tabs,
        loadedTabIds: new Set(['d1', 'b1']),
      });
      // The Sheet has not loaded, nor been read: nothing yet.
      expect(refsCalls(follower)).toEqual([]);
      hook.rerender({ loaded: false, tabs, loadedTabIds: all });
      expect(refsCalls(follower)).toEqual([]);
      act(() => hook.result.current.onSheetsRead('s1', READ));
      hook.rerender({ loaded: false, tabs, loadedTabIds: all });
      // The deleted tab is left out; the Sheet's read goes with it.
      expect(refsCalls(follower)).toEqual([
        { refs: { tabs: [board, sheet], sheets: [{ tabId: 's1', sheets: READ }] } },
      ]);
      // Another render with the same shown tabs writes nothing more; a changed shown tab does.
      hook.rerender({ loaded: false, tabs: [...tabs], loadedTabIds: all });
      expect(refsCalls(follower)).toHaveLength(1);
      const moved = { ...board, elements: [{ id: 'e1b' }] } as unknown as Tab;
      hook.rerender({ loaded: false, tabs: [dash, moved, sheet], loadedTabIds: all });
      expect(refsCalls(follower)).toHaveLength(2);
      expect(refsCalls(follower)[1]).toEqual({
        refs: { tabs: [moved, sheet], sheets: [{ tabId: 's1', sheets: READ }] },
      });
    });

    it('keeps none past the cell cap, and nothing while not following', () => {
      const big = [
        { id: 'sh1', tabId: 's1', cells: Array.from({ length: PLAN_COPY_MAX_CELLS + 1 }) },
      ] as unknown as SheetJson[];
      const { follower, hook } = mount({ loaded: false, tabs, loadedTabIds: all });
      act(() => hook.result.current.onSheetsRead('s1', big));
      hook.rerender({ loaded: false, tabs, loadedTabIds: all });
      expect(refsCalls(follower)).toEqual([{ refs: null }]);
      const off = mount({ loaded: false, tabs, loadedTabIds: all, following: false });
      off.hook.result.current.onSheetsRead('s1', READ);
      off.hook.rerender({ loaded: false, tabs, loadedTabIds: all, following: false });
      expect(off.follower.followItem).not.toHaveBeenCalled();
    });

    it('keeps nothing for a Dashboard with no tab tiles, nor for another first tab', () => {
      const bare = { ...dash, dashboard: { rows: [] } } as unknown as Tab;
      const a = mount({ loaded: false, tabs: [bare, board], loadedTabIds: all });
      expect(refsCalls(a.follower)).toEqual([]);
      const b = mount({ loaded: false, tabs: [board, dash], loadedTabIds: all });
      expect(refsCalls(b.follower)).toEqual([]);
    });
  });

  it('follows through the last seen copies by default', async () => {
    const { lastSeenCopies } = await import('@/lib/last-seen');
    renderHook(() =>
      usePlanCopyFollow({
        reader: 'u',
        projectId: 'plan-1',
        following: true,
        loaded: true,
        store: storeOf(1),
        practiceCount: 0,
        tabs: [],
        loadedTabIds: new Set(),
        tabScope: null,
      }),
    );
    expect(lastSeenCopies.followItem).toHaveBeenCalledOnce();
  });
});
