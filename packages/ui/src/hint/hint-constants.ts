// Timings and sizes for tooltips and hover cards
// (docs/specs/004-interface-design/blueprints/tooltips-hover-cards-popovers.md, Constants).

export type HintKind = 'tooltip' | 'hover-card' | 'preview';

// A pointer resting this long on a control is asking what it is called.
export const TOOLTIP_OPEN_DELAY_MS = 500;
// After a tooltip closes, the next one skips its delay for this long.
export const TOOLTIP_WARMUP_MS = 500;
// A pointer resting this long on a row asks to see what it opens: longer than a tooltip, as a
// picture is a bigger thing to put in the way of a pointer moving down a table.
export const PREVIEW_OPEN_DELAY_MS = 600;
// After a preview closes, the next one skips its delay for this long.
export const PREVIEW_WARMUP_MS = 500;
// Time the pointer has to cross the gap from the control onto the hint.
export const HINT_CLOSE_GRACE_MS = 100;
// Matches the editor's long press (apps/editor/hooks/ui/useLongPress.ts).
export const HINT_LONG_PRESS_MS = 500;
export const HINT_LONG_PRESS_SLOP_PX = 10;
// How long a long-pressed hint stays up after the finger lifts.
export const HINT_TOUCH_LINGER_MS = 1500;
// A mouse event this soon after a touch is the browser's echo of the tap, not a mouse.
export const HINT_TOUCH_COMPAT_MS = 1000;

export const TOOLTIP_GAP_PX = 6;
export const TOOLTIP_ARROW_PX = 8;
export const HOVER_CARD_GAP_PX = 10;
export const HOVER_CARD_ARROW_PX = 10;

// The hover card's surface without its size or padding: a card that sizes itself to its content (a chart's tooltip)
// wears the same colours, border and shadow. A plain string here, so a caller takes it without the surface component.
export const HINT_CARD_SURFACE =
  'rounded-lg border border-slate-200 bg-white text-left shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40';
