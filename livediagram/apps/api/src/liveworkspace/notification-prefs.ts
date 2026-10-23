// The email-notification switches someone flipped in Settings (docs/specs/014-identity/
// profile-and-email-notifications.md), read before this app sends them a notification
// (docs/specs/014-identity/transactional-email.md) on somebody else's request. They are preferences
// like any other, kept by liveworkspace (liveworkspace/settings.ts): most in the `all` scope, so
// turning one off in any app turns it off here; `notifyDocumentJoin` is this app's own.

import { upgradeLegacyPreferences } from '@livediagram/api-schema';
import type { Env } from '../types';
import { readPreferences } from './settings';

// Every switch defaults to on: a missing key, no settings, or liveworkspace out of reach means
// "notify" (the toggles are opt-OUT, as docs/specs/007-editor/user-preferences.md's
// notificationsEnabled).
export type NotificationPrefs = {
  notifyDocumentJoin: boolean;
  notifyInviteResponse: boolean;
  notifyComments: boolean;
  notifyMilestones: boolean;
  notifyActionAssigned: boolean;
  notifyMentions: boolean;
};

const DEFAULTS: NotificationPrefs = {
  notifyDocumentJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyMilestones: true,
  notifyActionAssigned: true,
  notifyMentions: true,
};

// One accounts call. Never throws: a failed read sends, as a missing switch would.
export async function getNotificationPrefs(env: Env, ownerId: string): Promise<NotificationPrefs> {
  let stored: Record<string, unknown> | null;
  try {
    stored = await readPreferences(env, ownerId);
  } catch (err) {
    console.warn('[notification-prefs] read_failed', String(err));
    return DEFAULTS;
  }
  if (!stored) return DEFAULTS;
  const blob = upgradeLegacyPreferences(stored);
  // Only an explicit `false` opts out; anything else (missing, true, or a non-boolean a misbehaving
  // client wrote) means notify.
  return {
    notifyDocumentJoin: blob.notifyDocumentJoin !== false,
    notifyInviteResponse: blob.notifyInviteResponse !== false,
    notifyComments: blob.notifyComments !== false,
    notifyMilestones: blob.notifyMilestones !== false,
    notifyActionAssigned: blob.notifyActionAssigned !== false,
    notifyMentions: blob.notifyMentions !== false,
  };
}
