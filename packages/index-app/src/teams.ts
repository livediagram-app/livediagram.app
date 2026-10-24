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
  createTeamFor,
  readAccountTeams,
  TeamError,
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

// ---------- New Team: POST /api/teams `{ name, organisation? }` in every app's API --------------------------------
// Makes a team for the person signed in, on liveworkspace, with them as its admin (liveworkspace/docs/accounts.md
// "Teams", createTeamFor): the same team on liveworkspace.app and in every app, managed there. It is usable at
// once, since a team the caller's token does not name yet is asked of accounts (createTeamAccess above, and the
// index's own check). The app checks the interactive session (an API token or a workbench can't make one) and
// hands over the access token the person sent, which vouches for them; this answers the rest.

// A team's name and organisation, as liveworkspace caps them: longer is cut, as it cuts them.
export const TEAM_NAME_MAX = 80;
export const TEAM_ORGANISATION_MAX = 80;

export type MadeTeam = {
  id: string;
  name: string;
  organisation: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MakeTeamAnswer =
  { status: 201; body: { team: MadeTeam } } | { status: number; body: { error: string } };

/** Makes the team `body` names for the person whose `accessToken` it is, and answers the route's status and body:
 *  201 `{ team }`, 400 for a missing name, liveworkspace's own refusal (400, 401, 409) passed on, and 503 when
 *  sign-in is not configured or liveworkspace is out of reach. */
export async function makeTeamFor(
  credentials: ClientCredentials | null,
  accessToken: string,
  body: unknown,
  now = Date.now(),
  fetcher?: typeof fetch,
): Promise<MakeTeamAnswer> {
  if (!credentials) return { status: 503, body: { error: 'teams_not_configured' } };
  const { name: rawName, organisation: rawOrganisation } = (body ?? {}) as {
    name?: unknown;
    organisation?: unknown;
  };
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, TEAM_NAME_MAX) : '';
  if (!name) return { status: 400, body: { error: 'name_required' } };
  const organisation =
    typeof rawOrganisation === 'string'
      ? rawOrganisation.trim().slice(0, TEAM_ORGANISATION_MAX) || null
      : null;
  try {
    const made = await createTeamFor(credentials, { accessToken, name, organisation }, fetcher);
    console.info('[teams] created');
    return {
      status: 201,
      body: {
        team: {
          id: made.id,
          name: made.name,
          organisation: made.organisation,
          createdAt: now,
          updatedAt: now,
        },
      },
    };
  } catch (err) {
    if (err instanceof TeamError) {
      console.warn('[teams] create_refused', { status: err.status, code: err.code });
      return { status: err.status, body: { error: err.code } };
    }
    console.error('[teams] create_failed', String(err));
    return { status: 503, body: { error: 'teams_unavailable' } };
  }
}
