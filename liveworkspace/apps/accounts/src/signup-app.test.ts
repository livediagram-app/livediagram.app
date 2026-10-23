// Which app a sign-up came through (liveworkspace/docs/accounts.md "Onboarding emails"): a real Better
// Auth over an in-memory D1, signing up with an email code from an app's authorize request, and on
// liveworkspace.app itself.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { authOptions } from './auth-options.ts';
import { clientApp } from './clients.ts';
import { signupAppOf, startLifecycle } from './lifecycle.ts';
import { addClient, testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const RESOURCE = 'https://liveplanner.app/api';
const CALLBACK = 'https://liveplanner.app/auth/callback';

let db: D1Database;
let sql: DatabaseSync;
let codes: Map<string, string>;
let via: (string | null)[];
let auth: ReturnType<typeof build>;

function build() {
  return betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: [RESOURCE],
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
        // As auth.ts does.
        onUserCreated: async (user, { clientId }) => {
          via.push(clientId);
          const app = clientId ? await clientApp(db, clientId) : 'liveworkspace.app';
          await startLifecycle(db, user, Date.now(), app);
        },
      },
      db,
    ),
  );
}

beforeEach(() => {
  ({ db, sql } = testD1());
  const now = new Date().toISOString();
  addClient(sql, 'liveplanner-client', 'liveplanner.app');
  addClient(sql, 'unmapped-client', null);
  sql
    .prepare(`UPDATE oauthClient SET redirectUris = ?, disabled = 0`)
    .run(JSON.stringify([CALLBACK]));
  sql
    .prepare(
      `INSERT INTO oauthResource (id, identifier, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('r1', RESOURCE, RESOURCE, now, now);
  codes = new Map();
  via = [];
  // Turnstile always passes.
  vi.stubGlobal('fetch', async () => Response.json({ success: true }));
  auth = build();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The signed query the provider puts on the sign-up page's URL when an app's authorize request finds
// nobody signed in, as the page sends it back (site lib/accounts.ts signedOAuthQuery).
async function signedQuery(clientId: string): Promise<string> {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALLBACK,
    response_type: 'code',
    scope: 'openid profile email',
    state: 'state-1',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
    prompt: 'create',
  });
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/oauth2/authorize?${query}`, { redirect: 'manual' }),
  );
  const location = response.headers.get('location') ?? '';
  const params = new URL(location, BASE).searchParams;
  expect(params.get('sig')).toBeTruthy();
  const allowed = new Set(params.getAll('ba_param'));
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || allowed.has(key)) out.append(key, value);
  }
  return out.toString();
}

async function signUp(email: string, oauthQuery?: string): Promise<string> {
  const json = { 'content-type': 'application/json', origin: BASE };
  const sent = await auth.handler(
    new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: { ...json, 'x-captcha-response': 'ok' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    }),
  );
  expect(sent.status).toBe(200);
  await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email-otp`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({
        email,
        otp: codes.get(email),
        ...(oauthQuery && { oauth_query: oauthQuery }),
      }),
    }),
  );
  const row = sql.prepare('SELECT id FROM "user" WHERE email = ?').get(email) as { id: string };
  return row.id;
}

const stored = (id: string) =>
  (
    sql.prepare('SELECT signup_app AS app FROM email_lifecycle WHERE user_id = ?').get(id) as {
      app: string | null;
    }
  ).app;

describe('the app a sign-up came through', () => {
  it('is the app of the client whose authorize request it was', async () => {
    const id = await signUp('ada@example.com', await signedQuery('liveplanner-client'));
    expect(via).toEqual(['liveplanner-client']);
    expect(stored(id)).toBe('liveplanner.app');
    expect(await signupAppOf(db, id)).toBe('liveplanner.app');
  });

  it('is liveworkspace.app for a sign-up on the site itself, which no app counts', async () => {
    const id = await signUp('bea@example.com');
    expect(via).toEqual([null]);
    expect(stored(id)).toBe('liveworkspace.app');
    expect(await signupAppOf(db, id)).toBeNull();
  });

  it('is not known for a client registered without an app', async () => {
    const id = await signUp('cy@example.com', await signedQuery('unmapped-client'));
    expect(via).toEqual(['unmapped-client']);
    expect(stored(id)).toBeNull();
  });

  it('is only recorded when the account is made, not at a later sign-in', async () => {
    const id = await signUp('ada@example.com');
    await signUp('ada@example.com', await signedQuery('liveplanner-client'));
    expect(via).toEqual([null]);
    expect(stored(id)).toBe('liveworkspace.app');
  });
});
