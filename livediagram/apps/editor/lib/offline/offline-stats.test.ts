import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { offlineDocumentStats } from './offline-stats';

// docs/specs/013-workspace/explorer-details-view.md: a document in this browser is counted from its
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

describe('offlineDocumentStats', () => {
  it('sums elements, comments and bytes over the tabs, in the first tab mode', () => {
    const a = tab('a', { opensIn: 'draw' }, [2, 0]);
    const b = tab('b', { opensIn: 'plan' }, [1]);
    expect(offlineDocumentStats({ id: 'd', savedAt: 1, tabs: [a, b] })).toEqual({
      mode: 'draw',
      elements: 3,
      comments: 3,
      bytes: bytesOf(a) + bytesOf(b),
    });
  });

  it('is null for a document with no tab', () => {
    expect(offlineDocumentStats({ id: 'no-tabs', savedAt: 1, tabs: [] })).toBeNull();
  });

  it('answers the same object for the same saved record, so a list re-read costs nothing', () => {
    const rec = { id: 'cached', savedAt: 5, tabs: [tab('a', {})] };
    expect(offlineDocumentStats(rec)).toBe(offlineDocumentStats({ ...rec, tabs: [...rec.tabs] }));
    expect(offlineDocumentStats({ ...rec, savedAt: 6 })).not.toBe(offlineDocumentStats(rec));
  });
});
