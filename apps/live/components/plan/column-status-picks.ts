// The column picker's rules (docs/specs/026-plan/plan-board.md "The column picker"): which of the document's
// statuses a board can still take as columns, whether a typed name is one of them, and the columns they make. A
// column made for an existing status keeps that status, so the cards already in it show on this board too.
import { PLAN_COLUMNS_MAX, type PlanBoardSetup, type PlanColumn } from '@livediagram/items';
import { COLUMN_NAME_MAX } from './board-setup-edits';

export type StatusPick = { status: string; name: string };

// A name as the picker compares it: case and spacing (and punctuation) aside, so "To do", "to-do" and "TO  DO" match.
// Letters and digits of any script count ("完成", "Готово"), so a name in any language is matched, not dropped.
export function statusKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// The statuses the document's boards use (in their order, the open tab's first) that this board has no column
// for, one per name: the first board's name and status win.
export function missingStatuses(
  setup: Pick<PlanBoardSetup, 'columns'>,
  statusNames: ReadonlyMap<string, string>,
): StatusPick[] {
  const onBoard = new Set(setup.columns.map((c) => c.status));
  const boardKeys = new Set(setup.columns.map((c) => statusKey(c.name)));
  const seen = new Set<string>();
  const out: StatusPick[] = [];
  for (const [status, name] of statusNames) {
    const key = statusKey(name);
    if (!key || onBoard.has(status) || boardKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ status, name });
  }
  return out;
}

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
