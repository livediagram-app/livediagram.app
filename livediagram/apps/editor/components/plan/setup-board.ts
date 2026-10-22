// Setup Board (docs/specs/026-plan/plan-board.md "Setup Board"): what a board with no columns becomes once the
// person has chosen its card types and its columns, as one change. Pure.
import {
  PLAN_COLUMNS_MAX,
  type CardSize,
  type PlanBoardSetup,
  type SwimlaneBy,
} from '@livediagram/items';
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
  // Run again on a board that has columns (Setup Board from its Board Setup): a column it keeps keeps its id and its
  // settings (name, WIP limit, colour, width); the rest are made afresh, in the order chosen. A column left out leaves
  // this board only: its cards keep their state.
  const kept = new Map(setup.columns.map((c) => [c.status, c]));
  let next: PlanBoardSetup = { ...setup, columns: [] };
  for (const c of columns.slice(0, PLAN_COLUMNS_MAX)) {
    const old = c.kind === 'existing' ? kept.get(c.status) : undefined;
    if (old) {
      next = { ...next, columns: [...next.columns, old] };
    } else if (c.kind === 'existing') {
      next = addStatusColumn(next, null, { status: c.status, name: c.name })?.setup ?? next;
    } else {
      next = addColumnAfter(next, null, c.name, random)?.setup ?? next;
    }
  }
  // The done column stays only while its column does.
  if (next.doneColumnId && !next.columns.some((c) => c.id === next.doneColumnId)) {
    const { doneColumnId: _gone, ...withoutDone } = next;
    next = withoutDone;
  }
  const { addTypes: _drop, ...rest } = next;
  const every = !typeIds || allTypeIds.every((id) => typeIds.includes(id));
  return every ? rest : { ...rest, addTypes: allTypeIds.filter((id) => typeIds.includes(id)) };
}

// What Setup Board starts from on a board that has columns: its columns, as existing states in its order, and the
// card types it takes (its layout is setupLayoutOf's).
export function setupFromBoard(
  setup: PlanBoardSetup,
  typeIds: readonly string[],
): { columns: SetupColumn[]; typeIds: string[] } {
  return {
    columns: setup.columns.map((c) => ({
      kind: 'existing' as const,
      status: c.status,
      name: c.name,
    })),
    typeIds: [...typeIds],
  };
}

// Setup Board's Layout step (docs/specs/026-plan/plan-board.md "Setup Board"): the board's swimlanes, card size and
// Fill Tab, starting from the board as it is (a new board's own defaults), so skipping the step changes none.
export type SetupLayout = {
  swimlaneBy: SwimlaneBy;
  swimlaneField?: string | undefined;
  cardSize?: CardSize | undefined;
  fillTab: boolean;
};

export function setupLayoutOf(setup: PlanBoardSetup): SetupLayout {
  return {
    swimlaneBy: setup.swimlaneBy,
    ...(setup.swimlaneBy === 'field' && setup.swimlaneField
      ? { swimlaneField: setup.swimlaneField }
      : {}),
    ...(setup.cardSize ? { cardSize: setup.cardSize } : {}),
    fillTab: setup.fillTab === true,
  };
}

// The board with the step's layout: its grouping (a field only for a field grouping), its card size (Detailed is
// absent) and Fill Tab (off is absent).
export function withSetupLayout(setup: PlanBoardSetup, layout: SetupLayout): PlanBoardSetup {
  const { swimlaneField: _f, cardSize: _c, fillTab: _t, ...rest } = setup;
  const field = layout.swimlaneBy === 'field' ? layout.swimlaneField : undefined;
  return {
    ...rest,
    swimlaneBy: layout.swimlaneBy === 'field' && !field ? 'none' : layout.swimlaneBy,
    ...(field ? { swimlaneField: field } : {}),
    ...(layout.cardSize && layout.cardSize !== 'detailed' ? { cardSize: layout.cardSize } : {}),
    ...(layout.fillTab ? { fillTab: true } : {}),
  };
}
