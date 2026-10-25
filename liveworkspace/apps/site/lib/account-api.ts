// The account pages' side of the account API (liveworkspace/apps/accounts src/account-api.ts), on
// this same origin under /api/account: the signed-in person's teams and API tokens.

import { pageApp } from './explorer/page-app';

export const ACCOUNT_API = '/api/account';

export type TeamRole = 'admin' | 'member';

// One of the first few members a team's card shows.
export interface MemberPreview {
  id: string;
  name: string | null;
  email: string;
  role: TeamRole;
}

export interface MyTeam {
  id: string;
  name: string;
  organisation: string | null;
  role: TeamRole;
  memberCount: number;
  // Invitations still waiting.
  invitedCount: number;
  // Up to four joined members, admins first.
  members: MemberPreview[];
}

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  role: TeamRole;
  invitedByName: string | null;
  createdAt: number;
}

// What a join link opens onto (GET /join/:token), signed in or not.
export interface JoinPreview {
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  alreadyMember: boolean;
  signedIn: boolean;
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
    // On an app's own address (the Explorer, served there) through the app's router, with the page's token.
    const send = pageApp() ? (await import('./explorer/token')).accountFetch : fetch;
    const response = await send(ACCOUNT_API + path, {
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
  invite_not_found: 'This link isn’t valid any more. Ask the team for a new one.',
  already_joined: 'You’re already in this team.',
  rate_limited: 'Too many tries just now. Wait a minute and try again.',
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
