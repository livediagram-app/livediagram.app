// The named constants of the draw.io importer
// (docs/specs/020-import-export/blueprints/drawio-import.md "Constants").
import type { ElementShadow } from '@livediagram/document';

const MiB = 1024 * 1024;

/** Largest file the importer reads (spec: 50 MB). */
export const DRAWIO_MAX_FILE_BYTES = 50 * MiB;
/** Inflate allowance across one whole import, a zip-bomb guard (spec: 100 MB). */
export const DRAWIO_MAX_INFLATED_BYTES = 100 * MiB;
/** Pages imported from one file; the rest are counted (spec). */
export const DRAWIO_MAX_PAGES = 100;
/** draw.io's rounding factor for `rounded=1` without `arcSize`, in percent. */
export const DRAWIO_DEFAULT_ARC_SIZE = 10;
/** `shadow=1` as a livediagram drop shadow (D22). */
export const DRAWIO_SHADOW: ElementShadow = { offsetX: 2, offsetY: 3, blur: 3, opacity: 0.25 };
/** Height one caption line adds to an icon's box (D23). */
export const DRAWIO_CAPTION_LINE_PX = 18;
/** Room a caption's box keeps around its text, both sides together (D23). */
export const DRAWIO_CAPTION_PADDING_PX = 16;
/** How far from the middle an edge label must sit to keep its place (D24). */
export const DRAWIO_LABEL_CENTRE_EPSILON = 0.05;
/** Unmatched stencil names the summary lists (D25). */
export const DRAWIO_REPORT_NAMES_MAX = 5;
/**
 * What the Import dialog's draw.io file picker offers. The Explorer's picker sets no filter: a
 * Google Drive save has no extension, so every file is read by its content.
 */
export const DRAWIO_TAB_FILE_ACCEPT =
  '.drawio,.xml,.json,.svg,.png,application/xml,text/xml,application/json,image/svg+xml,image/png';
/**
 * How far out from its node a JSON export's edge with one free end is drawn: the export records no
 * position for it (spec "The JSON export"). About half a default box's width; 40 to 160.
 */
export const DRAWIO_JSON_LOOSE_EDGE_PX = 80;
/** Items read from one library; the rest are counted (spec "Shape libraries": the first 1 000). */
export const DRAWIO_MAX_LIBRARY_ITEMS = 1000;
/** draw.io's head size when an edge names none (`mxConstants.DEFAULT_MARKERSIZE`). */
export const DRAWIO_DEFAULT_MARKER_SIZE = 6;
