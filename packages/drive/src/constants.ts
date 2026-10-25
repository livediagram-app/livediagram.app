// Every timing and size the Drive mirror runs on, in one place (liveworkspace/docs/drive.md "Cadence"). Tune here,
// never in the service.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
] as const;

// appProperties keys (each key plus value at most 124 bytes).
export const DRIVE_PROP_ITEM_ID = 'lwItemId';
export const DRIVE_PROP_APP = 'lwApp';
export const DRIVE_PROP_FOLDER_ID = 'lwFolderId';
export const DRIVE_PROP_ORIGIN = 'lwOrigin';
export const DRIVE_PROP_ROOT = 'lwRoot';

// How long a consent `state` may be redeemed.
export const DRIVE_STATE_TTL_MS = 10 * MINUTE;
// How long a consent by another Google account waits for the person to confirm or cancel the switch: time to read
// and answer the dialog; past it the sealed token is never used.
export const DRIVE_ACCOUNT_SWITCH_TTL_MS = 30 * MINUTE;

// A pass runs this long after the last change signal, so a burst of edits is one pass. Safe range: 5 s to 2 min.
export const DRIVE_PASS_DEBOUNCE_MS = 30 * SECOND;
// At most one content write per item per interval; renames, moves and the bin are not throttled.
export const DRIVE_ITEM_MIN_WRITE_INTERVAL_MS = 5 * MINUTE;
// The write interval's ceiling under back-off.
export const DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS = 30 * MINUTE;
// A pass runs at least this often while the person's push channel is down or unconfirmed.
export const DRIVE_FALLBACK_CHECK_MS = 30 * MINUTE;
// And at least this often while it is up, to catch a missed signal.
export const DRIVE_FALLBACK_CHECK_WATCHED_MS = 6 * HOUR;
// The fallback check's ceiling under back-off.
export const DRIVE_FALLBACK_CHECK_MAX_MS = 6 * HOUR;
// Opening Cloud Sync runs a pass unless one finished this recently.
export const DRIVE_CHECK_MIN_GAP_MS = 30 * SECOND;
// Files a pass writes before it hands over to the next alarm, so a first mirror of thousands of items stays inside
// a Worker invocation's subrequest and CPU limits (each write is an export, maybe a thumbnail, and an upload).
export const DRIVE_PASS_MAX_WRITES = 40;
// How soon the next batch of a pass that stopped at DRIVE_PASS_MAX_WRITES runs.
export const DRIVE_PASS_CONTINUE_MS = 1 * SECOND;
// Drive-side changes a pass applies to liveworkspace before it hands over to the next alarm (DRIVE_PASS_CONTINUE_MS).
// Only changes with an effect count (an echo or an ignored change costs no call); most cost one or two index calls.
// Safe range: 50 to 300, so a full batch's index calls stay well inside DRIVE_PASS_SUBREQUEST_BUDGET.
export const DRIVE_PASS_MAX_INBOUND = 200;
// The most subrequests (Google, the index, the apps' doors) one pass, or one call to the object, may make. Every one
// is counted before it is sent; a pass that reaches the budget stops cleanly and continues in DRIVE_PASS_CONTINUE_MS.
// Sized against Cloudflare's per-invocation limit of 1,000 on the paid plan's default, with room for what isn't
// counted (an access-token refresh, a revoke). Safe range: 300 to 900.
export const DRIVE_PASS_SUBREQUEST_BUDGET = 800;
// Google's maximum, so a catch-up is usually one call.
export const DRIVE_CHANGES_PAGE_SIZE = 1000;
// Back-off returns to the base intervals after this long without errors.
export const DRIVE_BACKOFF_CALM_MS = HOUR;
// 2^5 already passes every ceiling.
export const DRIVE_BACKOFF_MAX_LEVEL = 5;
// Refresh the access token this long before it expires.
export const DRIVE_TOKEN_RENEW_BEFORE_MS = MINUTE;
// The push channel: Google's maximum for changes is a week; renewed a day before it ends.
export const DRIVE_CHANNEL_TTL_MS = 7 * 24 * HOUR;
export const DRIVE_CHANNEL_RENEW_BEFORE_MS = 24 * HOUR;
// Google's multipart upload ceiling; larger contents go resumable.
export const DRIVE_MULTIPART_MAX_BYTES = 5 * 1024 * 1024;
// The thumbnail's long side (Google requires 220 or more), and Google's size ceiling for it.
export const DRIVE_THUMBNAIL_PX = 440;
export const DRIVE_THUMBNAIL_MAX_BYTES = 2 * 1000 * 1000;
// Picker tokens per person per minute; each reaches Google.
export const DRIVE_PICKER_TOKENS_PER_MINUTE = 10;
// The longest one call to Google may take (it answers in well under a second): past it the call fails as a network
// failure would. Safe range: 3 s to 30 s.
export const GOOGLE_CALL_TIMEOUT_MS = 10 * SECOND;
// The most index pages a list reads. The mirror takes an item or folder missing from a list as gone and removes its
// Drive file, so a list that would be cut short throws instead: the pass stops and the next one tries again.
export const DRIVE_LIST_PAGES_MAX = 100;
const DRIVE_ID_MAX = 200;
export const DRIVE_NAME_MAX = 1024;

const DRIVE_ID_RE = /^[A-Za-z0-9_-]+$/;

/** A Drive file id, or a liveworkspace item or folder id: the same url-safe charset. */
export function isDriveId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= DRIVE_ID_MAX && DRIVE_ID_RE.test(value);
}

export type DriveEnvironment = 'production' | 'staging' | 'development';

/** The Drive folder everything mirrors into, one per environment so staging never writes into production's. */
export function driveRootName(environment: DriveEnvironment): string {
  return environment === 'production' ? 'liveworkspace' : `liveworkspace (${environment})`;
}
