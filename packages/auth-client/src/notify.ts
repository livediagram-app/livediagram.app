// What every app's notification emails share (liveworkspace/docs/accounts.md "Notification emails"):
// the rules each one keeps, and the two questions each asks of accounts before it writes, so the apps
// send them the same way and none keeps addresses, switches or teams of its own.
//
//   - The milestone (the tenth item someone makes in the app) and the first share link: once per account
//     and app, claimed at accounts (`claimMilestone`) before the email goes.
//   - Someone joined my item (they opened it through a link for the first time): at most one email per
//     item per JOIN_NOTIFY_THROTTLE_MS.
//   - An action assigned, and a mention in a comment: once per (sender, item, recipient, wording) for
//     NOTIFY_EMAIL_DEDUPE_MS, and at most NOTIFY_EMAILS_PER_SENDER_PER_HOUR per sender. The recipient must
//     be one of the item's team's people (`readTeamPeople`), never anyone a request names.
//
// Each is best-effort and off the request's path: none of these throws into the caller's write.

import { accountEmails, readNotifySettings, type SettingsApp, type TeamPerson } from './account';
import type { ClientCredentials } from './oauth';

// The item counts that earn a milestone email: the tenth, once per account and app.
export const MILESTONE_ITEM_COUNTS: readonly number[] = [10];

// The highest milestone an account's item count has reached, or null for none (or no count).
export function reachedMilestone(count: number | null): number | null {
  if (count === null) return null;
  let reached: number | null = null;
  for (const m of MILESTONE_ITEM_COUNTS)
    if (count >= m && (reached === null || m > reached)) reached = m;
  return reached;
}
// At most one "someone joined" email per item in this window.
export const JOIN_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
// The same assignment or mention emails once in this window: a replayed request or a retried save
// reaches nobody twice. A day covers any retry.
export const NOTIFY_EMAIL_DEDUPE_MS = 24 * 60 * 60 * 1000;
// At most this many assignment and mention emails per sender an hour: three comments each mentioning
// twenty teammates, far past any real hour, and a ceiling on a scripted session. Safe range 20..200.
export const NOTIFY_EMAILS_PER_SENDER_PER_HOUR = 60;
export const NOTIFY_RATE_WINDOW_MS = 60 * 60 * 1000;

// The claim key for an assignment or mention email: a SHA-256 over what makes two emails the same one,
// so the claim store holds no comment text, action names or addresses.
export async function notifyClaimKey(parts: readonly (string | null)[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ACCOUNT_ID = /^user_[A-Za-z0-9]{1,64}$/;

// Whether an id is an account's (`user_…`): the only kind with an address. A guest is never emailed.
export function isAccountId(id: string): boolean {
  return ACCOUNT_ID.test(id);
}

// Who of these accounts gets an email: those with a verified address whose `setting` is not stored
// `false`, by id. `scope` is where the app keeps the switch: `all` for one every app shares, `app` for
// its own. Two requests at once whatever the count (each splits past 100 ids). Guests and malformed ids
// are dropped first. A switch read that fails counts as on, as a missing one does; an address read that
// fails means nobody (and throws nothing).
export async function notificationRecipients(
  credentials: ClientCredentials,
  request: { app: SettingsApp; ids: readonly string[]; setting: string; scope: 'all' | 'app' },
  fetcher: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const ids = [...new Set(request.ids.filter(isAccountId))];
  if (ids.length === 0) return new Map();
  const [emails, settings] = await Promise.allSettled([
    accountEmails(credentials, ids, fetcher),
    readNotifySettings(
      credentials,
      { owners: ids, app: request.app, keys: [request.setting] },
      fetcher,
    ),
  ]);
  if (emails.status === 'rejected') {
    console.warn('[notify] emails_failed', { count: ids.length, error: String(emails.reason) });
    return new Map();
  }
  if (settings.status === 'rejected') {
    console.warn('[notify] settings_failed', { error: String(settings.reason) });
  }
  const stored = settings.status === 'fulfilled' ? settings.value : {};
  const out = new Map<string, string>();
  for (const id of ids) {
    const address = emails.value[id];
    if (!address) continue;
    if (stored[id]?.[request.scope]?.[request.setting] === false) continue;
    out.set(id, address);
  }
  return out;
}

// Someone a mention or an assignment names: an account id, or a membership row id for someone invited.
export type NotifyTarget = { userId?: string | null; memberId?: string | null };

// The team's people these targets name, once each, never `exclude` (the sender): a membership row id
// first (it holds across an invitation being accepted), then an account id. Anyone the team doesn't
// hold is dropped, so a request can only ever reach the item's own team.
export function teamTargets(
  people: readonly TeamPerson[],
  targets: readonly NotifyTarget[],
  exclude: string,
): TeamPerson[] {
  const byMember = new Map(people.map((p) => [p.id, p]));
  const byUser = new Map(people.filter((p) => p.userId).map((p) => [p.userId!, p]));
  const out = new Map<string, TeamPerson>();
  for (const t of targets) {
    const hit =
      (t.memberId ? byMember.get(t.memberId) : undefined) ??
      (t.userId ? byUser.get(t.userId) : undefined);
    if (!hit || hit.userId === exclude) continue;
    out.set(hit.id, hit);
  }
  return [...out.values()];
}
