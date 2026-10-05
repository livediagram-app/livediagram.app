// A Plan board's header widgets (docs/specs/025-plan/board-widgets.md): the kinds, the set a board
// shows when it names none, and the edits that place, move and remove one. A board holds each kind at
// most once, in order. Pure; the editor makes each edit one board edit.
import type { PlanBoardSetup } from './board';

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
  'votes',
  'points',
  'priorities',
  'unassigned',
  'top-voted',
  'stale',
] as const;
export type BoardWidgetKind = (typeof BOARD_WIDGET_KINDS)[number];

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

// The widgets a stored list names: known kinds, each once, in order.
export function readBoardWidgets(input: unknown): BoardWidgetKind[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: BoardWidgetKind[] = [];
  for (const k of input) if (isBoardWidgetKind(k) && !out.includes(k)) out.push(k);
  return out;
}

// The widgets a board shows: its own, or the default set (with Votes Left when it has voting on).
export function widgetsOf(setup: Pick<PlanBoardSetup, 'widgets' | 'voting'>): BoardWidgetKind[] {
  if (setup.widgets) return [...setup.widgets];
  return setup.voting.on ? [...DEFAULT_BOARD_WIDGETS, 'votes'] : [...DEFAULT_BOARD_WIDGETS];
}

// A widget placed before the widget at `index` (the end when past it). One the board already has moves
// there instead; `index` counts the widgets as they are, before the move.
export function placeWidget(
  widgets: readonly BoardWidgetKind[],
  kind: BoardWidgetKind,
  index: number,
): BoardWidgetKind[] {
  const from = widgets.indexOf(kind);
  const at = Math.max(0, Math.min(index, widgets.length));
  const rest = widgets.filter((k) => k !== kind);
  const to = from >= 0 && from < at ? at - 1 : at;
  rest.splice(to, 0, kind);
  return rest;
}

// A widget moved one place left (-1) or right (1); unchanged at either end.
export function nudgeWidget(
  widgets: readonly BoardWidgetKind[],
  kind: BoardWidgetKind,
  delta: -1 | 1,
): BoardWidgetKind[] {
  const from = widgets.indexOf(kind);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= widgets.length) return [...widgets];
  const next = [...widgets];
  next.splice(from, 1);
  next.splice(to, 0, kind);
  return next;
}

export function removeWidget(
  widgets: readonly BoardWidgetKind[],
  kind: BoardWidgetKind,
): BoardWidgetKind[] {
  return widgets.filter((k) => k !== kind);
}
