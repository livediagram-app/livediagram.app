// The account pages' side of the account API (liveworkspace/apps/accounts src/account-api.ts), on
// this same origin under /api/account: the signed-in person's teams and API tokens.

export const ACCOUNT_API = '/api/account';

export type TeamRole = 'admin' | 'member';

export interface MyTeam {
  id: string;
  name: string;
  role: TeamRole;
  memberCount: number;
}

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  invitedByName: string | null;
  createdAt: number;
}

export interface Member {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: TeamRole;
  status: 'invited' | 'joined';
  createdAt: number;
}

export interface TeamDetail {
  team: { id: string; name: string; myRole: TeamRole; myMemberId: string };
  members: Member[];
}

export interface ApiToken {
  id: string;
  name: string;
  readOnly: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function accountApi<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(ACCOUNT_API + path, {
      method,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: response.status,
      error: typeof data.error === 'string' ? data.error : 'failed',
    };
  } catch {
    return { ok: false, status: 0, error: 'offline' };
  }
}

// What to tell the person when the API says no.
const MESSAGES: Record<string, string> = {
  name_required: 'Give it a name.',
  email_invalid: 'That doesn’t look like an email address.',
  already_invited: 'That address is already in the team, or invited.',
  member_limit_reached: 'A team can have up to 200 members and invitations.',
  team_limit_reached: 'You can be in up to 50 teams.',
  token_limit_reached: 'You can have up to 20 tokens. Revoke one to make another.',
  last_admin: 'A team needs an admin. Make someone else an admin first.',
  admin_only: 'Only the team’s admins can do that.',
  email_unverified: 'Sign in with the invited address to answer this.',
  not_found: 'That’s no longer there. It may have changed elsewhere.',
  signed_out: 'You’ve been signed out. Sign in again to carry on.',
  offline: 'Couldn’t reach liveworkspace. Check your connection and try again.',
};

export function errorMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(ms: number): string {
  return DATE.format(ms);
}
