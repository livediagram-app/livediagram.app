import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_JOURNAL,
  combinedStep,
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

  it('undoes and redoes a step tied to its canvas step as one (a type change and its filters)', () => {
    // canvas T1, then the filters' canvas T2 and the type change's item step C made together.
    let at: HistoryPosition = { depth: 1, branch: 1, futureLength: 0 };
    const C = { ...combinedStep([step('type'), step('values')], true), name: 'C' };
    expect(C.canvas).toBe(true);
    // Pushed with the history as read before the filters' commit landed.
    let j: ItemUndoJournal = journalPush(EMPTY_JOURNAL, C, at);
    at = { depth: 2, branch: 3, futureLength: 0 };
    // One undo: the item step is the target, and its canvas step goes back with it.
    expect(journalUndoTarget(j, at)).toBe(C);
    j = journalAfterUndo(j, at);
    at = { ...at, depth: 1, futureLength: 1 };
    // The next undo is the canvas's own T1.
    expect(journalUndoTarget(j, at)).toBeNull();
    // One redo: the canvas step comes back, then the item step, filed after it.
    expect(journalRedoTarget(j, at)).toBe(C);
    j = journalAfterRedo(j, at);
    at = { ...at, depth: 2, futureLength: 0 };
    expect(journalUndoTarget(j, at)).toBe(C);
    expect(combinedStep([step('x')]).canvas).toBeUndefined();
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

describe('combinedStep', () => {
  it('undoes its steps last first and redoes them in order', () => {
    const order: string[] = [];
    const s = (name: string) => ({
      undo: () => order.push(`undo ${name}`),
      redo: () => order.push(`redo ${name}`),
    });
    const both = combinedStep([s('type'), s('cards')]);
    both.undo();
    both.redo();
    expect(order).toEqual(['undo cards', 'undo type', 'redo type', 'redo cards']);
  });
});
