// Every number SVG import uses (docs/specs/020-import-export/svg-import.md), named.

/** A file over this many bytes is placed as a picture instead ("Trust and limits"). */
export const SVG_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/** A file holding more elements than this is placed as a picture instead. */
export const SVG_IMPORT_MAX_ELEMENTS = 5_000;

/** How deep a `<use>` is followed. */
export const SVG_USE_MAX_DEPTH = 8;

/** No arc piece strays further than this from the true arc, in landed px. */
export const SVG_ARC_TOLERANCE_PX = 0.1;

/** A nonzero area resolved to corner nodes is traced within this, in landed px. */
export const SVG_TRACE_TOLERANCE_PX = 0.25;

/** The widest arc piece, in radians (a quarter turn). */
export const SVG_ARC_MAX_PIECE = Math.PI / 2;

/** Points tested on each side of each contour when checking even-odd against nonzero. */
export const SVG_NONZERO_SAMPLES_PER_RING = 24;

/** Past this many traced points an element's fill rule is left even-odd (Combine's own input cap). */
export const SVG_NONZERO_MAX_POINTS = 50_000;

/** The arc-precision scale is recomputed when the landed scale passes the guess by this factor. */
export const SVG_RESCALE_FACTOR = 1.5;

/** An outlined stroke's centreline, and each of its round caps and joins, are traced within this, in landed px: the
 *  outline as a whole stays within the 0.25 px budget. */
export const SVG_OUTLINE_TOLERANCE_PX = 0.125;

/** A landed stroke is outlined only past Extra thick times this (D22), so a stroke at 7 px give or take rounding
 *  stays a stroke. */
export const SVG_OUTLINE_SLACK = 1.001;

/** SVG's default `stroke-miterlimit`. */
export const SVG_MITER_LIMIT = 4;
