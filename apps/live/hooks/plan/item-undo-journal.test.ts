import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_JOURNAL,
  ITEM_UNDO_LIMIT,
  journalAfterRedo,
  journalAfterUndo,
  journalLiveRedo,
  journalPush,
  journalRedoTarget,
  journalUndoTarget,
  type HistoryPosition,
  type ItemUndoJournal,
} from './item-undo-journal';

// Item steps interleave with canvas steps in true order (docs/specs/026-plan/items.md "Undo").
const step = (name: string) => ({ name, undo: vi.fn(), redo: vi.fn() });

describe('the item undo journal', () => {
  it('undoes and redoes item and canvas steps in the order they were made', () => {
    // canvas T1, item A, canvas T2, item B
    let at: HistoryPosition = { depth: 1, branch: 1, futureLength: 0 };
    const A = step('A');
    const B = step('B');
    let j: ItemUndoJournal = journalPush(EMPTY_JOURNAL, A, at);
    at = { depth: 2, branch: 3, futureLength: 0 };
    j = journalPush(j, B, at);
    const order: string[] = [];
    const undo = () => {
      const s = journalUndoTarget(j, at);
      if (s) {
        order.push((s as typeof A).name);
        j = journalAfterUndo(j, at);
      } else {
        order.push(`T${at.depth}`);
        at = { ...at, depth: at.depth - 1, futureLength: at.futureLength + 1 };
      }
    };
    const redo = () => {
      j = journalLiveRedo(j, at);
      const s = journalRedoTarget(j, at);
      if (s) {
        order.push((s as typeof A).name);
        j = journalAfterRedo(j, at);
      } else {
        at = { ...at, depth: at.depth + 1, futureLength: at.futureLength - 1 };
        order.push(`T${at.depth}`);
      }
    };
    undo();
    undo();
    undo();
    undo();
    expect(order).toEqual(['B', 'T2', 'A', 'T1']);
    order.length = 0;
    redo();
    redo();
    redo();
    redo();
    expect(order).toEqual(['T1', 'A', 'T2', 'B']);
  });

  it('drops redo steps from an older branch', () => {
    const at: HistoryPosition = { depth: 0, branch: 1, futureLength: 0 };
    let j = journalPush(EMPTY_JOURNAL, step('A'), at);
    j = journalAfterUndo(j, at);
    expect(journalRedoTarget(j, at)).not.toBeNull();
    const moved = { ...at, branch: 2 };
    expect(journalRedoTarget(j, moved)).toBeNull();
    expect(journalLiveRedo(j, moved).redo).toEqual([]);
    expect(journalLiveRedo(j, at)).toBe(j);
  });

  it('caps the steps it keeps', () => {
    let j = EMPTY_JOURNAL;
    for (let i = 0; i < ITEM_UNDO_LIMIT + 5; i++)
      j = journalPush(j, step(`s${i}`), { depth: 0, branch: 0, futureLength: 0 });
    expect(j.undo).toHaveLength(ITEM_UNDO_LIMIT);
    expect(journalUndoTarget(EMPTY_JOURNAL, { depth: 0, branch: 0, futureLength: 0 })).toBeNull();
  });
});
