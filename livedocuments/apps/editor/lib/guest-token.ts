// A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/one-explorer-contracts.md
// "Guests"). The first time this browser needs one, it goes to the accounts site through this app's
// `/api/auth/guest` (which names the app's client there) and comes back to /auth/guest with a year-long guest
// token in the fragment. The token is kept here and sent as the Bearer, exactly as an account's access token is.
// A token with fewer than GUEST_TOKEN_REFRESH_BEFORE_MS left is replaced on the next page load that needs it.

import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';
import { API_BASE } from './api/base';
import { reportParticipantCreated } from './local-identity';
import { GUEST_TOKEN_STORAGE_KEY as TOKEN_KEY } from './guest-token-key';

// The handoff in flight (sessionStorage): the state sent, and where to go back to.
const HANDOFF_KEY = 'livedocuments:guest-handoff';
// A handoff that came back without a token (the accounts site down, a deployment without one): no other is
// started for this long, so a failure never turns into a redirect loop. The page carries on without an identity,
// as a link visitor does.
const HANDOFF_FAILED_KEY = 'livedocuments:guest-handoff-failed';
const HANDOFF_FAILED_BACKOFF_MS = 5 * 60_000;

export const GUEST_TOKEN_REFRESH_BEFORE_MS = 30 * 24 * 3600 * 1000;

export type GuestToken = { token: string; id: string; expiresAt: number };

function readSession(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the handoff still runs, it just can't check its state on the way back.
  }
}

// The claims a guest token carries, read without checking the signature: the api and the index check that on
// every request. Null for anything that is not a guest token.
export function parseGuestToken(token: string): GuestToken | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { sub?: unknown; kind?: unknown; exp?: unknown };
    if (claims.kind !== 'guest' || typeof claims.sub !== 'string' || !claims.sub.startsWith('guest_'))
      return null;
    if (typeof claims.exp !== 'number') return null;
    return { token, id: claims.sub, expiresAt: claims.exp * 1000 };
  } catch {
    return null;
  }
}

// The kept guest token while it lasts, or null.
export function readGuestToken(now = Date.now()): GuestToken | null {
  const raw = readLocalStorageSafe(TOKEN_KEY);
  const parsed = raw ? parseGuestToken(raw) : null;
  return parsed && parsed.expiresAt > now ? parsed : null;
}

export function clearGuestToken(): void {
  removeLocalStorageSafe(TOKEN_KEY);
}

export function guestTokenNeedsRefresh(token: GuestToken | null, now = Date.now()): boolean {
  return !token || token.expiresAt - now < GUEST_TOKEN_REFRESH_BEFORE_MS;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function handoffRecentlyFailed(now: number): boolean {
  const at = Number(readSession(HANDOFF_FAILED_KEY) ?? 0);
  return Number.isFinite(at) && now - at < HANDOFF_FAILED_BACKOFF_MS;
}

// Send the browser for a guest token, coming back to `returnTo` (this page by default). Resolves only when no
// handoff is started (one failed a moment ago); otherwise the page is leaving and it never resolves.
export function startGuestHandoff(returnTo?: string): Promise<void> {
  const now = Date.now();
  if (typeof window === 'undefined' || handoffRecentlyFailed(now)) return Promise.resolve();
  const state = randomState();
  const back = returnTo ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  writeSession(HANDOFF_KEY, JSON.stringify({ state, returnTo: back }));
  window.location.assign(`${API_BASE}/auth/guest?state=${encodeURIComponent(state)}`);
  return new Promise(() => {});
}

// Only a path on this site, so the handoff can never be an open redirect.
function safePath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
    ? value
    : '/explorer';
}

// The /auth/guest page: keep the token the fragment carries when its state is the one this tab sent, and answer
// where to go back to. A fragment without a token (or with a stranger's state) records a failure, so the page
// does not start another handoff straight away.
export function completeGuestHandoff(hash: string): { returnTo: string; ok: boolean } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  let pending: { state?: unknown; returnTo?: unknown };
  try {
    pending = JSON.parse(readSession(HANDOFF_KEY) ?? '{}') as typeof pending;
  } catch {
    pending = {};
  }
  writeSession(HANDOFF_KEY, null);
  const returnTo = safePath(pending.returnTo);
  const token = params.get('guest_token');
  const parsed = token ? parseGuestToken(token) : null;
  if (!parsed || !pending.state || params.get('state') !== pending.state) {
    writeSession(HANDOFF_FAILED_KEY, String(Date.now()));
    return { returnTo, ok: false };
  }
  const before = readGuestToken();
  writeLocalStorageSafe(TOKEN_KEY, parsed.token);
  writeSession(HANDOFF_FAILED_KEY, null);
  // A guest this browser has never had: the daily new-visitors signal (docs/specs/017-telemetry/telemetry.md).
  if (!before || before.id !== parsed.id) reportParticipantCreated();
  return { returnTo, ok: true };
}

// The guest token to send, starting the handoff when there is none or it is near its end. Waits (forever) while
// the page leaves for the handoff; answers null when no handoff can run, and the page carries on without one.
let inflight: Promise<GuestToken | null> | null = null;
export function ensureGuestToken(): Promise<GuestToken | null> {
  const held = readGuestToken();
  if (!guestTokenNeedsRefresh(held)) return Promise.resolve(held);
  inflight ??= startGuestHandoff().then(() => {
    inflight = null;
    return readGuestToken();
  });
  return inflight;
}
