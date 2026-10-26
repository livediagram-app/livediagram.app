// What liveworkspace's three Drive pages decide (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Open with"), pure so every
// outcome is tested: /drive/connect asks for a consent state and leaves for Google; /drive/connected takes Google's
// answer to the service and sends the browser back where it came from; /drive/open is Drive's Open with.
import {
  withCloudSyncOpen,
  withDriveOutcome,
  type DriveCallError,
  type DriveResult,
} from '@liveworkspace/drive/client';
import {
  DRIVE_IMPORT_MAX_BYTES,
  type DriveConnectAnswer,
  type DriveOpenAnswer,
} from '@liveworkspace/drive';
import type { AppName } from '@liveworkspace/sites';
import { DRIVE_SETTINGS_PARAM } from './client';

// ---------- Where the browser may go back to ---------------------------------------------------------------------

/** liveworkspace.app's Explorer with Settings open on Cloud Sync: where a connect with no usable return page ends. */
export function defaultReturn(workspaceOrigin: string): string {
  return withCloudSyncOpen(`${workspaceOrigin.replace(/\/+$/, '')}/explorer`, DRIVE_SETTINGS_PARAM);
}

/**
 * The page a connect may come back to: one of liveworkspace's or of an app's in this environment (`isOurs` says which
 * origins are), never another site's, never /drive/connect or /drive/connected. Anything else is liveworkspace's Explorer. The
 * service checks the same again before it signs the state.
 */
export function safeReturn(
  value: string | null,
  workspaceOrigin: string,
  isOurs: (url: URL) => boolean,
): string {
  if (!value) return defaultReturn(workspaceOrigin);
  let url: URL;
  try {
    url = new URL(value, workspaceOrigin);
  } catch {
    return defaultReturn(workspaceOrigin);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return defaultReturn(workspaceOrigin);
  // Open with's Allow access comes back to /drive/open; the connect pages themselves never.
  const connectPage = url.pathname.startsWith('/drive/connect');
  if (!isOurs(url) || connectPage) return defaultReturn(workspaceOrigin);
  return url.toString();
}

// ---------- The consent's way back -------------------------------------------------------------------------------
// The return page, kept in this tab's session against the state the service issued, so a cancel at Google (which
// brings the state back but no code, so nothing for the service to answer) still comes back to it.

const CONSENT_KEY = 'liveworkspace:drive-consent';

type SessionLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
// The tab's storage, asked for inside the try: with site data blocked, merely reading `window.sessionStorage` throws.
type Session = () => SessionLike;

export function rememberConsent(session: Session, state: string, returnTo: string): void {
  try {
    session().setItem(CONSENT_KEY, JSON.stringify({ state, returnTo }));
  } catch {
    // A cancel then comes back to the Explorer instead.
  }
}

/** The remembered return page, once, when the state is the one issued here; null otherwise. */
export function takeConsent(session: Session, state: string | null): string | null {
  try {
    const storage = session();
    const raw = storage.getItem(CONSENT_KEY);
    storage.removeItem(CONSENT_KEY);
    if (!raw || !state) return null;
    const kept = JSON.parse(raw) as { state?: unknown; returnTo?: unknown };
    return kept.state === state && typeof kept.returnTo === 'string' ? kept.returnTo : null;
  } catch {
    return null;
  }
}

// ---------- /drive/connected ---------------------------------------------------------------------------------------

export type ConnectedQuery = { code: string | null; state: string | null; error: string | null };

export function connectedQuery(search: string): ConnectedQuery {
  const params = new URLSearchParams(search);
  return { code: params.get('code'), state: params.get('state'), error: params.get('error') };
}

/** What the page does before asking the service: go back after a cancel, stop on an address with nothing to redeem,
 *  or redeem the code. */
export type ConnectedPlan =
  | { kind: 'leave'; to: string }
  | { kind: 'invalid' }
  | { kind: 'redeem'; code: string; state: string };

export function planConnected(
  query: ConnectedQuery,
  remembered: string | null,
  workspaceOrigin: string,
): ConnectedPlan {
  if (query.error) {
    // A cancel at Google, calmly: back where they started, which says so.
    return {
      kind: 'leave',
      to: withDriveOutcome(remembered ?? defaultReturn(workspaceOrigin), 'cancelled'),
    };
  }
  if (!query.code || !query.state) return { kind: 'invalid' };
  return { kind: 'redeem', code: query.code, state: query.state };
}

export type ConnectedView =
  | { kind: 'leave'; to: string }
  // Another Google account than the one Cloud Sync uses: the Switch Google Account? dialog.
  | { kind: 'switch'; returnTo: string; until: number }
  | {
      kind: 'failed';
      reason: 'invalid_state' | 'no_refresh_token' | 'refused' | 'offline';
      returnTo: string;
    };

/** What the service's answer to the code means for the page. `fallback` is the return page this tab remembered (or
 *  the Explorer), for an answer that names none. */
export function connectedView(
  result: DriveResult<DriveConnectAnswer>,
  fallback: string,
): ConnectedView {
  if (!result.ok) {
    return {
      kind: 'failed',
      reason:
        result.error === 'invalid_state'
          ? 'invalid_state'
          : result.error === 'offline'
            ? 'offline'
            : 'refused',
      returnTo: fallback,
    };
  }
  const answer = result.data;
  switch (answer.outcome) {
    case 'connected':
      return { kind: 'leave', to: withDriveOutcome(answer.returnTo, 'connected') };
    case 'switch_pending':
      return { kind: 'switch', returnTo: answer.returnTo, until: answer.until };
    case 'no_refresh_token':
      return { kind: 'failed', reason: 'no_refresh_token', returnTo: answer.returnTo };
  }
}

/** Switch Account or Keep Current Account, answered: done, the pending switch gone (it lasts 30 minutes), or failed. */
export function switchOutcome(result: DriveResult<unknown>): 'done' | 'expired' | 'failed' {
  if (result.ok) return 'done';
  if (
    result.status === 409 ||
    result.status === 410 ||
    result.error === 'not_found' ||
    result.error === 'invalid_state'
  ) {
    return 'expired';
  }
  return 'failed';
}

// ---------- /drive/open ------------------------------------------------------------------------------------------

export type OpenView =
  | { kind: 'go'; to: string }
  | {
      kind: 'import';
      app: AppName;
      name: string;
      // A copy made in Drive of one of the person's mirrored items: a new item, never the original.
      copy: boolean;
    }
  | { kind: 'allow_access' }
  | { kind: 'not_ours' }
  | { kind: 'failed' };

export function openView(result: DriveResult<DriveOpenAnswer>): OpenView {
  if (!result.ok) {
    // No connection, or one Google no longer honours: connect, and come back to the same file.
    if (result.error === 'not_connected' || result.error === 'needs_reconnect')
      return { kind: 'allow_access' };
    if (result.error === 'not_found') return { kind: 'not_ours' };
    return { kind: 'failed' };
  }
  const answer = result.data;
  switch (answer.action) {
    case 'open':
      return { kind: 'go', to: answer.url };
    case 'import':
      return { kind: 'import', app: answer.app, name: answer.name, copy: answer.reason === 'copy' };
    case 'allow_access':
      return { kind: 'allow_access' };
    case 'not_ours':
      return { kind: 'not_ours' };
  }
}

/** What /drive/open says when Import as a copy fails: the file too big for an import, or not an app's file. */
export function importFailedBody(error: DriveCallError): string {
  if (error === 'file_too_large') {
    return `The file is bigger than ${DRIVE_IMPORT_MAX_BYTES / (1024 * 1024)} MB, the most an import can take.`;
  }
  return 'The file couldn’t be read as one of your liveworkspace apps’ files.';
}
