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
  it('push adds a token-stamped null marker and clears the redo side', () => {
    let h: EntryHistory = { past: [], future: [{ token: 9, entry: entry('stale') }] };
    h = entryHistoryPush(h, 1);
    expect(h.past).toEqual([{ token: 1, entry: null }]);
    expect(h.future).toEqual([]);
  });

  it('push caps the stack at HISTORY_LIMIT like the snapshot stack', () => {
    let h = emptyEntryHistory();
    for (let i = 0; i < HISTORY_LIMIT + 2; i++) {
      h = entryHistoryPush(h, i);
      h = entryHistoryFill(h, entry(`e${i}`));
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[HISTORY_LIMIT - 1]!.entry).toMatchObject({ id: `e${HISTORY_LIMIT + 1}` });
  });

  it('tokenless fill attaches the entry to the newest step only', () => {
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryPush(h, 2);
    h = entryHistoryFill(h, entry('a'));
    expect(h.past[0]!.entry).toBeNull();
    expect(h.past[1]!.entry).toMatchObject({ id: 'a' });
  });

  it('token fill targets its own step even when later steps were pushed (debounced flush)', () => {
    // Slider gesture checkpoints step 1; the user adds a tab (step 2)
    // within the 500ms window; then the slider's log entry flushes. It
    // must land on step 1 — filling the top glued it onto the tab add,
    // whose undo then deleted the slider's audit row.
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryPush(h, 2);
    h = entryHistoryFill(h, entry('slider'), 1);
    expect(h.past[0]!.entry).toMatchObject({ id: 'slider' });
    expect(h.past[1]!.entry).toBeNull();
  });

  it('token fill is a no-op when the step was undone or evicted', () => {
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryUndo(h).next; // step 1 moved to the redo side
    const after = entryHistoryFill(h, entry('late'), 1);
    expect(after).toBe(h);
    expect(entryHistoryFill(emptyEntryHistory(), entry('x'), 99)).toEqual(emptyEntryHistory());
  });

  it('fill is a no-op when the step already emitted (never repairs onto the wrong step)', () => {
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryFill(h, entry('first'), 1);
    const before = h;
    h = entryHistoryFill(h, entry('second'), 1);
    expect(h).toBe(before);
  });

  it('fill is a no-op on an empty stack (emit without a paired commit)', () => {
    const h = emptyEntryHistory();
    expect(entryHistoryFill(h, entry('x'))).toBe(h);
  });

  it('undo pops exactly one marker per step: entry-less steps delete nothing', () => {
    // edit (emits) then add-tab (no emit) — the drift bug scenario.
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryFill(h, entry('edit'), 1);
    h = entryHistoryPush(h, 2);

    const first = entryHistoryUndo(h); // undo the tab add
    expect(first.popped).toBeNull();
    const second = entryHistoryUndo(first.next); // undo the edit
    expect(second.popped).toMatchObject({ id: 'edit' });
    expect(second.next.past).toEqual([]);
  });

  it('redo replays markers in order, entry or not', () => {
    let h = entryHistoryPush(emptyEntryHistory(), 1);
    h = entryHistoryFill(h, entry('edit'), 1);
    h = entryHistoryPush(h, 2);
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
