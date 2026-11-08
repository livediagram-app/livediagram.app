'use client';

// The Settings panel's account categories (liveworkspace/docs/specs/010-site/site.md "Settings"): what belongs to the person in
// every app rather than to one, built once here and listed in the panel's rail beside the apps' categories, each
// top-level with its own tile, under the rail's Account and Developers labels. Its switches
// are the `all` scope's (@liveworkspace/settings/account), read from and written to whatever holds that scope where
// the panel is: the accounts API on liveworkspace.app and an app's Explorer, the editor's own preferences in an
// editor (which sync them). Everything in it is edited in place, wherever the panel opens: the profile (ProfileHost),
// sign-in and devices (AccountSecurity), and the API tokens and Download Your Data (accountPanels).
import type { ReactNode } from 'react';
import { PLATFORM_SITE, workspaceOriginFor } from '@liveworkspace/sites';
import type { SettingsBlob } from '@liveworkspace/settings';
import {
  ACCESSIBILITY_ROWS,
  IN_APP_ROWS,
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  PUSH_ROWS,
  readAccountToggle,
  DATA_EXPORT_CATEGORY,
  type AccountToggle,
} from '@liveworkspace/settings/account';
import { SettingsCategoryTile, type SettingsTileId } from './glyphs';
import { profileRows } from './profile/profile-rows';
import type { AccountIdentity } from './profile/ProfileHeader';
import type { ProfileHost } from './profile/profile-host';
import type { AccountSecurity } from './profile/SecurityRows';
import { cloudSyncRows, type CloudSync } from './cloud-sync/cloud-sync-host';
import type { PhoneHost } from './push/phone-host';
import { PHONE_SECTION, phoneRows } from './push/phone-rows';
import type { SettingsCategory, SettingsRow } from './model';

export interface AccountSection {
  // The `all` scope as it stands, and how to change one of its keys.
  all: SettingsBlob;
  set: (key: string, value: boolean) => void;
  // Who is signed in, for the Profile's header card (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile").
  identity?: AccountIdentity | null;
  // The profile collaborators see (the display name and presence colour), edited in place over the host's door: the
  // session on liveworkspace.app, the app's token on an app's address and in an editor. There is no address to link
  // to for it, on purpose: Name and Colour never leaves the panel.
  profile?: ProfileHost;
  // How they sign in and where they are signed in: the session's endpoints on liveworkspace.app, the bearer door
  // (bearerAccountSecurity) in an editor and on an app's address.
  security?: AccountSecurity;
  // Signing out, where the host can.
  onSignOut?: () => Promise<boolean> | boolean | void;
  // The API tokens and Download Your Data
  // (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"), drawn here (accountPanels) for a signed-in
  // account. A host without an account (a guest, a workbench, a self-hosted editor) hands none.
  renderTokens?: () => ReactNode;
  renderDataExport?: () => ReactNode;
  // The email switches, only where the person has an address the emails can go to (default true).
  emails?: boolean;
  // Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): where the deployment offers Drive and the person is signed
  // in (useCloudSync), its section in the Profile, before Your Account.
  cloudSync?: CloudSync | null;
  // Phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Settings"): for a signed-in person, the
  // panel's own door to the accounts API, whose Phone section turns them on and lists the devices.
  phone?: PhoneHost | null;
}

// liveworkspace.app as this page sees it (staging's from a staging app), for a row's link to a page there.
const workspaceOrigin = () =>
  typeof window === 'undefined' ? PLATFORM_SITE.url : workspaceOriginFor(window.location.host);

const toggleRow =
  (all: SettingsBlob, set: AccountSection['set'], section?: string) =>
  (row: AccountToggle): SettingsRow => ({
    kind: 'toggle',
    key: row.key,
    label: row.label,
    description: row.description,
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(section ? { section } : {}),
    ...(row.closesSection ? { closesSection: true } : {}),
    ...(row.more ? { link: { href: `${workspaceOrigin()}${row.more.path}`, label: row.more.label } } : {}),
    value: readAccountToggle(all, row),
    onChange: (next) => set(row.key, next),
  });

const TOKENS_KEYWORDS =
  'api token key mcp integration script developer access create revoke secret';

// The account's categories by their own ids, in the order the panel lists them. Each one's tile has the same id
// (glyphs.tsx): Profile (`account`) the person, the rest their shared marks.
export const ACCOUNT_CATEGORY_IDS = [
  'account',
  'notifications',
  'privacy',
  'accessibility',
  'data',
  'tokens',
] as const satisfies readonly SettingsTileId[];
// The ones the rail lists under Developers rather than Account.
export const DEVELOPER_CATEGORY_IDS: ReadonlySet<AccountCategoryId> = new Set(['tokens']);
export type AccountCategoryId = (typeof ACCOUNT_CATEGORY_IDS)[number];

/** The tile of the account category `id`. */
export function accountCategoryTile(id: AccountCategoryId): ReactNode {
  return <SettingsCategoryTile id={id} />;
}

/** The account's categories, by their own ids (the panel prefixes them `account:`), in the order they are listed:
 *  Profile, Notifications, Privacy, Accessibility and Your Data (the rail's Account), then API Tokens
 *  (its Developers). */
export function accountCategories(section: AccountSection): SettingsCategory[] {
  const { all, set, renderTokens, renderDataExport, emails = true } = section;
  const toggle = (rows: readonly AccountToggle[], heading?: string) =>
    rows.map(toggleRow(all, set, heading));

  const profile = profileRows(section);
  if (section.cloudSync && profile.length > 0) {
    // Before Your Account (Sign Out), which closes the Profile.
    const at = profile.findIndex((row) => row.key === 'signOut');
    profile.splice(at < 0 ? profile.length : at, 0, ...cloudSyncRows(section.cloudSync));
  }

  const categories: SettingsCategory[] = [];
  if (profile.length > 0) {
    categories.push({
      id: 'account',
      label: 'Profile',
      icon: accountCategoryTile('account'),
      rows: profile,
    });
  }
  categories.push(
    {
      id: 'notifications',
      label: 'Notifications',
      icon: accountCategoryTile('notifications'),
      rows: [
        ...toggle(IN_APP_ROWS, 'In the Editor'),
        ...(emails ? toggle(NOTIFICATION_ROWS, 'Email') : []),
        ...(section.phone ? phoneRows(section.phone, toggle(PUSH_ROWS, PHONE_SECTION)) : []),
      ],
    },
    {
      id: 'privacy',
      label: 'Privacy',
      icon: accountCategoryTile('privacy'),
      rows: toggle(PRIVACY_ROWS),
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      icon: accountCategoryTile('accessibility'),
      rows: toggle(ACCESSIBILITY_ROWS),
    },
  );
  const data: SettingsRow | null = renderDataExport
    ? {
        kind: 'custom',
        key: 'dataExport',
        label: DATA_EXPORT_CATEGORY.label,
        description: DATA_EXPORT_CATEGORY.description,
        keywords: DATA_EXPORT_CATEGORY.keywords,
        section: DATA_EXPORT_CATEGORY.label,
        render: renderDataExport,
      }
    : null;
  if (data) {
    categories.push({
      id: 'data',
      label: DATA_EXPORT_CATEGORY.label,
      icon: accountCategoryTile('data'),
      rows: [data],
    });
  }
  const tokens: SettingsRow | null = renderTokens
    ? {
        kind: 'custom',
        key: 'apiTokens',
        label: 'API Tokens',
        description: 'One token works on every app’s API and MCP server.',
        keywords: TOKENS_KEYWORDS,
        section: 'API Tokens',
        render: renderTokens,
      }
    : null;
  if (tokens) {
    categories.push({
      id: 'tokens',
      label: 'API Tokens',
      icon: accountCategoryTile('tokens'),
      rows: [tokens],
    });
  }
  return categories;
}
