// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  NO_PULL_REQUEST_STATUSES,
  type Item,
  type ItemTypeDef,
  type PullRequestStatus,
} from '@liveplanner/items';
import { usePullRequestStatuses } from './usePullRequestStatuses';

// The screen's pull request states (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards"; blueprint
// "Part 3" "The editor"): each read's, the room's ops, and one more read per pull request a card names that the screen
// has no state for, while the plan is connected.

const by = { id: 'p', name: 'Sam', color: '#000000' };
const types: ItemTypeDef[] = [
  {
    ...ITEM_TYPES[0],
    id: 'task',
    custom: [{ id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' }],
  },
];
const card = (id: string, n?: number): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: id, ...(n ? { 'f-pr': `https://github.com/acme/web/pull/${n}` } : {}) },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const status = (n: number, o: Partial<PullRequestStatus> = {}): PullRequestStatus => ({
  key: `acme/web#${n}`,
  url: `https://github.com/acme/web/pull/${n}`,
  title: `PR ${n}`,
  state: 'open',
  updatedAt: 1,
  ...o,
});
const mapOf = (...items: Item[]) => new Map(items.map((i) => [i.id, i]));

function hook(items = mapOf(card('a', 1))) {
  const refetch = vi.fn();
  const r = renderHook(
    (p: { items: ReadonlyMap<string, Item> }) =>
      usePullRequestStatuses({ items: p.items, types, refetch }),
    { initialProps: { items } },
  );
  return { ...r, refetch };
}

describe('usePullRequestStatuses', () => {
  it('holds none, and asks nothing, for a plan with no connection', () => {
    const { result, refetch } = hook();
    act(() => result.current.read(undefined));
    expect(result.current.statuses).toBe(NO_PULL_REQUEST_STATUSES);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('takes a read’s states, keeping an unchanged state’s object across reads', () => {
    const { result, refetch } = hook();
    act(() => result.current.read([status(1)]));
    const first = result.current.statuses.byKey.get('acme/web#1');
    expect(first?.title).toBe('PR 1');
    act(() => result.current.read([{ ...status(1) }, status(2, { cards: ['a'] })]));
    expect(result.current.statuses.byKey.get('acme/web#1')).toBe(first);
    expect(result.current.statuses.byCard.get('a')!.map((s) => s.key)).toEqual(['acme/web#2']);
    // What a read leaves out is gone; no state for a card's pull request the read answered asks nothing more.
    act(() => result.current.read([]));
    expect(result.current.statuses).toBe(NO_PULL_REQUEST_STATUSES);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('applies the room’s upserts and removals, and a reset drops every one', () => {
    const { result } = hook();
    act(() => result.current.read([status(1)]));
    act(() =>
      result.current.receive({
        kind: 'pull-requests',
        upserts: [status(1, { state: 'merged' }), status(3)],
        removed: [],
      }),
    );
    expect(result.current.statuses.byKey.get('acme/web#1')!.state).toBe('merged');
    act(() =>
      result.current.receive({ kind: 'pull-requests', upserts: [], removed: ['acme/web#3'] }),
    );
    expect([...result.current.statuses.byKey.keys()]).toEqual(['acme/web#1']);
    act(() =>
      result.current.receive({ kind: 'pull-requests', upserts: [], removed: [], reset: true }),
    );
    expect(result.current.statuses).toBe(NO_PULL_REQUEST_STATUSES);
  });

  it('reads again for a tab’s empty op', () => {
    const { result, refetch } = hook();
    act(() => result.current.receive({ kind: 'pull-requests', upserts: [], removed: [] }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reads once more for a pull request just pasted that it has no state for, once per pull request', () => {
    const { result, refetch, rerender } = hook();
    act(() => result.current.read([status(1)]));
    expect(refetch).not.toHaveBeenCalled();
    rerender({ items: mapOf(card('a', 1), card('b', 5)) });
    expect(refetch).toHaveBeenCalledTimes(1);
    // The same pull request again, on another card: already asked after.
    rerender({ items: mapOf(card('a', 1), card('b', 5), card('c', 5)) });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
