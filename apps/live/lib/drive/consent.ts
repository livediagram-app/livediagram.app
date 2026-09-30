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

// Control characters and whitespace (U+0000 to U+0020, U+007F).
function hasControlOrSpace(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

// A same-origin path to come back to, or the Explorer (D12). Never another
// origin, never a protocol-relative path.
export function safeReturnPath(path: string | null | undefined): string {
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    // Control characters and whitespace: browsers strip some of them, which
    // can turn a path into "//host".
    hasControlOrSpace(path)
  ) {
    return DEFAULT_RETURN;
  }
  const base = 'https://return.invalid';
  let url: URL;
  try {
    url = new URL(path, base);
  } catch {
    return DEFAULT_RETURN;
  }
  if (url.origin !== base || url.pathname.startsWith('/drive/connected')) return DEFAULT_RETURN;
  return `${url.pathname}${url.search}${url.hash}`;
}

// The same path with Settings named on it (`?settings=<category>&section=<id>`),
// the deep link the Explorer and the editor open Settings from.
export function withSettingsTarget(path: string, category: string, section: string): string {
  const url = new URL(path, 'https://return.invalid');
  url.searchParams.delete('settings');
  url.searchParams.delete('section');
  url.searchParams.append('settings', category);
  url.searchParams.append('section', section);
  return `${url.pathname}${url.search}${url.hash}`;
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

const OUTCOME_KEY = 'livediagram:v2:drive-connect-outcome';

// A cancel at Google, for the page the user comes back to: said once, calmly.
export function markConnectCancelled(storage: SessionLike): void {
  storage.setItem(OUTCOME_KEY, 'cancelled');
}

// A finished connection, for the page the user comes back to: the tab that
// runs the mirror may be another one, which must start at once.
export function markConnectConnected(storage: SessionLike): void {
  storage.setItem(OUTCOME_KEY, 'connected');
}

export function peekConnectOutcome(storage: SessionLike): 'cancelled' | 'connected' | null {
  const outcome = storage.getItem(OUTCOME_KEY);
  return outcome === 'cancelled' || outcome === 'connected' ? outcome : null;
}

export function clearConnectOutcome(storage: SessionLike): void {
  storage.removeItem(OUTCOME_KEY);
}
