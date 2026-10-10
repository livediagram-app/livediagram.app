// A Plan board an agent adds (docs/specs/026-plan/plan-agents.md "Adding a board"): a preset, or columns by name,
// as the palette places one (freshBoardSetup): a column named as a status the document already has takes that
// status, so its cards show here too; any other column starts empty under a status of its own. Placed to the right
// of what the tab already holds, so it never covers anything.
import {
  planBoardHeightFor,
  planBoardWidthFor,
  type PlanBoardSetup,
  type PlanColumn,
} from './board';
import { PLAN_COLUMN_NAME_MAX, PLAN_COLUMNS_MAX, PLAN_TITLE_MAX } from './limits';
import type { PlanStatusName } from './plan-outline';
import { freshBoardSetup, isPlanBoardPresetId, PLAN_BOARD_PRESET_IDS } from './presets';
import { statusKey, statusNamed } from './status-names';
import { slugOf } from './type-catalogue';

// A placed board's width (blueprints/DEFAULTS.md D5; wider when its columns need it; its height is
// planBoardHeightFor) and its gap from what the tab holds.
export const PLACED_BOARD_WIDTH = 1120;
export const PLACED_BOARD_GAP = 80;

export interface BoardRequest {
  preset?: string;
  title?: string;
  // Column names, left to right; replaces the preset's.
  columns?: readonly string[];
  // The card types it shows and takes, by id (resolved by the caller); absent is the preset's, or every type.
  types?: readonly string[];
}

export interface PlacedBoard {
  id: string;
  type: 'shape';
  shape: 'plan-board';
  x: number;
  y: number;
  width: number;
  height: number;
  planBoard: PlanBoardSetup;
}

export type BoardRefusal = { ok: false; code: 'board_invalid'; message: string };

interface Box {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Right of everything on the tab, tops aligned; the origin on an empty tab. Shared by every element an agent adds
// beside a tab's content (a board here, a Sheet in @livediagram/agent-verbs).
export function placeBeside(elements: readonly unknown[]): { x: number; y: number } {
  let right: number | null = null;
  let top: number | null = null;
  for (const raw of elements) {
    const b = raw as Box;
    const x = num(b.x);
    const y = num(b.y);
    if (x === null || y === null) continue;
    right = Math.max(right ?? -Infinity, x + (num(b.width) ?? 0));
    top = Math.min(top ?? Infinity, y);
  }
  return right === null
    ? { x: 0, y: 0 }
    : { x: Math.round(right + PLACED_BOARD_GAP), y: Math.round(top!) };
}

function namedColumns(
  names: readonly string[],
  existing: readonly PlanStatusName[],
  suffix: string,
): PlanColumn[] | string {
  if (names.length === 0 || names.length > PLAN_COLUMNS_MAX)
    return `A board has 1 to ${PLAN_COLUMNS_MAX} columns.`;
  const pairs = existing.map((s) => [s.status, s.name] as const);
  const columns: PlanColumn[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name.length > PLAN_COLUMN_NAME_MAX)
      return `A column name is 1 to ${PLAN_COLUMN_NAME_MAX} characters.`;
    if (columns.some((c) => statusKey(c.name) === statusKey(name)))
      return `Two columns are called "${name}".`;
    const named = statusNamed(name, pairs);
    const id = slugOf(name, 24) || `column-${columns.length + 1}`;
    const status =
      named && !columns.some((c) => c.status === named.status) ? named.status : `${id}~${suffix}`;
    columns.push({
      id: columns.some((c) => c.id === id) ? `${id}-${columns.length + 1}` : id,
      status,
      name,
    });
  }
  return columns;
}

export function placeBoard(
  request: BoardRequest,
  elements: readonly unknown[],
  existing: readonly PlanStatusName[],
  id: string,
  random: () => number = Math.random,
): { ok: true; board: PlacedBoard } | BoardRefusal {
  const preset = request.preset ?? (request.columns ? 'blank' : 'kanban');
  if (!isPlanBoardPresetId(preset))
    return {
      ok: false,
      code: 'board_invalid',
      message: `No board preset "${preset}". Presets: ${PLAN_BOARD_PRESET_IDS.join(', ')}.`,
    };
  const pairs = existing.map((s) => [s.status, s.name] as const);
  let setup = freshBoardSetup(preset, random, pairs);
  if (request.columns) {
    const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
    const columns = namedColumns(request.columns, existing, suffix);
    if (typeof columns === 'string') return { ok: false, code: 'board_invalid', message: columns };
    // The preset's done column is gone with its columns.
    const { doneColumnId: _done, ...rest } = setup;
    setup = { ...rest, columns };
  }
  if (request.title !== undefined) {
    const title = request.title.trim();
    if (!title || title.length > PLAN_TITLE_MAX)
      return {
        ok: false,
        code: 'board_invalid',
        message: `A board title is 1 to ${PLAN_TITLE_MAX} characters.`,
      };
    setup = { ...setup, title };
  }
  if (request.types) setup = { ...setup, addTypes: [...request.types] };
  return {
    ok: true,
    board: {
      id,
      type: 'shape',
      shape: 'plan-board',
      ...placeBeside(elements),
      width: Math.max(PLACED_BOARD_WIDTH, planBoardWidthFor(setup)),
      height: planBoardHeightFor(setup),
      planBoard: setup,
    },
  };
}

export interface BoardChange {
  title?: string;
  // Every column, by name, left to right: a name the board has keeps its column (status, WIP limit, colour); a name
  // the document's other boards use shares their status; any other is a new, empty column.
  columns?: readonly string[];
  // The card types it shows and takes, by id (resolved by the caller); null shows every type again.
  types?: readonly string[] | null;
}

// A board's set-up after an agent's change (docs/specs/026-plan/plan-agents.md "Changing a board"). Cards keep their
// statuses: a column taken away leaves its cards waiting off this board (on any other board that has the status).
export function reshapeBoard(
  setup: PlanBoardSetup,
  change: BoardChange,
  existing: readonly PlanStatusName[],
  random: () => number = Math.random,
): { ok: true; setup: PlanBoardSetup } | BoardRefusal {
  let next: PlanBoardSetup = { ...setup };
  if (change.title !== undefined) {
    const title = change.title.trim();
    if (!title || title.length > PLAN_TITLE_MAX)
      return {
        ok: false,
        code: 'board_invalid',
        message: `A board title is 1 to ${PLAN_TITLE_MAX} characters.`,
      };
    next = { ...next, title };
  }
  if (change.columns) {
    const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
    const own = setup.columns.map((c) => ({ status: c.status, name: c.name }));
    const others = existing.filter((s) => !own.some((o) => o.status === s.status));
    const made = namedColumns(change.columns, [...own, ...others], suffix);
    if (typeof made === 'string') return { ok: false, code: 'board_invalid', message: made };
    const columns = made.map((c) => setup.columns.find((o) => o.status === c.status) ?? c);
    const done = columns.some((c) => c.id === setup.doneColumnId) ? setup.doneColumnId : undefined;
    const { doneColumnId: _done, ...rest } = next;
    next = { ...rest, columns, ...(done ? { doneColumnId: done } : {}) };
  }
  if (change.types !== undefined) {
    const { addTypes: _types, ...rest } = next;
    next = change.types && change.types.length ? { ...rest, addTypes: [...change.types] } : rest;
  }
  return { ok: true, setup: next };
}
