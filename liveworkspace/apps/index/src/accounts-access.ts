// Who is in and who runs a team, and what people are called, as accounts says now (`POST /api/account/index/teams`
// and `/people`, with the key the two share). Team webhooks ask whether the person is an admin of the team at that
// moment, and a mention whether the mentioned person is one of the item's team's people
// (liveworkspace/docs/specs/004-index/webhooks.md "Who adds one", "Security"); the team audit log asks who runs the
// team and names its people (team-audit-log.md "Who reads it"). A token's `teams` claim can be an hour old, so it is
// never trusted for this.

import { readTeamsClaim, type TeamClaim } from '@liveworkspace/auth-client';
import { accountsUrl, type Env } from './env';

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

/** People's display names now, by id (a closed account's, or one accounts doesn't know, absent), or null when
 *  accounts can't say. */
export type PeopleNames = (ids: readonly string[]) => Promise<ReadonlyMap<string, string> | null>;

// Accounts names at most this many a call (its MAX_PROFILE_IDS), and the index makes at most this many at once.
export const NAMES_PER_CALL = 100;
const NAMES_CALLS_AT_ONCE = 4;

// One call's names: `POST /api/account/index/people`, the shared key.
async function namesNow(env: Env, key: string, ids: string[]): Promise<[string, string][] | null> {
  try {
    const res = await fetch(`${accountsUrl(env)}/api/account/index/people`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { people } = (await res.json()) as { people?: { id?: unknown; name?: unknown }[] };
    return (people ?? []).flatMap((p) =>
      typeof p.id === 'string' && typeof p.name === 'string'
        ? [[p.id, p.name] as [string, string]]
        : [],
    );
  } catch {
    return null;
  }
}

export function accountsPeopleNames(env: Env): PeopleNames {
  return async (ids) => {
    const key = env.MERGE_KEY?.trim();
    if (!key) return null;
    const unique = [...new Set(ids)];
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += NAMES_PER_CALL) {
      chunks.push(unique.slice(i, i + NAMES_PER_CALL));
    }
    const names = new Map<string, string>();
    for (let i = 0; i < chunks.length; i += NAMES_CALLS_AT_ONCE) {
      const answers = await Promise.all(
        chunks.slice(i, i + NAMES_CALLS_AT_ONCE).map((chunk) => namesNow(env, key, chunk)),
      );
      for (const answer of answers) {
        if (!answer) return null;
        for (const [id, name] of answer) names.set(id, name);
      }
    }
    return names;
  };
}

export function accountsPersonTeams(env: Env): PersonTeams {
  return async (personId) => {
    const teams = await teamsNow(env, personId);
    return teams && new Set(teams.map((t) => t.id));
  };
}
