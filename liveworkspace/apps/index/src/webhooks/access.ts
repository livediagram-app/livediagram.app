// Who runs a team, as accounts says now (liveworkspace/docs/specs/004-index/webhooks.md "Who adds one", "Security"):
// adding or changing a team's webhook, and sending one, each ask whether the person is an admin of the team at that
// moment (`POST /api/account/index/teams`, with the key the two share, as a team filter asks). A token's `teams` claim
// can be an hour old, so it is never trusted for this.

import { readTeamsClaim } from '@liveworkspace/auth-client';
import { accountsUrl, type Env } from '../env';

/** The teams a person is an admin of now, or null when accounts can't say (unreachable, no key). */
export type AdminTeams = (personId: string) => Promise<ReadonlySet<string> | null>;

const TIMEOUT_MS = 3_000;

export function accountsAdminTeams(env: Env): AdminTeams {
  return async (personId) => {
    const key = env.MERGE_KEY?.trim();
    if (!key) return null;
    try {
      const res = await fetch(`${accountsUrl(env)}/api/account/index/teams`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: personId }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // An id accounts refuses (a closed account's `deleted`) runs nothing.
      if (res.status === 400) return new Set();
      if (!res.ok) return null;
      const teams = readTeamsClaim(((await res.json()) as { teams?: unknown }).teams) ?? [];
      return new Set(teams.filter((t) => t.role === 'admin').map((t) => t.id));
    } catch {
      return null;
    }
  };
}
