import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import {
  HISTORY_LIMIT,
  type History,
  historyApplyRemote,
  historyCommit,
  historyMarkCheckpoint,
  historyRedo,
  historyReset,
  historyTick,
  historyCancel,
  historyUndo,
} from './useDiagramHistory';

const tab = (id: string, label = id): Tab => ({
  id,
  name: id,
  elements: [{ id: `el-${label}`, type: 'text', x: 0, y: 0, width: 50, height: 20, label }],
});

const start = (present: Tab[] = [tab('A', 'a')]): History => ({
  past: [],
  present,
  future: [],
});

describe('historyCommit', () => {
  it('pushes present to past, replaces present, clears future', () => {
    const h = { past: [], present: [tab('A', 'a')], future: [[tab('Z')]] };
    const next = historyCommit(h, (ts) => [...ts, tab('B', 'b')]);
    expect(next.past).toEqual([[tab('A', 'a')]]);
    expect(next.present).toEqual([tab('A', 'a'), tab('B', 'b')]);
    expect(next.future).toEqual([]);
  });

  it('caps the past stack at HISTORY_LIMIT', () => {
    // Build a past that's already at the cap, then commit one more.
    const filled: History = {
      past: Array.from({ length: HISTORY_LIMIT }, (_, i) => [tab(`P${i}`)]),
      present: [tab('present')],
      future: [],
    };
    const next = historyCommit(filled, (ts) => ts);
    expect(next.past).toHaveLength(HISTORY_LIMIT);
    // Oldest entry should have been dropped (FIFO eviction).
    expect(next.past[0]).toEqual([tab('P1')]);
    // The previous present should be the newest past row.
    expect(next.past[HISTORY_LIMIT - 1]).toEqual([tab('present')]);
  });
});

describe('historyTick', () => {
  it('updates present without touching past or future', () => {
    const h: History = { past: [[tab('P')]], present: [tab('cur', 'c')], future: [[tab('F')]] };
    const next = historyTick(h, () => [tab('new', 'n')]);
    expect(next.past).toBe(h.past);
    expect(next.future).toBe(h.future);
    expect(next.present).toEqual([tab('new', 'n')]);
  });
});

describe('historyMarkCheckpoint', () => {
  it('pushes a copy of present to past without replacing it', () => {
    const h = start([tab('A', 'a')]);
    const next = historyMarkCheckpoint(h);
    expect(next.past).toEqual([[tab('A', 'a')]]);
    expect(next.present).toEqual([tab('A', 'a')]);
    expect(next.future).toEqual([]);
  });
});

describe('historyUndo', () => {
  it('returns the same history when past is empty', () => {
    const h = start();
    expect(historyUndo(h)).toBe(h);
  });

  it('pops past → present, moves the old present into future', () => {
    const h: History = {
      past: [[tab('A', 'a')], [tab('B', 'b')]],
      present: [tab('C', 'c')],
      future: [],
    };
    const next = historyUndo(h);
    expect(next.past).toEqual([[tab('A', 'a')]]);
    expect(next.present).toEqual([tab('B', 'b')]);
    expect(next.future).toEqual([[tab('C', 'c')]]);
  });

  it('caps the future stack at HISTORY_LIMIT on consecutive undos', () => {
    // Past with 4 entries; future already capped at HISTORY_LIMIT.
    const h: History = {
      past: [[tab('P0')]],
      present: [tab('cur')],
      future: Array.from({ length: HISTORY_LIMIT }, (_, i) => [tab(`F${i}`)]),
    };
    const next = historyUndo(h);
    expect(next.future).toHaveLength(HISTORY_LIMIT);
    // The new "current" (was present) lands at the front of future.
    expect(next.future[0]).toEqual([tab('cur')]);
  });
});

describe('historyRedo', () => {
  it('returns the same history when future is empty', () => {
    const h = start();
    expect(historyRedo(h)).toBe(h);
  });

  it('shifts future → present, pushes the old present onto past', () => {
    const h: History = {
      past: [[tab('A', 'a')]],
      present: [tab('B', 'b')],
      future: [[tab('C', 'c')], [tab('D', 'd')]],
    };
    const next = historyRedo(h);
    expect(next.past).toEqual([[tab('A', 'a')], [tab('B', 'b')]]);
    expect(next.present).toEqual([tab('C', 'c')]);
    expect(next.future).toEqual([[tab('D', 'd')]]);
  });
});

describe('historyReset', () => {
  it('replaces present with the given tabs and clears past + future', () => {
    const h: History = {
      past: [[tab('p')]],
      present: [tab('cur')],
      future: [[tab('f')]],
    };
    const next = historyReset(h, [tab('new')]);
    expect(next.past).toEqual([]);
    expect(next.present).toEqual([tab('new')]);
    expect(next.future).toEqual([]);
  });

  it('accepts a callback that receives the current present', () => {
    const h = start([tab('cur', 'c')]);
    const next = historyReset(h, (prev) => [...prev, tab('extra', 'e')]);
    expect(next.present).toEqual([tab('cur', 'c'), tab('extra', 'e')]);
  });
});

describe('historyApplyRemote', () => {
  it('replaces present but PRESERVES past and future (unlike reset)', () => {
    const h: History = {
      past: [[tab('P0')]],
      present: [tab('cur', 'c')],
      future: [[tab('F0')]],
    };
    const next = historyApplyRemote(h, [tab('peer', 'p')]);
    expect(next.present).toEqual([tab('peer', 'p')]);
    // The whole point: a collaborator's op must not wipe undo / redo.
    expect(next.past).toEqual([[tab('P0')]]);
    expect(next.future).toEqual([[tab('F0')]]);
  });

  it('accepts a callback merger that receives the current present', () => {
    const h = start([tab('cur', 'c')]);
    const next = historyApplyRemote(h, (prev) => [...prev, tab('extra', 'e')]);
    expect(next.present).toEqual([tab('cur', 'c'), tab('extra', 'e')]);
    expect(next.past).toEqual([]);
  });

  it('still allows an undo back to the pre-remote local state', () => {
    // Local commit (A -> AB), then a remote op lands. Undo should return
    // to A (the retained past), not be lost.
    const committed = historyCommit(start([tab('A', 'a')]), (ts) => [...ts, tab('B', 'b')]);
    const afterRemote = historyApplyRemote(committed, (prev) => [...prev, tab('R', 'r')]);
    const undone = historyUndo(afterRemote);
    expect(undone.present).toEqual([tab('A', 'a')]);
  });
});

describe('historyCancel (Escape aborts an in-flight gesture)', () => {
  it('restores the checkpoint into the present and discards the step', () => {
    const t = (name: string) => [{ id: 't1', name, elements: [] }];
    const start = { past: [t('before')], present: t('dragged'), future: [t('redoable')] };
    const out = historyCancel(start);
    expect(out.present[0]!.name).toBe('before');
    expect(out.past).toEqual([]);
    // Unlike undo, nothing lands on the redo side — and the existing
    // redo stack survives (the checkpoint never cleared it... it did,
    // but cancel itself must not invent entries).
    expect(out.future).toEqual([t('redoable')]);
  });

  it('is a no-op with no checkpoint to restore', () => {
    const h = { past: [], present: [{ id: 't1', name: 'x', elements: [] }], future: [] };
    expect(historyCancel(h)).toBe(h);
  });
});
