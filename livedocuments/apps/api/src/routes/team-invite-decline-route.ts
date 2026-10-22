// /api/teams/invite-decline/<token> (docs/specs/013-workspace/teams.md "Declining from the email"): the two
// open doors behind an invite email's Decline link. No sign-in: the invitee may not have an account. The token
// is the only credential and it is single-purpose, so these routes read that one invite's team name and
// state (GET) and decline it (POST), and nothing else. GET never writes, so a mail client's link scanner
// opening the landing page changes nothing; only the page's button POSTs. Limited per network in index.ts
// (TEAM_INVITE_RATE_LIMITER).

import {
  declineTeamInvite,
  resolveDeclineToken,
  teamInviteStatus,
} from '../db/team-invite-decline';
import { notifyInviteResponse } from '../email/notifications';
import { conflict, json, notFound } from '../responses';
import { recordInviteDeclined } from '../timeline';
import type { RouteContext } from './context';
import { memberDisplayName } from './team-member-name';

function inviteNotFound(): Response {
  return json({ error: 'invite_not_found' }, { status: 404 });
}

export async function handleTeamInviteDecline(ctx: RouteContext, token: string): Promise<Response> {
  const { request, env } = ctx;
  if (request.method !== 'GET' && request.method !== 'POST') return notFound();
  const invite = await resolveDeclineToken(env, token);
  if (!invite) return inviteNotFound();
  if (request.method === 'GET') {
    return json({ teamName: invite.teamName, status: invite.status });
  }
  // The token cannot undo a membership: once they joined, Leave team is how they go.
  if (invite.status === 'joined') return conflict('already_joined');
  if (invite.status === 'invited' && (await declineTeamInvite(env, invite.memberId))) {
    // Only the request that flipped the row tells anyone, exactly as an in-app decline does: the admins'
    // Timeline card and their invite-response email (opt-out per admin). Off the response path.
    const team = { id: invite.teamId, name: invite.teamName };
    const name = memberDisplayName({ email: invite.email });
    ctx.waitUntil?.(recordInviteDeclined(env, team, invite.userId, name));
    if (invite.email) {
      ctx.waitUntil?.(
        notifyInviteResponse(env, team, invite.email, false, invite.userId).catch(() => {}),
      );
    }
    console.log('[team-invites] declined from the email');
    return json({ teamName: invite.teamName, status: 'declined' });
  }
  // Already answered (declined, expired), or a race just answered it: say where it stands. Idempotent.
  const status = (await teamInviteStatus(env, invite.memberId)) ?? invite.status;
  if (status === 'joined') return conflict('already_joined');
  return json({ teamName: invite.teamName, status });
}
