// The named constants of Microsoft Whiteboard import. Provenance and safe
// ranges: docs/specs/020-import-export/blueprints/whiteboard-import.md "Constants and configuration".

const MiB = 1024 * 1024;

export const WHITEBOARD_MAX_FILE_BYTES = 200 * MiB;
export const WHITEBOARD_MAX_INFLATED_BYTES = 400 * MiB;
export const WHITEBOARD_BEZIER_STEP_PX = 2;
export const WHITEBOARD_MIN_WIDTH_PX = 0.5;
export const WHITEBOARD_MAX_WIDTH_PX = 100;
export const WHITEBOARD_CLAMP_WARN_PX = 9;
export const WHITEBOARD_POINT_DECIMALS = 4;
export const WHITEBOARD_SIMPLIFY_TOLERANCE_PX = 0.35;
export const WHITEBOARD_SIMPLIFY_GROWTH = 1.6;
export const WHITEBOARD_SIMPLIFY_ROUNDS = 6;
export const WHITEBOARD_TAB_BYTES_BUDGET = 3.5 * MiB;
export const WHITEBOARD_YIELD_EVERY = 200;
