// The OAuth provider's resource seed on a cold Worker (liveworkspace/docs/specs/003-accounts/sign-in.md "Deploys"):
// patches/@better-auth__oauth-provider@1.7.14.patch looks every configured resource up in one D1 call, where the
// plugin made one call per resource, one after another. The audience a token carries is unchanged, so every app's
// sign-in and refresh still give a token its API takes.
import { betterAuth } from 'better-auth';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authOptions } from './auth-options.ts';
import type { Auth } from './auth.ts';
import { bearerPerson } from './bearer.ts';
import { registerClient } from './clients.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const APPS = RESOURCES.production.map((resource) => new URL(resource).hostname);

// A D1 handle that counts the round trips made through it: each statement run and each batch is one.
function counted(db: D1Database): { db: D1Database; calls: () => number } {
  let calls = 0;
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (typeof value !== 'function') return value;
        if (key === 'bind') return (...args: unknown[]) => wrap(target.bind(...args));
        if (key === 'first' || key === 'all' || key === 'run' || key === 'raw') {
          return (...args: unknown[]) => {
            calls++;
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return (value as (...a: unknown[]) => unknown).bind(target);
      },
    });
  const handle = new Proxy(db, {
    get(target, key) {
      if (key === 'prepare') return (query: string) => wrap(target.prepare(query));
      if (key === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          calls++;
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { db: handle, calls: () => calls };
}

function build(db: D1Database, codes = new Map<string, string>()): Auth {
  return betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: RESOURCES.production,
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
      },
      db,
    ),
  ) as unknown as Auth;
}

const resourceRows = (sql: DatabaseSync) =>
  sql.prepare('SELECT * FROM oauthResource ORDER BY identifier').all() as Record<string, unknown>[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a cold Worker's resource seed", () => {
  it('looks up every configured resource in one D1 call when they are stored', async () => {
    const { db } = testD1();
    await build(db).$context;
    const cold = counted(db);
    await build(cold.db).$context;
    expect(cold.calls()).toBe(1);
  });

  it('answers a cold discovery request after that one call', async () => {
    const { db } = testD1();
    await build(db).$context;
    const cold = counted(db);
    const response = await build(cold.db).handler(
      new Request(`${BASE}/api/auth/.well-known/openid-configuration`),
    );
    expect(response.status).toBe(200);
    expect(cold.calls()).toBe(1);
  });

  it('inserts every resource on a first boot, as the plugin always has', async () => {
    const { db, sql } = testD1();
    const cold = counted(db);
    await build(cold.db).$context;
    // One lookup, then one insert per resource.
    expect(cold.calls()).toBe(1 + RESOURCES.production.length);
    const rows = resourceRows(sql);
    expect(rows.map((row) => row.identifier)).toEqual([...RESOURCES.production].sort());
    for (const row of rows) {
      expect(row).toMatchObject({
        name: row.identifier,
        accessTokenTtl: null,
        refreshTokenTtl: null,
        allowedScopes: null,
        disabled: 0,
        policyVersion: 1,
      });
    }
  });

  it('inserts only the missing ones, leaving a stored row as it was', async () => {
    const { db, sql } = testD1();
    await build(db).$context;
    const [kept, ...removed] = RESOURCES.production;
    sql.prepare('UPDATE oauthResource SET accessTokenTtl = 300 WHERE identifier = ?').run(kept!);
    const keptBefore = resourceRows(sql).find((row) => row.identifier === kept);
    sql.prepare('DELETE FROM oauthResource WHERE identifier != ?').run(kept!);

    const cold = counted(db);
    await build(cold.db).$context;
    expect(cold.calls()).toBe(1 + removed.length);
    const rows = resourceRows(sql);
    expect(rows).toHaveLength(RESOURCES.production.length);
    expect(rows.find((row) => row.identifier === kept)).toEqual(keptBefore);
  });
});

describe("every app's sign-in and refresh", () => {
  it("still give a token for that app's API that the API takes", async () => {
    vi.stubGlobal('fetch', async () => Response.json({ success: true }));
    const { db } = testD1();
    const codes = new Map<string, string>();
    await build(db).$context;
    // A cold instance, seeded through the one lookup.
    const auth = build(db, codes);
    const env = {
      ENVIRONMENT: 'production',
      BASE_URL: BASE,
      BETTER_AUTH_SECRET: SECRET,
      ADMIN_TOKEN: 'admin',
      AUTH_DB: db,
    } as unknown as Env;

    const json = { 'content-type': 'application/json', origin: BASE };
    const email = 'ada@example.com';
    await auth.handler(
      new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { ...json, 'x-captcha-response': 'ok' },
        body: JSON.stringify({ email, type: 'sign-in' }),
      }),
    );
    const signedIn = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email, otp: codes.get(email) }),
      }),
    );
    const cookie = signedIn.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');

    const verifier = 'v'.repeat(43);
    const challenge = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ).toString('base64url');

    for (const app of APPS) {
      const resource = `https://${app}/api`;
      const callback = `https://${app}/api/auth/callback`;
      const registered = await registerClient(
        new Request(`${BASE}/api/auth/internal/clients`, {
          method: 'POST',
          headers: { authorization: 'Bearer admin', 'content-type': 'application/json' },
          body: JSON.stringify({ name: app, redirectUris: [callback], resource, app }),
        }),
        env,
        auth,
      );
      expect(registered.status, app).toBe(200);
      const client = (await registered.json()) as { client_id: string; client_secret: string };
      const token = (params: Record<string, string>) =>
        auth.handler(
          new Request(`${BASE}/api/auth/oauth2/token`, {
            method: 'POST',
            headers: {
              authorization: `Basic ${btoa(`${client.client_id}:${client.client_secret}`)}`,
              'content-type': 'application/x-www-form-urlencoded',
              accept: 'application/json',
            },
            body: new URLSearchParams({ ...params, resource }).toString(),
          }),
        );

      const authorized = await auth.handler(
        new Request(
          `${BASE}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: client.client_id,
            redirect_uri: callback,
            scope: 'openid profile email offline_access',
            state: 'state-1',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            resource,
          })}`,
          { headers: { cookie } },
        ),
      );
      const location =
        authorized.headers.get('location') ??
        ((await authorized.json()) as { url?: string }).url ??
        '';
      const code = new URL(location).searchParams.get('code');
      expect(code, app).toBeTruthy();

      const issued = await token({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: callback,
        code_verifier: verifier,
      });
      expect(issued.status, app).toBe(200);
      const first = (await issued.json()) as { access_token: string; refresh_token: string };
      const refreshed = await token({
        grant_type: 'refresh_token',
        refresh_token: first.refresh_token,
      });
      expect(refreshed.status, app).toBe(200);
      const second = (await refreshed.json()) as { access_token: string };

      for (const accessToken of [first.access_token, second.access_token]) {
        const claims = JSON.parse(
          Buffer.from(accessToken.split('.')[1]!, 'base64url').toString('utf8'),
        ) as { aud: unknown };
        expect([claims.aud].flat(), app).toContain(resource);
        expect(await bearerPerson(accessToken, env, auth), app).toMatchObject({ email });
      }
    }
  });
});
