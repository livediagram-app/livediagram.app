// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ItemStoreState } from '@liveplanner/items';
import type { SheetJson } from '@liveplanner/sheets';
import { PLAN_COPY_MAX_CARDS } from '@/lib/last-seen-plan';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": the copy follows the cards the board read and
// the first tab's sheets as they were read, never practice cards, an unloaded store or another tab's sheets.

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
    tabs: [{ id: 't1' }, { id: 't2' }],
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
        tabScope: null,
      }),
    );
    expect(lastSeenCopies.followItem).toHaveBeenCalledOnce();
  });
});
