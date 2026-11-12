'use client';

// The Settings panel's model (CatalogueSettingsView.tsx): one app's categories or All's, with the rail's
// headings. No state or effects, so a test reads the whole of All for every app's catalogue.

import { ACCOUNT_KEYS } from '@liveworkspace/settings/account';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { withoutCommonRows, type CommonCatalogue } from '@liveworkspace/settings/common';
import {
  accountCategories,
  DEVELOPER_CATEGORY_IDS,
  type AccountCategoryId,
  type AccountSection,
} from './account-model';
import { catalogueModel } from './catalogue-model';
import { foldIntoAccount } from './fold-account';
import { SettingsCategoryTile } from './glyphs';
import { guestProfileRows } from './profile/profile-rows';
import type { AccountGuest } from './profile/ProfileHeader';
import { COMMON_GROUP, commonModel, commonRowIds } from './common-model';
import { groupCategories } from './groups';
import { mergeAppCategories, type MergeSource } from './merge-categories';
import type { SettingsCategory, SettingsGroupHeading } from './model';
import { type PanelScopes, type ScopesSaver } from './saver';
import { panelAppIds, type SettingsAppId } from './store';

// The prefix of the account's category ids (`account:notifications`), and the rail's Account label.
export const ACCOUNT_GROUP = 'account';
// The prefix of the merged categories' ids (merge-categories.ts, `apps:editor`), and the rail's Apps label.
export const APPS_GROUP = 'apps';
// The rail's Developers label, over the account's API Tokens.
export const DEVELOPERS_GROUP = 'developers';

// The rail's label headings, in order: who you are, the apps' settings, then the panels for builders.
const RAIL_GROUPS: readonly SettingsGroupHeading[] = [
  { id: ACCOUNT_GROUP, label: 'Account' },
  { id: APPS_GROUP, label: 'Apps' },
  { id: DEVELOPERS_GROUP, label: 'Developers' },
];

export type AccountHost = Omit<AccountSection, 'all' | 'set'> & {
  // Where the host holds the `all` scope itself (an editor's preferences): read and written there rather than over
  // the accounts API.
  shared?: Pick<AccountSection, 'all' | 'set'>;
  // A guest (the app's side alone): their Profile, first, with the way to sign in.
  guest?: AccountGuest | null;
};

/** The panel's categories and the rail's label headings: one app's (its side of the switch), or All's. Plain, so a
 *  test can read the whole of All for every app's catalogue. */
export function panelModel({
  mode,
  withShared = false,
  current,
  own,
  catalogues,
  common,
  value,
  account,
  saver,
}: {
  mode: 'app' | 'all';
  withShared?: boolean;
  current: SettingsAppId | null;
  own?: readonly SettingsCategory[] | undefined;
  catalogues: Partial<Record<SettingsAppId, AppCatalogue>>;
  common: CommonCatalogue | null;
  value: PanelScopes;
  account: AccountHost;
  saver: Pick<ScopesSaver, 'changeApp' | 'changeShared'>;
}): { categories: SettingsCategory[]; groups?: readonly SettingsGroupHeading[] } {
  const { shared } = account;
  const appModel = (app: SettingsAppId, structure = false) => {
    const catalogue = catalogues[app];
    if (!catalogue) return [];
    return catalogueModel(
      // Beside the common settings, an app's own categories hold only its own: the common ones are Common's rows.
      mode === 'all' || withShared ? withoutCommonRows(catalogue) : catalogue,
      { all: shared?.all ?? value.all, app: value.apps[app] ?? {} },
      (binding, stored) => saver.changeApp(app, binding, stored),
      { structure },
    );
  };
  if (mode === 'app' && !withShared) {
    const listed = current ? appModel(current) : [];
    return {
      categories: account.guest
        ? [
            {
              id: 'profile',
              label: 'Profile',
              icon: <SettingsCategoryTile id="account" />,
              rows: guestProfileRows(account.guest),
            },
            ...listed,
          ]
        : listed,
    };
  }

  // Every app the panel lists, the app opened for first: whose rows are read, and whose wording and old copies of a
  // common setting win. An Account row, and an app's row over a setting every app shares, applies to all of them.
  const shownIds = panelAppIds(current);
  const order = current ? [current, ...shownIds.filter((app) => app !== current)] : shownIds;
  const every: readonly string[] = shownIds;
  const markApps = (app: SettingsAppId, categories: SettingsCategory[]) =>
    categories.map((category) => ({
      ...category,
      rows: category.rows.map((row) =>
        row.apps ? row : { ...row, apps: row.allApps ? every : [app] },
      ),
    }));
  // The account's categories, which each app's own copies are folded into below, so each shows once.
  const accountListed: SettingsCategory[] = groupCategories(
    ACCOUNT_GROUP,
    accountCategories({
      ...account,
      all: shared?.all ?? value.all,
      set: shared?.set ?? ((key, next) => saver.changeShared(key, next)),
    }),
  ).map((category) => ({
    ...category,
    rows: category.rows.map((row) => ({ ...row, apps: every })),
  }));
  // An editor's own copies of the account's switches and of the common settings are left out of its
  // categories.
  const commonIds = common ? commonRowIds(common) : new Set<string>();
  const ownFiled = (app: SettingsAppId) =>
    groupCategories(app, own ?? [], {
      omit: (row) => (row.allApps === true && ACCOUNT_KEYS.has(row.key)) || commonIds.has(row.key),
      keepEmpty: true,
    });

  // One set of categories (merge-categories.ts): Common's, then each app's own, the app opened for first, merged by
  // their place, every row marked with the apps it applies to. This App's side is the same, kept to the rows that
  // apply to that app (`only`), so the two sides never disagree about where a setting is.
  const sources: MergeSource[] = [];
  if (common) {
    sources.push({
      group: COMMON_GROUP,
      shared: true,
      categories: commonModel({
        common,
        all: value.all,
        apps: value.apps,
        order,
        ...(own && shared ? { own: { categories: own, prefs: shared.all } } : {}),
        ...(own && current
          ? {
              editor: {
                app: current,
                keys: new Set(own.flatMap((category) => category.rows.map((row) => row.key))),
              },
            }
          : {}),
        change: (app, binding, stored) => saver.changeApp(app, binding, stored),
        structure: true,
      }),
    });
  }
  for (const app of order) {
    const filed = markApps(
      app,
      own && app === current
        ? ownFiled(app)
        : groupCategories(app, appModel(app, true), { keepEmpty: true }),
    );
    sources.push({
      group: app,
      categories: foldIntoAccount({
        account: accountListed,
        accountGroup: ACCOUNT_GROUP,
        app: filed,
        appGroup: app,
      }),
    });
  }
  const only = mode === 'app' && current ? current : undefined;
  const merged = mergeAppCategories(sources, APPS_GROUP, only ? { only } : {});
  // Under the rail's labels (RAIL_GROUPS), never folded: Account (Profile, Notifications, Privacy, Accessibility, Your
  // Data, in accountCategories' order), the apps' merged categories, then Developers (API Tokens). The
  // account's answer to their bare ids too (`notifications`), and Profile to `profile`, the Explorer's old name for it,
  // and to `webhooks`, the category that left Settings for each document's own (004-index/webhooks.md).
  const accountKept = keepFor(accountListed, only).map((c) => {
    const bare = c.id.slice(ACCOUNT_GROUP.length + 1);
    return {
      ...c,
      group: DEVELOPER_CATEGORY_IDS.has(bare as AccountCategoryId)
        ? DEVELOPERS_GROUP
        : ACCOUNT_GROUP,
      aliases: [...(c.aliases ?? []), bare, ...(bare === 'account' ? ['profile', 'webhooks'] : [])],
    };
  });
  return {
    categories: [
      ...accountKept.filter((c) => c.group === ACCOUNT_GROUP),
      ...merged,
      ...accountKept.filter((c) => c.group === DEVELOPERS_GROUP),
    ],
    groups: RAIL_GROUPS,
  };
}

// The account's categories kept to the rows that apply to `app` (another app's own email switches are left out of
// this app's side), and those left with any.
function keepFor(categories: readonly SettingsCategory[], app: string | undefined) {
  if (app === undefined) return categories;
  return categories
    .map((category) => ({
      ...category,
      rows: category.rows.filter((row) => !row.apps || row.apps.includes(app)),
    }))
    .filter((category) => category.rows.length > 0);
}
