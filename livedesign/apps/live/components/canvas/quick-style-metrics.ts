import { PEN_COLOUR_NAMES } from '@livedesign/design';

// The Quick Style bar's measures (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): a colour row's
// popover is as wide as its targets, so a swatch row never wraps and is never clipped.
export const QUICK_TARGET_PX = 24;
// A theme's colour row: its seven swatches, Ink and More colours.
const THEME_ROW_TARGETS = 9;
// Targets in every colour row: the widest of a theme's row and the marker rows' stock colours (Ink
// and the hued ones) and More colours, so every colour popover is one width whatever it styles.
export const QUICK_ROW_TARGETS = Math.max(THEME_ROW_TARGETS, 1 + PEN_COLOUR_NAMES.length + 1);
