// A Plan board an agent adds (docs/specs/026-plan/plan-agents.md "Adding a board"): a preset, or columns by name,
// as the palette places one (freshBoardSetup): a column named as a status the project already has takes that
// status, so its cards show here too; any other column starts empty under a status of its own. Placed to the right
// of what the tab already holds, so it never covers anything.
import {
  CARD_FIELDS,
  planBoardHeightFor,
  planBoardWidthFor,
  type CardField,
  type CardSize,
  type PlanBoardSetup,
  type PlanColumn,
  type SwimlaneBy,
} from './board';
import { PLAN_COLUMN_NAME_MAX, PLAN_COLUMNS_MAX, PLAN_TITLE_MAX } from './limits';
import type { PlanStatusName } from './plan-outline';
import { freshBoardSetup, isPlanBoardPresetId, PLAN_BOARD_PRESET_IDS } from './presets';
import { statusKey, statusNamed } from './status-names';
import { slugOf } from './type-catalogue';
import { CARD_FIELD_LABELS } from './card-display';
import { settleDoneColumns } from './done-columns';

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

interface PlacedBoard {
  id: string;
  type: 'shape';
  shape: 'plan-board';
  x: number;
  y: number;
  width: number;
  height: number;
  planBoard: PlanBoardSetup;
}

type BoardRefusal = { ok: false; code: 'board_invalid'; message: string };

interface Box {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Right of everything on the tab, tops aligned; the origin on an empty tab. Shared by every element an agent adds
// beside a tab's content (a board here, a Sheet in @liveplanner/agent-verbs).
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
    const slug = slugOf(name, 24) || `column-${columns.length + 1}`;
    // The status is made from the unique id: two names that shorten to one slug ("Waiting for customer feedback
    // A" and "… B", or two in a script the slug drops) would otherwise share a status, and one column be lost.
    const id = columns.some((c) => c.id === slug) ? `${slug}-${columns.length + 1}` : slug;
    const status =
      named && !columns.some((c) => c.status === named.status) ? named.status : `${id}~${suffix}`;
    columns.push({ id, status, name });
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
    // The preset's done columns are gone with its columns: the new ones count as done by their names.
    const { doneColumnId: _done, ...rest } = setup;
    setup = settleDoneColumns(undefined, { ...rest, columns });
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
  // the project's other boards use shares their status; any other is a new, empty column.
  columns?: readonly string[];
  // Columns renamed in place, old name to new: each keeps its status, WIP limit, colour and cards. Applied before
  // `columns`, which may name them by their new names.
  renameColumns?: Readonly<Record<string, string>>;
  // The card types it shows and takes, by id (resolved by the caller); null shows every type again, and an empty
  // list takes none, as the editor's last type turned off does.
  types?: readonly string[] | null;
  // How much of each card it draws; Detailed draws every field the board shows.
  cardSize?: CardSize;
  // Its swimlanes: none, by a built-in grouping, or by a field (its id, resolved by the caller).
  swimlanes?: { by: SwimlaneBy; field?: string };
  // The columns whose cards count as done (docs/specs/026-plan/plan-board.md "Done columns"), by name, whole; [] for
  // none.
  doneColumns?: readonly string[];
  // The older way: the column whose cards count as done, and every one after it; null for none.
  doneColumn?: string | null;
  // The built-in fields its cards show, by name ("Number", "Due Date") or id, whole; a type's Display places them.
  cardFields?: readonly string[];
}

// The ids of the columns a change makes done (`doneColumns`, or `doneColumn` and every column after it), undefined
// when it names none, or the refusal.
function doneColumnsNamed(
  setup: PlanBoardSetup,
  change: BoardChange,
): Set<string> | undefined | string {
  if (change.doneColumns !== undefined && change.doneColumn !== undefined)
    return 'Give doneColumns or doneColumn, not both.';
  const names =
    change.doneColumns ??
    (change.doneColumn === undefined
      ? undefined
      : change.doneColumn === null
        ? []
        : [change.doneColumn]);
  if (!names) return undefined;
  const ids = new Set<string>();
  for (const name of names) {
    const at = setup.columns.findIndex((c) => statusKey(c.name) === statusKey(name));
    if (at < 0)
      return `"${setup.title}" has no column "${name}". Columns: ${setup.columns.map((c) => c.name).join(', ')}.`;
    for (const c of change.doneColumns ? [setup.columns[at]!] : setup.columns.slice(at))
      ids.add(c.id);
  }
  return ids;
}

// A built-in card field by its name or id ("Due Date", "due"), case and spaces aside.
function builtInCardFieldOf(name: string): CardField | null {
  const k = statusKey(name);
  if (k === 'number' || k === '#') return 'key';
  for (const f of CARD_FIELDS) if (k === f || k === statusKey(CARD_FIELD_LABELS[f])) return f;
  return null;
}

// Column ids made unique after a reshape: a kept column keeps its id (its done mark and the editor's references
// follow it), and a new column whose name slugs to a kept one's id ("Doing" beside a kept "In Progress" whose id is
// `doing`) takes the next free `<id>-<n>`.
function uniqueColumnIds(
  columns: readonly PlanColumn[],
  kept: ReadonlySet<PlanColumn>,
): PlanColumn[] {
  const taken = new Set(columns.filter((c) => kept.has(c)).map((c) => c.id));
  return columns.map((c) => {
    if (kept.has(c)) return c;
    let id = c.id;
    for (let n = 2; taken.has(id); n++) id = `${c.id}-${n}`;
    taken.add(id);
    return id === c.id ? c : { ...c, id };
  });
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
  if (change.renameColumns) {
    let columns = next.columns;
    for (const [from, to] of Object.entries(change.renameColumns)) {
      const column = columns.find((c) => statusKey(c.name) === statusKey(from));
      if (!column)
        return {
          ok: false,
          code: 'board_invalid',
          message: `"${next.title}" has no column "${from}". Columns: ${columns.map((c) => c.name).join(', ')}.`,
        };
      const name = to.trim();
      if (!name || name.length > PLAN_COLUMN_NAME_MAX)
        return {
          ok: false,
          code: 'board_invalid',
          message: `A column name is 1 to ${PLAN_COLUMN_NAME_MAX} characters.`,
        };
      if (columns.some((c) => c !== column && statusKey(c.name) === statusKey(name)))
        return {
          ok: false,
          code: 'board_invalid',
          message: `"${next.title}" already has a column "${name}".`,
        };
      columns = columns.map((c) => (c === column ? { ...c, name } : c));
    }
    next = { ...next, columns };
  }
  if (change.columns) {
    const base = next;
    const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join('');
    const own = base.columns.map((c) => ({ status: c.status, name: c.name }));
    const others = existing.filter((s) => !own.some((o) => o.status === s.status));
    const made = namedColumns(change.columns, [...own, ...others], suffix);
    if (typeof made === 'string') return { ok: false, code: 'board_invalid', message: made };
    const columns = uniqueColumnIds(
      made.map((c) => base.columns.find((o) => o.status === c.status) ?? c),
      new Set(base.columns),
    );
    next = { ...next, columns };
  }
  if (change.swimlanes) {
    const { swimlaneField: _field, ...rest } = next;
    next = {
      ...rest,
      swimlaneBy: change.swimlanes.by,
      ...(change.swimlanes.by === 'field' && change.swimlanes.field
        ? { swimlaneField: change.swimlanes.field }
        : {}),
    };
  }
  // Each column flagged as it counts: a kept column as it did (an older board's by its done column), a new one by its
  // name (docs/specs/026-plan/plan-board.md "Done columns").
  const { doneColumnId: _done, ...unflagged } = next;
  next = settleDoneColumns(setup, unflagged);
  const done = doneColumnsNamed(next, change);
  if (typeof done === 'string') return { ok: false, code: 'board_invalid', message: done };
  if (done)
    next = settleDoneColumns(undefined, {
      ...next,
      columns: next.columns.map((c) => ({ ...c, done: done.has(c.id) })),
    });
  if (change.cardSize) {
    const { cardSize: _size, ...rest } = next;
    next = change.cardSize === 'detailed' ? rest : { ...rest, cardSize: change.cardSize };
  }
  if (change.cardFields) {
    const picked = new Set<CardField>();
    for (const name of change.cardFields) {
      const f = builtInCardFieldOf(name);
      if (!f)
        return {
          ok: false,
          code: 'board_invalid',
          message: `"${name}" is not a card field. Card fields: ${CARD_FIELDS.map((c) => CARD_FIELD_LABELS[c]).join(', ')}.`,
        };
      picked.add(f);
    }
    next = { ...next, cardFields: CARD_FIELDS.filter((f) => picked.has(f)) };
  }
  if (change.types !== undefined) {
    const { addTypes: _types, ...rest } = next;
    next = change.types ? { ...rest, addTypes: [...change.types] } : rest;
  }
  return { ok: true, setup: next };
}
