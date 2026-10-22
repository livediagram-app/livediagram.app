import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { offlineProjectStats } from './offline-stats';

// docs/specs/013-workspace/explorer-details-view.md: a project in this browser is counted from its
// own record, the same way the api counts a stored tab.

const tab = (id: string, extra: Record<string, unknown>, comments: number[] = []): Tab =>
  ({
    id,
    name: id,
    ...extra,
    elements: comments.map((n, i) => ({
      id: `${id}-${i}`,
      commentThread: { comments: Array.from({ length: n }, () => ({})) },
    })),
  }) as unknown as Tab;

const bytesOf = (t: Tab) => {
  const { id: _id, name: _name, ...rest } = t;
  return new TextEncoder().encode(JSON.stringify(rest)).length;
};

describe('offlineProjectStats', () => {
  it('sums elements, comments and bytes over the tabs, in Plan', () => {
    const a = tab('a', {}, [2, 0]);
    const b = tab('b', {}, [1]);
    expect(offlineProjectStats({ id: 'd', savedAt: 1, tabs: [a, b] })).toEqual({
      mode: 'plan',
      elements: 3,
      comments: 3,
      bytes: bytesOf(a) + bytesOf(b),
    });
  });

  it('is null for a project with no tab', () => {
    expect(offlineProjectStats({ id: 'no-tabs', savedAt: 1, tabs: [] })).toBeNull();
  });

  it('answers the same object for the same saved record, so a list re-read costs nothing', () => {
    const rec = { id: 'cached', savedAt: 5, tabs: [tab('a', {})] };
    expect(offlineProjectStats(rec)).toBe(offlineProjectStats({ ...rec, tabs: [...rec.tabs] }));
    expect(offlineProjectStats({ ...rec, savedAt: 6 })).not.toBe(offlineProjectStats(rec));
  });
});
