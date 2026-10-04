// The view constants (docs/specs/024-agents/blueprints/document-views.md "Constants and configuration").

// Spec, "The outline".
export const LABEL_CUT_CHARS = 60;
export const NOTE_CUT_CHARS = 48;
export const ENTITY_FIELDS_SHOWN = 8;
// Spec, "Budgets": measured 3.07 characters per token for the outline.
export const CHARS_PER_TOKEN = 3;
// As notes (VW53).
export const ALT_CUT_CHARS = 48;
export const ACTION_CUT_CHARS = 48;
// URL-safe without quotes or spaces (VW15).
export const ATTR_BARE_PATTERN = /^[A-Za-z0-9._:/#?&=%+@~-]+$/;
// Above any stored id in practice (VW53).
export const REF_INPUT_MAX_LENGTH = 256;
// A phrase, not a document (VW53).
export const FIND_QUERY_MAX_LENGTH = 200;
// Above a full 10,000-element outline (VW53).
export const VIEW_BUDGET_MAX = 1_000_000;
// About 15 MB of tab bodies at the tab cap (VW47).
export const OVERVIEW_TAB_BATCH = 8;
// Well above a 1,000-element render (VW53).
export const VIEW_SLOW_MS = 100;
// Where a progress bar or ring with no value sits, as the editor draws it.
export const PROGRESS_DEFAULT = 50;
