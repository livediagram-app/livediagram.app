// The footer tab's look, shared by every editor's tab bar (docs/specs/007-editor/editor-app.md "How a tab looks" in
// each product): tabs stand on the screen's bottom edge like sheet tabs. The open tab is a card that joins the bottom
// edge, lifted off a slate-100 bar by a hairline ring and a soft upward shadow; the others are quiet, with an inset
// wash on hover. Nothing runs along a tab's top. Classes only, so Tailwind finds them here (each app's globals.css
// scans packages/workbench/src).
//
// The wash is a tab's ::after layer, so hovering eases its opacity alone. The open tab's card is one element for the
// whole strip (TAB_SLIDER_CLASS, useTabSlider) that slides to the tab you open; each tab's ::before draws the same card
// only until the strip's card has measured (or where no strip card is: a tab outside a tab-scoped share).

// The footer bar the strip sits in: a shade below the open tab's card, so the card lifts off it.
export const TAB_BAR_CLASS =
  'flex shrink-0 items-center gap-2 border-t border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950';

// The scroller the tabs stand in: the bar's full height, tabs at its foot, sideways only (the tab menu's and Add
// tab's 44px tap areas reach past the row, and a free y axis drew a vertical scrollbar for them). The edge with more
// tabs beyond it fades (scroll-edge-fade). Its foot clips the open tab's ring, so the card stays open at its foot.
export const TAB_STRIP_CLASS =
  'scroll-edge-fade scrollbar-slim flex flex-1 items-end self-stretch overflow-x-auto overflow-y-hidden px-1';

// The toolbar inside the scroller: every tab and folder, a hair apart. Its own stacking layer, so the sliding card
// stands above the folders' shelves and under every tab; `data-tab-slide` is set once that card shows.
export const TAB_LIST_CLASS = 'group/tabs relative isolate flex h-full shrink-0 items-end gap-0.5';

// The card: white (slate-800 in dark), rounded on top, a hairline ring and a shadow cast upward. Its own foot
// reaches past the strip, which clips it, so no ring line runs along the bottom edge. The strip's sliding card wears
// the same surface (TAB_SLIDER_CLASS); this ::before copy shows only until it has measured.
const CARD_SURFACE =
  'rounded-t-[10px] bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_-3px_10px_-4px_rgb(15_23_42/0.2)] dark:bg-[color-mix(in_srgb,var(--color-slate-800)_70%,var(--color-slate-600))] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(255_255_255/0.12),0_-4px_14px_-4px_rgb(0_0_0/0.8)]';

// The strip's one sliding card (useTabSlider writes its place, size and opacity). Hidden until it has measured.
export const TAB_SLIDER_CLASS = `pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform ${CARD_SURFACE}`;

const CARD =
  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-bottom-2 before:-z-10 before:rounded-t-[10px] before:bg-white before:shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_-3px_10px_-4px_rgb(15_23_42/0.2)] before:opacity-0 before:transition-opacity before:duration-150 before:ease-out dark:before:bg-[color-mix(in_srgb,var(--color-slate-800)_70%,var(--color-slate-600))] dark:before:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(255_255_255/0.12),0_-4px_14px_-4px_rgb(0_0_0/0.8)] motion-reduce:before:transition-none';

// The hover wash: a soft rounded fill inset inside the tab.
const WASH =
  'after:pointer-events-none after:absolute after:inset-x-1 after:inset-y-1.5 after:-z-10 after:rounded-lg after:bg-slate-400/[0.16] after:opacity-0 after:transition-opacity after:duration-150 dark:after:bg-slate-400/[0.06] motion-reduce:after:transition-none';

// Every tab: one height, the rounded top, its own stacking layer (the card and wash sit under its content), and a
// focus ring that follows its shape when its name has keyboard focus.
const BASE = `group/tab relative isolate flex h-10 shrink-0 items-center gap-1 rounded-t-[10px] text-[13.5px] tracking-[-0.005em] ${CARD} ${WASH} has-[[data-tab-key]:focus-visible]:outline-2 has-[[data-tab-key]:focus-visible]:-outline-offset-2 has-[[data-tab-key]:focus-visible]:outline-brand-500`;

// The open tab: its card shows (until the strip's sliding card takes over), its name semibold (its colour, the tab
// theme's accent, is set inline).
const ACTIVE =
  'z-[1] font-semibold before:opacity-100 group-data-[tab-slide]/tabs:before:opacity-0';

// The others: medium slate ink, darker with the wash on hover.
const INACTIVE =
  'font-medium text-slate-600 hover:text-slate-900 hover:after:opacity-100 dark:text-slate-400 dark:hover:text-slate-100';

export type TabShapeState = {
  active: boolean;
  // Renaming in place: the name field carries the only box, so the tab sheds most of its padding.
  editing: boolean;
  // Being dragged: dimmed while it moves.
  dragging?: boolean;
};

// The tab's classes for its state. The trailing padding is trimmed on every tab: the menu button carries its own
// padding around the glyph, and a tab without one gets a spacer in its place (optical-alignment.md).
export function tabShapeClass({ active, editing, dragging = false }: TabShapeState): string {
  // The trailing 10px an even padding would add live in TabFrame's spacer, which eases away as the menu button eases
  // in, so the tab's width never jumps when it opens.
  const pad = editing ? 'px-1' : 'pl-3.5 pr-1';
  return `${BASE} ${active ? ACTIVE : INACTIVE} ${pad}${dragging ? ' opacity-50' : ''}`;
}

// The tab's name: one line, truncated past 14rem, trimmed to its cap band so it centres on its letters.
export const TAB_NAME_CLASS = 'text-optical-line max-w-[14rem] truncate';

// The name's button, the tab's own key in the strip (`data-tab-key`): the tab's full height (a 44px tap area on touch), no ring of its own
// (the tab draws it).
export const TAB_NAME_BUTTON_CLASS =
  'relative flex h-10 min-w-0 cursor-pointer items-center gap-1.5 outline-none touch-target-y';

// The rename field, the same height as the name, inside the tab's own shape.
export const TAB_RENAME_FIELD_CLASS =
  'h-7 w-36 rounded-md bg-white px-2 text-[13.5px] font-medium text-slate-900 outline-none ring-2 ring-brand-400 dark:bg-slate-800 dark:text-slate-100';

// Where a dragged tab will land: a 2px rounded brand caret standing in the gap on that side.
export const TAB_CARET_CLASS =
  'pointer-events-none absolute top-1/2 z-10 h-6 w-0.5 -translate-y-1/2 rounded-full bg-brand-500';

// A tab not shared with this session: the same standing shape, outlined dashed.
export const TAB_DASHED_CLASS =
  'flex h-10 shrink-0 items-center gap-1 rounded-t-[10px] border-x border-t border-dashed border-slate-300 px-3.5 text-[13.5px] font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400';

// Add tab: a quiet `+` after the last tab, with the tabs' inset wash on hover.
export const TAB_ADD_CLASS =
  'relative mb-1.5 ml-1 flex size-7 shrink-0 cursor-pointer touch-target items-center justify-center rounded-lg text-lg leading-none text-slate-500 transition-colors duration-150 hover:bg-slate-400/[0.16] hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-400/[0.08] dark:hover:text-slate-100 motion-reduce:transition-none';
