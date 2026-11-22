import { describe, expect, it } from 'vitest';
import type { VersionSummary } from '@liveknowledge/api-schema';
import { mergeVersion } from './useVersionHistory';

// The rail's list after a name is given or taken off (docs/specs/006-document/version-history.md "Where versions are
// kept"): in place, under the id it was asked for, one per revision.

const v = (id: string, rev: number, name: string | null): VersionSummary => ({
  id,
  tabId: 't1',
  rev,
  kind: 'manual',
  name,
  author: null,
  savedAt: rev,
  createdAt: rev,
  bytes: 1,
  elementCount: 0,
});

const ids = (list: VersionSummary[]) => list.map((x) => `${x.id}:${x.name ?? '-'}`);

describe('mergeVersion', () => {
  it('replaces a renamed row in place', () => {
    const list = [v('a', 3, null), v('b', 2, 'B'), v('c', 1, null)];
    expect(ids(mergeVersion(list, v('b', 2, 'B2')))).toEqual(['a:-', 'b:B2', 'c:-']);
  });

  it('puts a new named version first and leaves out the automatic one at its revision', () => {
    const list = [v('a', 3, null), v('c', 1, null)];
    expect(ids(mergeVersion(list, v('s_new', 3, 'Named')))).toEqual(['s_new:Named', 'c:-']);
  });

  it('answers an unnamed row under another id in its place', () => {
    const list = [v('a', 3, null), v('s_b', 2, 'B'), v('c', 1, null)];
    expect(ids(mergeVersion(list, v('v_auto', 2, null), 's_b'))).toEqual([
      'a:-',
      'v_auto:-',
      'c:-',
    ]);
  });

  it('keeps an automatic row at another revision', () => {
    const list = [v('a', 3, null)];
    expect(ids(mergeVersion(list, v('s_n', 2, 'N')))).toEqual(['s_n:N', 'a:-']);
  });
});
