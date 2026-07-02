import { describe, expect, it } from 'vitest';
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { HISTORY_LIMIT } from '@/hooks/canvas/useDiagramHistory';
import {
  emptyEntryHistory,
  entryHistoryFill,
  entryHistoryPush,
  entryHistoryRedo,
  entryHistoryUndo,
  type EntryHistory,
} from './entry-history';

const entry = (id: string): ChangeLogEntry => ({
  id,
  tabId: 'tab-1',
  participantId: 'p1',
  participantName: 'Sam',
  participantColor: '#f00',
  kind: 'edit',
  summary: `entry ${id}`,
  elementIds: ['el-1'],
  beforeState: {},
  afterState: {},
  createdAt: 1,
});

describe('entry-history markers', () => {
  it('push adds a null marker and clears the redo side', () => {
    let h: EntryHistory = { past: [], future: [entry('stale')] };
    h = entryHistoryPush(h);
    expect(h.past).toEqual([null]);
    expect(h.future).toEqual([]);
  });

  it('push caps the stack at HISTORY_LIMIT like the snapshot stack', () => {
    let h = emptyEntryHistory();
    for (let i = 0; i < HISTORY_LIMIT + 2; i++) {
      h = entryHistoryPush(h);
      h = entryHistoryFill(h, entry(`e${i}`));
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[HISTORY_LIMIT - 1]).toMatchObject({ id: `e${HISTORY_LIMIT + 1}` });
  });

  it('fill attaches the entry to the newest step only', () => {
    let h = entryHistoryPush(emptyEntryHistory());
    h = entryHistoryPush(h);
    h = entryHistoryFill(h, entry('a'));
    expect(h.past[0]).toBeNull();
    expect(h.past[1]).toMatchObject({ id: 'a' });
  });

  it('fill is a no-op when the top step already emitted (never repairs onto the wrong step)', () => {
    let h = entryHistoryPush(emptyEntryHistory());
    h = entryHistoryFill(h, entry('first'));
    const before = h;
    h = entryHistoryFill(h, entry('second'));
    expect(h).toBe(before);
  });

  it('fill is a no-op on an empty stack (emit without a paired commit)', () => {
    const h = emptyEntryHistory();
    expect(entryHistoryFill(h, entry('x'))).toBe(h);
  });

  it('undo pops exactly one marker per step: entry-less steps delete nothing', () => {
    // edit (emits) then add-tab (no emit) — the drift bug scenario.
    let h = entryHistoryPush(emptyEntryHistory());
    h = entryHistoryFill(h, entry('edit'));
    h = entryHistoryPush(h);

    const first = entryHistoryUndo(h); // undo the tab add
    expect(first.popped).toBeNull();
    const second = entryHistoryUndo(first.next); // undo the edit
    expect(second.popped).toMatchObject({ id: 'edit' });
    expect(second.next.past).toEqual([]);
  });

  it('redo replays markers in order, entry or not', () => {
    let h = entryHistoryPush(emptyEntryHistory());
    h = entryHistoryFill(h, entry('edit'));
    h = entryHistoryPush(h);
    h = entryHistoryUndo(h).next;
    h = entryHistoryUndo(h).next;

    const first = entryHistoryRedo(h); // redo the edit
    expect(first.shifted).toMatchObject({ id: 'edit' });
    const second = entryHistoryRedo(first.next); // redo the tab add
    expect(second.shifted).toBeNull();
    expect(second.next.past).toHaveLength(2);
    expect(second.next.future).toEqual([]);
  });

  it('undo/redo are no-ops on empty stacks', () => {
    const h = emptyEntryHistory();
    expect(entryHistoryUndo(h).next).toBe(h);
    expect(entryHistoryRedo(h).next).toBe(h);
  });
});
