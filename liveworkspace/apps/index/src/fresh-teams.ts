// A team made or joined since the caller's access token was minted (liveworkspace/docs/one-explorer-contracts.md
// "Teams"): the token's `teams` claim is up to an hour old, so when a request names a team the claim does not
// hold, the index asks accounts for the person's teams as they are now (`POST /api/account/index/teams`, with the
// key the two share) and the team is usable at once. @liveworkspace/index-app's team access does the asking and
// remembering: only a miss asks, a burst of misses is one call, and when accounts can't be reached the claim
// stands. A claim is never narrowed here.

import { createTeamAccess, type TeamReader } from '@liveworkspace/index-app';
import { readTeamsClaim } from '@liveworkspace/auth-client';
import type { Person } from './auth';
import { accountsUrl, type Env } from './env';

const access = createTeamAccess();

export function clearFreshTeamsForTests(): void {
  access.clearForTests();
}

function readerFor(env: Env): TeamReader | null {
  const key = env.MERGE_KEY?.trim();
  if (!key) return null;
  return async (userId) => {
    const res = await fetch(`${accountsUrl(env)}/api/account/index/teams`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) throw new Error(`accounts teams ${res.status}`);
    return readTeamsClaim(((await res.json()) as { teams?: unknown }).teams) ?? [];
  };
}

// Whether `person` is in `teamId`, adding it to their teams for the rest of the request when accounts says
// they are now. Accounts only: a guest has no teams, an app's delegated person carries the teams the app
// checked (the app asks the same way, @liveworkspace/index-app teams.ts), and the Drive mirror reaches no team.
export async function inTeamNow(env: Env, person: Person, teamId: string): Promise<boolean> {
  if (person.teams.includes(teamId)) return true;
  if (person.kind !== 'account' || person.app || person.drive) return false;
  const claimed = person.teams.map((id) => ({ id, name: '', role: 'member' as const }));
  const teams = await access.teamsOf(readerFor(env), person.id, claimed, teamId);
  for (const t of teams) if (!person.teams.includes(t.id)) person.teams.push(t.id);
  return person.teams.includes(teamId);
}

// The same for several teams at once (one call at most).
export async function inTeamsNow(
  env: Env,
  person: Person,
  teamIds: readonly string[],
): Promise<boolean> {
  for (const id of teamIds) if (!(await inTeamNow(env, person, id))) return false;
  return true;
}
