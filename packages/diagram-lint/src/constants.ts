// Every number the lint judges by (docs/specs/024-agents/blueprints/diagram-lint.md "Constants and
// configuration"), with its provenance in the blueprint's table.

export const LINT_CROSSINGS_PER_ARROW = 0.25;
export const LINT_MAX_ASPECT = 3;
export const LINT_MAX_ARROWS = 300;
// Touching is not overlapping (LN3).
export const LINT_OVERLAP_TOLERANCE_PX = 2;
// A member reaching its frame's border (LN13).
export const LINT_CONTAIN_TOLERANCE_PX = 2;
// A font epoch no browser uses, so estimated widths never share the label layout's cache (LN33).
export const LINT_MEASURE_EPOCH = -1;
// "Otherwise a graph": at least two connected boxes, at least half of them all (LN11).
export const LINT_GRAPH_MIN_CONNECTED = 2;
export const LINT_GRAPH_MIN_SHARE = 0.5;
// "Most" of a frame's arrows: more than half of at least three (LN12).
export const LINT_GROUP_SPLIT_SHARE = 0.5;
export const LINT_GROUP_SPLIT_MIN_ARROWS = 3;
// A flow is the direction of at least 60% of at least three arrows (LN15).
export const LINT_FLOW_MIN_ARROWS = 3;
export const LINT_FLOW_MIN_SHARE = 0.6;
export const LINT_FLOW_TOLERANCE_PX = 8;
// One or two boxes have a shape, not a layout (LN16).
export const LINT_ASPECT_MIN_BOXES = 3;
// The text report stays near 100 tokens (LN20).
export const LINT_MAX_LINES_PER_CODE = 10;
// Arrows named in an `edge-crossings` message; the JSON lists all (LN9).
export const LINT_REFS_PER_FINDING_MAX = 3;
// A heading's length (LN21).
export const LINT_LABEL_QUOTE_MAX = 40;
// The fix column stays inside a 100-column terminal (LN19).
export const LINT_MESSAGE_COLUMN_MAX = 48;
// CPU for 300 boxes and 300 arrows with the label pass (LN35).
export const LINT_BUDGET_CPU_MS = 50;
