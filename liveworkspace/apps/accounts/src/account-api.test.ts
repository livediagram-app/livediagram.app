import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { __setBearerVerifier } from './bearer.ts';
import { signGuestCookie } from './guests.ts';
import { addClient, addUser, testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const CLIENT = `Basic ${btoa('liveplanner:secret')}`;
// Two more clients with the right secret: livediagram's, and one registered without an app.
const DIAGRAM = `Basic ${btoa('livediagram:secret')}`;
const NO_APP = `Basic ${btoa('lonely:secret')}`;
const CLIENTS: Record<string, string> = {
  [CLIENT]: 'liveplanner',
  [DIAGRAM]: 'livediagram',
  [NO_APP]: 'lonely',
};

let env: Env;
let sent: { to: string[]; subject: string }[];
// Who the stub session belongs to, or null for signed out.
let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;

// Stands in for Better Auth: the session from `signedIn`, and introspection that knows three clients
// (CLIENTS) and one access token ('jwt-ada', minted for liveplanner).
const auth = {
  api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  handler: async (request: Request) => {
    if (!CLIENTS[request.headers.get('authorization') ?? '']) {
      return new Response(null, { status: 401 });
    }
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
  addClient(d1.sql, 'liveplanner', 'liveplanner.app');
  addClient(d1.sql, 'livediagram', 'livediagram.app');
  addClient(d1.sql, 'lonely', null);
  sent = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)) as { to: string[]; subject: string });
    return new Response('{}');
  });
  env = {
    BASE_URL: BASE,
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    AUTH_DB: d1.db,
    ENVIRONMENT: 'production',
    RESEND_API_KEY: 're_test',
  } as unknown as Env;
  signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
});

afterEach(() => vi.unstubAllGlobals());

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
        to: ['bea@example.com'],
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

  it('reads and sets their own display name and colour', async () => {
    expect(await (await call('/profile')).json()).toEqual({
      profile: { id: 'user_ada', name: 'Ada', color: null, createdAt: null, updatedAt: null },
    });
    const patched = await call('/profile', {
      method: 'PATCH',
      body: { name: 'Ada L', color: '#f97316' },
    });
    expect(await patched.json()).toMatchObject({ profile: { name: 'Ada L', color: '#f97316' } });
    expect((await call('/profile', { method: 'PATCH', body: {} })).status).toBe(400);
  });

  it('reads other people’s display names by id, names only', async () => {
    const res = await call('/people?ids=user_bea,user_nobody,not-an-id');
    expect(await res.json()).toEqual({ people: [{ id: 'user_bea', name: 'Bea' }] });
    const many = Array.from({ length: 101 }, (_, i) => `user_${i}`).join(',');
    expect((await call(`/people?ids=${many}`)).status).toBe(400);
    signedIn = null;
    expect((await call('/people?ids=user_bea')).status).toBe(401);
  });

  it('names people for this browser’s guest too, and nobody else signed out', async () => {
    signedIn = null;
    env.BETTER_AUTH_SECRET = 'guest-secret';
    const guest = await signGuestCookie(
      'guest_00000000-0000-4000-8000-000000000001',
      'guest-secret',
    );
    const res = await call('/people?ids=user_bea', { headers: { cookie: `lw_guest=${guest}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ people: [{ id: 'user_bea', name: 'Bea' }] });
    const forged = await signGuestCookie('guest_00000000-0000-4000-8000-000000000001', 'other');
    expect(
      (await call('/people?ids=user_bea', { headers: { cookie: `lw_guest=${forged}` } })).status,
    ).toBe(401);
    // Still only names: the guest's door opens nothing else.
    expect((await call('/teams', { headers: { cookie: `lw_guest=${guest}` } })).status).toBe(401);
  });

  it('reads and patches the settings every app shows', async () => {
    expect(await (await call('/settings')).json()).toEqual({ all: {}, updatedAt: null });
    const patched = await call('/settings', {
      method: 'PATCH',
      body: { all: { theme: 'dark', locale: 'en' } },
    });
    expect(await patched.json()).toMatchObject({ all: { theme: 'dark', locale: 'en' } });
    await call('/settings', { method: 'PATCH', body: { all: { locale: null } } });
    expect(await (await call('/settings')).json()).toMatchObject({ all: { theme: 'dark' } });
    expect((await call('/settings', { method: 'PATCH', body: { all: [1] } })).status).toBe(400);
    const crossOrigin = await call('/settings', {
      method: 'PATCH',
      body: { all: { theme: 'light' } },
      headers: { origin: 'https://evil.example' },
    });
    expect(crossOrigin.status).toBe(403);
  });

  it("reads and patches one app's own settings, and only that app's", async () => {
    await call('/settings', { method: 'PATCH', body: { all: { reduceMotion: true } } });
    expect(await (await call('/settings/livediagram.app')).json()).toEqual({
      all: { reduceMotion: true },
      app: {},
      updatedAt: expect.any(Number),
    });
    const patched = await call('/settings/livediagram.app', {
      method: 'PATCH',
      body: { app: { showMinimap: false }, all: { reduceMotion: false } },
    });
    // `all` in the body is ignored: the dialog changes the app's scope alone.
    expect(await patched.json()).toMatchObject({
      all: { reduceMotion: true },
      app: { showMinimap: false },
    });
    expect(await (await call('/settings/liveplanner.app')).json()).toMatchObject({ app: {} });
    expect((await call('/settings/liveworkspace.app')).status).toBe(404);
    expect((await call('/settings/nope.app')).status).toBe(404);
    expect(
      (await call('/settings/livediagram.app', { method: 'PATCH', body: { app: [1] } })).status,
    ).toBe(400);
    const crossOrigin = await call('/settings/livediagram.app', {
      method: 'PATCH',
      body: { app: { showMinimap: true } },
      headers: { origin: 'https://evil.example' },
    });
    expect(crossOrigin.status).toBe(403);
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

  it("reads and writes someone's settings for one app", async () => {
    const owner = 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b';
    const written = await internal(
      '/settings/write',
      { owner, app: 'livediagram.app', patch: { all: { theme: 'dark' }, app: { snap: true } } },
      DIAGRAM,
    );
    expect(written.status).toBe(200);
    expect(await written.json()).toMatchObject({ all: { theme: 'dark' }, app: { snap: true } });
    const read = await internal('/settings/read', { owner, app: 'liveplanner.app' });
    expect(await read.json()).toMatchObject({ all: { theme: 'dark' }, app: {} });
    // Reaching a guest's settings through an app counts as the guest being seen, for the idle sweep.
    expect(
      await env.AUTH_DB.prepare('SELECT guest_id FROM guest_seen WHERE guest_id = ?')
        .bind(owner)
        .first('guest_id'),
    ).toBe(owner);

    expect(
      (await internal('/settings/read', { owner: 'nobody', app: 'liveplanner.app' })).status,
    ).toBe(400);
    expect((await internal('/settings/read', { owner, app: 'liveplanner' })).status).toBe(400);
    expect(
      (await internal('/settings/write', { owner, app: 'liveplanner.app', patch: [] })).status,
    ).toBe(400);
    const tooBig = await internal('/settings/write', {
      owner,
      app: 'liveplanner.app',
      patch: { app: { big: 'x'.repeat(20_000) } },
    });
    expect(tooBig.status).toBe(400);
    expect(await tooBig.json()).toEqual({ error: 'settings_too_large' });
    expect(
      (await internal('/settings/read', { owner, app: 'liveplanner.app' }, `Basic ${btoa('x:y')}`))
        .status,
    ).toBe(401);
  });

  it("keeps each app to its own settings scope, beside 'all'", async () => {
    const owner = 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b';
    // liveplanner's client can't read or write livediagram's scope, even to touch only 'all'.
    const read = await internal('/settings/read', { owner, app: 'livediagram.app' });
    expect(read.status).toBe(403);
    expect(await read.json()).toEqual({ error: 'wrong_app' });
    expect(
      (
        await internal('/settings/write', {
          owner,
          app: 'livediagram.app',
          patch: { all: { theme: 'dark' } },
        })
      ).status,
    ).toBe(403);
    // A client registered without an app reaches no one's settings, but still checks tokens.
    const lonely = await internal('/settings/read', { owner, app: 'liveplanner.app' }, NO_APP);
    expect(lonely.status).toBe(403);
    expect(await lonely.json()).toEqual({ error: 'client_has_no_app' });
    expect((await internal('/tokens/verify', { token: 'lwt_nope' }, NO_APP)).status).toBe(404);
  });

  it('reads profiles in a batch, and sets your own name or colour', async () => {
    const guest = 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b';
    const set = await internal('/profiles/write', { owner: guest, name: 'Bea', color: '#0ea5e9' });
    expect(set.status).toBe(200);
    expect(await set.json()).toMatchObject({
      profile: { id: guest, name: 'Bea', color: '#0ea5e9' },
    });
    const read = await internal(
      '/profiles/read',
      { ids: [guest, 'user_ada', 'user_nobody'] },
      DIAGRAM,
    );
    const { profiles } = (await read.json()) as { profiles: { id: string; name: string }[] };
    expect(profiles.map((p) => [p.id, p.name]).sort()).toEqual([
      [guest, 'Bea'],
      ['user_ada', 'Ada'],
    ]);

    const tooMany = Array.from({ length: 101 }, () => guest);
    expect((await internal('/profiles/read', { ids: tooMany })).status).toBe(400);
    expect((await internal('/profiles/read', { ids: ['nobody'] })).status).toBe(400);
    expect((await internal('/profiles/write', { owner: guest, color: 'url(x)' })).status).toBe(400);
    expect((await internal('/profiles/write', { owner: 'user_gone', name: 'x' })).status).toBe(404);
  });

  it("records the client's own app's sign-ups and milestones", async () => {
    expect(await (await internal('/sightings', { userId: 'user_ada' })).json()).toEqual({
      first: true,
    });
    expect(await (await internal('/sightings', { userId: 'user_ada' })).json()).toEqual({
      first: false,
    });
    // Another app seeing the same account is that app's first time.
    expect(await (await internal('/sightings', { userId: 'user_ada' }, DIAGRAM)).json()).toEqual({
      first: true,
    });
    const claim = (milestone: string) =>
      internal('/milestones/claim', { userId: 'user_ada', milestone });
    expect(await (await claim('milestone')).json()).toEqual({ claimed: true });
    expect(await (await claim('milestone')).json()).toEqual({ claimed: false });
    expect((await claim('tenth')).status).toBe(400);
    expect((await internal('/sightings', { userId: 'guest_x' })).status).toBe(400);
    expect((await internal('/sightings', { userId: 'user_ada' }, NO_APP)).status).toBe(403);
  });

  it('takes activity for an account, and ignores a guest', async () => {
    await env.AUTH_DB.prepare('INSERT INTO email_lifecycle (user_id, created_at) VALUES (?, 1)')
      .bind('user_ada')
      .run();
    expect((await internal('/activity', { userId: 'user_ada', at: 5000 })).status).toBe(200);
    // A time in the future is held to now.
    await internal('/activity', { userId: 'user_ada', at: Date.now() + 1e9 });
    const at = await env.AUTH_DB.prepare('SELECT active_at FROM email_lifecycle').first<number>(
      'active_at',
    );
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(
      (await internal('/activity', { userId: 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b' }))
        .status,
    ).toBe(200);
    expect((await internal('/activity', { userId: 'user_ada', at: 'soon' })).status).toBe(400);
    expect((await internal('/activity', { userId: 'nobody' })).status).toBe(400);
  });

  it("answers accounts' verified emails, a bounded batch", async () => {
    const response = await internal('/emails', { ids: ['user_ada', 'user_bea'] });
    expect(await response.json()).toEqual({
      emails: { user_ada: 'ada@example.com', user_bea: 'bea@example.com' },
    });
    const many = Array.from({ length: 101 }, (_, i) => `user_${i}`);
    expect((await internal('/emails', { ids: many })).status).toBe(400);
    expect((await internal('/emails', { ids: ['guest_x'] })).status).toBe(400);
  });

  it("answers many accounts' notify switches for the client's own app only", async () => {
    await env.AUTH_DB.prepare(
      `INSERT INTO settings (owner_id, scope, prefs, updated_at) VALUES ('user_ada', 'all', '{"notifyMentions":false,"theme":"dark"}', 0)`,
    ).run();
    const body = {
      owners: ['user_ada', 'user_bea'],
      app: 'liveplanner.app',
      keys: ['notifyMentions'],
    };
    expect(await (await internal('/settings/notify', body)).json()).toEqual({
      settings: { user_ada: { all: { notifyMentions: false }, app: {} } },
    });
    expect((await internal('/settings/notify', { ...body, keys: ['theme'] })).status).toBe(400);
    expect((await internal('/settings/notify', { ...body, keys: [] })).status).toBe(400);
    expect((await internal('/settings/notify', { ...body, owners: ['guest_x'] })).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => `user_${i}`);
    expect((await internal('/settings/notify', { ...body, owners: many })).status).toBe(400);
    expect((await internal('/settings/notify', body, DIAGRAM)).status).toBe(403);
    expect((await internal('/settings/notify', body, NO_APP)).status).toBe(403);
  });

  it("answers a team's people, or 404", async () => {
    const made = await call('/teams', { method: 'POST', body: { name: 'Design' } });
    const team = (await made.json()) as { id: string };
    const found = await internal('/teams/members', { teamId: team.id });
    expect(await found.json()).toMatchObject({
      team: { id: team.id, name: 'Design' },
      members: [{ userId: 'user_ada', email: 'ada@example.com', status: 'joined', role: 'admin' }],
    });
    expect((await internal('/teams/members', { teamId: 'nope' })).status).toBe(404);
    expect((await internal('/teams/members', {})).status).toBe(400);
  });

  it("answers the teams someone is in now, to an app and to the index's key", async () => {
    const made = await call('/teams', { method: 'POST', body: { name: 'Design' } });
    const team = (await made.json()) as { id: string };
    const now = await internal('/teams/of', { userId: 'user_ada' });
    expect(await now.json()).toEqual({ teams: [{ id: team.id, name: 'Design', role: 'admin' }] });
    expect((await internal('/teams/of', { userId: 'robert' })).status).toBe(400);
    const index = (key: string) =>
      handleAccountApi(
        new Request(`${BASE}/api/account/index/teams`, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ userId: 'user_ada' }),
        }),
        { ...env, INDEX_MERGE_KEY: 'merge-key' },
        auth,
      );
    expect(await (await index('merge-key')).json()).toEqual({
      teams: [{ id: team.id, name: 'Design', role: 'admin' }],
    });
    expect((await index('nope')).status).toBe(401);
  });

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

  it('makes a team in an app for the person the access token vouches for, as its admin', async () => {
    const made = await internal('/teams', {
      accessToken: 'jwt-ada',
      name: '  Design ',
      organisation: 'Acme',
    });
    expect(made.status).toBe(201);
    const team = (await made.json()) as { id: string; role: string; members: unknown[] };
    expect(team).toMatchObject({
      name: 'Design',
      organisation: 'Acme',
      role: 'admin',
      memberCount: 1,
    });
    // The same team the site shows.
    const mine = (await (await call('/teams')).json()) as { teams: { id: string }[] };
    expect(mine.teams.map((t) => t.id)).toEqual([team.id]);

    expect((await internal('/teams', { accessToken: 'forged', name: 'x' })).status).toBe(401);
    expect((await internal('/teams', { name: 'x' })).status).toBe(400);
    expect((await internal('/teams', { accessToken: 'jwt-ada', name: ' ' })).status).toBe(400);
    expect(
      (await internal('/teams', { accessToken: 'jwt-ada', name: 'x' }, `Basic ${btoa('x:y')}`))
        .status,
    ).toBe(401);
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

describe("the account API, for the Explorer on an app's address (by the app's bearer)", () => {
  // Stands in for this Worker's keys: 'tok-ada' is Ada's access token, 'tok-guest' a guest's, anything else forged.
  beforeEach(() => {
    signedIn = null;
    __setBearerVerifier(
      () => async (token) =>
        token === 'tok-ada'
          ? {
              kind: 'account',
              userId: 'user_ada',
              email: 'ada@example.com',
              emailVerified: true,
              scopes: [],
              teams: null,
            }
          : token === 'tok-guest'
            ? { kind: 'guest', guestId: 'guest_00000000-0000-4000-8000-000000000009' }
            : null,
    );
  });
  afterEach(() => __setBearerVerifier(null));

  const bearer = (token: string, init: Parameters<typeof call>[1] = {}) => ({
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      origin: 'https://liveplanner.app',
      ...init.headers,
    },
  });

  it("reads names, the person's teams and a team's members, with no session", async () => {
    signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
    const made = (await (
      await call('/teams', { method: 'POST', body: { name: 'Design' } })
    ).json()) as {
      id: string;
    };
    signedIn = null;
    const teams = await call('/teams', bearer('tok-ada'));
    expect(teams.status).toBe(200);
    expect(((await teams.json()) as { teams: { id: string }[] }).teams.map((t) => t.id)).toEqual([
      made.id,
    ]);
    const members = await call(`/teams/${made.id}/members`, bearer('tok-ada'));
    expect(members.status).toBe(200);
    const people = await call('/people?ids=user_ada,user_bea', bearer('tok-ada'));
    expect(((await people.json()) as { people: unknown[] }).people).toHaveLength(2);
  });

  it("reads and writes the app's settings from the app's origin", async () => {
    const patched = await call(
      '/settings/liveplanner.app',
      bearer('tok-ada', { method: 'PATCH', body: { app: { homeBanner: false } } }),
    );
    expect(patched.status).toBe(200);
    const read = (await (await call('/settings/liveplanner.app', bearer('tok-ada'))).json()) as {
      app: Record<string, unknown>;
    };
    expect(read.app.homeBanner).toBe(false);
    expect((await call('/settings', bearer('tok-ada'))).status).toBe(200);
  });

  it('patches the settings every app shares, for the Settings panel’s Account section', async () => {
    const patched = await call(
      '/settings',
      bearer('tok-ada', { method: 'PATCH', body: { all: { notifyTips: false } } }),
    );
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { all: Record<string, unknown> }).all.notifyTips).toBe(false);
    const read = (await (await call('/settings/liveplanner.app', bearer('tok-ada'))).json()) as {
      all: Record<string, unknown>;
    };
    expect(read.all.notifyTips).toBe(false);
    // A guest's bearer has no account settings to change.
    expect(
      (await call('/settings', bearer('tok-guest', { method: 'PATCH', body: { all: {} } }))).status,
    ).toBe(401);
  });

  it('lets a guest read names alone', async () => {
    expect((await call('/people?ids=user_ada', bearer('tok-guest'))).status).toBe(200);
    expect((await call('/teams', bearer('tok-guest'))).status).toBe(401);
    expect((await call('/settings/liveplanner.app', bearer('tok-guest'))).status).toBe(401);
  });

  it('runs a team in place: makes, renames, invites and deletes it', async () => {
    const made = await call(
      '/teams',
      bearer('tok-ada', { method: 'POST', body: { name: 'Design' } }),
    );
    expect(made.status).toBe(201);
    const { id } = (await made.json()) as { id: string };
    const renamed = await call(
      `/teams/${id}`,
      bearer('tok-ada', { method: 'PATCH', body: { name: 'Product Design' } }),
    );
    expect(renamed.status).toBe(200);
    const invited = await call(
      `/teams/${id}/members`,
      bearer('tok-ada', { method: 'POST', body: { email: 'bea@example.com', role: 'member' } }),
    );
    expect(invited.status).toBe(201);
    const members = (await (await call(`/teams/${id}/members`, bearer('tok-ada'))).json()) as {
      team: { name: string };
      members: { email: string }[];
    };
    expect(members.team.name).toBe('Product Design');
    expect(members.members.map((m) => m.email).sort()).toEqual([
      'ada@example.com',
      'bea@example.com',
    ]);
    expect((await call(`/teams/${id}`, bearer('tok-ada', { method: 'DELETE' }))).status).toBe(200);
  });

  it('refuses a forged bearer, and everything the page does not need', async () => {
    expect((await call('/teams', bearer('forged'))).status).toBe(401);
    expect(
      (await call('/teams', bearer('tok-guest', { method: 'POST', body: { name: 'x' } }))).status,
    ).toBe(401);
    expect((await call('/join/abc', bearer('tok-ada', { method: 'POST' }))).status).toBe(404);
    expect((await call('/tokens', bearer('tok-ada'))).status).toBe(404);
  });

  it('reads and sets the account’s own profile, for the Settings panel’s Profile in place', async () => {
    const read = await call('/profile', bearer('tok-ada'));
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ profile: { id: 'user_ada', color: null } });
    const patched = await call(
      '/profile',
      bearer('tok-ada', { method: 'PATCH', body: { name: 'Ada L', color: '#f97316' } }),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      profile: { id: 'user_ada', name: 'Ada L', color: '#f97316' },
    });
    expect(await (await call('/profile', bearer('tok-ada'))).json()).toMatchObject({
      profile: { name: 'Ada L', color: '#f97316' },
    });
    // Null clears either; a bad colour is refused as on the session's door.
    const cleared = await call(
      '/profile',
      bearer('tok-ada', { method: 'PATCH', body: { name: null, color: null } }),
    );
    expect(await cleared.json()).toMatchObject({ profile: { color: null } });
    expect(
      (await call('/profile', bearer('tok-ada', { method: 'PATCH', body: { color: 'url(x)' } })))
        .status,
    ).toBe(400);
    expect((await call('/profile', bearer('tok-ada', { method: 'DELETE' }))).status).toBe(404);
  });

  it('refuses a guest’s bearer and a forged one on the profile', async () => {
    expect((await call('/profile', bearer('tok-guest'))).status).toBe(401);
    expect(
      (await call('/profile', bearer('tok-guest', { method: 'PATCH', body: { name: 'Bea' } })))
        .status,
    ).toBe(401);
    expect((await call('/profile', bearer('forged'))).status).toBe(401);
  });
});
