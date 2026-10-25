import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { createTeam, deleteTeam, inviteMember, type Actor } from './teams.ts';
import { addClient, addUser, testD1 } from './test-d1.ts';

// POST /api/account/internal/invitations (internal-invitations.ts): what an app's Invites view lists.

const BASE = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev';
const CLIENT = `Basic ${btoa('livediagram:secret')}`;
const T0 = Date.UTC(2026, 9, 1);

const ADA: Actor = { id: 'user_ada', email: 'ada@example.com' };

// Introspection that knows one client, the only part of Better Auth the internal routes use here.
const auth = {
  api: { getSession: async () => null },
  handler: async (request: Request) =>
    request.headers.get('authorization') === CLIENT
      ? Response.json({ active: true, client_id: 'livediagram' })
      : new Response(null, { status: 401 }),
} as unknown as Auth;

let env: Env;
let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  const d1 = testD1();
  db = d1.db;
  sql = d1.sql;
  addUser(sql, { id: ADA.id, email: ADA.email!, name: 'Ada' });
  addUser(sql, { id: 'user_bea', email: 'Bea@Example.com', name: 'Bea' });
  addUser(sql, { id: 'user_cy', email: 'cy@example.com', verified: false });
  addClient(sql, 'livediagram', 'livediagram.app');
  env = { BASE_URL: BASE, AUTH_DB: db, ENVIRONMENT: 'production' } as unknown as Env;
});

async function teamInviting(name: string, email: string, at: number, role = 'member') {
  const made = await createTeam(db, ADA, name, at, 'Acme');
  if (!made.ok) throw new Error(made.error);
  const invited = await inviteMember(db, ADA, made.value.id, email, role, at);
  if (!invited.ok) throw new Error(invited.error);
  return made.value.id;
}

const ask = (body: unknown, authorization = CLIENT) =>
  handleAccountApi(
    new Request(`${BASE}/api/account/internal/invitations`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    auth,
  );

describe('POST /api/account/internal/invitations', () => {
  it('lists the invitations waiting for the account’s verified address, newest first', async () => {
    const older = await teamInviting('Design', 'bea@example.com', T0);
    const newer = await teamInviting('Writers', 'bea@example.com', T0 + 1000, 'admin');
    const res = await ask({ userId: 'user_bea' });
    expect(res.status).toBe(200);
    const { invitations } = (await res.json()) as { invitations: Record<string, unknown>[] };
    expect(invitations.map((i) => i.teamId)).toEqual([newer, older]);
    expect(invitations[0]).toMatchObject({
      teamName: 'Writers',
      organisation: 'Acme',
      role: 'admin',
      invitedByName: 'Ada',
      memberCount: 1,
      createdAt: T0 + 1000,
    });
  });

  it('answers none for an account with no invitations, an unverified address or no account', async () => {
    await teamInviting('Design', 'cy@example.com', T0);
    for (const userId of ['user_ada', 'user_cy', 'user_nobody']) {
      const res = await ask({ userId });
      expect(await res.json()).toEqual({ invitations: [] });
    }
  });

  it('leaves out a deleted team’s invitation', async () => {
    const teamId = await teamInviting('Design', 'bea@example.com', T0);
    await deleteTeam(db, ADA, teamId);
    expect(await (await ask({ userId: 'user_bea' })).json()).toEqual({ invitations: [] });
  });

  it('needs a well-formed account id, and the app’s client credentials', async () => {
    expect((await ask({ userId: 'guest_1' })).status).toBe(400);
    expect((await ask({})).status).toBe(400);
    expect((await ask({ userId: 'user_bea' }, 'Basic bm9wZTpub3Bl')).status).toBe(401);
  });
});
