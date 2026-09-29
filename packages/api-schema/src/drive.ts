// Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): the wire
// types the api worker's /api/drive routes emit and the live app's sync engine
// consumes, plus the constants both sides must agree on.

// How a deployment gets Google access tokens: not at all, in the browser only
// (client id, no secret), or through the api's refresh-token broker.
export type DriveMode = 'off' | 'browser' | 'broker';

export type DriveConnectionStatus = 'connected' | 'needs_reconnect';

export type DriveItemKind = 'diagram' | 'folder';

export const DRIVE_ITEM_KINDS: readonly DriveItemKind[] = ['diagram', 'folder'];

// The item was moved in Drive into a folder livediagram cannot see.
export type DriveNotice = 'unseen_folder';

// The connection summary. The refresh token itself never leaves the worker;
// `hasRefreshToken` only says whether one is stored.
export type DriveConnection = {
  status: DriveConnectionStatus;
  hasRefreshToken: boolean;
  rootFolderId: string | null;
  pageToken: string | null;
  pageTokenSavedAt: number | null;
  connectedAt: number;
};

// One mirrored diagram or folder, with the Drive state livediagram last wrote
// (or last accepted from Drive). `name` is the name as Drive holds it; `ldName`
// the livediagram name it mirrors.
export type DriveItem = {
  kind: DriveItemKind;
  ldId: string;
  driveFileId: string;
  name: string;
  ldName: string;
  parentId: string | null;
  trashed: boolean;
  md5: string | null;
  headRevisionId: string | null;
  mirroredSavedAt: number | null;
  notice: DriveNotice | null;
  noticeParentId: string | null;
};

export type DriveLease = { acquired: boolean; holder: string | null; expiresAt: number | null };

export type DriveAccessToken = { accessToken: string; expiresAt: number };

export const DRIVE_FILE_MIME = 'application/vnd.livediagram+json';
export const DRIVE_FILE_EXTENSION = '.livediagram';
export const DRIVE_ROOT_NAME = 'livediagram';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
] as const;

// appProperties keys (each key plus value at most 124 bytes).
export const DRIVE_PROP_DIAGRAM_ID = 'ldDiagramId';
export const DRIVE_PROP_FOLDER_ID = 'ldFolderId';
export const DRIVE_PROP_ORIGIN = 'ldOrigin';
export const DRIVE_PROP_ROOT = 'ldRoot';

// The cross-device lease: held this long, renewed only when a pass has work
// and less than the renew window remains.
export const DRIVE_LEASE_MS = 15 * 60 * 1000;
export const DRIVE_LEASE_RENEW_BEFORE_MS = 5 * 60 * 1000;
// How long a consent `state` may be redeemed.
export const DRIVE_STATE_TTL_MS = 10 * 60 * 1000;
// Rows per PUT /api/drive/items: one D1 batch.
export const DRIVE_ITEMS_PUT_MAX = 100;
export const DRIVE_ID_MAX = 200;
export const DRIVE_NAME_MAX = 1024;

export function driveFileName(name: string): string {
  return `${name}${DRIVE_FILE_EXTENSION}`;
}

const EXTENSION_RE = /\.livediagram$/i;

// The livediagram name a Drive file name stands for: the extension dropped,
// trimmed, and cut to `max`. Null when nothing is left, so an empty rename in
// Drive keeps the old name.
export function stripDriveName(driveName: string, max = Number.POSITIVE_INFINITY): string | null {
  const stripped = driveName.trim().replace(EXTENSION_RE, '').trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, max);
}

const DRIVE_ID_RE = /^[A-Za-z0-9_-]+$/;
const LEASE_HOLDER_RE = /^[A-Za-z0-9-]{1,64}$/;

export function isDriveFileId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= DRIVE_ID_MAX &&
    DRIVE_ID_RE.test(value)
  );
}

// Diagram and folder ids are uuids or short url-safe ids; the same charset.
export const isLivediagramId = isDriveFileId;

export function isDriveLeaseHolder(value: unknown): value is string {
  return typeof value === 'string' && LEASE_HOLDER_RE.test(value);
}
