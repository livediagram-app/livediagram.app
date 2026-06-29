// spec/65: server-side read of the email-notification preferences a user
// flipped on the Explorer profile page. They live in the same
// `user_preferences` JSON blob as the editor flags (spec/20) — reusing that
// synced store rather than a parallel table — so this is a read-only slice of
// that blob, used by the api worker to decide whether to send a transactional
// notification email (spec/64) on someone else's request.

import type { Env } from '../types';

// Both flags default to true: a missing key / row / corrupt blob means
// "notify" (the toggles are opt-OUT, mirroring spec/20's notificationsEnabled).
export type NotificationPrefs = {
  notifyDiagramJoin: boolean;
  notifyInviteResponse: boolean;
  notifyComments: boolean;
  notifyTips: boolean;
  notifyMilestones: boolean;
};

const DEFAULTS: NotificationPrefs = {
  notifyDiagramJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyTips: true,
  notifyMilestones: true,
};

// One SELECT + JSON.parse. Reads only the two notification keys; every other
// flag in the blob is ignored here. A guest owner has no profile UI to set
// these, but the read is harmless (returns defaults) so callers don't have to
// branch on owner kind.
export async function getNotificationPrefs(env: Env, ownerId: string): Promise<NotificationPrefs> {
  const row = await env.DB.prepare('SELECT prefs FROM user_preferences WHERE owner_id = ? LIMIT 1')
    .bind(ownerId)
    .first<{ prefs: string }>();
  if (!row?.prefs) return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(row.prefs);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULTS;
    const blob = parsed as Record<string, unknown>;
    return {
      // Only an explicit `false` opts out; anything else (missing,
      // true, or a non-boolean a misbehaving client wrote) means notify.
      notifyDiagramJoin: blob.notifyDiagramJoin !== false,
      notifyInviteResponse: blob.notifyInviteResponse !== false,
      notifyComments: blob.notifyComments !== false,
      notifyTips: blob.notifyTips !== false,
      notifyMilestones: blob.notifyMilestones !== false,
    };
  } catch {
    return DEFAULTS;
  }
}
