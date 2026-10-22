// The app side of signing in through liveworkspace.app: an authorization-code flow with
// PKCE. The redirect leaves the app's domain on purpose. livediagram.app, liveplanner.app
// and liveworkspace.app are separate sites, so the accounts cookie can only be read on a
// full-page visit to liveworkspace.app, never from a fetch or an iframe inside another app
// (Safari blocks those third-party cookies outright).
//
// exchangeCode and refreshTokens send the client secret, so they run in the app's
// Worker. authorizeUrl and createPkcePair are safe anywhere.

const AUTH_PATH = '/api/auth/oauth2';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface ClientCredentials {
  // e.g. `https://liveworkspace.app`
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
  // `create` opens the accounts site's registration page instead of sign-in.
  prompt?: 'create' | 'login';
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
  const url = new URL(`${AUTH_PATH}/authorize`, options.accountsUrl);
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

async function requestTokens(
  credentials: ClientCredentials,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenSet> {
  const response = await fetchImpl(new URL(`${AUTH_PATH}/token`, credentials.accountsUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      authorization: `Basic ${btoa(`${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret)}`)}`,
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
