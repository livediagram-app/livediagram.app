'use client';

// What every board widget shares (BoardWidgetView.tsx): the pill they are drawn in, the context they read, their
// colours and the small parts (the glyph that leads a widget, a lone count, a pressable part, the quick filter
// toggle). BoardWidgetView re-exports WIDGET_PILL, PRESSABLE and WidgetContext for their callers.
import type {
  BoardProjection,
  BoardWidgetKind,
  Item,
  ItemTypeDef,
  PlanBoardSetup,
  QuickFilter,
} from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { BoardWidgetArt } from '../plan-tile-art';
import { PHASE_COLOURS } from '../views/view-frame';
import { CountBadge } from '@liveplanner/ui';

export const PEOPLE_SHOWN = 5;
export const TYPES_SHOWN = 3;
export const DONE_GREEN = PHASE_COLOURS.done;
export const SOON_AMBER = '#d97706';

export const WIDGET_PILL =
  'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium';

export type WidgetContext = {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  // The items the board shows (status is one of its columns), unfiltered.
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  // The viewer's person id, when they can be "mine".
  canFilterMine: string | null;
  trayOpen: boolean;
  onToggleTray: () => void;
  now: Date;
  // Whether this viewer may change the board, and a change to its set-up (Set Done Column).
  canEdit: boolean;
  onSetup: (next: PlanBoardSetup, part: string) => void;
  // Open an item in the item panel (Top Voted).
  onOpenItem: (itemId: string) => void;
  // Every card of the plan and its status names: the Filter widget's chips name and count by them.
  planItems?: ReadonlyMap<string, Item> | undefined;
  statusNames?: ReadonlyMap<string, string> | undefined;
};

export const NO_PLAN_ITEMS: ReadonlyMap<string, Item> = new Map();

const WIDGET_KEYS = ['person', 'type', 'due', 'priority'] as const;

// The quick filter with one widget narrowing set, or cleared when it is already the one set.
export function toggle<K extends (typeof WIDGET_KEYS)[number]>(
  quick: QuickFilter,
  key: K,
  value: NonNullable<QuickFilter[K]>,
): QuickFilter {
  const next: QuickFilter = { ...quick };
  if (JSON.stringify(quick[key]) === JSON.stringify(value)) delete next[key];
  else next[key] = value;
  return next;
}

// A part of a widget that narrows the board when pressed, pressed while it does.
export const PRESSABLE =
  'relative inline-flex items-center gap-1 rounded-md px-1 py-0.5 touch-target-y transition enabled:cursor-pointer enabled:hover:bg-black/5 dark:enabled:hover:bg-white/10';

// The widget's glyph, small, in a colour that says what it is about.
export function Lead({ kind, color }: { kind: BoardWidgetKind; color: string }) {
  return (
    <span className="flex shrink-0 items-center" style={{ color }} aria-hidden>
      <BoardWidgetArt kind={kind} size={14} />
    </span>
  );
}

// A lone count in a widget: a badge, like a column's count.
export function Figure({ children, palette }: { children: React.ReactNode; palette: PlanPalette }) {
  return (
    <CountBadge size="md" background={palette.column} color={palette.text}>
      {children}
    </CountBadge>
  );
}

// A widget pill's border and text colours, before a kind changes them.
export type WidgetPill = { borderColor: string; color: string };
