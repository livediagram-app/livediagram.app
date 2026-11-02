import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup, PlanColumn } from './board';
import {
  DONE_NAMES,
  doneColumnsOf,
  doneNameKey,
  finishedStatuses,
  firstDoneColumn,
  isDoneColumn,
  isDoneName,
  setColumnDone,
  settleDoneColumns,
} from './done-columns';
import { PLAN_BOARD_PRESETS } from './presets';

const col = (id: string, name: string, extra: Partial<PlanColumn> = {}): PlanColumn => ({
  id,
  status: id,
  name,
  ...extra,
});
const board = (columns: PlanColumn[], doneColumnId?: string): PlanBoardSetup => ({
  title: 'B',
  columns,
  ...(doneColumnId ? { doneColumnId } : {}),
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
});
const ids = (cs: readonly PlanColumn[]) => cs.map((c) => c.id);

// docs/specs/026-plan/plan-board.md "Done columns".
describe('done-like names', () => {
  it('reads every listed name, whatever its case, spacing and apostrophe', () => {
    for (const name of DONE_NAMES) expect(isDoneName(name.toUpperCase())).toBe(true);
    expect(isDoneName('  Won’t   Do ')).toBe(true);
    expect(isDoneName('Wont Do')).toBe(true);
    expect(isDoneName('won`t fix')).toBe(true);
    expect(isDoneName('Done!')).toBe(true);
    expect(doneNameKey('Won’t  Do')).toBe("won't do");
  });

  it('never reads a part of a name', () => {
    for (const name of ['Not Done', 'Done Soon', 'To Do', 'In Progress', 'Closing', 'Wontfix', ''])
      expect(isDoneName(name)).toBe(false);
  });
});

describe('isDoneColumn and doneColumnsOf', () => {
  it('reads a flagged board’s flags, a column without one by its name', () => {
    const b = board(
      [
        col('a', 'To Do'),
        col('b', 'Shipping', { done: true }),
        col('c', 'Done', { done: false }),
        col('d', 'Cancelled'),
        col('e', 'Later'),
      ],
      'a',
    );
    expect(ids(doneColumnsOf(b))).toEqual(['b', 'd']);
    expect(b.columns.map((c) => isDoneColumn(b, c))).toEqual([false, true, false, true, false]);
    expect(firstDoneColumn(b)?.id).toBe('b');
    expect(finishedStatuses(b)).toEqual(['b', 'd']);
  });

  it('reads an older board as it did: its done column and every one after it', () => {
    const b = board([col('a', 'Done'), col('b', 'Fixed'), col('c', 'Later')], 'b');
    expect(ids(doneColumnsOf(b))).toEqual(['b', 'c']);
    expect(b.columns.map((c) => isDoneColumn(b, c))).toEqual([false, true, true]);
  });

  it('reads a board with neither by its names, and one with none as having none', () => {
    const named = board([col('a', 'To Do'), col('b', 'Done'), col('c', 'Won’t Do')]);
    expect(ids(doneColumnsOf(named))).toEqual(['b', 'c']);
    // A done column id that is no column reads past.
    const none = board([col('a', 'Now'), col('b', 'Later')], 'gone');
    expect(doneColumnsOf(none)).toEqual([]);
    expect(firstDoneColumn(none)).toBeUndefined();
    expect(finishedStatuses(none)).toEqual([]);
  });
});

describe('settleDoneColumns', () => {
  it('flags an older board as it read, keeping its done column id', () => {
    const older = board([col('a', 'To Do'), col('b', 'Fixed'), col('c', 'Later')], 'b');
    const settled = settleDoneColumns(older, older);
    expect(settled.columns.map((c) => c.done)).toEqual([undefined, true, true]);
    expect(settled.doneColumnId).toBe('b');
    expect(ids(doneColumnsOf(settled))).toEqual(ids(doneColumnsOf(older)));
  });

  it('keeps what an older board’s columns counted as when a column is added, the new one by its name', () => {
    const older = board([col('a', 'Done'), col('b', 'Review'), col('c', 'Shipped')], 'c');
    const after = {
      ...older,
      columns: [...older.columns, col('d', 'Cancelled'), col('e', 'Blocked')],
    };
    const settled = settleDoneColumns(older, after);
    // Done before the done column keeps reading not done, flagged so against its name.
    expect(settled.columns.map((c) => c.done)).toEqual([false, undefined, true, true, undefined]);
    expect(settled.doneColumnId).toBe('c');
  });

  it('settles by name with nothing before, and drops the done column id when none is done', () => {
    const fresh = board([col('a', 'To Do'), col('b', 'Completed')]);
    expect(settleDoneColumns(undefined, fresh).columns[1]).toEqual(
      col('b', 'Completed', { done: true }),
    );
    const plain = board([col('a', 'Now', { done: false }), col('b', 'Later')], 'a');
    const settled = settleDoneColumns(undefined, plain);
    expect(settled.columns).toEqual([col('a', 'Now'), col('b', 'Later')]);
    expect(settled.doneColumnId).toBeUndefined();
  });

  it('reads an after that is itself an older board', () => {
    const flagged = board([col('a', 'To Do', { done: true })]);
    const older = board([col('a', 'To Do'), col('b', 'Next')], 'b');
    expect(settleDoneColumns(flagged, older).columns.map((c) => c.done)).toEqual([undefined, true]);
  });

  it('is idempotent and keeps a flagged board as it reads', () => {
    const b = board([
      col('a', 'To Do'),
      col('b', 'Done', { done: false }),
      col('c', 'Live', { done: true }),
    ]);
    const once = settleDoneColumns(b, b);
    expect(settleDoneColumns(once, once)).toEqual(once);
    expect(ids(doneColumnsOf(once))).toEqual(['c']);
    expect(once.doneColumnId).toBe('c');
  });
});

describe('setColumnDone (Counts as Done)', () => {
  it('turns any column on or off by hand, keeping it whatever its name', () => {
    const b = board([col('a', 'To Do'), col('b', 'Review'), col('c', 'Done')]);
    const on = setColumnDone(b, 'b', true);
    expect(ids(doneColumnsOf(on))).toEqual(['b', 'c']);
    expect(on.doneColumnId).toBe('b');
    const off = setColumnDone(on, 'c', false);
    expect(ids(doneColumnsOf(off))).toEqual(['b']);
    expect(off.columns[2]!.done).toBe(false);
    const none = setColumnDone(off, 'b', false);
    expect(doneColumnsOf(none)).toEqual([]);
    expect(none.doneColumnId).toBeUndefined();
  });

  it('flags an older board first, so turning one column off leaves the others done', () => {
    const older = board([col('a', 'To Do'), col('b', 'Fixed'), col('c', 'Won’t Fix')], 'b');
    expect(ids(doneColumnsOf(setColumnDone(older, 'b', false)))).toEqual(['c']);
  });
});

describe('presets', () => {
  it('flag their done columns and name the first for older editors', () => {
    for (const { setup } of Object.values(PLAN_BOARD_PRESETS)) {
      const done = doneColumnsOf(setup);
      expect(setup.doneColumnId).toBe(done[0]?.id);
      expect(settleDoneColumns(setup, setup)).toEqual(setup);
    }
  });
});
