// What livehuddle's notification emails ask of liveworkspace (liveworkspace/docs/specs/003-accounts/accounts.md "Notification
// emails"; the shared rules are @liveworkspace/auth-client's notify.ts): who gets one (a verified address and the
// switch not off, for many people in two requests) and how many canvases someone has made (the index). livehuddle
// keeps none of it. Neither throws: without the accounts Worker or the index, or when one can't be reached, each
// answers as though there were nobody (and logs). A team's people are team-people.ts; the milestone claim
// emails.ts.

import { notificationRecipients } from '@liveworkspace/auth-client';
import { countOwnedItems } from '@liveworkspace/index-client';
import { isAllSetting } from '@liveworkspace/settings';
import { isAccountIdShape } from '@livehuddle/api-schema';
import { accountCredentials } from '../auth/accounts';
import { indexApiUrl, INDEX_APP } from '../index-service';
import type { Env } from '../types';
import { LIVEHUDDLE_SETTINGS_APP } from './settings';

// The email switches livehuddle reads at accounts (docs/specs/014-identity/profile-and-email-notifications.md).
export type NotifySetting =
  | 'notifyMilestones'
  | 'notifyDocumentJoin'
  | 'notifyActionAssigned'
  | 'notifyMentions'
  | 'notifyComments';

// The verified addresses of these accounts who have not turned `setting` off, by id. Guests are dropped.
export async function notifyRecipients(
  env: Env,
  ids: readonly string[],
  setting: NotifySetting,
): Promise<Map<string, string>> {
  const credentials = accountCredentials(env);
  const accounts = ids.filter(isAccountIdShape);
  if (!credentials || accounts.length === 0) return new Map();
  try {
    return await notificationRecipients(credentials, {
      app: LIVEHUDDLE_SETTINGS_APP,
      ids: accounts,
      setting,
      scope: isAllSetting(setting) ? 'all' : 'app',
    });
  } catch (error) {
    console.warn('[notify] recipients_failed', { setting, error: String(error) });
    return new Map();
  }
}

// How many canvases this person has made (the index's count, the Trash's included), up to `limit`. Null when the
// index can't be asked.
export async function canvasesMadeBy(
  env: Env,
  ownerId: string,
  limit: number,
): Promise<number | null> {
  const baseUrl = indexApiUrl(env);
  if (!baseUrl || !env.INDEX_KEY) return null;
  try {
    return await countOwnedItems({ app: INDEX_APP, key: env.INDEX_KEY, baseUrl }, ownerId, limit);
  } catch (error) {
    console.warn('[notify] canvas_count_failed', { error: String(error) });
    return null;
  }
}
