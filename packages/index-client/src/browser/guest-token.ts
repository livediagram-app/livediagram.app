// A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Guests"). The first time a browser needs one, the editor sends it to the accounts site through its api's
// `/api/auth/guest` (which names the app's client there), and it comes back to the editor's /auth/guest page with a
// year-long guest token in the fragment. The token is kept in localStorage and sent as the Bearer, exactly as an
// account's access token is. A token with fewer than GUEST_TOKEN_REFRESH_BEFORE_MS left is replaced on the next page
// load that needs it.
//
// Each app makes one set with createGuestTokens, naming its own storage keys, its api's base and where a handoff
// with nowhere safe to go back to lands.

import { isSameSitePath } from '@liveworkspace/auth-client/return-path';

export const GUEST_TOKEN_REFRESH_BEFORE_MS = 30 * 24 * 3600 * 1000;

// A handoff that came back without a token (the accounts site down, a deployment without one): no other is started
// for this long, so a failure never turns into a redirect loop. The page carries on without an identity, as a link
// visitor does.
export const GUEST_HANDOFF_BACKOFF_MS = 5 * 60_000;

export type GuestToken = { token: string; id: string; expiresAt: number };

export type GuestTokenOptions = {
  /** The localStorage key the token is kept under (an inline boot script may read the same key). */
  storageKey: string;
  /** The prefix of the two sessionStorage keys a handoff uses (`<prefix>:guest-handoff`, `…-failed`). */
  sessionPrefix: string;
  /** The app's api base on its own origin (`/api`): the handoff starts at `${apiBase}/auth/guest`. */
  apiBase: string;
  /** Where a handoff goes back to when the one it kept is not a path on this site. */
  fallbackPath: string;
  /** A guest this browser has never had, just kept: the daily new-visitors signal. */
  onNewGuest?: () => void;
};

export type GuestTokens = {
  readGuestToken: (now?: number) => GuestToken | null;
  clearGuestToken: () => void;
  startGuestHandoff: (returnTo?: string) => Promise<void>;
  completeGuestHandoff: (hash: string) => { returnTo: string; ok: boolean };
  ensureGuestToken: () => Promise<GuestToken | null>;
};

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

function read(kind: 'localStorage' | 'sessionStorage', key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: 'localStorage' | 'sessionStorage', key: string, value: string | null): void {
  try {
    const s = storage(kind);
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage blocked: the handoff still runs, it just can't keep its state.
  }
}

/** The claims a guest token carries, read without checking the signature (the api and the index check that on
 *  every request). Null for anything that is not a guest token. */
export function parseGuestToken(token: string): GuestToken | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { sub?: unknown; kind?: unknown; exp?: unknown };
    if (
      claims.kind !== 'guest' ||
      typeof claims.sub !== 'string' ||
      !claims.sub.startsWith('guest_')
    )
      return null;
    if (typeof claims.exp !== 'number') return null;
    return { token, id: claims.sub, expiresAt: claims.exp * 1000 };
  } catch {
    return null;
  }
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

export function createGuestTokens(opts: GuestTokenOptions): GuestTokens {
  const handoffKey = `${opts.sessionPrefix}:guest-handoff`;
  const failedKey = `${opts.sessionPrefix}:guest-handoff-failed`;

  const readGuestToken = (now = Date.now()): GuestToken | null => {
    const raw = read('localStorage', opts.storageKey);
    const parsed = raw ? parseGuestToken(raw) : null;
    return parsed && parsed.expiresAt > now ? parsed : null;
  };

  const recentlyFailed = (now: number) => {
    const at = Number(read('sessionStorage', failedKey) ?? 0);
    return Number.isFinite(at) && now - at < GUEST_HANDOFF_BACKOFF_MS;
  };

  // Send the browser for a guest token, coming back to `returnTo` (this page by default). Resolves only when no
  // handoff is started (one failed a moment ago); otherwise the page is leaving and it never resolves.
  const startGuestHandoff = (returnTo?: string): Promise<void> => {
    if (typeof window === 'undefined' || recentlyFailed(Date.now())) return Promise.resolve();
    const state = randomState();
    const { pathname, search, hash } = window.location;
    write(
      'sessionStorage',
      handoffKey,
      JSON.stringify({ state, returnTo: returnTo ?? `${pathname}${search}${hash}` }),
    );
    // On the next task, never inside the caller's own: a handoff begun from a React effect would otherwise fire
    // beforeunload mid-commit, where the editors' unload flush (flushSync) cannot run.
    // In place of this page (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests"): the round trip leaves no history
    // entry, so Back from where it comes back to skips this page, which would only hand off again or, on a /new,
    // make another document. Pushed, it trapped Back on the editor.
    const to = `${opts.apiBase}/auth/guest?state=${encodeURIComponent(state)}`;
    setTimeout(() => window.location.replace(to), 0);
    return new Promise(() => {});
  };

  // The /auth/guest page: keep the token the fragment carries when its state is the one this tab sent, and answer
  // where to go back to. A fragment without a token (or with a stranger's state) records a failure, so the page
  // does not start another handoff straight away.
  const completeGuestHandoff = (hash: string) => {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    let pending: { state?: unknown; returnTo?: unknown };
    try {
      pending = JSON.parse(read('sessionStorage', handoffKey) ?? '{}') as typeof pending;
    } catch {
      pending = {};
    }
    write('sessionStorage', handoffKey, null);
    const returnTo = isSameSitePath(pending.returnTo) ? pending.returnTo : opts.fallbackPath;
    const token = params.get('guest_token');
    const parsed = token ? parseGuestToken(token) : null;
    if (!parsed || !pending.state || params.get('state') !== pending.state) {
      write('sessionStorage', failedKey, String(Date.now()));
      return { returnTo, ok: false };
    }
    const before = readGuestToken();
    write('localStorage', opts.storageKey, parsed.token);
    write('sessionStorage', failedKey, null);
    if (!before || before.id !== parsed.id) opts.onNewGuest?.();
    return { returnTo, ok: true };
  };

  // The guest token to send, starting the handoff when there is none or it is near its end. Waits (forever) while
  // the page leaves for the handoff; answers null when no handoff can run, and the page carries on without one.
  let inflight: Promise<GuestToken | null> | null = null;
  const ensureGuestToken = (): Promise<GuestToken | null> => {
    const held = readGuestToken();
    if (!guestTokenNeedsRefresh(held)) return Promise.resolve(held);
    inflight ??= startGuestHandoff().then(() => {
      inflight = null;
      return readGuestToken();
    });
    return inflight;
  };

  return {
    readGuestToken,
    clearGuestToken: () => write('localStorage', opts.storageKey, null),
    startGuestHandoff,
    completeGuestHandoff,
    ensureGuestToken,
  };
}
