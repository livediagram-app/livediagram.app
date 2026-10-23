// Team access for an app on the index (liveworkspace/docs/accounts.md "Teams"): an app keeps no copy of teams.
// Who is in which team is the accounts Worker's; every access token and API token check carries the person's
// teams (`TeamClaim[]`), and the index decides team access from them.
//
// A claim can be older than a team made or joined a moment ago (an access token lives up to an hour; an API
// token's answer is remembered for a minute). So when a request names a team the claim does not hold, or there is
// no claim, `teamsOf` asks accounts for the person's teams as they are now (`POST teams/of`), and the team is
// usable at once. Only a miss asks; a person's answer is remembered for MISS_RECHECK_MS, so a burst of misses
// is one call. When accounts can't be reached, the claim stands.
//
// Leaving a team (or being removed) takes effect for the index when the person's token is next minted: a claim
// is never narrowed here.

import {
  readAccountTeams,
  type ClientCredentials,
  type TeamClaim,
} from '@liveworkspace/auth-client';

// A fresh answer is reused for this long when it, too, lacks the team asked for.
export const MISS_RECHECK_MS = 2_000;
// And for this long when it holds it.
export const FRESH_TEAMS_MS = 30_000;
const CACHE_MAX = 1000;

export const teamIdsOf = (teams: readonly TeamClaim[] | null | undefined): string[] =>
  (teams ?? []).map((t) => t.id);

export type TeamAccess = ReturnType<typeof createTeamAccess>;

// How the teams someone is in now are read: an app with its client credentials (`accountsTeamReader`), the
// index with the key it shares with accounts.
export type TeamReader = (userId: string) => Promise<TeamClaim[]>;

export const accountsTeamReader = (
  credentials: ClientCredentials | null,
  fetcher?: typeof fetch,
): TeamReader | null =>
  credentials ? (userId) => readAccountTeams(credentials, userId, fetcher) : null;

export function createTeamAccess() {
  const cache = new Map<string, { teams: TeamClaim[]; at: number }>();

  async function fresh(read: TeamReader, userId: string, now: number) {
    const teams = await read(userId);
    cache.delete(userId);
    cache.set(userId, { teams, at: now });
    while (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return teams;
  }

  // The person's teams: the claim, or (when it is missing or lacks `need`) the claim with accounts' answer
  // now. A guest (`guest_…`) has none.
  async function teamsOf(
    read: TeamReader | null,
    userId: string,
    claimed: readonly TeamClaim[] | null | undefined,
    need?: string,
    now = Date.now(),
  ): Promise<TeamClaim[]> {
    const base = [...(claimed ?? [])];
    if (!userId.startsWith('user_')) return [];
    if (claimed && (need === undefined || base.some((t) => t.id === need))) return base;
    if (!read) return base;
    const cached = cache.get(userId);
    const holds = cached?.teams.some((t) => t.id === need) ?? false;
    let current: TeamClaim[];
    if (cached && now - cached.at < (holds ? FRESH_TEAMS_MS : MISS_RECHECK_MS))
      current = cached.teams;
    else {
      try {
        current = await fresh(read, userId, now);
      } catch (error) {
        console.warn('[teams] accounts unreachable; the claim stands', { error: String(error) });
        return base;
      }
    }
    const merged = new Map(base.map((t) => [t.id, t]));
    for (const t of current) merged.set(t.id, t);
    return [...merged.values()];
  }

  return {
    teamsOf,
    // Whether the person is in this team now.
    async inTeam(
      read: TeamReader | null,
      userId: string,
      claimed: readonly TeamClaim[] | null | undefined,
      teamId: string,
    ): Promise<boolean> {
      return (await teamsOf(read, userId, claimed, teamId)).some((t) => t.id === teamId);
    },
    clearForTests: () => cache.clear(),
  };
}
