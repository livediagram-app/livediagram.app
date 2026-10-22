import { PEN_COLOUR_NAMES } from '@livedesign/document';

// The quick style panel's measures (docs/specs/008-canvas/quick-style-panel.md "Where it sits"):
// the panel's width is derived from these, so a swatch row never wraps and is never clipped.
export const QUICK_TARGET_PX = 24;
export const QUICK_BORDER_PX = 1;
export const QUICK_COMPACT_PADDING_PX = 8;
// A theme's colour row: its seven swatches, Ink and More colours.
const THEME_ROW_TARGETS = 9;
// Targets in every colour row: the widest of a theme's row and the marker rows' stock colours (Ink
// and the hued ones) and More colours, so the panel is one width whatever it styles.
export const QUICK_ROW_TARGETS = Math.max(THEME_ROW_TARGETS, 1 + PEN_COLOUR_NAMES.length + 1);
