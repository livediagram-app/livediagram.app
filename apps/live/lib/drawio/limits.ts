// The named constants of the draw.io importer
// (docs/specs/020-import-export/blueprints/drawio-import.md "Constants").
import type { ElementShadow } from '@livediagram/diagram';

const MiB = 1024 * 1024;

/** Largest file the importer reads (spec: 50 MB). */
export const DRAWIO_MAX_FILE_BYTES = 50 * MiB;
/** Inflate allowance across one whole import, a zip-bomb guard (spec: 100 MB). */
export const DRAWIO_MAX_INFLATED_BYTES = 100 * MiB;
/** Pages imported from one file; the rest are counted (spec). */
export const DRAWIO_MAX_PAGES = 100;
/** draw.io's rounding factor for `rounded=1` without `arcSize`, in percent. */
export const DRAWIO_DEFAULT_ARC_SIZE = 10;
/** `shadow=1` as a livediagram drop shadow (D19). */
export const DRAWIO_SHADOW: ElementShadow = { offsetX: 2, offsetY: 3, blur: 3, opacity: 0.25 };
/** Height one caption line adds to an icon's box (D20). */
export const DRAWIO_CAPTION_LINE_PX = 18;
/** Width one caption character adds to an icon's box, sideways captions (D20). */
export const DRAWIO_CAPTION_CHAR_PX = 7;
/** How far from the middle an edge label must sit to keep its place (D21). */
export const DRAWIO_LABEL_CENTRE_EPSILON = 0.05;
/** Unmatched stencil names the summary lists (D22). */
export const DRAWIO_REPORT_NAMES_MAX = 5;
