// Walks the whole sign-in flow against a local `pnpm dev`, the way an app would:
// redirect to /oauth2/authorize, register with a code and a name, swap the code for
// tokens, verify them, sign in again without a code, refresh, give a nameless
// account its name after the code, start a Google sign-in, and close an account.
//
//   pnpm dev   (in another terminal; .dev.vars from .dev.vars.example, with any
//              GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: Google itself is never called),
//              and the site's dev server (apps/site), which serves this Worker at
//              http://localhost:3000/api/auth, the origin it signs for
//   ADMIN_TOKEN=local-admin-token node scripts/e2e-local.ts
//
// The emailed code is read back from the dev server's log (wrangler dev simulates the EMAIL binding), so pass the
// file `pnpm dev` writes to: DEV_LOG=/path/to/dev.log
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  authorizeUrl,
  createPkcePair,
  createVerifier,
  exchangeCode,
  randomState,
  refreshTokens,
} from '@liveworkspace/auth-client';

const ACCOUNTS = process.env.ACCOUNTS_URL ?? 'http://localhost:3000';
const RESOURCE = 'http://localhost/api';
const REDIRECT = 'http://localhost:3100/auth/callback';
const EMAIL = process.env.E2E_EMAIL ?? `e2e+${Date.now()}@example.com`;
const NAMELESS_EMAIL = `e2e-nameless+${Date.now()}@example.com`;
const devLog = process.env.DEV_LOG;
if (!devLog) throw new Error('Set DEV_LOG to the file `pnpm dev` writes its output to');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok  ${message}`);
}

// A tiny cookie jar: the browser's side of liveworkspace.app.
const jar = new Map<string, string>();
async function browser(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  // Same-origin page script, as the sign-in page is: Better Auth refuses a POST without it.
  if (init.method === 'POST') headers.set('origin', ACCOUNTS);
  const response = await fetch(url, { ...init, headers, redirect: 'manual' });
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const at = pair!.indexOf('=');
    jar.set(pair!.slice(0, at), pair!.slice(at + 1));
  }
  return response;
}

// Where a navigation would land. Node's fetch always sends `sec-fetch-mode: cors` (it can't
// be overridden), and the provider answers a fetch with `{ redirect, url }` JSON where a
// real page load gets a 302 to the same URL, so accept either.
async function redirectOf(response: Response): Promise<URL | null> {
  const location = response.headers.get('location');
  if (response.status === 302 && location) return new URL(location, ACCOUNTS);
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { redirect?: boolean; url?: string } | null;
  return body?.redirect && body.url ? new URL(body.url, ACCOUNTS) : null;
}

const register = await fetch(`${ACCOUNTS}/api/auth/internal/clients`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.ADMIN_TOKEN ?? 'local-admin-token'}`,
  },
  body: JSON.stringify({
    name: 'e2e',
    redirectUris: [REDIRECT],
    resource: RESOURCE,
    app: 'liveplanner.app',
  }),
});
const client = (await register.json()) as { client_id: string; client_secret: string };
assert(register.ok && client.client_id && client.client_secret, 'registered a client');
const credentials = {
  accountsUrl: ACCOUNTS,
  clientId: client.client_id,
  clientSecret: client.client_secret,
};

async function startSignIn(prompt?: 'create') {
  const pkce = await createPkcePair();
  const state = randomState();
  const response = await browser(
    authorizeUrl({
      accountsUrl: ACCOUNTS,
      clientId: client.client_id,
      redirectUri: REDIRECT,
      state,
      codeChallenge: pkce.challenge,
      resource: RESOURCE,
      prompt,
    }),
  );
  return { pkce, state, response };
}

async function requestCode(email: string): Promise<string> {
  const logBefore = readFileSync(devLog!, 'utf8').length;
  const send = await browser(`${ACCOUNTS}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  assert(send.ok, `code requested (${send.status} ${send.ok ? '' : await send.clone().text()})`);
  let code: string | undefined;
  for (let i = 0; i < 20 && !code; i++) {
    const log = readFileSync(devLog!, 'utf8').slice(logBefore);
    // The dev server's simulated EMAIL binding logs each email; the code is in its subject.
    code = log.match(/\b(\d{6}) is your liveworkspace sign-in code/)?.[1];
    if (!code) await sleep(250);
  }
  assert(code, 'the code email was sent');
  return code;
}

// The signed OAuth query a sign-in page posts back, rebuilt from the URL it was sent to.
function oauthQueryOf(pageUrl: URL): string {
  const out = new URLSearchParams();
  const names = new Set(pageUrl.searchParams.getAll('ba_param'));
  for (const [k, v] of pageUrl.searchParams) {
    if (k === 'sig' || k === 'ba_param' || names.has(k)) out.append(k, v);
  }
  return out.toString();
}

function jwtClaims(token: string | null): Record<string, unknown> {
  const payload = token?.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

// 1. Not signed in: "Create account" in the app sends the browser to the registration page.
const first = await startSignIn('create');
const signInUrl = (await redirectOf(first.response))!;
assert(signInUrl?.pathname === '/sign-up', 'authorize with prompt=create redirects to /sign-up');
assert(signInUrl.searchParams.has('sig'), 'the sign-up URL carries a signed OAuth query');

const page = await browser(signInUrl.toString());
const pageHtml = await page.text();
assert(
  page.status === 200 && pageHtml.includes('Create account') && pageHtml.includes('given-name'),
  'registration page renders, asking for a first and a last name',
);

// 2. Request a code. Turnstile's test secret accepts its dummy token.
const noCaptcha = await browser(`${ACCOUNTS}/api/auth/email-otp/send-verification-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, type: 'sign-in' }),
});
const noCaptchaBody = await noCaptcha.text();
assert(
  !noCaptcha.ok && /captcha/i.test(noCaptchaBody),
  `sending without Turnstile is refused (${noCaptchaBody})`,
);

const code = await requestCode(EMAIL);

// 3. A wrong code is refused; the right one registers, with the names typed on the page, and
// returns to the app with a code.
const oauthQuery = oauthQueryOf(signInUrl);
const wrong = await browser(`${ACCOUNTS}/api/auth/sign-in/email-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    email: EMAIL,
    otp: code === '000000' ? '111111' : '000000',
    oauth_query: oauthQuery,
  }),
});
assert(!wrong.ok, `a wrong code is refused (${wrong.status})`);

const signIn = await browser(`${ACCOUNTS}/api/auth/sign-in/email-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    email: EMAIL,
    otp: code,
    oauth_query: oauthQuery,
    givenName: ' Ada ',
    familyName: 'Lovelace',
    name: 'Ada Lovelace',
  }),
});
const signInBody = (await signIn.json()) as { url?: string };
assert(
  signIn.ok && signInBody.url?.startsWith('/sign-up'),
  'registering keeps the request on /sign-up until the page says the account was made',
);
const created = await browser(`${ACCOUNTS}/api/auth/oauth2/continue`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ created: true, oauth_query: oauthQuery }),
});
const createdBody = (await created.json()) as { url?: string };
assert(
  created.ok && createdBody.url,
  `continuing returns a redirect URL (${JSON.stringify(createdBody).slice(0, 120)})`,
);
const callback = new URL(createdBody.url!);
assert(callback.origin + callback.pathname === REDIRECT, 'it points at the app callback');
assert(callback.searchParams.get('state') === first.state, 'state round-trips');

// 4. The app swaps the code for tokens and verifies the access token locally.
const tokens = await exchangeCode(credentials, {
  code: callback.searchParams.get('code')!,
  redirectUri: REDIRECT,
  codeVerifier: first.pkce.verifier,
  resource: RESOURCE,
});
assert(
  tokens.accessToken && tokens.refreshToken && tokens.idToken,
  'token swap returns access, refresh and id tokens',
);
const idClaims = jwtClaims(tokens.idToken);
assert(
  idClaims.given_name === 'Ada' &&
    idClaims.family_name === 'Lovelace' &&
    idClaims.name === 'Ada Lovelace' &&
    idClaims.email === EMAIL.toLowerCase(),
  `the id token carries the names and email (${JSON.stringify(idClaims)})`,
);

const discovery = (await (await fetch(`${ACCOUNTS}/.well-known/openid-configuration`)).json()) as {
  issuer: string;
};
const verify = createVerifier({ issuer: discovery.issuer, audience: RESOURCE });
const claims = await verify(tokens.accessToken);
assert(claims, 'access token verifies');
assert(claims.userId.startsWith('user_'), `account id ${claims.userId}`);
assert(
  claims.email === EMAIL.toLowerCase() && claims.emailVerified,
  'it carries the verified email',
);
const otherApp = createVerifier({
  issuer: discovery.issuer,
  audience: 'https://liveplanner.app/api',
});
assert((await otherApp(tokens.accessToken)) === null, 'another app refuses it (audience)');

// 5. Signing in to a second app: the accounts cookie is there, so no code is needed.
const second = await startSignIn();
const secondLocation = await redirectOf(second.response);
assert(
  secondLocation && secondLocation.origin + secondLocation.pathname === REDIRECT,
  'a second sign-in goes straight back to the app',
);

// 6. Refresh rotates the refresh token.
const refreshed = await refreshTokens(credentials, {
  refreshToken: tokens.refreshToken!,
  resource: RESOURCE,
});
assert(
  refreshed.accessToken && refreshed.refreshToken !== tokens.refreshToken,
  'refresh returns new tokens',
);
assert(
  (await verify(refreshed.accessToken))?.userId === claims.userId,
  'the refreshed token is the same account',
);

// Two tabs refreshing with the same token at once both succeed (refreshTokenReuseInterval).
const racing = await Promise.allSettled(
  [0, 1].map(() =>
    refreshTokens(credentials, { refreshToken: refreshed.refreshToken!, resource: RESOURCE }),
  ),
);
assert(
  racing.every((r) => r.status === 'fulfilled'),
  `two refreshes at once both succeed (${racing.map((r) => r.status).join(', ')})`,
);

// 7. A signed-in account can't register its own OAuth client.
const selfRegister = await browser(`${ACCOUNTS}/api/auth/oauth2/create-client`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ redirect_uris: ['https://evil.example/cb'] }),
});
assert(!selfRegister.ok, `accounts can't register clients (${selfRegister.status})`);

// 8. Signing in as someone with no name yet: the page asks for one after the code, and the
// names saved then are in the ID token the app gets from that same sign-in.
jar.clear();
const nameless = await startSignIn();
const namelessPage = (await redirectOf(nameless.response))!;
assert(namelessPage?.pathname === '/sign-in', 'without prompt=create, authorize opens /sign-in');
const namelessCode = await requestCode(NAMELESS_EMAIL);
const namelessSignIn = await browser(`${ACCOUNTS}/api/auth/sign-in/email-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    email: NAMELESS_EMAIL,
    otp: namelessCode,
    oauth_query: oauthQueryOf(namelessPage),
  }),
});
const namelessBody = (await namelessSignIn.json()) as { url?: string };
assert(namelessSignIn.ok && namelessBody.url, 'a new address signs in with just a code');
const session = (await (await browser(`${ACCOUNTS}/api/auth/get-session`)).json()) as {
  user?: { givenName?: string | null };
} | null;
assert(session?.user && !session.user.givenName, 'its session shows it has no name yet');
const named = await browser(`${ACCOUNTS}/api/auth/update-user`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ givenName: 'Grace', familyName: 'Hopper', name: 'Grace Hopper' }),
});
assert(named.ok, `the name step saves the names (${named.status})`);
const namelessTokens = await exchangeCode(credentials, {
  code: new URL(namelessBody.url!).searchParams.get('code')!,
  redirectUri: REDIRECT,
  codeVerifier: nameless.pkce.verifier,
  resource: RESOURCE,
});
const namelessClaims = jwtClaims(namelessTokens.idToken);
assert(
  namelessClaims.given_name === 'Grace' && namelessClaims.name === 'Grace Hopper',
  `that sign-in's id token carries the new name (${JSON.stringify(namelessClaims)})`,
);

// 9. "Continue with Google" hands the browser to Google, carrying the app's request so the
// provider can finish it when Google sends the browser back.
const google = await startSignIn();
const googlePage = (await redirectOf(google.response))!;
const toGoogle = await browser(`${ACCOUNTS}/api/auth/sign-in/social`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    provider: 'google',
    callbackURL: googlePage.pathname + googlePage.search,
    errorCallbackURL: googlePage.pathname + googlePage.search,
    oauth_query: oauthQueryOf(googlePage),
  }),
});
const toGoogleBody = (await toGoogle.json()) as { url?: string };
const googleUrl = toGoogleBody.url ? new URL(toGoogleBody.url) : null;
assert(
  googleUrl?.hostname === 'accounts.google.com' &&
    googleUrl.searchParams.get('redirect_uri') === `${ACCOUNTS}/api/auth/callback/google` &&
    googleUrl.searchParams.get('prompt') === 'select_account',
  `Google sign-in starts at Google, coming back to this Worker (${toGoogle.status})`,
);

// 10. Closing the account: only an app's own server can ask (its client credentials and the
// person's access token, both checked), and it takes the account with it everywhere.
const closeUrl = `${ACCOUNTS}/api/auth/delete-account`;
const close = (authorization: string | null, token: string) =>
  fetch(closeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization && { authorization }),
    },
    body: JSON.stringify({ token }),
  });
const basic = (id: string, secret: string) =>
  `Basic ${btoa(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`)}`;
assert(
  (await close(null, namelessTokens.accessToken)).status === 400,
  'closing without client credentials is refused',
);
assert(
  (await close(basic(client.client_id, 'wrong'), namelessTokens.accessToken)).status === 401,
  'closing with a wrong client secret is refused',
);
const otherRegister = await fetch(`${ACCOUNTS}/api/auth/internal/clients`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.ADMIN_TOKEN ?? 'local-admin-token'}`,
  },
  body: JSON.stringify({
    name: 'e2e other',
    redirectUris: [REDIRECT],
    resource: RESOURCE,
    app: 'livediagram.app',
  }),
});
const other = (await otherRegister.json()) as { client_id: string; client_secret: string };
assert(
  (await close(basic(other.client_id, other.client_secret), namelessTokens.accessToken)).status ===
    401,
  "another app can't close an account with a token it was not given",
);
const closed = await close(
  basic(client.client_id, client.client_secret),
  namelessTokens.accessToken,
);
assert(closed.ok, `the app closes the account (${closed.status} ${await closed.clone().text()})`);
const afterClose = (await (await browser(`${ACCOUNTS}/api/auth/get-session`)).json()) as {
  user?: unknown;
} | null;
assert(!afterClose?.user, 'its accounts-site session is gone');
const refreshAfterClose = await refreshTokens(credentials, {
  refreshToken: namelessTokens.refreshToken!,
  resource: RESOURCE,
}).then(
  () => 'refreshed',
  () => 'refused',
);
assert(refreshAfterClose === 'refused', 'its refresh token no longer works');
const reopened = await startSignIn();
assert(
  (await redirectOf(reopened.response))?.pathname === '/sign-in',
  'signing in again starts over at the sign-in page',
);

console.log('\nall good');
