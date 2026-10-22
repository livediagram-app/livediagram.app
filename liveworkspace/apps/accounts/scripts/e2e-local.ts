// Walks the whole sign-in flow against a local `pnpm dev`, the way an app would:
// redirect to /oauth2/authorize, request a code, sign in with it, swap the code for
// tokens, verify the access token, sign in again without a code, and refresh.
//
//   pnpm dev   (in another terminal; .dev.vars from .dev.vars.example)
//   ADMIN_TOKEN=local-admin-token node scripts/e2e-local.ts
//
// The emailed code is read back from the local email simulation's log, so pass the
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

const ACCOUNTS = process.env.ACCOUNTS_URL ?? 'http://localhost:8787';
const RESOURCE = 'http://localhost/api';
const REDIRECT = 'http://localhost:3000/auth/callback';
const EMAIL = process.env.E2E_EMAIL ?? `e2e+${Date.now()}@example.com`;
const devLog = process.env.DEV_LOG;
if (!devLog) throw new Error('Set DEV_LOG to the file `pnpm dev` writes its output to');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok  ${message}`);
}

// A tiny cookie jar: the browser's side of accounts.liveworkspace.app.
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

const register = await fetch(`${ACCOUNTS}/internal/clients`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.ADMIN_TOKEN ?? 'local-admin-token'}`,
  },
  body: JSON.stringify({ name: 'e2e', redirectUris: [REDIRECT], resource: RESOURCE }),
});
const client = (await register.json()) as { client_id: string; client_secret: string };
assert(register.ok && client.client_id && client.client_secret, 'registered a client');
const credentials = {
  accountsUrl: ACCOUNTS,
  clientId: client.client_id,
  clientSecret: client.client_secret,
};

async function startSignIn() {
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
    }),
  );
  return { pkce, state, response };
}

// 1. Not signed in: the provider sends the browser to the sign-in page.
const first = await startSignIn();
const signInUrl = (await redirectOf(first.response))!;
assert(signInUrl?.pathname === '/sign-in', 'authorize redirects to /sign-in');
assert(signInUrl.searchParams.has('sig'), 'the sign-in URL carries a signed OAuth query');

const page = await browser(signInUrl.toString());
assert(
  page.status === 200 && (await page.text()).includes('Email me a code'),
  'sign-in page renders',
);

// 2. Request a code. Turnstile's test secret accepts its dummy token.
const logBefore = readFileSync(devLog, 'utf8').length;
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

const send = await browser(`${ACCOUNTS}/api/auth/email-otp/send-verification-otp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
  body: JSON.stringify({ email: EMAIL, type: 'sign-in' }),
});
assert(send.ok, `code requested (${send.status} ${send.ok ? '' : await send.clone().text()})`);

let code: string | undefined;
for (let i = 0; i < 20 && !code; i++) {
  const log = readFileSync(devLog, 'utf8').slice(logBefore);
  // The local simulation logs where it saved the message; the code is in its subject.
  const saved = log.match(/(\/[^\s'"]+\.eml)/)?.[1];
  const text = saved ? readFileSync(saved, 'utf8') : log;
  code = text.match(/\b(\d{6}) is your liveworkspace sign-in code/)?.[1];
  if (!code) await sleep(250);
}
assert(code, 'the code email was sent');

// 3. A wrong code is refused; the right one signs in and returns to the app with a code.
const oauthQuery = (() => {
  const out = new URLSearchParams();
  const names = new Set(signInUrl.searchParams.getAll('ba_param'));
  for (const [k, v] of signInUrl.searchParams) {
    if (k === 'sig' || k === 'ba_param' || names.has(k)) out.append(k, v);
  }
  return out.toString();
})();
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
  body: JSON.stringify({ email: EMAIL, otp: code, oauth_query: oauthQuery }),
});
const signInBody = (await signIn.json()) as { url?: string };
assert(
  signIn.ok && signInBody.url,
  `signing in returns a redirect URL (${JSON.stringify(signInBody).slice(0, 120)})`,
);
const callback = new URL(signInBody.url!);
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

console.log('\nall good');
