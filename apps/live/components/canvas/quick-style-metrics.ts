import { PEN_COLOUR_NAMES } from '@livediagram/document';

// The quick style panel's measures (docs/specs/008-canvas/quick-style-panel.md "Where it sits"):
// the panel's width is derived from these, so a swatch row never wraps and is never clipped.
export const QUICK_TARGET_PX = 24;
export const QUICK_BORDER_PX = 1;
export const QUICK_COMPACT_PADDING_PX = 8;
// A theme's colour row in Diagram mode: its seven swatches, Ink and More colours.
const THEME_ROW_TARGETS = 9;
// Targets in every colour row: the widest of a theme's row and the stock colours (Ink and the hued
// ones) and More colours in Draw mode, so the panel is one width in both modes.
export const QUICK_ROW_TARGETS = Math.max(THEME_ROW_TARGETS, 1 + PEN_COLOUR_NAMES.length + 1);
