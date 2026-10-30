// The footer tab's shape, shared by all four editors' TabPill (docs/specs/007-editor/editor-app.md "How a tab looks"
// in each product): a tab hangs from the canvas's bottom edge like a sheet tab. The active tab is a raised card in the
// canvas's colour with no top edge, covering the bar's top border so it reads as joined to the canvas above; the
// others sit flat on the bar, a hairline between neighbours, and fill on hover. Classes only, so every editor draws
// the same tab and Tailwind finds them here (each app's globals.css scans packages/workbench/src).

// The strip the tabs hang in: it rises one pixel over the bar's top border, so the active tab can hide that border.
// Sideways only (the tab menu's and Add tab's 44px tap areas reach past the row, and a free y axis drew a vertical
// scrollbar for them); the edge with more tabs beyond it fades (scroll-edge-fade).
export const TAB_STRIP_CLASS =
  'scroll-edge-fade scrollbar-slim -mt-px flex flex-1 items-start gap-1 self-stretch overflow-x-auto overflow-y-hidden px-1 pb-1';

// Every tab: one height, the hanging shape, and a border kept transparent when unused so a tab keeps its width as it
// becomes active.
const BASE =
  'relative flex h-9 shrink-0 items-center gap-1 rounded-b-lg border-x border-b transition-colors';

// The active tab: the canvas's own surface (white, slate-800 in dark), its sides and foot outlined, no top edge.
const ACTIVE =
  'z-[1] border-slate-200 bg-white shadow-[0_2px_4px_-2px_rgb(15_23_42/0.12)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.5)]';

// The others: flat on the bar, neutral ink, a fill on hover, and a hairline on the left when the tab before is also
// flat (never beside the active tab, whose own outline is the divider there).
const INACTIVE =
  'border-transparent text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white before:pointer-events-none before:absolute before:inset-y-2.5 before:-left-[3px] before:w-px before:bg-slate-300 before:opacity-0 dark:before:bg-slate-700 [[data-tab]:not([data-active])+&]:before:opacity-100';

export type TabShapeState = {
  active: boolean;
  // Renaming in place: the name field carries the only box, so the tab sheds its padding.
  editing: boolean;
  // A Viewer's active tab has no menu button, so it keeps its even padding.
  readOnly: boolean;
};

// The tab's classes for its state. The trailing menu button carries its own padding around the glyph, so an active
// tab with one trims its own trailing padding (optical-alignment.md).
export function tabShapeClass({ active, editing, readOnly }: TabShapeState): string {
  const pad = editing ? 'px-0.5' : active && !readOnly ? 'pl-3 pr-1' : 'px-3';
  return `${BASE} ${active ? ACTIVE : INACTIVE} ${pad}`;
}

// The active tab's accent, a short bar along its foot in the tab theme's colour (set inline by the caller).
export const TAB_ACCENT_CLASS =
  'pointer-events-none absolute inset-x-2.5 bottom-0 h-[3px] rounded-t-full';

// The type icon (a tab's mode or kind) shows on a computer only: a phone keeps the room for names.
export const TAB_TYPE_ICON_CLASS = 'contents phone:hidden';

// A tab that is not shared with this session, and a tab folder: the same hanging shape, outlined dashed.
export const TAB_DASHED_CLASS =
  'flex h-9 shrink-0 items-center gap-1 rounded-b-lg border-x border-b border-dashed border-slate-300 dark:border-slate-600';

// Inside a folder's upward fan the tabs are a list, not hanging from an edge: every corner rounds.
export const TAB_FAN_ITEM_CLASS = 'flex w-full items-center [&_[data-tab]]:rounded-lg';
