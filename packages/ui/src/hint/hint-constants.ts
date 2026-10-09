// Timings and sizes for tooltips and hover cards
// (docs/specs/004-interface-design/blueprints/tooltips-hover-cards-popovers.md, Constants).

export type HintKind = 'tooltip' | 'hover-card';

// A pointer resting this long on a control is asking what it is called.
export const TOOLTIP_OPEN_DELAY_MS = 500;
// After a tooltip closes, the next one skips its delay for this long.
export const TOOLTIP_WARMUP_MS = 500;
// Time the pointer has to cross the gap from the control onto the hint.
export const HINT_CLOSE_GRACE_MS = 100;
// Matches the editor's long press (apps/live/hooks/ui/useLongPress.ts).
export const HINT_LONG_PRESS_MS = 500;
export const HINT_LONG_PRESS_SLOP_PX = 10;
// How long a long-pressed hint stays up after the finger lifts.
export const HINT_TOUCH_LINGER_MS = 1500;

export const TOOLTIP_GAP_PX = 6;
export const TOOLTIP_ARROW_PX = 8;
export const HOVER_CARD_GAP_PX = 10;
export const HOVER_CARD_ARROW_PX = 10;
