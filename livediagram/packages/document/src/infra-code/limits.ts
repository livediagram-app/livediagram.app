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
