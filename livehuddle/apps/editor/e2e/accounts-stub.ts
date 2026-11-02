import type { APIRequestContext } from '@playwright/test';

// What a person does on liveworkspace.app, for the signed-in specs (docs/specs/003-system-architecture/
// e2e-smoke.md "Signed-in specs"). Teams and API tokens are the liveworkspace account's, so the specs make
// them where the stack's accounts stand-in keeps them (E2E_ACCOUNTS_STUB, scripts/e2e-stack.mjs), and the
// api learns of them as it does in production: a team from the change feed, which it follows as soon as
// a caller's access token names a team it hasn't seen; a token by asking the stand-in when it's presented.
//
// An access token carries the teams its account is in when it is minted, so mint the token a request
// sends (`/e2e/token`) after the team it should see is made.

export type SeededTeam = { id: string; name: string };
export type SeededToken = { id: string; secret: string };

async function seed<T>(request: APIRequestContext, route: string, data: unknown): Promise<T> {
  const res = await request.post(`/e2e/accounts/__seed/${route}`, { data });
  if (!res.ok()) throw new Error(`seeding a ${route} failed: ${res.status()}`);
  return (await res.json()) as T;
}

// A team made by `admin`, who is its first member.
export function seedTeam(
  request: APIRequestContext,
  team: { id?: string; name: string; admin: { userId: string; email: string } },
): Promise<SeededTeam> {
  return seed(request, 'team', team);
}

// Someone joining a team (an invitation accepted on liveworkspace.app).
export function seedMember(
  request: APIRequestContext,
  member: { teamId: string; userId: string; email: string; role?: 'admin' | 'member' },
): Promise<unknown> {
  return seed(request, 'member', member);
}

// An API token the person made on liveworkspace.app; `secret` is the `lwt_…` a CLI or agent sends.
export function seedToken(
  request: APIRequestContext,
  token: { userId: string; email?: string; name?: string; readOnly?: boolean },
): Promise<SeededToken> {
  return seed(request, 'token', token);
}
