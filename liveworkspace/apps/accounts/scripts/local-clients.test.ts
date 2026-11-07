// The local clients (liveworkspace/docs/specs/003-accounts/sign-in.md "Local clients"): written into a real migrated
// database, a guest hand-off and the token endpoint take them as they take a registered client, and every app's
// apps/api/.dev.vars.example names the same id, secret and router.
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { betterAuth } from 'better-auth';
import { beforeEach, describe, expect, it } from 'vitest';
import { authOptions } from '../src/auth-options.ts';
import type { Auth } from '../src/auth.ts';
import type { Env } from '../src/env.ts';
import { findClient, guestHandoff } from '../src/guests.ts';
import { RESOURCES } from '../src/resources.ts';
import { testD1 } from '../src/test-d1.ts';
import {
  hashedSecret,
  LOCAL_CLIENTS,
  LOCAL_RESOURCE,
  localClientsSql,
  parseExtraOrigins,
  redirectUrisFor,
} from './local-clients.ts';

const BASE = 'http://localhost:3000';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const NOW = '2026-11-07T12:00:00.000Z';
const design = LOCAL_CLIENTS.find((client) => client.app === 'livedesign.app')!;

let sql: DatabaseSync;
let env: Env;
let auth: Auth;

beforeEach(() => {
  const made = testD1();
  sql = made.sql;
  env = {
    ENVIRONMENT: 'development',
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    AUTH_DB: made.db,
  } as unknown as Env;
  auth = betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: RESOURCES.development,
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async () => {},
      },
      made.db,
    ),
  ) as unknown as Auth;
});

const guest = (clientId: string, redirectUri: string) =>
  guestHandoff(
    new Request(
      `${BASE}/api/auth/guest?${new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state: 's' })}`,
    ),
    env,
    auth,
  );

// A refresh with a made-up token: the client's credentials are checked first, so a right secret gets as far as the
// token (invalid_grant) and a wrong one stops at the client (invalid_client).
async function refreshAs(clientId: string, secret: string): Promise<string> {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'nope' }).toString(),
    }),
  );
  return ((await response.json()) as { error: string }).error;
}

describe('localClientsSql', () => {
  it('makes every app a client a guest hand-off and the token endpoint take', async () => {
    sql.exec(localClientsSql(NOW));
    for (const client of LOCAL_CLIENTS) {
      expect(await findClient(env.AUTH_DB, client.clientId)).toEqual({
        redirectUris: redirectUrisFor(client),
        resources: [LOCAL_RESOURCE],
      });
      const app = sql
        .prepare('SELECT app FROM oauth_client_app WHERE clientId = ?')
        .get(client.clientId) as { app: string };
      expect(app.app).toBe(client.app);
    }
    const handoff = await guest(design.clientId, `${design.origin}/auth/guest`);
    expect(handoff.status).toBe(302);
    expect(handoff.headers.get('location')).toMatch(
      /^http:\/\/localhost:3400\/auth\/guest#guest_token=/,
    );
    expect(await refreshAs(design.clientId, design.clientSecret)).toBe('invalid_grant');
    expect(await refreshAs(design.clientId, 'wrong')).toBe('invalid_client');
  });

  it('runs again over itself, putting a changed client back and leaving registered ones alone', async () => {
    sql.exec(localClientsSql(NOW));
    sql.exec(
      `INSERT INTO oauthClient (id, clientId, clientSecret, redirectUris, name) VALUES ('x', 'hand-made', 'h', '["http://localhost:3400/x"]', 'livedesign-dev')`,
    );
    sql.exec(
      `UPDATE oauthClient SET redirectUris = '[]', disabled = 1 WHERE clientId = 'local-livedesign'`,
    );
    sql.exec(localClientsSql('2026-11-08T00:00:00.000Z'));
    expect((await findClient(env.AUTH_DB, design.clientId))?.redirectUris).toEqual(
      redirectUrisFor(design),
    );
    const counts = sql
      .prepare(
        'SELECT (SELECT count(*) FROM oauthClientResource) AS resources, (SELECT count(*) FROM oauthResource) AS apis',
      )
      .get() as { resources: number; apis: number };
    expect(counts).toEqual({ resources: LOCAL_CLIENTS.length, apis: 1 });
    const handMade = sql
      .prepare(`SELECT redirectUris FROM oauthClient WHERE clientId = 'hand-made'`)
      .get() as {
      redirectUris: string;
    };
    expect(handMade.redirectUris).toBe('["http://localhost:3400/x"]');
  });

  it('adds the extra origins of a stack on other ports', async () => {
    const { origins } = parseExtraOrigins('livedesign.app=http://localhost:3660');
    sql.exec(localClientsSql(NOW, origins));
    expect((await guest(design.clientId, 'http://localhost:3660/auth/guest')).status).toBe(302);
    expect((await guest(design.clientId, 'http://localhost:3661/auth/guest')).status).toBe(400);
  });

  it("stores the secret as Better Auth's default hasher does", () => {
    // SHA-256 of "abc", base64url without padding.
    expect(hashedSecret('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });
});

describe('parseExtraOrigins', () => {
  it('takes apps and loopback origins, and names what it skips', () => {
    const { origins, refused } = parseExtraOrigins(
      ' livedesign.app=http://localhost:3660, livedesign.app=http://127.0.0.1:3661,,livediagram.app=https://localhost:1,nope.app=http://localhost:2,livehuddle.app,livehuddle.app=http://localhost:3/x,liveplanner.app=::',
    );
    expect(Object.fromEntries(origins)).toEqual({
      'livedesign.app': ['http://localhost:3660', 'http://127.0.0.1:3661'],
    });
    expect(refused).toEqual([
      'livediagram.app=https://localhost:1',
      'nope.app=http://localhost:2',
      'livehuddle.app',
      'livehuddle.app=http://localhost:3/x',
      'liveplanner.app=::',
    ]);
    expect(parseExtraOrigins(undefined)).toEqual({ origins: new Map(), refused: [] });
  });

  it('keeps a quote in a value from reaching the SQL unquoted', () => {
    expect(parseExtraOrigins("livedesign.app=http://localhost:1'--").origins.size).toBe(0);
  });
});

describe("each app's .dev.vars.example", () => {
  const vars = (file: string): Record<string, string> => {
    const text = readFileSync(
      fileURLToPath(new URL(`../../../../${file}`, import.meta.url).href),
      'utf8',
    );
    return Object.fromEntries(
      text
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  };

  it.each(LOCAL_CLIENTS.map((client) => [client.app, client] as const))(
    '%s names its local client',
    (_, client) => {
      const name = client.app.replace('.app', '');
      const index = vars('liveworkspace/apps/index/.dev.vars.example');
      expect(index[`INDEX_KEY_${name.toUpperCase()}`]).toBe(`dev-${name}-index-key`);
      expect(index[`APP_ORIGIN_${name.toUpperCase()}`]).toBe(client.origin);
      expect(vars(`${name}/apps/api/.dev.vars.example`)).toMatchObject({
        ACCOUNTS_URL: BASE,
        API_RESOURCE: LOCAL_RESOURCE,
        ACCOUNTS_CLIENT_ID: client.clientId,
        ACCOUNTS_CLIENT_SECRET: client.clientSecret,
        AUTH_ORIGIN: client.origin,
        INDEX_ORIGIN: 'http://127.0.0.1:8793',
        INDEX_KEY: `dev-${name}-index-key`,
      });
    },
  );
});
