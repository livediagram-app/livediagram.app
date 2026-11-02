// A Plan board's header widgets (docs/specs/026-plan/board-widgets.md): the kinds, the set a board
// shows when it names none, and the edits that place, move and remove one. A board holds each kind at
// most once, in order, and each field widget (field-widgets.ts) at most once beside them. Pure; the editor makes
// each edit one board edit.
import type { PlanBoardSetup } from './board';
import {
  FIELD_WIDGETS_MAX,
  fieldWidgetCount,
  isFieldWidgetKey,
  type FieldWidgetKey,
} from './field-widgets';

export const BOARD_WIDGET_KINDS = [
  'count',
  'progress',
  'filter',
  'mine',
  'people',
  'unplaced',
  'types',
  'wip',
  'due',
  'points',
  // Hours on the board's cards, and the timers running (docs/specs/026-plan/board-widgets.md "Time").
  'time',
  'priorities',
  'unassigned',
  'top-voted',
  'stale',
] as const;
export type BoardWidgetKind = (typeof BOARD_WIDGET_KINDS)[number];

// One widget in a board's list: a built-in kind, or a field widget (`field:<view>:<fieldId>`).
export type BoardWidgetId = BoardWidgetKind | FieldWidgetKey;

// What a board shows before anyone arranges it, and what a board saved before widgets shows, so it
// looks as it did.
export const DEFAULT_BOARD_WIDGETS: readonly BoardWidgetKind[] = [
  'count',
  'progress',
  'unplaced',
  'filter',
  'mine',
];

export function isBoardWidgetKind(value: unknown): value is BoardWidgetKind {
  return (BOARD_WIDGET_KINDS as readonly unknown[]).includes(value);
}

// The widgets a stored list names: known kinds and well-formed field widgets, each once, in order, and no more
// than FIELD_WIDGETS_MAX field widgets (the first ones kept).
export function readBoardWidgets(input: unknown): BoardWidgetId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: BoardWidgetId[] = [];
  let fields = 0;
  for (const k of input as unknown[]) {
    if (isBoardWidgetKind(k)) {
      if (!out.includes(k)) out.push(k);
    } else if (isFieldWidgetKey(k) && !out.includes(k) && fields < FIELD_WIDGETS_MAX) {
      out.push(k);
      fields += 1;
    }
  }
  return out;
}

// The widgets a board shows: its own, or the default set. A stored Votes Left (from when boards had their own
// voting) is no kind any more, and reads past.
export function widgetsOf(setup: Pick<PlanBoardSetup, 'widgets'>): BoardWidgetId[] {
  return setup.widgets ? [...setup.widgets] : [...DEFAULT_BOARD_WIDGETS];
}

// A widget placed before the widget at `index` (the end when past it). One the board already has moves
// there instead; `index` counts the widgets as they are, before the move.
export function placeWidget(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
  index: number,
): BoardWidgetId[] {
  const from = widgets.indexOf(kind);
  const at = Math.max(0, Math.min(index, widgets.length));
  const rest = widgets.filter((k) => k !== kind);
  const to = from >= 0 && from < at ? at - 1 : at;
  rest.splice(to, 0, kind);
  return rest;
}

// A widget moved one place left (-1) or right (1); unchanged at either end.
export function nudgeWidget(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
  delta: -1 | 1,
): BoardWidgetId[] {
  const from = widgets.indexOf(kind);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= widgets.length) return [...widgets];
  const next = [...widgets];
  next.splice(from, 1);
  next.splice(to, 0, kind);
  return next;
}

export function removeWidget(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
): BoardWidgetId[] {
  return widgets.filter((k) => k !== kind);
}

// The gallery's press on a widget (board-widgets.md "The widget gallery"): added at the end, or taken off when the
// board has it. A field widget past FIELD_WIDGETS_MAX is not added.
export function toggleWidget(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
): BoardWidgetId[] {
  if (widgets.includes(kind)) return removeWidget(widgets, kind);
  if (isFieldWidgetKey(kind) && fieldWidgetCount(widgets) >= FIELD_WIDGETS_MAX) return [...widgets];
  return placeWidget(widgets, kind, widgets.length);
}
