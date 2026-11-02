// A board's done columns (docs/specs/026-plan/plan-board.md "Done columns"): any column can count as done. A column
// says so with its `done` flag; one without a flag counts by its name ("Done", "Won't Do", "Cancelled"). An older
// board, saved before columns were flagged, keeps its one done column and every column after it.
import type { PlanBoardSetup, PlanColumn } from './board';

// The done-like names (DEFAULTS D55), as doneNameKey reads them.
export const DONE_NAMES: readonly string[] = [
  'done',
  "won't do",
  "won't fix",
  'cancelled',
  'canceled',
  'completed',
  'complete',
  'closed',
  'resolved',
  'shipped',
  'fixed',
  'released',
  'published',
  'delivered',
  'finished',
  'rejected',
  'declined',
  'abandoned',
  'dropped',
  'merged',
  'deployed',
];
const DONE_NAME_SET = new Set(DONE_NAMES);

// A name as the done-like names compare: lower case, curly apostrophes straight, any other mark a space, spaces
// collapsed, and "wont" read as "won't".
export function doneNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim()
    .replace(/^wont\b/, "won't");
}

// Whether a column's name alone makes it a done column: a whole done-like name, never a part ("Not Done").
export function isDoneName(name: string): boolean {
  return DONE_NAME_SET.has(doneNameKey(name));
}

type DoneSetup = Pick<PlanBoardSetup, 'columns' | 'doneColumnId'>;

// An older board: no column carries a flag, and its done column is one of its columns. Its index, else -1.
function olderDoneAt(setup: DoneSetup): number {
  if (setup.columns.some((c) => c.done !== undefined)) return -1;
  return setup.columns.findIndex((c) => c.id === setup.doneColumnId);
}

// Whether a column of the board counts as done: its flag, else (an older board) whether it is the done column or
// after it, else its name.
export function isDoneColumn(setup: DoneSetup, column: PlanColumn): boolean {
  if (column.done !== undefined) return column.done;
  const at = olderDoneAt(setup);
  if (at >= 0) return setup.columns.indexOf(column) >= at;
  return isDoneName(column.name);
}

// The columns that count as done, left to right.
export function doneColumnsOf(setup: DoneSetup): PlanColumn[] {
  const at = olderDoneAt(setup);
  return setup.columns.filter((c, i) =>
    c.done !== undefined ? c.done : at >= 0 ? i >= at : isDoneName(c.name),
  );
}

// The first done column (a linked board's Done), or undefined when none is.
export function firstDoneColumn(setup: DoneSetup): PlanColumn | undefined {
  return doneColumnsOf(setup)[0];
}

// The statuses a board counts as finished (docs/specs/026-plan/board-widgets.md "Not done"): every done column's.
// None without a done column, when every card is not done.
export function finishedStatuses(setup: DoneSetup): string[] {
  return doneColumnsOf(setup).map((c) => c.status);
}

// A set-up as written (docs/specs/026-plan/blueprints/plan-board.md "Done columns"): each column flagged as it counts.
// A column without a flag keeps what it counted as on `before` when that is an older board holding it (else on
// `after` when that is one), else its name decides. A column stores `done: true` when done, `done: false` when its name is done-like but
// it is not, and nothing otherwise; `doneColumnId` names the first done column for older editors, or goes.
export function settleDoneColumns<T extends PlanBoardSetup>(
  before: Pick<PlanBoardSetup, 'columns' | 'doneColumnId'> | undefined,
  after: T,
): T {
  // An older `before` is what its columns counted as; an older `after` (nothing older before it) is its own.
  const basis =
    before && olderDoneAt(before) >= 0 ? before : olderDoneAt(after) >= 0 ? after : null;
  const columns = after.columns.map((c): PlanColumn => {
    let done = c.done;
    if (done === undefined) {
      const old = basis?.columns.find((o) => o.id === c.id);
      done = old ? isDoneColumn(basis!, old) : isDoneName(c.name);
    }
    const { done: _flag, ...rest } = c;
    if (done) return { ...rest, done: true };
    return isDoneName(c.name) ? { ...rest, done: false } : rest;
  });
  const { doneColumnId: _id, ...rest } = after;
  const first = columns.find((c) => c.done === true);
  return { ...rest, columns, ...(first ? { doneColumnId: first.id } : {}) } as T;
}

// Counts as Done (docs/specs/026-plan/plan-board.md "Done columns"): one column turned on or off by hand, kept
// whatever its name.
export function setColumnDone<T extends PlanBoardSetup>(setup: T, id: string, on: boolean): T {
  const settled = settleDoneColumns(setup, setup);
  return settleDoneColumns(undefined, {
    ...settled,
    columns: settled.columns.map((c) => (c.id === id ? { ...c, done: on } : c)),
  });
}
