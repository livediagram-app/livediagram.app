// The infrastructure import's limits (docs/specs/020-import-export/infrastructure-import.md "Limits", blueprint
// "Constants"). Each value's provenance and safe range is in the blueprint's table.

/** The largest file the import parses: real Compose and Wrangler files are a few KB. */
export const INFRA_MAX_FILE_BYTES = 1_000_000;

/** The most files one run reads into one tab (a monorepo's Workers). */
export const INFRA_MAX_FILES = 20;

/** The most boxes one drawing holds; the rest fold into one "N more" box. */
export const INFRA_MAX_NODES = 150;

/** Past this many boxes, with no network groups, services sharing a name prefix are framed together. */
export const INFRA_GROUP_FROM = 40;

/** How deep HCL blocks may nest: real Terraform nests 3 or 4 deep; this bounds the parser's stack. */
export const HCL_MAX_DEPTH = 64;

/** The most text a tab's sources record keeps, all its files together: a tenth of a tab's size cap. */
export const INFRA_SOURCES_MAX_STORED_CHARS = 200_000;

/** The gap an update keeps between a box it places and the drawing (the template look's rank gap). */
export const PLACE_GAP = 48;

/** The padding a frame keeps round a box an update grows it to hold (the clustered layout's frame padding). */
export const FRAME_GROW_PAD = 24;
