'use client';

// The Settings panel's Account section (liveworkspace/docs/site.md "Settings"): what belongs to the person in
// every app rather than to one, built once here and shown in the All view wherever the panel opens. Its switches
// are the `all` scope's (@liveworkspace/settings/account), read from and written to whatever holds that scope where
// the panel is: the accounts API on liveworkspace.app and an app's Explorer, the editor's own preferences in an
// editor (which sync them). The profile and the API tokens are the host's to draw or link to.
import type { ReactNode } from 'react';
import type { SettingsBlob } from '@liveworkspace/settings';
import {
  ACCESSIBILITY_ROWS,
  IN_APP_ROWS,
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  readAccountToggle,
  type AccountToggle,
} from '@liveworkspace/settings/account';
import { SettingsCategoryTile, SettingsSharedGlyph, SettingsSubcategoryGlyph } from './glyphs';
import type { SettingsCategory, SettingsRow } from './model';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from './SettingsRowShell';

export interface AccountSection {
  // The `all` scope as it stands, and how to change one of its keys.
  all: SettingsBlob;
  set: (key: string, value: boolean) => void;
  // The profile collaborators see: drawn here where the host can set it (liveworkspace.app, with its session),
  // else a link to where it is set.
  renderProfile?: () => ReactNode;
  profileHref?: string;
  // The API tokens: drawn here where the host can make and revoke them (liveworkspace.app, with its session), else a
  // link to where they are.
  renderTokens?: () => ReactNode;
  tokensHref?: string;
  // The email switches, only where the person has an address the emails can go to (default true).
  emails?: boolean;
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

/** A row that leaves for another page (the profile, the API tokens on liveworkspace.app). */
function linkOut(
  key: string,
  label: string,
  description: string,
  href: string,
  cta: string,
): SettingsRow {
  return {
    kind: 'custom',
    key,
    label,
    description,
    render: () => (
      <SettingsRowShell
        row={{ key, label, description }}
        control={
          <a href={href} className={SETTINGS_ROW_BUTTON}>
            {cta}
          </a>
        }
      />
    ),
  };
}

const TOKENS_KEYWORDS =
  'api token key mcp integration script developer access create revoke secret';

/** The Account section's categories, by their own ids (the panel files them under the Account heading). */
export function accountCategories(section: AccountSection): SettingsCategory[] {
  const { all, set, renderProfile, profileHref, renderTokens, tokensHref, emails = true } = section;
  const toggle = (rows: readonly AccountToggle[], heading?: string) =>
    rows.map(toggleRow(all, set, heading));

  const profile: SettingsRow[] = renderProfile
    ? [
        {
          kind: 'custom',
          key: 'profile',
          label: 'Profile',
          description: 'How collaborators see you in every app.',
          keywords: 'name display colour color cursor avatar presence profile',
          section: 'Profile',
          render: renderProfile,
        },
      ]
    : profileHref
      ? [
          {
            ...linkOut(
              'profile',
              'Profile',
              'Your name and colour, as collaborators see them on your cursor, comments and avatar in every app.',
              profileHref,
              'Edit',
            ),
            keywords: 'name display colour color cursor avatar presence profile',
          },
        ]
      : [];

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
