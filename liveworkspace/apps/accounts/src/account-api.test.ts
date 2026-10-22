import { beforeEach, describe, expect, it } from 'vitest';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { addUser, testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const CLIENT = `Basic ${btoa('liveplanner:secret')}`;

let env: Env;
let sent: { to: string; subject: string }[];
// Who the stub session belongs to, or null for signed out.
let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;

// Stands in for Better Auth: the session from `signedIn`, and introspection that knows one client
// (liveplanner:secret) and one access token ('jwt-ada', minted for liveplanner).
const auth = {
  api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  handler: async (request: Request) => {
    if (request.headers.get('authorization') !== CLIENT) return new Response(null, { status: 401 });
    const token = new URLSearchParams(await request.text()).get('token');
    return Response.json(
      token === 'jwt-ada'
        ? { active: true, sub: 'user_ada', client_id: 'liveplanner' }
        : { active: false },
    );
  },
} as unknown as Auth;

beforeEach(() => {
  const d1 = testD1();
  addUser(d1.sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addUser(d1.sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  sent = [];
  env = {
    BASE_URL: BASE,
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    AUTH_DB: d1.db,
    EMAIL: {
      send: async (message: { to: string; subject: string }) => {
        sent.push(message);
      },
    },
  } as unknown as Env;
  signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
});

function call(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const method = init.method ?? 'GET';
  return handleAccountApi(
    new Request(`${BASE}/api/account${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(method === 'GET' ? {} : { origin: BASE }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
    auth,
  );
}

describe('the account API, signed in', () => {
  it('refuses a signed-out request', async () => {
    signedIn = null;
    expect((await call('/teams')).status).toBe(401);
  });

  it('refuses a write from another origin', async () => {
    const response = await call('/teams', {
      method: 'POST',
      body: { name: 'x' },
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status).toBe(403);
  });

  it('makes a team, invites by email, and lets the invited person join', async () => {
    const made = await call('/teams', { method: 'POST', body: { name: 'Design' } });
    expect(made.status).toBe(201);
    const { id } = (await made.json()) as { id: string };

    const invited = await call(`/teams/${id}/members`, {
      method: 'POST',
      body: { email: 'bea@example.com' },
    });
    expect(invited.status).toBe(201);
    expect(sent).toEqual([
      expect.objectContaining({
        to: 'bea@example.com',
        subject: 'Ada invited you to Design on liveworkspace',
      }),
    ]);

    signedIn = { id: 'user_bea', name: 'Bea', email: 'bea@example.com', emailVerified: true };
    const mine = (await (await call('/teams')).json()) as { invitations: { id: string }[] };
    expect(mine.invitations).toHaveLength(1);
    const joined = await call(`/invitations/${mine.invitations[0]!.id}/accept`, {
      method: 'POST',
      body: {},
    });
    expect(joined.status).toBe(200);
    const detail = (await (await call(`/teams/${id}/members`)).json()) as {
      team: { myRole: string };
      members: unknown[];
    };
    expect(detail.team.myRole).toBe('member');
    expect(detail.members).toHaveLength(2);
  });

  it('makes, lists and revokes API tokens', async () => {
    const made = await call('/tokens', {
      method: 'POST',
      body: { name: 'Script', readOnly: true },
    });
    expect(made.status).toBe(201);
    const token = (await made.json()) as { id: string; secret: string };
    expect(token.secret).toMatch(/^lwt_/);
    const listed = (await (await call('/tokens')).json()) as { tokens: unknown[] };
    expect(JSON.stringify(listed)).not.toContain(token.secret);
    expect((await call(`/tokens/${token.id}`, { method: 'DELETE' })).status).toBe(200);
    expect(((await (await call('/tokens')).json()) as { tokens: unknown[] }).tokens).toEqual([]);
  });
});

describe('the account API, for the apps', () => {
  const internal = (path: string, body?: unknown, authorization = CLIENT) =>
    handleAccountApi(
      new Request(`${BASE}/api/account/internal${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
      auth,
    );

  it('refuses wrong client credentials', async () => {
    const response = await internal(
      '/teams/changes',
      undefined,
      `Basic ${btoa('liveplanner:wrong')}`,
    );
    expect(response.status).toBe(401);
  });

  it('checks a token to its account and teams', async () => {
    await call('/teams', { method: 'POST', body: { name: 'Design' } });
    const { secret } = (await (
      await call('/tokens', { method: 'POST', body: { name: 'x' } })
    ).json()) as {
      secret: string;
    };
    const checked = await internal('/tokens/verify', { token: secret });
    expect(await checked.json()).toMatchObject({
      userId: 'user_ada',
      email: 'ada@example.com',
      teams: [{ name: 'Design', role: 'admin' }],
    });
    expect(
      (await internal('/tokens/verify', { token: 'lwt_unknown_unknown_unknown' })).status,
    ).toBe(404);
  });

  it('makes a token only for the person the access token vouches for', async () => {
    const made = await internal('/tokens', {
      accessToken: 'jwt-ada',
      name: 'Claude',
      readOnly: false,
    });
    expect(made.status).toBe(201);
    expect(await made.json()).toMatchObject({ name: 'Claude' });
    expect((await internal('/tokens', { accessToken: 'forged', name: 'x' })).status).toBe(401);
  });

  it('lets a token revoke itself, and says which tokens still work', async () => {
    const made = (await (
      await call('/tokens', { method: 'POST', body: { name: 'cli' } })
    ).json()) as {
      id: string;
      secret: string;
    };
    const other = (await (
      await call('/tokens', { method: 'POST', body: { name: 'x' } })
    ).json()) as {
      id: string;
    };
    expect(
      await (await internal('/tokens/live', { ids: [made.id, other.id, 'nope'] })).json(),
    ).toEqual({
      live: expect.arrayContaining([made.id, other.id]),
    });
    expect((await internal('/tokens/revoke', { token: made.secret })).status).toBe(200);
    expect((await internal('/tokens/revoke', { token: made.secret })).status).toBe(404);
    expect(await (await internal('/tokens/live', { ids: [made.id, other.id] })).json()).toEqual({
      live: [other.id],
    });
  });

  it('serves the teams change feed', async () => {
    await call('/teams', { method: 'POST', body: { name: 'Design' } });
    const feed = (await (await internal('/teams/changes')).json()) as { teams: { name: string }[] };
    expect(feed.teams.map((t) => t.name)).toEqual(['Design']);
  });
});
