// The repository link's constants (docs/specs/027-repositories/blueprints/repository-link.md "Constants and
// configuration"). `WAIT_SETTLE_MS` is `wait --for change`'s, reused by `sync --watch` (commands/wait.ts).

export const LINK_FILE_NAME = 'livediagram.toml';
export const MIRROR_DEFAULT_LEVEL = 'index';
export const MIRROR_DEFAULT_DIR = 'diagrams';
export const INDEX_FILE_NAME = 'INDEX.md';
// As read-copy keys (CLI76), RL8.
export const LINK_ID_HEX = 16;
// RL3.
export const LINK_ID_MAX = 128;
export const SYNC_LOCK_WAIT_MS = 30_000;
// RL18.
export const SYNC_LOCK_POLL_MS = 250;
export const SYNC_LOCAL_SETTLE_MS = 1_500;
// RL21.
export const SYNC_WATCH_COVERAGE_MS = 60_000;
// As EXPORT_CONCURRENCY (CLI29).
export const SYNC_CONCURRENCY = 2;
// As LIST_DEFAULT_LIMIT (CLI19), RL38.
export const PICKER_PAGE = 20;
export const SYNC_REPORTS_KEPT = 20;
