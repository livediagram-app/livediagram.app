// The HTTP/WS plumbing every editor's api client shares (each editor's lib/api/core.ts binds it once with
// createApiCore): the WebSocket base, the request funnel (apiFetch), the identity header builder, the
// response-handling helpers, the shared DELETE shape, the autosave time bound and the module-level token and
// share-password state. What differs per editor is handed in: its guest token, its error telemetry, the index's
// grant it adds to a request about one file, how it reads the server's release signal, a workbench session's
// confinement where it has one, and its share-password cache prefix.
import { isAccountIdShape } from '@liveworkspace/api-kit/request-auth';
import { readErrorCode } from '@liveworkspace/api-schema/http-errors';
import { readLocalStorageSafe, writeLocalStorageSafe } from '../local-storage-safe';
import { ApiError } from './api-error';
import { API_BASE } from './base';

// How long an autosave write may take before it is abandoned (per-tab-storage.md "Retrying a
// failed save"). Each tab's saves run one after another (tab-save-queue.ts), so a save left hanging on a stalled
// connection (a laptop switching networks can leave a request open for minutes before the browser fails it) held
// back every later save of that tab. Abandoned, it fails like any network error: the retry runs on a fresh
// connection with the newest content. The bound is a base for the round trip plus the time to upload the body at a
// slow uplink, so a large tab on a poor connection still has its time. Safe ranges: base 10 s to 60 s, rate 8 to
// 64 KB/s.
export const SAVE_TIMEOUT_BASE_MS = 20_000;
const SAVE_UPLOAD_BYTES_PER_SECOND = 16 * 1024;

export function saveTimeoutMs(bodyBytes: number): number {
  return SAVE_TIMEOUT_BASE_MS + Math.ceil((bodyBytes / SAVE_UPLOAD_BYTES_PER_SECOND) * 1000);
}

// The signal an autosave write carries: aborts once saveTimeoutMs has passed for a body of this size.
export function saveTimeoutSignal(body: string): AbortSignal {
  return AbortSignal.timeout(saveTimeoutMs(new TextEncoder().encode(body).byteLength));
}

// WebSocket counterpart of API_BASE. Converts http(s):// to ws(s):// for absolute bases; for the same-origin default
// it builds from `window.location` at call time (so SSR-safe modules can still import this file).
export function wsUrl(path: string): string {
  if (API_BASE.startsWith('http://')) {
    return `ws://${API_BASE.slice('http://'.length)}${path}`;
  }
  if (API_BASE.startsWith('https://')) {
    return `wss://${API_BASE.slice('https://'.length)}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${API_BASE}${path}`;
}

// Thrown instead of sending a request that is certain to be refused: a signed-in client (its owner id is an account
// id) that has no session token to prove it. Sending the guest's token in its place would act as someone else, so an
// auth problem is not turned into what looks like a network one.
export class SessionTokenUnavailableError extends Error {
  constructor() {
    super('no session token for a signed-in owner');
    this.name = 'SessionTokenUnavailableError';
  }
}

// How long one token request may take (docs/specs/007-editor/load-recovery.md "The load always ends"). A session
// that never hands out a token used to hold every request, and so the load, open forever; giving up answers null,
// which a signed-in caller turns into SessionTokenUnavailableError.
export const SESSION_TOKEN_TIMEOUT_MS = 10_000;

// Strip fields that ride on the Tab type for the editor's convenience but must never enter the persisted tab body
// (`tabs.data`):
//   - `templateChosen`: UI-only (have we dismissed the per-tab template picker yet?); a pure frontend concern.
//   - `folder`: per-file membership (tab-folders.md) that lives on the tab's link row, carried via the meta/reorder
//     path. Leaking it into the shared body would make a folder follow the tab into every file it's shared into,
//     breaking per-file scope.
export function stripUiTabFields<T extends { templateChosen?: unknown; folder?: unknown }>(
  tab: T,
): T {
  if (tab.templateChosen === undefined && tab.folder === undefined) return tab;
  const { templateChosen: _tc, folder: _f, ...rest } = tab;
  void _tc;
  void _f;
  return rest as T;
}

// `skipCache` asks the session for a fresh token rather than the held one (AccountsBridge refreshes over the
// network).
export type TokenProvider = (opts?: { skipCache?: boolean }) => Promise<string | null>;

export type ApiCoreConfig = {
  // The guest token liveworkspace issued this browser (lib/guest-token.ts), or null.
  readGuestToken: () => { token: string } | null;
  // Error telemetry (lib/api/error-report.ts, docs/specs/017-telemetry/telemetry.md 'Error').
  report: {
    apiError: (status: number, action: string, code: string | null) => void;
    apiWarning: (type: string) => void;
    networkError: (method: string, url: string, err: unknown) => void;
    noSessionToken: () => void;
    markReported: (err: unknown) => void;
  };
  // The request with the index's grant on it, where it is about one file (lib/api/*-grants.ts).
  withGrant: (
    apiBase: string,
    input: string,
    init: RequestInit | undefined,
  ) => Promise<RequestInit | undefined>;
  // Reads the server's release signal off every response (lib/server-release.ts).
  noteResponse: (res: Response) => void;
  // A workbench session's confinement (lib/api/workbench-confinement.ts), where the editor has one: a request outside
  // its allow-list is refused unsent, and every response passes it.
  confinement?: {
    refusal: (url: string, init: RequestInit | undefined) => Error | null;
    noteResponse: (init: RequestInit | undefined, res: Response) => unknown;
  };
  // The localStorage key prefix the share-password cache keeps its entries under (`<app>:share-password:`).
  sharePasswordCachePrefix: string;
};

export type ApiHeadersOptions = {
  share?: string | null;
  body?: boolean;
  extra?: Record<string, string>;
};

export type ApiDeleteOptions = {
  action: string;
  // Forwarded to apiHeaders when present. Skip the field (or pass null) for endpoints that don't accept a share-code
  // path.
  share?: string | null;
  // Defaults to true: most DELETEs are idempotent ("if it exists, remove it") and a racing concurrent delete should
  // NOT throw. Pass `false` to require a successful 2xx and surface 404 as a real error.
  allow404?: boolean;
  // Declarative markers this DELETE carries, e.g. the Offline Mode conversion header: without one the worker cannot
  // tell "take offline" from a real delete and records the wrong event.
  extra?: Record<string, string>;
};

export function createApiCore(config: ApiCoreConfig) {
  const { report } = config;

  // Every api request goes through here rather than bare `fetch`: it reports a network failure, and reads the
  // server's release signal off every response. Same arguments and the same Response otherwise. `grant: false`
  // sends the request as it is, at once: the unload flush, which adds the grant it holds itself and cannot wait for
  // one (a beforeunload handler runs to its end before anything it awaits).
  async function apiFetch(
    input: string,
    init?: RequestInit,
    opts: { grant?: boolean | undefined } = {},
  ): Promise<Response> {
    const method = (init?.method ?? 'GET').toUpperCase();
    // A workbench session's request outside its allow-list is refused unsent, and is no network error.
    const refusal = config.confinement?.refusal(input, init);
    if (refusal) throw refusal;
    let res: Response;
    try {
      // A request about one file carries the index's grant on it, fetched once per ten minutes.
      res = await fetch(
        input,
        opts.grant === false ? init : await config.withGrant(API_BASE, input, init),
      );
    } catch (err) {
      // The one place that sees a request fail before any response exists.
      report.networkError(method, input, err);
      throw err;
    }
    if (config.confinement) void config.confinement.noteResponse(init, res);
    // The server release signal rides every response: the format number and the live build id
    // (docs/specs/016-platform/new-version-prompt.md, docs/specs/016-platform/stale-builds.md).
    config.noteResponse(res);
    return res;
  }

  // Identity (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Reaching the index"). A signed-in page
  // registers a token provider (`registerTokenProvider`, `setTokenProvider`) whose account access token goes out as
  // `Authorization: Bearer <jwt>`; without one (a guest, or signed out) the guest token goes out the same way. A link
  // visitor with neither sends only its share code in `X-Share-Code`, which is enough for the index to grant what the
  // link allows. Share-code visitors who are also signed in send Bearer + X-Share-Code; the per-link role still gates
  // write access.
  //
  // Module-level state (rather than threading a tokenProvider through every function signature) because the editor
  // ships only as a static export: single browser tab, single-threaded, single signed-in session per page load.
  // useAccountBootstrap wires it up once in a layout effect and clears on unmount. Tests reset between cases via the
  // same setter.
  let currentTokenProvider: TokenProvider | null = null;

  // The most recent token the provider returned, kept for the ONE caller that can't await: the `beforeunload` save
  // beacon. The provider is async (the session may refresh over the network), so during page teardown it's unusable,
  // but the editor autosaves every ~600ms while editing, so this cache is at most seconds old exactly when the beacon
  // needs it. Cleared with the provider on sign-out/unmount so a signed-out tab can't flush with a dead identity.
  let lastKnownToken: string | null = null;

  // Every mounted useAccountBootstrap registers the same provider; the newest registration is the one in force, and
  // it stays in force until the LAST registration goes. A single slot cleared on unmount let one component leaving
  // (a Settings row, a dialog) take the Bearer away from the page still mounted around it, and its next save failed
  // as unauthenticated.
  const registrations: TokenProvider[] = [];

  function registerTokenProvider(provider: TokenProvider): () => void {
    registrations.push(provider);
    currentTokenProvider = provider;
    lastKnownToken = null;
    return () => {
      const at = registrations.lastIndexOf(provider);
      if (at >= 0) registrations.splice(at, 1);
      currentTokenProvider = registrations.at(-1) ?? null;
      lastKnownToken = null;
    };
  }

  // Set / clear the provider outright, dropping every registration (tests, and callers that own the whole
  // identity). Pass `null` to clear.
  function setTokenProvider(provider: TokenProvider | null): void {
    registrations.length = 0;
    currentTokenProvider = provider;
    // Clear on EVERY provider change, not just sign-out: a replaced provider means the cached token came from a
    // session we no longer trust. The next request refills it from the new provider.
    lastKnownToken = null;
  }

  // Synchronous read of the last token apiHeaders fetched, for the unload beacon only. Everything else must go
  // through apiHeaders (which refreshes via the async provider).
  function getLastKnownToken(): string | null {
    return lastKnownToken;
  }

  // Share password for the current visitor session (docs/specs/013-workspace/share-password.md). Same module-level
  // rationale as the token provider: the viewer sets it once after passing the password gate and `apiHeaders` (HTTP)
  // and `connectRoom` (WebSocket) attach it automatically. Owners never set it, so their requests never carry it.
  // Null = no password in play.
  let sessionSharePassword: string | null = null;
  function setSessionSharePassword(password: string | null): void {
    sessionSharePassword = password && password.length > 0 ? password : null;
  }
  function getSessionSharePassword(): string | null {
    return sessionSharePassword;
  }

  // localStorage cache so a returning visitor on a protected file doesn't have to retype the password every load.
  // Keyed by share code rather than the file's id because the id only resolves AFTER the gate is passed; the share
  // code is what the URL carries on arrival. Entry lifetime is bounded by the share code's validity:
  //   - Code revoked: the shared load returns null, no cache read happens on later loads anyway.
  //   - Password rotated: the cached value comes back from the server as passwordRequired { invalid: true }, the
  //     bootstrap clears the entry, and the gate prompts the visitor afresh.
  // The threat model (share-password.md) is anti-URL-guessing, not cryptographic protection of user data.
  function readCachedSharePassword(shareCode: string): string | null {
    const raw = readLocalStorageSafe(`${config.sharePasswordCachePrefix}${shareCode}`);
    return raw && raw.length > 0 ? raw : null;
  }
  function writeCachedSharePassword(shareCode: string, password: string | null): void {
    const key = `${config.sharePasswordCachePrefix}${shareCode}`;
    if (password && password.length > 0) writeLocalStorageSafe(key, password);
    else writeLocalStorageSafe(key, '');
  }

  // The identity half of every request, shared by apiHeaders (async) and the unload beacon (sync, off the cached
  // token): the account's token, else the guest's, else nothing (a link visitor). An account id with no account
  // token is refused here rather than sent as a guest.
  function identityHeaders(ownerId: string, token: string | null): Record<string, string> {
    if (token) return { Authorization: `Bearer ${token}` };
    if (isAccountIdShape(ownerId)) throw new SessionTokenUnavailableError();
    const guest = config.readGuestToken();
    return guest ? { Authorization: `Bearer ${guest.token}` } : {};
  }

  // The Bearer this page sends, for a request that goes outside apiHeaders: the account's, else the guest's.
  async function currentBearer(): Promise<string | null> {
    const token = await resolveToken();
    lastKnownToken = token;
    return token ?? config.readGuestToken()?.token ?? null;
  }

  function withTokenTimeout(p: Promise<string | null>): Promise<string | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[api] session token timed out after ${SESSION_TOKEN_TIMEOUT_MS} ms`);
        report.apiWarning('SessionToken.TimedOut');
        resolve(null);
      }, SESSION_TOKEN_TIMEOUT_MS);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  // The session's getToken() can resolve null for a moment on a live session, so a null gets one fresh attempt that
  // bypasses the session's held token. Each attempt is bounded by SESSION_TOKEN_TIMEOUT_MS.
  async function resolveToken(): Promise<string | null> {
    const provider = currentTokenProvider;
    if (!provider) return null;
    return (
      (await withTokenTimeout(provider())) ??
      (await withTokenTimeout(provider({ skipCache: true })))
    );
  }

  async function apiHeaders(
    ownerId: string,
    // `extra` is merged last, for the handful of routes that carry a declarative header of their own
    // (X-Allow-Empty, the Offline Mode conversion marker). `body: true` adds `Content-Type: application/json` for
    // write requests; GETs and DELETEs omit it.
    opts: ApiHeadersOptions = {},
  ): Promise<HeadersInit> {
    const token = await resolveToken();
    // Mirror into the sync cache for the unload beacon (see getLastKnownToken), including null, so a session that
    // lapsed mid-page doesn't leave a stale Bearer for the flush.
    lastKnownToken = token;
    let h: Record<string, string>;
    try {
      h = identityHeaders(ownerId, token);
    } catch (err) {
      report.noSessionToken();
      report.markReported(err);
      throw err;
    }
    if (opts.body) h['Content-Type'] = 'application/json';
    if (opts.share) h['X-Share-Code'] = opts.share;
    // Share password (share-password.md) rides on every request once the visitor has passed the gate; the api
    // ignores it unless the file is protected and accessed via a share code. Owners never set it.
    if (sessionSharePassword) h['X-Share-Password'] = sessionSharePassword;
    return { ...h, ...opts.extra };
  }

  // The ApiError for a non-2xx, reported to error telemetry on the way out. `expected`: a refusal the caller retries
  // (a sheet's create racing its tab's first save), reported only if it is still there on the last try, so a race the
  // retry settles counts as no error.
  async function failedResponse(
    res: Response,
    action: string,
    expected?: (code: string | null) => boolean,
  ): Promise<ApiError> {
    const code = await readErrorCode(res);
    if (!expected?.(code)) report.apiError(res.status, action, code);
    const err = new ApiError(action, res.status, code);
    report.markReported(err);
    return err;
  }

  // Throw an `ApiError` (status + the worker's error token) on non-2xx, otherwise parse JSON. The `action` string
  // gets baked into the thrown message so debugging keeps the caller's intent without a stack walk.
  async function expectOk<T>(
    res: Response,
    action: string,
    expected?: (code: string | null) => boolean,
  ): Promise<T> {
    if (!res.ok) {
      throw await failedResponse(res, action, expected);
    }
    return (await res.json()) as T;
  }

  // Same as `expectOk`, but 404 means "doesn't exist" not "broken": used by read paths where a missing row is a
  // legitimate result the caller wants to handle (welcome flow, share-resolution etc.)
  async function expectOkOrNull<T>(res: Response, action: string): Promise<T | null> {
    if (res.status === 404) return null;
    if (!res.ok) {
      throw await failedResponse(res, action);
    }
    return (await res.json()) as T;
  }

  // For endpoints with no response body (DELETE, write-only PUT). Same error-on-non-ok contract; nothing to return.
  async function expectOkVoid(res: Response, action: string): Promise<void> {
    if (!res.ok) {
      throw await failedResponse(res, action);
    }
  }

  // DELETE that tolerates 404: "remove this if it exists". A racing concurrent delete shouldn't throw.
  async function expectOkOr404Void(res: Response, action: string): Promise<void> {
    if (!res.ok && res.status !== 404) {
      throw await failedResponse(res, action);
    }
  }

  // Shared DELETE shape: fetch with method DELETE + apiHeaders, then either expectOkOr404Void (the common "remove
  // this if it exists" semantic) or expectOkVoid (the rarer "404 should surface as a failure" case), so a new DELETE
  // caller never has to think about which helper to reach for, and the share-code wiring is opt-in via `share`.
  async function apiDelete(url: string, ownerId: string, opts: ApiDeleteOptions): Promise<void> {
    const res = await apiFetch(url, {
      method: 'DELETE',
      headers: await apiHeaders(ownerId, {
        ...(opts.share === undefined ? {} : { share: opts.share }),
        ...(opts.extra ? { extra: opts.extra } : {}),
      }),
    });
    if (opts.allow404 ?? true) {
      await expectOkOr404Void(res, opts.action);
    } else {
      await expectOkVoid(res, opts.action);
    }
  }

  return {
    apiFetch,
    registerTokenProvider,
    setTokenProvider,
    getLastKnownToken,
    setSessionSharePassword,
    getSessionSharePassword,
    readCachedSharePassword,
    writeCachedSharePassword,
    identityHeaders,
    currentBearer,
    apiHeaders,
    expectOk,
    expectOkOrNull,
    expectOkVoid,
    apiDelete,
  };
}
