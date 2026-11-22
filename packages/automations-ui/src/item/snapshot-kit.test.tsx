// @vitest-environment jsdom
// Take Snapshot and Revert to Snapshot for an app whose kinds are its own (liveplanner automations.md "Snapshot
// steps"): the read-once snapshot list as a kit's outline holds it, and the two tiles and their group.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_GROUP_ID, snapshotGroup, snapshotKitActions } from './snapshot-kit';
import { snapshotListStore, useSnapshotList } from './snapshot-list';
import type { ItemSnapshot, ItemSnapshots } from './types';

afterEach(cleanup);

const SNAP: ItemSnapshot = {
  id: 'sn1',
  name: 'Monday Start',
  kind: 'manual',
  createdAt: 1,
  createdBy: { id: 'u1', name: 'Ana', color: '#000' },
} as unknown as ItemSnapshot;

describe('useSnapshotList', () => {
  it('reads only when asked, once, and shares the answer', async () => {
    const store = snapshotListStore();
    const read = vi.fn(async () => [SNAP]);
    const { result } = renderHook(() => useSnapshotList(store, 'p1', read, false));
    expect(result.current.status).toBe('idle');
    expect(read).not.toHaveBeenCalled();
    act(() => result.current.ask());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.list).toEqual([SNAP]);
    act(() => result.current.ask());
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads at once when wanted, and reads again on retry after a failure', async () => {
    const store = snapshotListStore();
    const read = vi
      .fn<() => Promise<readonly ItemSnapshot[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([SNAP]);
    const { result } = renderHook(() => useSnapshotList(store, 'p1', read, true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('forgets the list when the last holder goes', async () => {
    const store = snapshotListStore();
    const read = vi.fn(async () => [SNAP]);
    const first = renderHook(() => useSnapshotList(store, 'p1', read, true));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    expect(store.get('p1').status).toBe('idle');
  });
});

describe('snapshotKitActions', () => {
  it('builds both tiles at the top level, a revert last, in the Snapshots group', () => {
    const tiles = snapshotKitActions<{ kind: string }, { snapshots: ItemSnapshots }>('plan');
    expect(Object.keys(tiles)).toEqual(['take_snapshot', 'revert_snapshot']);
    expect(tiles.take_snapshot).toMatchObject({ name: 'Take Snapshot', top: true });
    expect(tiles.take_snapshot.last).toBeUndefined();
    expect(tiles.revert_snapshot).toMatchObject({
      name: 'Revert to Snapshot',
      top: true,
      last: true,
    });
    expect(tiles.take_snapshot.fresh()).toEqual({ kind: 'take_snapshot', name: '{{now.date}}' });
    expect(tiles.revert_snapshot.fresh()).toEqual({ kind: 'revert_snapshot', snapshot: '' });
    expect(tiles.take_snapshot.line).toMatch(/plan/);
    expect(tiles.take_snapshot.scene()).toBeTruthy();
    expect(snapshotGroup()).toEqual({
      id: SNAPSHOT_GROUP_ID,
      name: 'Snapshots',
      kinds: ['take_snapshot', 'revert_snapshot'],
    });
  });
});
