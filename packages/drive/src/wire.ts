// What the service's browser routes answer (liveworkspace/docs/specs/005-drive/drive.md "The service"), shared by the service and
// the UI (`@liveworkspace/settings-ui`'s Cloud Sync row, the site's /drive pages, the Explorer's marks).

import type { AppName } from './formats';
import type { DriveNotice } from './plan/types';

export const DRIVE_API_PATH = '/api/drive';

/** GET /api/drive/config. Cheap: no Google call, no object woken for someone not connected. */
export type DriveConfigAnswer = {
  // The deployment offers Drive (a client id and secret are set).
  enabled: boolean;
  // The person has a connection (any status).
  connected: boolean;
  // The OAuth client id and the consent's scopes, for /drive/connect; the Picker's API key and app id.
  clientId: string | null;
  pickerKey: string | null;
  appId: string | null;
};

export type DriveStatus =
  // Connected; nothing failing.
  | 'ok'
  // Google refused the stored grant (revoked or expired): Reconnect.
  | 'needs_reconnect'
  // The last pass failed for another reason, and the next one will try again.
  | 'error';

/** GET /api/drive/connection: Cloud Sync's row. */
export type DriveConnectionAnswer =
  | { connected: false }
  | {
      connected: true;
      status: DriveStatus;
      rootFolderName: string;
      connectedAt: number;
      lastSyncedAt: number | null;
      // A pass is running now; `progress` while a first mirror or a big catch-up writes in batches.
      syncing: boolean;
      progress: { done: number; total: number } | null;
      // Items mirrored, and those with a notice (moved in Drive into a folder liveworkspace can't see).
      items: number;
      notices: { id: string; app: AppName | null; kind: 'item' | 'folder'; name: string }[];
      // A consent by another Google account waits for Switch / Cancel until this time.
      pendingSwitchUntil: number | null;
    };

/** POST /api/drive/state `{ returnTo }` → the signed state and the redirect URI Google must send the code to. */
export type DriveStateAnswer = { state: string; redirectUri: string; authUrl: string };

/** POST /api/drive/connect `{ code, state }`. */
export type DriveConnectAnswer =
  | { outcome: 'connected'; returnTo: string }
  // Another Google account than the one connected: confirm with POST /api/drive/account-switch, or cancel.
  | { outcome: 'switch_pending'; returnTo: string; until: number }
  // Google sent no refresh token (a consent without prompt=consent): connect again.
  | { outcome: 'no_refresh_token'; returnTo: string };

export type DriveMarkState = 'synced' | 'waiting' | 'syncing' | 'failed';

/** GET /api/drive/marks: one per mirrored item and folder of the person's own. */
export type DriveMarksAnswer = {
  marks: {
    id: string;
    kind: 'item' | 'folder';
    state: DriveMarkState;
    notice: DriveNotice | null;
  }[];
};

/** POST /api/drive/picker-token. */
export type DrivePickerTokenAnswer = { accessToken: string; expiresAt: number };

/** POST /api/drive/open `{ fileId }`. */
export type DriveOpenAnswer =
  | { action: 'open'; app: AppName; itemId: string; url: string }
  | {
      action: 'import';
      app: AppName;
      name: string;
      reason: 'copy' | 'shared' | 'other_environment';
    }
  | { action: 'not_ours' }
  // The person isn't connected, or the grant doesn't reach this file: connect (Allow access) and come back.
  | { action: 'allow_access' };

/** POST /api/drive/import `{ fileId }`. */
export type DriveImportAnswer = { app: AppName; itemId: string; url: string };

/** Every error a browser route answers, as `{ error }` with a 4xx/5xx status. */
export type DriveErrorCode =
  | 'drive_not_configured'
  | 'unauthorised'
  | 'not_connected'
  | 'needs_reconnect'
  | 'invalid_request'
  | 'invalid_state'
  | 'rate_limited'
  | 'not_found'
  // Import as a copy: the file is larger than DRIVE_IMPORT_MAX_BYTES (413).
  | 'file_too_large'
  | 'google_failed'
  // Any request that threw (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails"): a
  // mirror's storage failing on its side (503 with Retry-After), or anything else (500).
  | 'storage_unavailable'
  | 'internal_error';
