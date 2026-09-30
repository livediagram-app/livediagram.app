// The quick style panel's measures (docs/specs/008-canvas/quick-style-panel.md "Where it sits"):
// the panel's width is derived from these, so a swatch row never wraps and is never clipped.
export const QUICK_TARGET_PX = 24;
export const QUICK_BORDER_PX = 1;
export const QUICK_COMPACT_PADDING_PX = 8;
export const QUICK_FLOATING_PADDING_PX = 10;
export const QUICK_FLOATING_GAP_PX = 4;
// Targets in the widest row: a theme's seven swatches, or a whiteboard's pen colours (the ink and
// six colours, then the picker's opener).
export const QUICK_ROW_TARGETS = { swatches: 7, pen: 8 } as const;
