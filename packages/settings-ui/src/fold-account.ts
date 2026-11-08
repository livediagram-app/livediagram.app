// The panel shows the account's categories once (liveworkspace/docs/specs/010-site/site.md "Settings", "The Account section shows
// once"). Each editor's own Settings carries Account, Notifications, API Tokens, Privacy and Accessibility categories
// of its own, and each app's catalogue an Account › Notifications; listed for the app as well, the account read
// twice. Here an app's copies are folded into the account's category of the same name: the rows the account's
// categories don't already hold (an editor's Delete Account, an app's own email switches, its own
// accessibility rows) join it, each section once (section-order.ts), an introduction above a category that is one
// whole panel (API Tokens), marked with the app's logo as every row of the
// panel is (`SettingsRow.apps`), and the editor's identity row gives way to the Profile's header card.
import { ACCOUNT_CATEGORY_IDS, accountCategoryTile, type AccountCategoryId } from './account-model';
import type { SettingsCategory, SettingsRow } from './model';
import { bySection } from './section-order';

// An app's category ids that are the account's, by the account's own id for them.
const FOLDED: Readonly<Record<string, AccountCategoryId>> = {
  account: 'account',
  notifications: 'notifications',
  tokens: 'tokens',
  data: 'data',
  privacy: 'privacy',
  accessibility: 'accessibility',
};

// The account's categories that are one whole panel (the token manager, Download Your Data): an app's
// rows there introduce it (what a token lets your scripts and AI tools do, the guide to connecting one), so they come
// first, above the panel.
const INTRODUCED: ReadonlySet<AccountCategoryId> = new Set(['tokens', 'data']);

// An editor's own rows the Account section draws itself: its identity card is the Profile's header.
const DRAWN_BY_ACCOUNT = new Set(['identity']);

const local = (group: string, id: string) =>
  id.startsWith(`${group}:`) ? id.slice(group.length + 1) : id;

/**
 * Moves an app's account categories (already filed under the app's id, `groupCategories`) into the account's (filed
 * under `accountGroup`). Returns the app's categories left; `account` is changed in place, so the
 * next app folds into what this one left.
 */
export function foldIntoAccount({
  account,
  accountGroup,
  app,
  appGroup,
}: {
  account: SettingsCategory[];
  accountGroup: string;
  app: readonly SettingsCategory[];
  appGroup: string;
}): SettingsCategory[] {
  const left: SettingsCategory[] = [];
  for (const category of app) {
    const id = local(appGroup, category.id);
    const target = FOLDED[id];
    if (!target) {
      left.push(category);
      continue;
    }
    // The app's rows keep the apps they were marked with (the caller's), else they are the app's own.
    const rows: SettingsRow[] = category.rows
      .filter((row) => !DRAWN_BY_ACCOUNT.has(local(appGroup, row.key)))
      .map((row) => (row.apps ? row : { ...row, apps: [appGroup] }));
    if (rows.length === 0) continue;
    const targetId = `${accountGroup}:${target}`;
    const at = account.findIndex((c) => c.id === targetId);
    if (at >= 0) {
      const existing = account[at]!;
      // The account's own notes and closed sections first; the app's fill in the sections it adds.
      const sectionNotes =
        existing.sectionNotes || category.sectionNotes
          ? { ...category.sectionNotes, ...existing.sectionNotes }
          : undefined;
      const collapsed = [
        ...new Set([...(existing.collapsedSections ?? []), ...(category.collapsedSections ?? [])]),
      ];
      account[at] = {
        ...existing,
        ...(sectionNotes ? { sectionNotes } : {}),
        ...(collapsed.length > 0 ? { collapsedSections: collapsed } : {}),
        rows: bySection(
          INTRODUCED.has(target) ? [...rows, ...existing.rows] : [...existing.rows, ...rows],
        ),
      };
      continue;
    }
    // The account has none (API Tokens where the host offers no tokens, say): the app's becomes it, a top-level
    // category with the account's tile, in the account's order.
    const made: SettingsCategory = {
      ...category,
      id: targetId,
      group: accountGroup,
      label: target === 'account' ? 'Profile' : category.label.replace(/^Account › /, ''),
      icon: accountCategoryTile(target),
      rows,
    };
    delete made.parent;
    const rank = ACCOUNT_CATEGORY_IDS.indexOf(target);
    const before = account.findIndex(
      (c) => ACCOUNT_CATEGORY_IDS.indexOf(local(accountGroup, c.id) as AccountCategoryId) > rank,
    );
    if (before >= 0) account.splice(before, 0, made);
    else account.push(made);
  }
  return left;
}
