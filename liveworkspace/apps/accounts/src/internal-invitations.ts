// The invitations waiting for an account, for an app's server (liveworkspace/docs/accounts.md "The
// API"): `POST /api/account/internal/invitations` `{ userId }`. An app shows them in its Invites view
// with a link to /account/teams, where they are answered; it never answers one itself.
//
// The app vouches for the account, as it does for settings and emails: an id it has already verified
// (an access token's sub, or an API token's owner). What comes back is what the person sees on
// /account/teams: the team's name, organisation and joined-member count, the role offered, who invited
// them and when. An account with no verified address has none waiting (an invitation is to an address,
// and only a verified one may accept it).
//
// One indexed read for the address and one for the invitations (team_member_email_idx).

import { USER_ID } from './ids.ts';
import { listMyInvitations, type Invitation } from './teams.ts';

export type InvitationsAnswer =
  | { ok: true; invitations: Invitation[] }
  | { ok: false; status: number; error: string };

export async function pendingInvitations(
  db: D1Database,
  body: Record<string, unknown>,
): Promise<InvitationsAnswer> {
  const { userId } = body;
  if (typeof userId !== 'string' || !USER_ID.test(userId)) {
    return { ok: false, status: 400, error: 'invalid_user' };
  }
  const user = await db
    .prepare('SELECT email, emailVerified FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ email: string; emailVerified: number }>();
  if (!user?.emailVerified) return { ok: true, invitations: [] };
  return { ok: true, invitations: await listMyInvitations(db, user.email.toLowerCase()) };
}
