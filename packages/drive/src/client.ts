// The browser's side of the Drive service (liveworkspace/docs/specs/005-drive/drive.md "The service"): one typed method per browser
// route, for Cloud Sync's row (@liveworkspace/settings-ui), the site's /drive pages and the Explorer's marks. A page
// calls its own origin's `/api/drive` (liveworkspace.app, or an app's router, which forwards it), with the
// person's account access token. Nothing here throws: every answer is a result, so a row can say what went wrong.
//
// Browser-safe and dependency-free beyond the wire shapes: it never imports the server side.

import { DRIVE_API_PATH, type DriveErrorCode } from './wire';
import type {
  DriveConfigAnswer,
  DriveConnectAnswer,
  DriveConnectionAnswer,
  DriveImportAnswer,
  DriveMarksAnswer,
  DriveOpenAnswer,
  DrivePickerTokenAnswer,
  DriveStateAnswer,
} from './wire';

// `offline`: no answer at all (no network, or the page is leaving); `signed_out`: no token to send; `failed`: an
// answer that wasn't one of ours.
export type DriveCallError = DriveErrorCode | 'offline' | 'signed_out' | 'failed';

export type DriveResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: DriveCallError };

export type DriveClientOptions = {
  // The service's browser routes; this origin's `/api/drive` by default.
  baseUrl?: string;
  // The person's account access token, asked for per call (a guest's is refused by the service).
  getToken: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
};

const KNOWN_ERRORS = new Set<string>([
  'drive_not_configured',
  'unauthorised',
  'not_connected',
  'needs_reconnect',
  'invalid_request',
  'invalid_state',
  'rate_limited',
  'not_found',
  'google_failed',
] satisfies DriveErrorCode[]);

export function createDriveClient({
  baseUrl = DRIVE_API_PATH,
  getToken,
  fetch: doFetch,
}: DriveClientOptions) {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<DriveResult<T>> {
    let token: string | null;
    try {
      token = await getToken();
    } catch {
      token = null;
    }
    if (!token) return { ok: false, status: 401, error: 'signed_out' };
    const headers = new Headers({ accept: 'application/json', authorization: `Bearer ${token}` });
    if (body !== undefined) headers.set('content-type', 'application/json');
    let res: Response;
    try {
      // Looked up per call, so a test's stub installed later is used.
      res = await (doFetch ?? fetch)(`${base}${path}`, {
        method,
        headers,
        credentials: 'omit',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return { ok: false, status: 0, error: 'offline' };
    }
    if (res.status === 204) return { ok: true, data: undefined as T };
    const parsed = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (res.ok) return { ok: true, data: (parsed ?? {}) as T };
    const code =
      typeof parsed?.error === 'string' && KNOWN_ERRORS.has(parsed.error) ? parsed.error : 'failed';
    return { ok: false, status: res.status, error: code as DriveCallError };
  }

  return {
    /** Whether the deployment offers Drive, and whether the person is connected. Cheap. */
    config: () => call<DriveConfigAnswer>('/config'),
    /** Cloud Sync's row: the connection and its status. */
    connection: () => call<DriveConnectionAnswer>('/connection'),
    /** A signed consent state for a return page, and Google's consent address. */
    state: (returnTo: string) => call<DriveStateAnswer>('/state', 'POST', { returnTo }),
    /** Google's code and the state it came back with. */
    connect: (code: string, state: string) =>
      call<DriveConnectAnswer>('/connect', 'POST', { code, state }),
    /** Confirm a pending switch to another Google account. */
    confirmSwitch: () => call<unknown>('/account-switch', 'POST', {}),
    /** Cancel a pending switch: the connection stays as it was. */
    cancelSwitch: () => call<unknown>('/account-switch', 'DELETE'),
    /** Disconnect: the grant revoked, the rows forgotten, the Drive files left. */
    disconnect: () => call<unknown>('/connection', 'DELETE'),
    /** Run a pass now (Cloud Sync opened); the service skips it within 30 s of the last. */
    check: () => call<unknown>('/check', 'POST', {}),
    /** Each mirrored item's mark and notice. */
    marks: () => call<DriveMarksAnswer>('/marks'),
    pickerToken: () => call<DrivePickerTokenAnswer>('/picker-token', 'POST', {}),
    adopt: (folderId: string, itemId?: string) =>
      call<unknown>('/adopt', 'POST', itemId ? { folderId, itemId } : { folderId }),
    /** What Drive's Open with should do with a file. */
    open: (fileId: string) => call<DriveOpenAnswer>('/open', 'POST', { fileId }),
    /** Import a copy of a file into its app. */
    importFile: (fileId: string) => call<DriveImportAnswer>('/import', 'POST', { fileId }),
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;

// ---------- Connecting ------------------------------------------------------------------------------------------

/** The page every Connect leaves for (liveworkspace/docs/specs/005-drive/drive.md "Connecting"). */
export const DRIVE_CONNECT_PATH = '/drive/connect';
export const DRIVE_CONNECTED_PATH = '/drive/connected';
export const DRIVE_OPEN_PATH = '/drive/open';
/** The platform's help article on Google Drive sync, on liveworkspace's origin. */
export const DRIVE_HELP_PATH = '/help/google-drive';
/** The query parameter /drive/connect reads the return page from. */
export const DRIVE_RETURN_PARAM = 'return';

/** Set by /drive/connected on the page it returns to, once: `connected` (a consent was taken) or `cancelled` (the
 *  person cancelled at Google). Cloud Sync's row reads it and takes it away. */
export const DRIVE_OUTCOME_PARAM = 'drive';
export type DriveReturnOutcome = 'connected' | 'cancelled';

/** `href` with the outcome set on it. */
export function withDriveOutcome(href: string, outcome: DriveReturnOutcome): string {
  const url = new URL(href);
  url.searchParams.set(DRIVE_OUTCOME_PARAM, outcome);
  return url.toString();
}

/** The outcome a page was returned to with, if any. */
export function driveOutcomeOf(search: string): DriveReturnOutcome | null {
  const value = new URLSearchParams(search).get(DRIVE_OUTCOME_PARAM);
  return value === 'connected' || value === 'cancelled' ? value : null;
}

/** The Settings section Cloud Sync is, as a deep link's `section` names it (settingsSectionId("Cloud Sync")). */
export const CLOUD_SYNC_SECTION = 'Cloud Sync';
export const CLOUD_SYNC_SECTION_ID = 'cloud-sync';

/** `href` with Settings named on it, open on Cloud Sync: `?settings=<settings>&section=cloud-sync`, any earlier
 *  pair replaced, the fragment kept. */
export function withCloudSyncOpen(href: string, settings: string): string {
  const url = new URL(href);
  url.searchParams.delete('settings');
  url.searchParams.delete('section');
  url.searchParams.set('settings', settings);
  url.searchParams.set('section', CLOUD_SYNC_SECTION_ID);
  return url.toString();
}

/** Where Connect goes: liveworkspace's /drive/connect, carrying the page to come back to. */
export function driveConnectUrl(workspaceOrigin: string, returnTo: string): string {
  const origin = workspaceOrigin.replace(/\/+$/, '');
  return `${origin}${DRIVE_CONNECT_PATH}?${DRIVE_RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

// ---------- Open with -------------------------------------------------------------------------------------------

/** Drive's `state` on the Open URL: `{"ids":["<file id>"],"action":"open","userId":"…","resourceKeys":{…}}`. */
export type DriveOpenState = { fileId: string; userId: string | null };

const FILE_ID = /^[A-Za-z0-9_-]{1,200}$/;

/** The file Drive asks to open, or null for a `state` that isn't one (missing, not JSON, another action, no id). */
export function parseDriveOpenState(search: string): DriveOpenState | null {
  const raw = new URLSearchParams(search).get('state');
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { ids, action, userId } = value as { ids?: unknown; action?: unknown; userId?: unknown };
  if (action !== 'open' || !Array.isArray(ids)) return null;
  const fileId = (ids as unknown[])[0];
  if (typeof fileId !== 'string' || !FILE_ID.test(fileId)) return null;
  return { fileId, userId: typeof userId === 'string' ? userId : null };
}
