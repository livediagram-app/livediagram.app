// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): what a board with no columns becomes once the
// person has chosen its card types and its columns, as one change. Pure.
import { PLAN_COLUMNS_MAX, type PlanBoardSetup } from '@livediagram/items';
import { addColumnAfter } from './board-setup-edits';
import { addStatusColumn, matchStatus, type StatusPick } from './column-status-picks';

// A column the person chose: an existing status (its cards show there), or a new one to name.
export type SetupColumn = ({ kind: 'existing' } & StatusPick) | { kind: 'new'; name: string };

// The key a chosen column is kept by in the list (an existing status by its status, a new one by its name).
export const setupColumnKey = (c: SetupColumn) =>
  c.kind === 'existing' ? `s:${c.status}` : `n:${c.name.trim().toLowerCase()}`;

// What a typed name adds: the existing status of that name (case, spacing and punctuation aside) when the document
// has one, else a new column; null when it is empty or already chosen.
export function columnFromName(
  name: string,
  chosen: readonly SetupColumn[],
  statusNames: ReadonlyMap<string, string>,
): SetupColumn | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const match = matchStatus(trimmed, { columns: [] }, statusNames);
  const next: SetupColumn =
    match.kind === 'existing'
      ? { kind: 'existing', ...match.pick }
      : { kind: 'new', name: trimmed };
  const key = setupColumnKey(next);
  const nameKey = trimmed.toLowerCase();
  if (chosen.some((c) => setupColumnKey(c) === key || c.name.trim().toLowerCase() === nameKey))
    return null;
  return next;
}

// The board with its chosen columns (in order, up to PLAN_COLUMNS_MAX) and card types. Every type chosen (or none
// given) is "every type" (no `addTypes`); a chosen few are its `addTypes`.
export function setUpBoard(
  setup: PlanBoardSetup,
  columns: readonly SetupColumn[],
  typeIds: readonly string[] | null,
  allTypeIds: readonly string[],
  random: () => number = Math.random,
): PlanBoardSetup {
  let next: PlanBoardSetup = setup;
  for (const c of columns.slice(0, PLAN_COLUMNS_MAX)) {
    if (c.kind === 'existing') {
      next = addStatusColumn(next, null, { status: c.status, name: c.name })?.setup ?? next;
    } else {
      next = addColumnAfter(next, null, c.name, random)?.setup ?? next;
    }
  }
  const { addTypes: _drop, ...rest } = next;
  const every = !typeIds || allTypeIds.every((id) => typeIds.includes(id));
  return every ? rest : { ...rest, addTypes: allTypeIds.filter((id) => typeIds.includes(id)) };
}
