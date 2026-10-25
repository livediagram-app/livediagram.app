import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from './auth.ts';
import { clientApp, CLIENTS_PATH, registerClient } from './clients.ts';
import type { Env } from './env.ts';
import { testD1 } from './test-d1.ts';

// crypto.subtle.timingSafeEqual is the Workers runtime's own; Node's crypto has none.
vi.mock('./secrets.ts', () => ({
  ADMIN_HEADER: 'x-admin-token',
  sameSecret: async (a: string, b: string) => a === b,
}));

const ADMIN = 'admin-token';
let env: Env;
let made: { client_name: string }[];

// Stands in for Better Auth's registration: makes the oauthClient row, as the provider does.
function stubAuth(db: D1Database): Auth {
  return {
    $context: Promise.resolve({
      authCookies: { sessionToken: { name: 'session' } },
      internalAdapter: {
        findUserByEmail: async () => ({ user: { id: 'user_registrar' } }),
        createSession: async () => ({ token: 'session-token' }),
        deleteSession: async () => {},
      },
    }),
    api: {
      adminCreateOAuthClient: async ({ body }: { body: { client_name: string } }) => {
        made.push(body);
        const clientId = `client-${made.length}`;
        await db
          .prepare(
            `INSERT INTO oauthClient (id, clientId, redirectUris, createdAt, updatedAt) VALUES (?, ?, '[]', '2026', '2026')`,
          )
          .bind(clientId, clientId)
          .run();
        return { client_id: clientId, client_secret: 'secret', redirect_uris: [] };
      },
    },
  } as unknown as Auth;
}

beforeEach(() => {
  made = [];
  env = {
    ENVIRONMENT: 'development',
    ADMIN_TOKEN: ADMIN,
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
    AUTH_DB: testD1().db,
  } as unknown as Env;
});

const register = (body: unknown, token = ADMIN) =>
  registerClient(
    new Request(`http://localhost:3000${CLIENTS_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    stubAuth(env.AUTH_DB),
  );

const valid = {
  name: 'livediagram-dev',
  redirectUris: ['http://localhost:3100/api/auth/callback'],
  resource: 'http://localhost/api',
  app: 'livediagram.app',
};

describe('registering a client', () => {
  it('stores the app the client is', async () => {
    const response = await register(valid);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ client_id: 'client-1', app: 'livediagram.app' });
    expect(await clientApp(env.AUTH_DB, 'client-1')).toBe('livediagram.app');
  });

  it('refuses a client without a known app, before making anything', async () => {
    for (const app of [undefined, 'livediagram', 'liveworkspace.app']) {
      expect((await register({ ...valid, app })).status).toBe(400);
    }
    expect(made).toEqual([]);
  });

  it('needs the admin token', async () => {
    expect((await register(valid, 'wrong')).status).toBe(401);
  });

  it('answers null for a client registered without an app', async () => {
    expect(await clientApp(env.AUTH_DB, 'nobody')).toBeNull();
  });
});
