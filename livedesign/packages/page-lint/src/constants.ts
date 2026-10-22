// Every number the lint judges by (docs/specs/024-agents/blueprints/page-lint.md "Constants and configuration"),
// with its provenance in the blueprint's table.

// Text that only touches is not printed over (LN3).
export const LINT_OVERLAP_TOLERANCE_PX = 2;
// A font epoch no browser uses, so estimated widths never share the label layout's cache (LN33).
export const LINT_MEASURE_EPOCH = -1;
// The text report stays near 100 tokens (LN20).
export const LINT_MAX_LINES_PER_CODE = 10;
// A quoted word's length (LN21).
export const LINT_LABEL_QUOTE_MAX = 40;
// The fix column stays inside a 100-column terminal (LN19).
export const LINT_MESSAGE_COLUMN_MAX = 48;
