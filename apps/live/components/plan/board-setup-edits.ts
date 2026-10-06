// A board set-up's edits (docs/specs/026-plan/plan-board.md "The board set-up"), as pure functions of the
// set-up: what a column's cog and the board's element menu change. Each returns the new set-up (the
// caller writes it as one element edit, undone like any other) and leaves the input untouched.
import {
  PLAN_COLUMNS_MAX,
  type CardField,
  type ColumnWidth,
  type PlanBoardSetup,
  type PlanColumn,
  type SwimlaneBy,
} from '@livediagram/items';

export const COLUMN_COLOURS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0d9488',
  '#db2777',
  '#64748b',
] as const;

export const SWIMLANE_LABELS: Record<SwimlaneBy, string> = {
  none: 'No Swimlanes',
  assignee: 'By Assignee',
  type: 'By Card Type',
  priority: 'By Priority',
  parent: 'By Project',
  status: 'By Status',
  // The tile reads the field's own name (PlanBoardMenuSection); this names the setting.
  field: 'By a Field',
};

export const CARD_FIELD_LABELS: Record<CardField, string> = {
  key: 'Number',
  type: 'Type',
  assignee: 'Assignee',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start Date',
  due: 'Due Date',
  votes: 'Votes',
  checklist: 'Checklist',
  description: 'Description',
  parent: 'Project',
};

export const COLUMN_NAME_MAX = 40;
export const WIP_LIMIT_MAX = 99;

// A status for a new column: its name, as a slug, unique on the board.
export function newColumnStatus(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'column';
  let status = base;
  for (let n = 2; taken.includes(status); n++) status = `${base}-${n}`;
  return status;
}

const withColumn = (
  setup: PlanBoardSetup,
  id: string,
  change: (c: PlanColumn) => PlanColumn,
): PlanBoardSetup => ({
  ...setup,
  columns: setup.columns.map((c) => (c.id === id ? change(c) : c)),
});

export function renameColumn(setup: PlanBoardSetup, id: string, name: string): PlanBoardSetup {
  const trimmed = name.trim().slice(0, COLUMN_NAME_MAX);
  return trimmed ? withColumn(setup, id, (c) => ({ ...c, name: trimmed })) : setup;
}

// A colour, or null for none.
export function recolourColumn(
  setup: PlanBoardSetup,
  id: string,
  color: string | null,
): PlanBoardSetup {
  return withColumn(setup, id, (c) => {
    const { color: _old, ...rest } = c;
    void _old;
    return color ? { ...rest, color } : rest;
  });
}

// A WIP limit of 1 to 99, or null for none.
export function setWipLimit(
  setup: PlanBoardSetup,
  id: string,
  limit: number | null,
): PlanBoardSetup {
  const ok = limit !== null && Number.isInteger(limit) && limit >= 1 && limit <= WIP_LIMIT_MAX;
  return withColumn(setup, id, (c) => {
    const { wipLimit: _old, ...rest } = c;
    void _old;
    return ok ? { ...rest, wipLimit: limit } : rest;
  });
}

// The column that counts as done (its cards make the board's progress), or none.
export function setDoneColumn(setup: PlanBoardSetup, id: string, done: boolean): PlanBoardSetup {
  if (done) return { ...setup, doneColumnId: id };
  if (setup.doneColumnId !== id) return setup;
  const { doneColumnId: _old, ...rest } = setup;
  void _old;
  return rest as PlanBoardSetup;
}

export function moveColumn(setup: PlanBoardSetup, id: string, step: -1 | 1): PlanBoardSetup {
  const from = setup.columns.findIndex((c) => c.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= setup.columns.length) return setup;
  const columns = [...setup.columns];
  const [c] = columns.splice(from, 1);
  columns.splice(to, 0, c!);
  return { ...setup, columns };
}

// A new column right after `afterId` (at the end when null); null when the board is full.
export function addColumnAfter(
  setup: PlanBoardSetup,
  afterId: string | null,
  name = 'New Column',
  random: () => number = Math.random,
): { setup: PlanBoardSetup; column: PlanColumn } | null {
  if (setup.columns.length >= PLAN_COLUMNS_MAX) return null;
  // A status of its own (`to-do~k3f9`), so a new column starts empty rather than taking in the cards of a
  // column of the same name on another board (docs/specs/026-plan/plan-board.md "The board set-up").
  const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
  const status = `${newColumnStatus(
    name,
    setup.columns.map((c) => c.status.split('~')[0]!),
  )}~${suffix}`;
  const column: PlanColumn = { id: status, status, name };
  const at = afterId ? setup.columns.findIndex((c) => c.id === afterId) + 1 : setup.columns.length;
  const columns = [...setup.columns];
  columns.splice(at <= 0 ? columns.length : at, 0, column);
  return { setup: { ...setup, columns }, column };
}

// Removes a column (never the last); its cards are the caller's to move first.
export function removeColumn(setup: PlanBoardSetup, id: string): PlanBoardSetup {
  if (setup.columns.length <= 1) return setup;
  const next = { ...setup, columns: setup.columns.filter((c) => c.id !== id) };
  return setup.doneColumnId === id ? setDoneColumn(next, id, false) : next;
}

// A column one, two or three slots wide; one is stored as absent.
export function setColumnWidth(
  setup: PlanBoardSetup,
  columnId: string,
  width: ColumnWidth,
): PlanBoardSetup {
  return {
    ...setup,
    columns: setup.columns.map((c) => {
      if (c.id !== columnId) return c;
      const { width: _drop, ...rest } = c;
      return width === 1 ? rest : { ...rest, width };
    }),
  };
}

// A board's first column, named as typed (a board with no columns asks for one).
export function addFirstColumn(setup: PlanBoardSetup, name: string): PlanBoardSetup | null {
  const trimmed = name.trim().slice(0, COLUMN_NAME_MAX);
  if (!trimmed) return null;
  return addColumnAfter(setup, null, trimmed)?.setup ?? null;
}
