// Every timing and size the Drive mirror runs on, in one place
// (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence"; values and budget from
// docs/research/migration-readiness.md, "Proposed sync cadence"). Tune here,
// never in the engine.

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// Check Drive this often while a livediagram tab is visible: a 5-unit
// `changes.getStartPageToken`, and `changes.list` only when it moved.
export const DRIVE_POLL_INTERVAL_MS = 2 * MINUTE;
// The poll interval's ceiling under back-off.
export const DRIVE_POLL_INTERVAL_MAX_MS = 60 * MINUTE;
// On focus or becoming visible, check if the last check is older than this.
export const DRIVE_FOCUS_POLL_MIN_GAP_MS = 30 * SECOND;
// Google's maximum, so a catch-up is usually one call.
export const DRIVE_CHANGES_PAGE_SIZE = 1000;
// Mirror a diagram once it has had no edits for this long.
export const DRIVE_WRITE_IDLE_MS = 60 * SECOND;
// At most one content write per diagram per interval.
export const DRIVE_WRITE_MIN_INTERVAL_MS = 5 * MINUTE;
// The write interval's ceiling under back-off.
export const DRIVE_WRITE_MIN_INTERVAL_MAX_MS = 30 * MINUTE;
// Back-off returns to the base values after this long without errors.
export const DRIVE_BACKOFF_CALM_MS = 60 * MINUTE;
// 2^5 x 2 minutes already passes the 60-minute check ceiling.
export const DRIVE_BACKOFF_MAX_LEVEL = 5;
// Write the page token to D1 only when it changed and at most this often
// (and always on a flush).
export const DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS = 10 * MINUTE;
// Fetch a new access token this long before the current one expires.
export const DRIVE_TOKEN_RENEW_BEFORE_MS = 5 * MINUTE;
// Recorded items reach D1 in batches of this many rows during a pass.
export const DRIVE_ITEMS_PUT_BATCH = 25;
// Google's multipart upload ceiling; larger contents go resumable.
export const DRIVE_MULTIPART_MAX_BYTES = 5 * 1024 * 1024;
// The PNG thumbnail's width (Google recommends 1600, requires 220 or more)
// and Google's size ceiling for it.
export const DRIVE_THUMBNAIL_WIDTH_PX = 1600;
export const DRIVE_THUMBNAIL_MIN_WIDTH_PX = 220;
export const DRIVE_THUMBNAIL_MAX_BYTES = 2 * 1000 * 1000;

// How long a pass must be running before the avatar's sync mark says
// "syncing", so the cheap start-token check never flashes it.
export const DRIVE_SYNCING_MARK_DELAY_MS = 600;
