// spec/65: the two opt-out transactional notifications layered on top of the
// spec/64 email feature. Both are best-effort, fired from `ctx.waitUntil` on a
// request made by SOMEONE OTHER than the recipient (a visitor opening a shared
// diagram; an invitee responding to an invite), so the recipient's address
// comes from trusted server state (email_lifecycle / team_members), never the
// caller's headers, and their opt-out is read from user_preferences (spec/20).
//
// Like every spec/64 send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { getNotificationPrefs, getOwnerEmail, listTeamAdminUserIds } from '../db';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import { diagramJoinedEmail, inviteResponseEmail } from './templates';

// Someone opened one of an owner's shared diagrams for the FIRST time
// (recordSharedAccess reported a new row). No-op unless email is on, the owner
// has a stored verified address (a Clerk owner — guests have none), and the
// owner hasn't opted out.
export async function notifyDiagramJoin(
  env: Env,
  diagram: { ownerId: string; name: string },
  joinerName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, diagram.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, diagram.ownerId);
  if (!prefs.notifyDiagramJoin) return;
  await sendEmail(env, { to, ...diagramJoinedEmail(env, diagram.name, joinerName) });
}

// An invitee accepted / declined a team invite. Tells each JOINED admin of the
// team (other than the responder themselves) who has a known address and
// hasn't opted out. Sends run concurrently; each is independently best-effort.
export async function notifyInviteResponse(
  env: Env,
  team: { id: string; name: string },
  responderEmail: string,
  accepted: boolean,
  responderUserId: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const adminIds = await listTeamAdminUserIds(env, team.id);
  await Promise.all(
    adminIds.map(async (adminId) => {
      // Don't notify the responder about their own action (an admin can be
      // re-invited as a member and respond to that).
      if (responderUserId && adminId === responderUserId) return;
      const to = await getOwnerEmail(env, adminId);
      if (!to) return;
      const prefs = await getNotificationPrefs(env, adminId);
      if (!prefs.notifyInviteResponse) return;
      await sendEmail(env, {
        to,
        ...inviteResponseEmail(env, team.name, responderEmail, accepted),
      });
    }),
  );
}
