// @vitest-environment jsdom
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LastSeenItem } from '../../lib/api/last-seen-follower';
import { useLastSeenFollow } from './useLastSeenFollow';

type Tab = { id: string; name: string; folder?: string; elements: number[] };

function follower(follows = true) {
  return {
    follows: vi.fn(() => follows),
    followMeta: vi.fn(),
    followSave: vi.fn(),
    forget: vi.fn(async () => {}),
  };
}

const t1: Tab = { id: 't1', name: 'One', elements: [1] };
const t2: Tab = { id: 't2', name: 'Two', elements: [] };
const tabs: Tab[] = [t1, t2];

type Props = Parameters<typeof useLastSeenFollow<LastSeenItem>>[0];
const base = (f: ReturnType<typeof follower>): Props => ({
  follower: f,
  reader: 'user_a',
  itemId: 'd1',
  following: true,
  serverStored: true,
  hydrated: true,
  name: 'Plan',
  tabs,
});

describe('useLastSeenFollow', () => {
  it('follows the name and the tab list, never an edit inside a tab', () => {
    const f = follower();
    const { rerender } = renderHook((p: Props) => useLastSeenFollow(p), { initialProps: base(f) });
    expect(f.followMeta).toHaveBeenCalledTimes(1);
    expect(f.followMeta).toHaveBeenLastCalledWith('user_a', 'd1', { name: 'Plan', tabs });
    // An element edit: new tab objects, the same ids, names and folders.
    const e1: Tab = { ...t1, elements: [1, 2] };
    const edited = [e1, t2];
    rerender({ ...base(f), tabs: edited });
    expect(f.followMeta).toHaveBeenCalledTimes(1);
    rerender({ ...base(f), tabs: edited, name: 'Plan 2' });
    expect(f.followMeta).toHaveBeenCalledTimes(2);
    const moved = [t2, { ...e1, folder: 'Ideas' }];
    rerender({ ...base(f), tabs: moved, name: 'Plan 2' });
    expect(f.followMeta).toHaveBeenCalledTimes(3);
    expect(f.followMeta).toHaveBeenLastCalledWith('user_a', 'd1', { name: 'Plan 2', tabs: moved });
  });

  it('follows nothing while not following or without an item', () => {
    const f = follower();
    const { rerender, result } = renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: { ...base(f), following: false },
    });
    rerender({ ...base(f), following: false, name: 'Other' });
    result.current.onSaveLanded({ name: 'Plan', tabs, revs: new Map() });
    rerender({ ...base(f), itemId: null });
    result.current.onSaveLanded({ name: 'Plan', tabs, revs: new Map() });
    expect(f.followMeta).not.toHaveBeenCalled();
    expect(f.followSave).not.toHaveBeenCalled();
  });

  it('hands each landed save to the follower under the current reader and item', () => {
    const f = follower();
    const { result, rerender } = renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: base(f),
    });
    const first = result.current.onSaveLanded;
    rerender({ ...base(f), itemId: 'd2' });
    expect(result.current.onSaveLanded).toBe(first);
    const landing = { name: 'Plan', tabs, revs: new Map([['t1', 4]]) };
    result.current.onSaveLanded(landing);
    expect(f.followSave).toHaveBeenCalledWith('user_a', 'd2', landing);
  });

  it('forgets the copy of a document taken offline to This Browser', () => {
    const f = follower();
    const { rerender } = renderHook((p: Props) => useLastSeenFollow(p), { initialProps: base(f) });
    expect(f.forget).not.toHaveBeenCalled();
    rerender({ ...base(f), serverStored: false, following: false });
    expect(f.forget).toHaveBeenCalledWith('user_a', 'd1');
  });

  it('forgets nothing for a This Browser document it never followed, nor before hydrating', () => {
    const f = follower(false);
    renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: { ...base(f), serverStored: false, following: false },
    });
    const g = follower();
    renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: { ...base(g), serverStored: false, hydrated: false, following: false },
    });
    renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: { ...base(g), serverStored: false, itemId: null, following: false },
    });
    expect(f.forget).not.toHaveBeenCalled();
    expect(g.forget).not.toHaveBeenCalled();
  });

  it('keeps an edit render cheap: 1,000 renders of a 200-tab document within budget', () => {
    const f = follower();
    const many: Tab[] = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: [],
    }));
    const [head, ...rest] = many as [Tab, ...Tab[]];
    const { rerender } = renderHook((p: Props) => useLastSeenFollow(p), {
      initialProps: { ...base(f), tabs: many },
    });
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1_000; i++) rerender({ ...base(f), tabs: [{ ...head }, ...rest] });
    });
    expect(f.followMeta).toHaveBeenCalledTimes(1);
    expect(ms).toBeLessThan(2_000);
  });
});
