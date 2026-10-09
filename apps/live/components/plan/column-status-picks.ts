// The column picker's rules (docs/specs/026-plan/plan-board.md "The column picker"): which of the document's
// statuses a board can still take as columns, whether a typed name is one of them, and the columns they make. A
// column made for an existing status keeps that status, so the cards already in it show on this board too.
import {
  PLAN_COLUMNS_MAX,
  missingStatuses,
  pickableStatuses,
  statusKey,
  statusNamed,
  type PlanBoardSetup,
  type PlanColumn,
  type StatusPick,
} from '@livediagram/items';
import { COLUMN_NAME_MAX } from './board-setup-edits';

// A name as the picker compares it (case, spacing and punctuation aside): shared with board placement and renames.
// Which statuses the board lacks lives in packages/items (board-status-picks.ts), shared with any other caller.
export { statusKey, missingStatuses, pickableStatuses, type StatusPick };

// What a typed name would do: use an existing status, clash with a column the board has, or make a new one.
export type NameMatch =
  { kind: 'existing'; pick: StatusPick } | { kind: 'on-board'; name: string } | { kind: 'new' };

export function matchStatus(
  name: string,
  setup: Pick<PlanBoardSetup, 'columns'>,
  statusNames: ReadonlyMap<string, string>,
): NameMatch {
  const key = statusKey(name);
  if (!key) return { kind: 'new' };
  const column = setup.columns.find((c) => statusKey(c.name) === key);
  if (column) return { kind: 'on-board', name: column.name };
  const pick = missingStatuses(setup, statusNames).find((p) => statusKey(p.name) === key);
  return pick ? { kind: 'existing', pick } : { kind: 'new' };
}

// A column for an existing status, after `afterId` (null: at the end); null at the column limit or when the
// board already shows that status.
export function addStatusColumn(
  setup: PlanBoardSetup,
  afterId: string | null,
  pick: StatusPick,
): { setup: PlanBoardSetup; column: PlanColumn } | null {
  if (setup.columns.length >= PLAN_COLUMNS_MAX) return null;
  if (setup.columns.some((c) => c.status === pick.status)) return null;
  const ids = new Set(setup.columns.map((c) => c.id));
  let id = pick.status;
  for (let n = 2; ids.has(id); n++) id = `${pick.status}-${n}`;
  const column: PlanColumn = { id, status: pick.status, name: pick.name.slice(0, COLUMN_NAME_MAX) };
  const at = afterId ? setup.columns.findIndex((c) => c.id === afterId) + 1 : setup.columns.length;
  const columns = [...setup.columns];
  columns.splice(at <= 0 ? columns.length : at, 0, column);
  return { setup: { ...setup, columns }, column };
}

// Every pick as a column, in order, after `afterId` (null: at the end), as one change; stops at the limit.
export function addStatusColumns(
  setup: PlanBoardSetup,
  afterId: string | null,
  picks: readonly StatusPick[],
): PlanBoardSetup {
  let next = setup;
  let after = afterId;
  for (const pick of picks) {
    const added = addStatusColumn(next, after, pick);
    if (!added) break;
    next = added.setup;
    after = added.column.id;
  }
  return next;
}

// What renaming a column to `name` does (docs/specs/026-plan/plan-board.md "The board set-up": one name, one
// status). A name no other status has renames it. A name another status already has (`statusNames`, the
// document's): when this board already has a column for that status, a clash (the name stays); when the column's
// own status holds no cards (`hasCards` false), the column switches to that status, its cards showing here; when it
// holds cards, a clash too, as switching would leave them on no column.
export type ColumnRename =
  | { kind: 'rename' }
  | { kind: 'reuse'; status: string; name: string }
  | { kind: 'clash'; name: string };

export function columnRename(
  setup: Pick<PlanBoardSetup, 'columns'>,
  columnId: string,
  name: string,
  statusNames: ReadonlyMap<string, string>,
  hasCards: boolean,
): ColumnRename {
  const column = setup.columns.find((c) => c.id === columnId);
  if (!column) return { kind: 'rename' };
  const others = [...statusNames].filter(([status]) => status !== column.status);
  const named = statusNamed(name, others);
  if (!named) return { kind: 'rename' };
  if (setup.columns.some((c) => c.status === named.status) || hasCards)
    return { kind: 'clash', name: named.name };
  return { kind: 'reuse', status: named.status, name: named.name };
}
