import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import type { KeysFetcher } from './verify';
// The app side of signing in through liveworkspace.app: an authorization-code flow with
// PKCE. The redirect leaves the app's domain on purpose. livediagram.app, liveplanner.app
// and liveworkspace.app are separate sites, so the accounts cookie can only be read on a
// full-page visit to liveworkspace.app, never from a fetch or an iframe inside another app
// (Safari blocks those third-party cookies outright).
//
// exchangeCode and refreshTokens (and close-account.ts) send the client secret, so they run in the app's
// Worker. authorizeUrl and createPkcePair are safe anywhere.

const AUTH_PATH = '/api/auth/oauth2';

// A route of the accounts service, kept under any path its URL carries (a stand-in served at /e2e/accounts, say):
// `new URL('/api/…', base)` would drop that path.
export const accountsRoute = (accountsUrl: string, route: string): URL =>
  new URL(`${withoutTrailingSlashes(accountsUrl)}${route}`);

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface ClientCredentials {
  // e.g. `https://www.liveworkspace.app`
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
  // The app API's ACCOUNTS service binding, when it has one: the account API's calls (account-call.ts) and the
  // deletion code's (close-account.ts) go through it, the public route only without it or when it throws.
  accounts?: KeysFetcher;
}

export interface AuthorizeUrlOptions {
  accountsUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  // The app's API resource; it becomes the access token's audience.
  resource: string;
  scope?: string;
  // `create` opens the accounts site's registration page instead of sign-in. `none` never shows a page: a code
  // when there is a session, `error=login_required` when not (silent.ts).
  prompt?: 'create' | 'login' | 'none';
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  // Epoch milliseconds.
  expiresAt: number;
  scope: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function randomState(): string {
  return randomToken(16);
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomToken(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function authorizeUrl(options: AuthorizeUrlOptions): string {
  const url = accountsRoute(options.accountsUrl, `${AUTH_PATH}/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scope ?? 'openid email profile offline_access',
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
    resource: options.resource,
    ...(options.prompt && { prompt: options.prompt }),
  }).toString();
  return url.toString();
}

// A guest's identity is liveworkspace's (liveworkspace/docs/specs/003-accounts/accounts.md "Guests"): the browser goes to the accounts
// site with the app's client and comes back to `redirectUri` with a 45-day guest token in the fragment
// (`#guest_token=…&state=…`). The editor makes and checks `state` itself (@liveworkspace/index-client/browser
// createGuestTokens); the app's Worker only names its client, so a state it forwards must look like one.
export const GUEST_STATE_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

export interface GuestHandoffOptions {
  accountsUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  // The app's API resource; it becomes the guest token's audience.
  resource: string;
}

export function isGuestHandoffState(state: string | null | undefined): state is string {
  return typeof state === 'string' && GUEST_STATE_PATTERN.test(state);
}

export function guestHandoffUrl(options: GuestHandoffOptions): string {
  const url = accountsRoute(options.accountsUrl, '/api/auth/guest');
  url.search = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    state: options.state,
    resource: options.resource,
  }).toString();
  return url.toString();
}

// The app's client credentials as HTTP Basic, each part URL-encoded as OAuth asks (and the accounts Worker reads).
export function basicAuthorization(credentials: ClientCredentials): string {
  return `Basic ${btoa(`${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret)}`)}`;
}

// How long a token request waits on the accounts site. A Worker's fetch to another Worker can stall (2026-11-13,
// and 2026-11-15, when every app's POST /api/auth/token hung and the Explorers stayed on their placeholders), so the
// request is given up on rather than held until the browser gives up.
export const TOKEN_REQUEST_TIMEOUT_MS = 8_000;

/** A token request that failed. `status` is the accounts site's answer, or null when there was none in time (a
 *  stall, a network error). Only a 4xx says the session is over (`refused`); anything else may pass. */
export class TokenRequestError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message: string) {
    super(message);
    this.name = 'TokenRequestError';
    this.status = status;
  }
  get refused(): boolean {
    return this.status !== null && this.status >= 400 && this.status < 500;
  }
}

/** Whether `err` says the accounts site turned the request down (a 4xx), not that it couldn't be reached. Anything
 *  that isn't a TokenRequestError (a body that isn't a token set) counts as refused, as it always has. */
export function accountsRefused(err: unknown): boolean {
  return !(err instanceof TokenRequestError) || err.refused;
}

// What local dev (miniflare's dev registry) answers for a service binding whose Worker isn't running: a 503 with
// `Worker "<name>" not found. Make sure it is running locally.` (or, for a mismatched dev server, `Worker "<name>" is
// not compatible ...`), where a deployed binding would throw. The accounts Worker's own 503s are JSON.
const MISSING_WORKER = /^Worker "[^"]+" (?:not found|is not compatible)/;

/** Whether a binding's answer is local dev's "that Worker isn't running", not the Worker's own. */
async function boundWorkerMissing(response: Response): Promise<boolean> {
  if (response.status !== 503) return false;
  if (response.headers.get('content-type')?.includes('json')) return false;
  return MISSING_WORKER.test(await response.clone().text());
}

/**
 * `fetch` over a service binding to the accounts Worker (ACCOUNTS), falling back to the public route when there is
 * no binding, it throws for any reason but the request's own timeout, or local dev says its Worker isn't running
 * (a local run without accounts started, `boundWorkerMissing`). A Worker's fetch to another Worker's public route
 * can stall; a binding's does not.
 *
 * A `Request` goes to the binding whole (its method, headers, body and signal, with `init` laid over them), never
 * as its URL alone. One with a body keeps a clone for local dev's fallback, and a throw on it is not retried: the
 * binding may have read the body, and a write must not go twice.
 */
export function accountsFetch(via?: KeysFetcher, fallback: typeof fetch = fetch): typeof fetch {
  if (!via) return fallback;
  return async (input, init) => {
    if (input instanceof Request) {
      const request = new Request(input, init);
      const spare = request.body ? request.clone() : null;
      let response: Response;
      try {
        response = await via.fetch(request);
      } catch (err) {
        if (spare || request.signal.aborted) throw err;
        return fallback(request);
      }
      if (await boundWorkerMissing(response)) return fallback(spare ?? request);
      return response;
    }
    const url = String(input);
    let response: Response;
    try {
      response = await via.fetch(url, init);
    } catch (err) {
      if (init?.signal?.aborted) throw err;
      return fallback(input, init);
    }
    if (await boundWorkerMissing(response)) return fallback(input, init);
    return response;
  };
}

async function requestTokens(
  credentials: ClientCredentials,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenSet> {
  let response: Response;
  let body: Record<string, unknown>;
  try {
    response = await fetchImpl(accountsRoute(credentials.accountsUrl, `${AUTH_PATH}/token`), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        authorization: basicAuthorization(credentials),
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TokenRequestError(
        response.status,
        `token request failed (${response.status}): ${detail.slice(0, 200)}`,
      );
    }
    body = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof TokenRequestError) throw err;
    // No answer in time, or none at all: not a refusal.
    throw new TokenRequestError(
      null,
      `token request got no answer: ${err instanceof Error ? err.name : 'unknown'}`,
    );
  }
  if (typeof body.access_token !== 'string') throw new Error('token response had no access_token');
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    idToken: typeof body.id_token === 'string' ? body.id_token : null,
    expiresAt: Date.now() + (typeof body.expires_in === 'number' ? body.expires_in : 0) * 1000,
    scope: typeof body.scope === 'string' ? body.scope : '',
  };
}

export function exchangeCode(
  credentials: ClientCredentials,
  input: { code: string; redirectUri: string; codeVerifier: string; resource: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  return requestTokens(
    credentials,
    {
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      resource: input.resource,
    },
    fetchImpl,
  );
}

// Refresh tokens rotate: store the returned refreshToken in place of the one sent.
export function refreshTokens(
  credentials: ClientCredentials,
  input: { refreshToken: string; resource: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  return requestTokens(
    credentials,
    { grant_type: 'refresh_token', refresh_token: input.refreshToken, resource: input.resource },
    fetchImpl,
  );
}

// Signing out everywhere (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"). How long an app's sign-out
// waits on the accounts site before it signs out of the app alone.
const END_SESSION_TIMEOUT_MS = 5_000;

// Ends the liveworkspace session the refresh token came from, and every app's session from it. Sends the client
// secret, so it runs in the app's Worker. Resolves the ticket the browser's hop carries, or null when anything failed:
// the app then signs out of itself alone.
export async function endAccountsSession(
  credentials: ClientCredentials,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(
      accountsRoute(credentials.accountsUrl, '/api/auth/end-session'),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: basicAuthorization(credentials),
        },
        body: JSON.stringify({ token: refreshToken }),
        signal: AbortSignal.timeout(END_SESSION_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { ticket?: unknown } | null;
    return typeof body?.ticket === 'string' && body.ticket ? body.ticket : null;
  } catch {
    return null;
  }
}

export interface EndSessionUrlOptions {
  accountsUrl: string;
  clientId: string;
  // Where the browser lands afterwards: an address on the origin of one of the client's registered redirect URIs.
  postLogoutRedirectUri: string;
  ticket: string;
}

// The browser's hop through the accounts site, which clears its session cookie there and comes back to the app.
export function endSessionUrl(options: EndSessionUrlOptions): string {
  const url = accountsRoute(options.accountsUrl, '/api/auth/end-session');
  url.search = new URLSearchParams({
    client_id: options.clientId,
    post_logout_redirect_uri: options.postLogoutRedirectUri,
    ticket: options.ticket,
  }).toString();
  return url.toString();
}

// Both steps of an app's sign-out: the session ended from the Worker, then the hop for the page to take; null when
// there is nothing to hop for (no refresh token, or the accounts site didn't answer).
export async function signOutEverywhere(
  credentials: ClientCredentials,
  input: { refreshToken: string | null; postLogoutRedirectUri: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!input.refreshToken) return null;
  const ticket = await endAccountsSession(credentials, input.refreshToken, fetchImpl);
  if (!ticket) return null;
  return endSessionUrl({
    accountsUrl: credentials.accountsUrl,
    clientId: credentials.clientId,
    postLogoutRedirectUri: input.postLogoutRedirectUri,
    ticket,
  });
}
