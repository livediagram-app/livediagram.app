// The app side of signing in through liveworkspace.app: an authorization-code flow with
// PKCE. The redirect leaves the app's domain on purpose. livediagram.app, liveplanner.app
// and liveworkspace.app are separate sites, so the accounts cookie can only be read on a
// full-page visit to liveworkspace.app, never from a fetch or an iframe inside another app
// (Safari blocks those third-party cookies outright).
//
// exchangeCode, refreshTokens and closeAccount send the client secret, so they run in the app's
// Worker. authorizeUrl and createPkcePair are safe anywhere.

const AUTH_PATH = '/api/auth/oauth2';

// A route of the accounts service, kept under any path its URL carries (a stand-in served at /e2e/accounts, say):
// `new URL('/api/…', base)` would drop that path.
const accountsRoute = (accountsUrl: string, route: string): URL =>
  new URL(`${accountsUrl.replace(/\/+$/, '')}${route}`);

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface ClientCredentials {
  // e.g. `https://www.liveworkspace.app`
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
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
// site with the app's client and comes back to `redirectUri` with a year-long guest token in the fragment
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

async function requestTokens(
  credentials: ClientCredentials,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenSet> {
  const response = await fetchImpl(accountsRoute(credentials.accountsUrl, `${AUTH_PATH}/token`), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      authorization: basicAuthorization(credentials),
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`token request failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const body = (await response.json()) as Record<string, unknown>;
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

// Closes the person's liveworkspace account, everywhere, when they delete their account in the
// app. Sends the client secret, so it runs in the app's Worker, with the access token the person
// signed in to the app with. Resolves once the account is gone.
export async function closeAccount(
  credentials: ClientCredentials,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(
    accountsRoute(credentials.accountsUrl, '/api/auth/delete-account'),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: basicAuthorization(credentials),
      },
      body: JSON.stringify({ token: accessToken }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`closing the account failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}
