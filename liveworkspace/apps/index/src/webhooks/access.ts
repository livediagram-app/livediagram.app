// Who is in and who runs a team, as accounts says now (liveworkspace/docs/specs/004-index/webhooks.md "Who adds one",
// "What it sends", "Security"): adding or changing a team's webhook, and sending one, each ask whether the person is
// an admin of the team at that moment, and a mention asks whether the mentioned person is one of the item's team's
// people (`POST /api/account/index/teams`, with the key the two share, as a team filter asks). A token's `teams` claim
// can be an hour old, so it is never trusted for this.

import { readTeamsClaim, type TeamClaim } from '@liveworkspace/auth-client';
import { accountsUrl, type Env } from '../env';

/** Teams of a person's now (those they run, or every one they are in), or null when accounts can't say (unreachable,
 *  no key). */
export type AdminTeams = (personId: string) => Promise<ReadonlySet<string> | null>;
export type PersonTeams = AdminTeams;

const TIMEOUT_MS = 3_000;

// The person's teams as accounts answers now; none for an id it refuses, null when it can't say.
async function teamsNow(env: Env, personId: string): Promise<TeamClaim[] | null> {
  const key = env.MERGE_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(`${accountsUrl(env)}/api/account/index/teams`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: personId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // An id accounts refuses (a closed account's `deleted`) is in nothing and runs nothing.
    if (res.status === 400) return [];
    if (!res.ok) return null;
    return readTeamsClaim(((await res.json()) as { teams?: unknown }).teams) ?? [];
  } catch {
    return null;
  }
}

export function accountsAdminTeams(env: Env): AdminTeams {
  return async (personId) => {
    const teams = await teamsNow(env, personId);
    return teams && new Set(teams.filter((t) => t.role === 'admin').map((t) => t.id));
  };
}

export function accountsPersonTeams(env: Env): PersonTeams {
  return async (personId) => {
    const teams = await teamsNow(env, personId);
    return teams && new Set(teams.map((t) => t.id));
  };
}
