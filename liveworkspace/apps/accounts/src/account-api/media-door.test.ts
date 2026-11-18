import { beforeEach, describe, expect, it } from 'vitest';
import { handleAccountApi } from '../account-api.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { addUser, testD1 } from '../test-d1.ts';
import { MAX_DELETED_TEAM_IDS } from './media-door.ts';

// The media service's door (liveworkspace/docs/specs/006-media/libraries.md "Account and guest lifecycle"): it hears
// only of teams that are really deleted, whoever asked for what.

const BASE = 'https://liveworkspace.app';
const KEY = 'media-key';
type Person = { id: string; name: string; email: string; emailVerified: boolean };
const ADA: Person = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
const BEA: Person = { id: 'user_bea', name: 'Bea', email: 'bea@example.com', emailVerified: true };

let env: Env;
let signedIn: Person = ADA;
const auth = {
  api: { getSession: async () => ({ user: signedIn, session: {} }) },
  handler: async () => new Response(null, { status: 401 }),
} as unknown as Auth;

beforeEach(() => {
  const d1 = testD1();
  addUser(d1.sql, { id: ADA.id, email: ADA.email, name: ADA.name });
  addUser(d1.sql, { id: BEA.id, email: BEA.email, name: BEA.name });
  env = {
    BASE_URL: BASE,
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    AUTH_DB: d1.db,
    ENVIRONMENT: 'production',
    EMAIL: { send: async () => ({ messageId: 'm' }) } as unknown as SendEmail,
    ACCOUNTS_KEY_MEDIA: KEY,
  } as unknown as Env;
  signedIn = ADA;
});

async function as(person: Person, method: string, path: string, body?: unknown) {
  signedIn = person;
  const response = await handleAccountApi(
    new Request(`${BASE}/api/account${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: BASE },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    auth,
  );
  return { status: response.status, body: (await response.json().catch(() => null)) as never };
}

// A team Ada runs, with Bea joined as a member.
async function teamWithBea(name: string): Promise<{ id: string; beaMember: string }> {
  const { body: team } = await as(ADA, 'POST', '/teams', { name });
  const { id } = team as { id: string };
  await as(ADA, 'POST', `/teams/${id}/members`, { email: BEA.email });
  const { body: mine } = await as(BEA, 'GET', '/teams');
  const invitation = (mine as { invitations: { id: string }[] }).invitations[0]!;
  await as(BEA, 'POST', `/invitations/${invitation.id}/accept`, {});
  const { body: members } = await as(ADA, 'GET', `/teams/${id}/members`);
  const bea = (members as { members: { id: string; email: string }[] }).members.find(
    (m) => m.email === BEA.email,
  )!;
  return { id, beaMember: bea.id };
}

function ask(body: unknown, init: { key?: string; method?: string } = {}) {
  const method = init.method ?? 'POST';
  return handleAccountApi(
    new Request(`${BASE}/api/account/media/teams-deleted`, {
      method,
      headers: { authorization: `Bearer ${init.key ?? KEY}`, 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    env,
    auth,
  );
}

describe('the media door: which teams are deleted', () => {
  it('names a team an admin deleted, never one a member could not delete, left or was removed from', async () => {
    const kept = await teamWithBea('Kept');
    // A member's delete is refused, so the team stands.
    expect((await as(BEA, 'DELETE', `/teams/${kept.id}`)).status).toBe(403);
    const left = await teamWithBea('Left');
    // A member leaving deletes nothing.
    expect((await as(BEA, 'DELETE', `/teams/${left.id}/members/${left.beaMember}`)).status).toBe(
      200,
    );
    const removed = await teamWithBea('Removed');
    // Nor does an admin removing a member.
    expect(
      (await as(ADA, 'DELETE', `/teams/${removed.id}/members/${removed.beaMember}`)).status,
    ).toBe(200);
    const deleted = await teamWithBea('Deleted');
    expect((await as(ADA, 'DELETE', `/teams/${deleted.id}`)).status).toBe(200);
    // The last member leaving a team deletes it.
    const { body: alone } = await as(ADA, 'POST', '/teams', { name: 'Alone' });
    const aloneId = (alone as { id: string }).id;
    const { body: aloneMembers } = await as(ADA, 'GET', `/teams/${aloneId}/members`);
    const me = (aloneMembers as { members: { id: string }[] }).members[0]!;
    expect((await as(ADA, 'DELETE', `/teams/${aloneId}/members/${me.id}`)).status).toBe(200);

    const answer = await ask({
      ids: [kept.id, left.id, removed.id, deleted.id, aloneId, 'team-nobody-knows', 7],
    });
    expect(answer.status).toBe(200);
    const { deleted: gone } = (await answer.json()) as { deleted: string[] };
    expect(gone.sort()).toEqual([deleted.id, aloneId].sort());
  });

  it('answers none for no ids, and asking twice answers the same', async () => {
    const team = await teamWithBea('Twice');
    await as(ADA, 'DELETE', `/teams/${team.id}`);
    expect(await (await ask({ ids: [] })).json()).toEqual({ deleted: [] });
    expect(await (await ask({ ids: [team.id] })).json()).toEqual({ deleted: [team.id] });
    expect(await (await ask({ ids: [team.id] })).json()).toEqual({ deleted: [team.id] });
  });

  it("refuses all but a POST with the media service's key, and too many ids", async () => {
    expect((await ask({ ids: [] }, { key: 'nope' })).status).toBe(401);
    expect((await ask(undefined, { method: 'GET' })).status).toBe(404);
    expect((await ask({ ids: 'team' })).status).toBe(400);
    const many = Array.from({ length: MAX_DELETED_TEAM_IDS + 1 }, (_, i) => `team_${i}`);
    expect((await ask({ ids: many })).status).toBe(400);
    // No key set: the door isn't there.
    env = { ...env, ACCOUNTS_KEY_MEDIA: undefined };
    expect((await ask({ ids: [] })).status).toBe(404);
  });
});
