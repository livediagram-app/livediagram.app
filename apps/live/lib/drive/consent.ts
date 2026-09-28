// The Google consent step (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"):
// the authorisation-code flow in redirect mode, asking for drive.file and
// drive.install with offline access. `prompt=consent` only when no refresh
// token is stored, so the user normally consents once.

import { DRIVE_SCOPES } from '@livediagram/api-schema';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const RETURN_KEY = 'livediagram:v2:drive-return';
const STATE_KEY = 'livediagram:v2:drive-state';
const DEFAULT_RETURN = '/explorer';

export function driveRedirectUri(origin: string): string {
  return `${origin}/drive/connected`;
}

export function googleConsentUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  promptConsent: boolean;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    state: input.state,
  });
  if (input.promptConsent) params.set('prompt', 'consent');
  if (input.loginHint) params.set('login_hint', input.loginHint);
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// A same-origin path to come back to, or the Explorer (D12). Never another
// origin, never a protocol-relative path.
export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return DEFAULT_RETURN;
  }
  if (path.startsWith('/drive/connected')) return DEFAULT_RETURN;
  return path;
}

type SessionLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Remember where to return and which state was issued, for the redirect back.
export function rememberConsent(storage: SessionLike, state: string, returnPath: string): void {
  storage.setItem(STATE_KEY, state);
  storage.setItem(RETURN_KEY, safeReturnPath(returnPath));
}

// The remembered return path, once, when the state matches the one issued
// here; null for a state this browser never issued.
export function takeConsent(storage: SessionLike, state: string | null): string | null {
  const issued = storage.getItem(STATE_KEY);
  const returnPath = storage.getItem(RETURN_KEY);
  storage.removeItem(STATE_KEY);
  storage.removeItem(RETURN_KEY);
  if (!issued || issued !== state) return null;
  return safeReturnPath(returnPath);
}
