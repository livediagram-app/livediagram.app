// The All view shows the Account section once (liveworkspace/docs/site.md "Settings", "The Account section shows
// once"). Each editor's own Settings carries Account, Notifications, API Tokens, Privacy and Accessibility categories
// of its own, and each app's catalogue an Account › Notifications; listed under the app as well, the account read
// twice. Here an app's copies are folded into the Account section's category of the same name: the rows the Account
// section doesn't already hold (an editor's Trash and Delete Account, an app's own email switches, its own
// accessibility rows) join it under a heading with the app's name, and the editor's identity row gives way to the
// Profile's header card.
import type { SettingsCategory, SettingsRow } from './model';

// An app's category ids that are the Account section's, by the Account section's own id for them.
const FOLDED: Readonly<Record<string, string>> = {
  account: 'account',
  notifications: 'notifications',
  tokens: 'tokens',
  privacy: 'privacy',
  accessibility: 'accessibility',
};

// An editor's own rows the Account section draws itself: its identity card is the Profile's header.
const DRAWN_BY_ACCOUNT = new Set(['identity']);

const local = (group: string, id: string) =>
  id.startsWith(`${group}:`) ? id.slice(group.length + 1) : id;

/**
 * Moves an app's account categories (already filed under the app's heading, `groupCategories`) into the Account
 * section's (filed under `accountGroup`). Returns the app's categories left; `account` is changed in place, so the
 * next app folds into what this one left.
 */
export function foldIntoAccount({
  account,
  accountGroup,
  app,
  appGroup,
  appName,
}: {
  account: SettingsCategory[];
  accountGroup: string;
  app: readonly SettingsCategory[];
  appGroup: string;
  appName: string;
}): SettingsCategory[] {
  const left: SettingsCategory[] = [];
  const profileId = `${accountGroup}:account`;
  for (const category of app) {
    const id = local(appGroup, category.id);
    const target = FOLDED[id];
    if (!target) {
      left.push(category);
      continue;
    }
    const rows: SettingsRow[] = category.rows
      .filter((row) => !DRAWN_BY_ACCOUNT.has(local(appGroup, row.key)))
      // The Profile keeps an editor's own sections (Your Data, Cloud Sync, Danger Zone), which only an editor has;
      // anywhere else the app's rows sit under its name, beside the Account section's own.
      .map((row) => (target === 'account' ? row : { ...row, section: appName }));
    if (rows.length === 0) continue;
    const targetId = `${accountGroup}:${target}`;
    const at = account.findIndex((c) => c.id === targetId);
    if (at >= 0) {
      const existing = account[at]!;
      account[at] = { ...existing, rows: [...existing.rows, ...rows] };
      continue;
    }
    // The Account section has none (API Tokens where the host offers no tokens, say): the app's becomes it,
    // nested under Profile as the Account section nests its own.
    const hasProfile = account.some((c) => c.id === profileId);
    const made: SettingsCategory = {
      ...category,
      id: targetId,
      group: accountGroup,
      label: target === 'account' ? 'Profile' : category.label.replace(/^Account › /, ''),
      rows,
    };
    delete made.parent;
    if (hasProfile && target !== 'account' && target !== 'privacy' && target !== 'accessibility') {
      made.parent = profileId;
    }
    // After the last category under Profile, so a sub-category stays beside its siblings.
    const lastUnderProfile = account.reduce(
      (last, c, i) => (c.id === profileId || c.parent === profileId ? i : last),
      -1,
    );
    if (made.parent && lastUnderProfile >= 0) account.splice(lastUnderProfile + 1, 0, made);
    else account.push(made);
  }
  return left;
}
