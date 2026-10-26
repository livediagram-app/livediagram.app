// Teams, run in the Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): the person's
// teams and the invitations waiting for them, one team's members and join link, and every change to a team. They
// are liveworkspace accounts' routes (liveworkspace/docs/specs/003-accounts/accounts.md "The API"), the same team in every app. The host
// hands them over as a `TeamsHost`, built here once for every host: on liveworkspace.app by the session cookie, on an
// app's address and in an editor through the app's router (`/api/workspace/account`) by the app's access token.

import type { TeamRef } from '../types';

export type TeamRole = 'admin' | 'member';

export type TeamMember = {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: TeamRole;
  status: 'invited' | 'joined' | 'declined';
  // An invitation nobody answered in 28 days.
  expired?: boolean;
  createdAt?: number;
  // A joined member's published Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), read with the
  // members list; null or absent for none.
  picture?: string | null;
};

/** The team's join link, for its admins: anyone signed in who opens it joins as a member, until it ends. */
export type InviteLink = { url: string; expiresAt: number };

export type TeamDetails = {
  team: {
    id: string;
    name: string;
    organisation: string | null;
    myRole: TeamRole;
    myMemberId: string;
  };
  members: TeamMember[];
  // Only an admin is told it; null when it is off (or for a member).
  inviteLink?: InviteLink | null;
};

/** An invitation waiting for the person, answered in the Explorer's Invites. */
export type PendingInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  organisation?: string | null;
  role: TeamRole;
  invitedByName: string | null;
  memberCount: number;
  // When the invitation was sent.
  createdAt?: number;
};

export type MyTeams = {
  teams: { id: string; name: string; memberCount: number }[];
  invitations: PendingInvitation[];
};

/** A change's answer: what it made, or the account API's error code (teamErrorMessage words it). */
export type TeamResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type RemovedMember = { teamDeleted: boolean; removed: 'self' | 'invite' | 'member' };

export type AnsweredInvitation = {
  teamId: string;
  teamName: string;
  status: 'joined' | 'declined';
};

export type TeamsHost = {
  /** The person's teams with their member counts, and the invitations waiting for them. */
  myTeams: (signal?: AbortSignal) => Promise<MyTeams>;
  /** A team's members (and, for an admin, its join link), or null when the person is not in it. */
  team: (teamId: string, signal?: AbortSignal) => Promise<TeamDetails | null>;
  create: (input: { name: string; organisation?: string | null }) => Promise<TeamResult<TeamRef>>;
  update: (
    teamId: string,
    patch: { name?: string; organisation?: string | null },
  ) => Promise<TeamResult<TeamRef & { organisation: string | null }>>;
  remove: (teamId: string) => Promise<TeamResult<null>>;
  invite: (
    teamId: string,
    input: { email: string; role: TeamRole },
  ) => Promise<TeamResult<TeamMember>>;
  setRole: (teamId: string, memberId: string, role: TeamRole) => Promise<TeamResult<null>>;
  /** Removes a member, withdraws or clears an invitation, or (one's own row) leaves. */
  removeMember: (teamId: string, memberId: string) => Promise<TeamResult<RemovedMember>>;
  /** Turns the join link on, or makes a new one (the old stops working). */
  resetInviteLink: (teamId: string) => Promise<TeamResult<InviteLink>>;
  clearInviteLink: (teamId: string) => Promise<TeamResult<null>>;
  answer: (invitationId: string, accept: boolean) => Promise<TeamResult<AnsweredInvitation>>;
  /** A team was made, joined, renamed, left or deleted: the host renews its token, so it names the teams anew. */
  onTeamsChanged?: () => void | Promise<void>;
};

const MESSAGES: Record<string, string> = {
  name_required: 'Give the team a name.',
  email_invalid: 'That doesn’t look like an email address.',
  already_invited: 'That address is already in the team, or invited.',
  member_limit_reached: 'A team can have up to 200 members and invitations.',
  team_limit_reached: 'You can be in up to 50 teams.',
  last_admin: 'A team needs an admin. Make someone else an admin first.',
  admin_only: 'Only the team’s admins can do that.',
  role_invalid: 'Choose Member or Admin.',
  email_unverified: 'Sign in with the invited address to answer this.',
  not_found: 'That’s no longer there. It may have changed elsewhere.',
  rate_limited: 'Too many tries just now. Wait a minute and try again.',
  signed_out: 'You’ve been signed out. Sign in again to carry on.',
  offline: 'Couldn’t reach liveworkspace. Check your connection and try again.',
};

/** A change's refusal, in words. */
export function teamErrorMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

export class TeamsError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`teams: ${status}`);
    this.name = 'TeamsError';
    this.status = status;
  }
}

export type TeamsHostOptions = {
  /** The account API, `/api/account` (liveworkspace.app) by default; `/api/workspace/account` through an app's
   *  router. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** The person's bearer (an app's access token). Without it the request carries this origin's cookie. */
  token?: () => Promise<string | null>;
  onTeamsChanged?: () => void | Promise<void>;
};

const id = encodeURIComponent;

export function createTeamsHost({
  baseUrl = '/api/account',
  fetch: doFetch,
  token,
  onTeamsChanged,
}: TeamsHostOptions = {}): TeamsHost {
  const base = baseUrl.replace(/\/+$/, '');

  async function send(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers = new Headers();
    if (body !== undefined) headers.set('content-type', 'application/json');
    const bearer = token ? await token() : null;
    if (token && !bearer) return new Response(null, { status: 401 });
    if (bearer) headers.set('authorization', `Bearer ${bearer}`);
    return (doFetch ?? fetch)(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: bearer ? 'omit' : 'same-origin',
      signal,
    });
  }

  async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await send(path, 'GET', undefined, signal);
    if (!res.ok) throw new TeamsError(res.status);
    return (await res.json()) as T;
  }

  async function change<T>(
    path: string,
    method: string,
    body?: unknown,
    shape: (raw: unknown) => T = (raw) => raw as T,
  ): Promise<TeamResult<T>> {
    let res: Response;
    try {
      res = await send(path, method, body);
    } catch {
      return { ok: false, error: 'offline' };
    }
    const raw = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (!res.ok) {
      const error =
        typeof raw?.error === 'string' ? raw.error : res.status === 401 ? 'signed_out' : 'failed';
      return { ok: false, error };
    }
    return { ok: true, value: shape(raw) };
  }

  const none = () => null;

  return {
    myTeams: async (signal) => {
      const res = await read<MyTeams>('/teams', signal);
      return {
        teams: res.teams.map((t) => ({ id: t.id, name: t.name, memberCount: t.memberCount })),
        invitations: res.invitations,
      };
    },
    team: async (teamId, signal) => {
      try {
        return await read<TeamDetails>(`/teams/${id(teamId)}/members`, signal);
      } catch (e) {
        if (e instanceof TeamsError && (e.status === 404 || e.status === 403)) return null;
        throw e;
      }
    },
    create: ({ name, organisation }) =>
      change('/teams', 'POST', { name, organisation: organisation ?? null }, (raw) => {
        const t = raw as { id: string; name: string };
        return { id: t.id, name: t.name };
      }),
    update: (teamId, patch) =>
      change(`/teams/${id(teamId)}`, 'PATCH', patch, (raw) => {
        const t = raw as { id: string; name: string; organisation: string | null };
        return { id: t.id, name: t.name, organisation: t.organisation ?? null };
      }),
    remove: (teamId) => change(`/teams/${id(teamId)}`, 'DELETE', undefined, none),
    invite: (teamId, input) => change(`/teams/${id(teamId)}/members`, 'POST', input),
    setRole: (teamId, memberId, role) =>
      change(`/teams/${id(teamId)}/members/${id(memberId)}`, 'PATCH', { role }, none),
    removeMember: (teamId, memberId) =>
      change(`/teams/${id(teamId)}/members/${id(memberId)}`, 'DELETE', undefined, (raw) => {
        const r = raw as RemovedMember;
        return { teamDeleted: r.teamDeleted === true, removed: r.removed };
      }),
    resetInviteLink: (teamId) => change(`/teams/${id(teamId)}/invite-link`, 'POST'),
    clearInviteLink: (teamId) =>
      change(`/teams/${id(teamId)}/invite-link`, 'DELETE', undefined, none),
    answer: (invitationId, accept) =>
      change(
        `/invitations/${id(invitationId)}/${accept ? 'accept' : 'decline'}`,
        'POST',
        undefined,
        (raw) => {
          const r = raw as AnsweredInvitation;
          return { teamId: r.teamId, teamName: r.teamName, status: r.status };
        },
      ),
    onTeamsChanged,
  };
}
