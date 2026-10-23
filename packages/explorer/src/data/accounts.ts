// What the Explorer reads from liveworkspace accounts (liveworkspace/docs/accounts.md "The API"): a team's
// members for its page, the person's teams with their member counts and the invitations waiting for them, and
// other people's display names for the Owner column. The Explorer lives on liveworkspace.app, so these are the
// signed-in person's own routes on its origin (`/api/account/*`, by the session cookie). A host elsewhere passes
// its own `ExplorerAccounts`, or none, and the Explorer goes without.

export type TeamRole = 'admin' | 'member';

export type TeamMember = {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: TeamRole;
  status: 'invited' | 'joined' | 'declined';
  expired?: boolean;
};

export type TeamDetails = {
  team: {
    id: string;
    name: string;
    organisation: string | null;
    myRole: TeamRole;
    myMemberId: string;
  };
  members: TeamMember[];
};

/** An invitation waiting for the person: accepted or declined on liveworkspace.app. */
export type PendingInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  invitedByName: string | null;
  memberCount: number;
};

export type MyTeams = {
  teams: { id: string; name: string; memberCount: number }[];
  invitations: PendingInvitation[];
};

export type ExplorerAccounts = {
  /** A team's members, or null when the person is not in it (gone, or never joined). */
  teamMembers: (teamId: string, signal?: AbortSignal) => Promise<TeamDetails | null>;
  /** The person's teams with their member counts, and the invitations waiting for them. */
  myTeams: (signal?: AbortSignal) => Promise<MyTeams>;
  /** Display names by person id (up to PEOPLE_MAX a call); ids with none are left out. */
  people: (ids: readonly string[], signal?: AbortSignal) => Promise<Map<string, string | null>>;
};

export const PEOPLE_MAX = 100;

export class AccountsError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`accounts: ${status}`);
    this.name = 'AccountsError';
    this.status = status;
  }
}

/** The signed-in person's accounts routes on this origin (liveworkspace.app). */
export function createExplorerAccounts({
  baseUrl = '/api/account',
  fetch: doFetch,
}: { baseUrl?: string; fetch?: typeof fetch } = {}): ExplorerAccounts {
  const base = baseUrl.replace(/\/+$/, '');
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await (doFetch ?? fetch)(`${base}${path}`, {
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) throw new AccountsError(res.status);
    return (await res.json()) as T;
  }
  return {
    teamMembers: async (teamId, signal) => {
      try {
        return await get<TeamDetails>(`/teams/${encodeURIComponent(teamId)}/members`, signal);
      } catch (e) {
        if (e instanceof AccountsError && (e.status === 404 || e.status === 403)) return null;
        throw e;
      }
    },
    myTeams: async (signal) => {
      const res = await get<{
        teams: { id: string; name: string; memberCount: number }[];
        invitations: PendingInvitation[];
      }>('/teams', signal);
      return {
        teams: res.teams.map((t) => ({ id: t.id, name: t.name, memberCount: t.memberCount })),
        invitations: res.invitations,
      };
    },
    people: async (ids, signal) => {
      const out = new Map<string, string | null>();
      const unique = [...new Set(ids)].slice(0, PEOPLE_MAX);
      if (unique.length === 0) return out;
      const res = await get<{ people: { id: string; name: string | null }[] }>(
        `/people?ids=${unique.map(encodeURIComponent).join(',')}`,
        signal,
      );
      for (const p of res.people) out.set(p.id, p.name);
      return out;
    },
  };
}
