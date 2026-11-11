import { describe, expect, it } from 'vitest';
import {
  admitChangesetOp,
  noteLoadedRev,
  type ChangesetAdmissionOp,
  type ChangesetSeen,
} from './changeset-seen';

// Which relayed changesets an editor applies (docs/specs/024-agents/blueprints/agent-changesets.md
// "The editor", CS21): one table row a case.

const op = (over: Partial<ChangesetAdmissionOp> = {}): ChangesetAdmissionOp => ({
  tabId: 't1',
  rev: 5,
  prevRev: 4,
  ...over,
});
const loaded = new Set(['t1']);
const seenAt = (rev: number): ChangesetSeen => new Map([['t1', rev]]);

describe('admitChangesetOp', () => {
  it('skips a tab this editor has not loaded: its first load carries it', () => {
    expect(admitChangesetOp(seenAt(4), op({ tabId: 't9' }), loaded)).toBe('skip');
  });

  it('applies a changeset that created a tab this editor does not have', () => {
    expect(
      admitChangesetOp(
        new Map(),
        op({ tabId: 't9', tab: { id: 't9', name: 'New' }, prevRev: null, rev: 1 }),
        loaded,
      ),
    ).toBe('apply');
  });

  it('skips what the loaded content already holds', () => {
    expect(admitChangesetOp(seenAt(5), op(), loaded)).toBe('skip');
    expect(admitChangesetOp(seenAt(9), op(), loaded)).toBe('skip');
  });

  it('applies and refetches when a changeset before it was missed', () => {
    expect(admitChangesetOp(seenAt(2), op({ prevRev: 4 }), loaded)).toBe('apply-and-refetch');
  });

  it('refetches an op relayed without its element ops', () => {
    expect(admitChangesetOp(seenAt(4), op({ refetch: true }), loaded)).toBe('refetch');
    expect(admitChangesetOp(seenAt(2), op({ refetch: true }), loaded)).toBe('refetch');
  });

  it('applies the next changeset in line, and the first one a tab ever had', () => {
    expect(admitChangesetOp(seenAt(4), op(), loaded)).toBe('apply');
    expect(admitChangesetOp(seenAt(1), op({ prevRev: null, rev: 3 }), loaded)).toBe('apply');
  });
});

describe('noteLoadedRev', () => {
  it('records what a load holds, never moving backwards', () => {
    const seen: ChangesetSeen = new Map();
    noteLoadedRev(seen, 't1', 4);
    noteLoadedRev(seen, 't1', 2);
    expect(seen.get('t1')).toBe(4);
  });
});
