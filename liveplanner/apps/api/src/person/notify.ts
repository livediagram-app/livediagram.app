// What liveplanner's notification emails ask of liveworkspace (liveworkspace/docs/accounts.md "Notification
// emails"; the shared rules are @liveworkspace/auth-client's notify.ts): who gets one (a verified address and
// the switch not off, for many people in two requests), a team's people (whom a mention or an assignment may
// reach), a once-per-account milestone claim, and how many plans someone has made (the index). liveplanner
// keeps none of it. None of these throws: without the accounts Worker or the index, or when one can't be
// reached, each answers as though there were nobody (and logs).

import {
  claimMilestone,
  notificationRecipients,
  readTeamPeople,
  type Milestone,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { countOwnedItems } from '@liveworkspace/index-client';
import { isAllSetting } from '@liveworkspace/settings';
import { accountCredentials } from '../auth/accounts';
import { indexApiUrl, INDEX_APP } from '../index-service';
import type { Env } from '../types';
import { SETTINGS_APP } from './settings';
import { isAccountId } from '@liveworkspace/auth-client';

// The email switches liveplanner reads at accounts (docs/specs/014-identity/profile-and-email-notifications.md).
export type NotifySetting =
  'notifyMilestones' | 'notifyProjectJoin' | 'notifyActionAssigned' | 'notifyMentions';

// The verified addresses of these accounts who have not turned `setting` off, by id. Guests are dropped.
export async function notifyRecipients(
  env: Env,
  ids: readonly string[],
  setting: NotifySetting,
): Promise<Map<string, string>> {
  const credentials = accountCredentials(env);
  const accounts = ids.filter(isAccountId);
  if (!credentials || accounts.length === 0) return new Map();
  try {
    return await notificationRecipients(credentials, {
      app: SETTINGS_APP,
      ids: accounts,
      setting,
      scope: isAllSetting(setting) ? 'all' : 'app',
    });
  } catch (error) {
    console.warn('[notify] recipients_failed', { setting, error: String(error) });
    return new Map();
  }
}

// A team's joined and invited people, or null for no such team (or no accounts Worker).
export async function teamPeople(env: Env, teamId: string): Promise<TeamPerson[] | null> {
  const credentials = accountCredentials(env);
  if (!credentials) return null;
  try {
    return (await readTeamPeople(credentials, teamId))?.members ?? null;
  } catch (error) {
    console.warn('[notify] team_people_failed', { error: String(error) });
    return null;
  }
}

// Claims a one-time milestone email at accounts: true for the first claim only.
export async function claimOwnerMilestone(
  env: Env,
  ownerId: string,
  milestone: Milestone,
): Promise<boolean> {
  const credentials = accountCredentials(env);
  if (!credentials || !isAccountId(ownerId)) return false;
  try {
    return await claimMilestone(credentials, { userId: ownerId, milestone });
  } catch (error) {
    console.warn('[notify] milestone_claim_failed', { milestone, error: String(error) });
    return false;
  }
}

// How many plans this person has made (the index's count, the Trash's included), up to `limit`. Null when the
// index can't be asked.
export async function plansMadeBy(
  env: Env,
  ownerId: string,
  limit: number,
): Promise<number | null> {
  const baseUrl = indexApiUrl(env);
  if (!baseUrl || !env.INDEX_KEY) return null;
  try {
    return await countOwnedItems({ app: INDEX_APP, key: env.INDEX_KEY, baseUrl }, ownerId, limit);
  } catch (error) {
    console.warn('[notify] plan_count_failed', { error: String(error) });
    return null;
  }
}
