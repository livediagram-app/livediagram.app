'use client';

// The Settings panel's Account section (liveworkspace/docs/specs/010-site/site.md "Settings"): what belongs to the person in
// every app rather than to one, built once here and shown in the All view wherever the panel opens. Its switches
// are the `all` scope's (@liveworkspace/settings/account), read from and written to whatever holds that scope where
// the panel is: the accounts API on liveworkspace.app and an app's Explorer, the editor's own preferences in an
// editor (which sync them). The profile is edited in place by every host (ProfileHost); the API tokens and the webhooks
// are the host's to draw or link to.
import type { ReactNode } from 'react';
import type { SettingsBlob } from '@liveworkspace/settings';
import {
  ACCESSIBILITY_ROWS,
  IN_APP_ROWS,
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  PUSH_ROWS,
  readAccountToggle,
  DATA_EXPORT_CATEGORY,
  WEBHOOKS_CATEGORY,
  type AccountToggle,
} from '@liveworkspace/settings/account';
import { SettingsCategoryTile, SettingsSharedGlyph, SettingsSubcategoryGlyph } from './glyphs';
import { linkOut, profileRows } from './profile/profile-rows';
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
  // How they sign in and where they are signed in: drawn here where the host can reach the session
  // (liveworkspace.app), else a link to where they are.
  security?: AccountSecurity;
  securityHref?: string;
  // Signing out, where the host can.
  onSignOut?: () => Promise<boolean> | boolean | void;
  // The API tokens: drawn here where the host can make and revoke them (liveworkspace.app, with its session), else a
  // link to where they are.
  renderTokens?: () => ReactNode;
  tokensHref?: string;
  // The webhooks (liveworkspace/docs/specs/004-index/webhooks.md): drawn here where the host can reach the index with the
  // person's own session (liveworkspace.app, an app's Explorer), else a link to where they are.
  renderWebhooks?: () => ReactNode;
  webhooksHref?: string;
  // Download Your Data (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): drawn here where the host has
  // the person's session (liveworkspace.app), else a link to where it is.
  renderDataExport?: () => ReactNode;
  dataExportHref?: string;
  // The email switches, only where the person has an address the emails can go to (default true).
  emails?: boolean;
  // Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): where the deployment offers Drive and the person is signed
  // in (useCloudSync), its section in the Profile, before Your Account.
  cloudSync?: CloudSync | null;
  // Phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Settings"): for a signed-in person, the
  // panel's own door to the accounts API, whose Phone section turns them on and lists the devices.
  phone?: PhoneHost | null;
}

const toggleRow =
  (all: SettingsBlob, set: AccountSection['set'], section?: string) =>
  (row: AccountToggle): SettingsRow => ({
    kind: 'toggle',
    key: row.key,
    label: row.label,
    description: row.description,
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(section ? { section } : {}),
    value: readAccountToggle(all, row),
    onChange: (next) => set(row.key, next),
  });

const TOKENS_KEYWORDS =
  'api token key mcp integration script developer access create revoke secret';

/** The Account section's categories, by their own ids (the panel files them under the Account heading). */
export function accountCategories(section: AccountSection): SettingsCategory[] {
  const {
    all,
    set,
    renderTokens,
    tokensHref,
    renderWebhooks,
    webhooksHref,
    renderDataExport,
    dataExportHref,
    emails = true,
  } = section;
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
      icon: <SettingsCategoryTile id="account" />,
      rows: profile,
    });
  }
  const parent = profile.length > 0 ? { parent: 'account' } : {};
  categories.push({
    id: 'notifications',
    label: 'Notifications',
    icon: parent.parent ? (
      <SettingsSubcategoryGlyph>
        <SettingsSharedGlyph id="notifications" />
      </SettingsSubcategoryGlyph>
    ) : (
      <SettingsCategoryTile id="account" />
    ),
    ...parent,
    rows: [
      ...toggle(IN_APP_ROWS, 'In the Editor'),
      ...(emails ? toggle(NOTIFICATION_ROWS, 'Email') : []),
      ...(section.phone ? phoneRows(section.phone, toggle(PUSH_ROWS, PHONE_SECTION)) : []),
    ],
  });
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
    : tokensHref
      ? {
          ...linkOut(
            'apiTokens',
            'API Tokens',
            'One token works on every app’s API and MCP server. Make one for a script or an AI tool, and revoke it any time.',
            tokensHref,
            'Manage',
          ),
          keywords: TOKENS_KEYWORDS,
        }
      : null;
  if (tokens) {
    categories.push({
      id: 'tokens',
      label: 'API Tokens',
      icon: (
        <SettingsSubcategoryGlyph>
          <SettingsSharedGlyph id="tokens" />
        </SettingsSubcategoryGlyph>
      ),
      ...parent,
      rows: [tokens],
    });
  }
  const webhooks: SettingsRow | null = renderWebhooks
    ? {
        kind: 'custom',
        key: 'webhooks',
        label: WEBHOOKS_CATEGORY.label,
        description: WEBHOOKS_CATEGORY.description,
        keywords: WEBHOOKS_CATEGORY.keywords,
        section: WEBHOOKS_CATEGORY.label,
        render: renderWebhooks,
      }
    : webhooksHref
      ? {
          ...linkOut(
            'webhooks',
            WEBHOOKS_CATEGORY.label,
            WEBHOOKS_CATEGORY.description,
            webhooksHref,
            'Manage',
          ),
          keywords: WEBHOOKS_CATEGORY.keywords,
        }
      : null;
  if (webhooks) {
    categories.push({
      id: 'webhooks',
      label: WEBHOOKS_CATEGORY.label,
      icon: (
        <SettingsSubcategoryGlyph>
          <SettingsSharedGlyph id="webhooks" />
        </SettingsSubcategoryGlyph>
      ),
      ...parent,
      rows: [webhooks],
    });
  }
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
    : dataExportHref
      ? {
          ...linkOut(
            'dataExport',
            DATA_EXPORT_CATEGORY.label,
            DATA_EXPORT_CATEGORY.description,
            dataExportHref,
            'Open',
          ),
          keywords: DATA_EXPORT_CATEGORY.keywords,
        }
      : null;
  if (data) {
    categories.push({
      id: 'data',
      label: DATA_EXPORT_CATEGORY.label,
      icon: (
        <SettingsSubcategoryGlyph>
          <SettingsSharedGlyph id="data" />
        </SettingsSubcategoryGlyph>
      ),
      ...parent,
      rows: [data],
    });
  }
  categories.push(
    {
      id: 'privacy',
      label: 'Privacy',
      icon: <SettingsCategoryTile id="privacy" />,
      rows: toggle(PRIVACY_ROWS),
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      icon: <SettingsCategoryTile id="accessibility" />,
      rows: toggle(ACCESSIBILITY_ROWS),
    },
  );
  return categories;
}
