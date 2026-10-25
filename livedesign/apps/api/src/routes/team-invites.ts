// GET /api/teams/invites (docs/specs/013-workspace/teams.md "Invitations"): the team invitations waiting
// for the caller. They live and are answered on liveworkspace.app (liveworkspace/docs/accounts.md
// "Invitations"); this lists them for the Explorer's Invites view and its sidebar badge, read from
// liveworkspace (pendingInvitationsFor in @liveworkspace/auth-client, remembered per isolate for 30
// seconds, so an Explorer load costs at most one call there).
//
// Quiet on failure: without accounts configured, or with liveworkspace out of reach, the list is empty
// rather than an error, as there was nothing here to show before.

import type { TeamInvite } from '@livedesign/api-schema';
import { pendingInvitationsFor } from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import { json } from '../responses';
import type { RouteContext } from './context';

export async function listTeamInvites(ctx: RouteContext, userId: string): Promise<Response> {
  const credentials = accountCredentials(ctx.env);
  if (!credentials) return json({ invites: [] });
  let invites: TeamInvite[];
  try {
    invites = (await pendingInvitationsFor(credentials, userId)).map((invitation) => ({
      memberId: invitation.id,
      team: {
        id: invitation.teamId,
        name: invitation.teamName,
        organisation: invitation.organisation,
        createdAt: invitation.createdAt,
        updatedAt: invitation.createdAt,
      },
      memberCount: invitation.memberCount,
      invitedAt: invitation.createdAt,
      role: invitation.role,
      invitedByName: invitation.invitedByName,
    }));
  } catch (err) {
    console.warn('[teams] invites_unavailable', String(err));
    invites = [];
  }
  return json({ invites });
}
