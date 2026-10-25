import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { ACCOUNT_GROUP, panelModel, type AccountHost } from './CatalogueSettingsView';
import type { SettingsCategory, SettingsRow } from './model';
import { loadAppCatalogue, SETTINGS_APP_IDS, type SettingsAppId } from './store';

// The panel shows the account once (liveworkspace/docs/site.md "Settings", "The Account section shows once"): every
// category id is unique, no heading lists two categories of one name, and no category name the Account section uses
// appears again under an app. Checked for every app's catalogue (All on liveworkspace.app and an app's Explorer, and
// each app's own side), and for an editor's own Settings, which carries an Account, Notifications, API Tokens, Privacy
// and Accessibility of its own.

let catalogues: Record<SettingsAppId, AppCatalogue>;
beforeAll(async () => {
  const loaded = await Promise.all(SETTINGS_APP_IDS.map((app) => loadAppCatalogue(app)));
  catalogues = Object.fromEntries(SETTINGS_APP_IDS.map((app, i) => [app, loaded[i]!])) as Record<
    SettingsAppId,
    AppCatalogue
  >;
});

const saver = { changeApp: vi.fn(), changeShared: vi.fn() };
const value = { all: {}, apps: {} };
const renderLogo = () => null;
const signedIn: AccountHost = {
  identity: { name: 'Ada Lovelace', email: 'ada@example.com', colour: null },
  profile: {
    accountName: 'Ada Lovelace',
    load: async () => ({ ok: true, data: null }),
    save: async () => ({ ok: true, data: null }),
  },
  securityHref: '/explorer?settings=profile',
  tokensHref: '/explorer?settings=tokens',
};

const toggle = (key: string, label: string, extra: Partial<SettingsRow> = {}): SettingsRow =>
  ({
    kind: 'toggle',
    key,
    label,
    description: '',
    value: true,
    onChange: vi.fn(),
    ...extra,
  }) as SettingsRow;
const custom = (key: string, label: string, section?: string): SettingsRow => ({
  kind: 'custom',
  key,
  label,
  description: '',
  ...(section ? { section } : {}),
  render: () => null,
});

/** An editor's own Settings, in the shape every editor's catalogue has (its settings-catalogue.ts). */
function editorOwn(): SettingsCategory[] {
  return [
    { id: 'editor', label: 'Editor', rows: [toggle('snapToGrid', 'Snap to Grid')] },
    {
      id: 'accessibility',
      label: 'Accessibility',
      rows: [
        toggle('reduceMotion', 'Reduce Motion', { allApps: true }),
        toggle('highContrastFocus', 'High-Contrast Focus'),
      ],
    },
    {
      id: 'account',
      label: 'Account',
      rows: [
        custom('identity', 'Guest', 'You'),
        custom('trash', 'Trash', 'Your Data'),
        custom('deleteAccount', 'Delete Account', 'Danger Zone'),
      ],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      parent: 'account',
      rows: [
        toggle('notificationsEnabled', 'In-Editor Notifications', { allApps: true }),
        toggle('notifyDocumentJoin', 'Someone Joins My Canvas', { section: 'Email' }),
      ],
    },
    {
      id: 'tokens',
      label: 'API Tokens',
      parent: 'account',
      rows: [custom('apiTokens', 'API Tokens')],
    },
    {
      id: 'privacy',
      label: 'Privacy',
      rows: [toggle('telemetryEnabled', 'Send Anonymous Usage Events', { allApps: true })],
    },
  ];
}

function allModel(current: SettingsAppId | null, own?: SettingsCategory[]) {
  const common = commonCatalogue(
    SETTINGS_APP_IDS.map((app) => ({ app, catalogue: catalogues[app] })),
  );
  return panelModel({
    mode: 'all',
    current,
    own,
    catalogues,
    common,
    value,
    account: own ? { ...signedIn, shared: { all: {}, set: vi.fn() } } : signedIn,
    renderLogo,
    saver,
  });
}

function expectNoDuplicates(categories: readonly SettingsCategory[]) {
  const ids = categories.map((c) => c.id);
  expect(new Set(ids).size, `duplicate ids: ${ids.join(', ')}`).toBe(ids.length);
  const byGroup = new Map<string, string[]>();
  for (const c of categories) {
    const key = `${c.group ?? ''}/${c.parent ?? ''}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), c.label]);
  }
  for (const [group, labels] of byGroup) {
    expect(new Set(labels).size, `${group} lists ${labels.join(', ')}`).toBe(labels.length);
  }
  // No category name the Account section uses appears under an app.
  const account = new Set(
    categories
      .filter((c) => c.group === ACCOUNT_GROUP)
      .map((c) => c.label.replace(/^Account › /, '')),
  );
  account.add('Account');
  for (const c of categories.filter((c) => c.group && c.group !== ACCOUNT_GROUP)) {
    const bare = c.label.replace(/^Account › /, '');
    expect(
      account.has(bare) || c.label.startsWith('Account'),
      `${c.group} has its own ${c.label}`,
    ).toBe(false);
  }
}

describe('the Settings panel lists the account once', () => {
  it('in All on liveworkspace.app and an app’s Explorer, from every app’s catalogue', () => {
    const { categories } = allModel(null);
    expectNoDuplicates(categories);
    const labels = categories.filter((c) => c.group === ACCOUNT_GROUP).map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Profile',
        'Notifications',
        'API Tokens',
        'Privacy',
        'Accessibility',
      ]),
    );
    // Each app's own email switches join Account › Notifications, under the app's name.
    const notifications = categories.find((c) => c.id === 'account:notifications')!;
    const sections = new Set(notifications.rows.map((r) => r.section));
    expect(sections).toEqual(
      new Set([
        'In the Editor',
        'Email',
        'livediagram',
        'liveplanner',
        'livedocuments',
        'livedesign',
      ]),
    );
  });

  for (const app of [
    'livediagram.app',
    'liveplanner.app',
    'livedocuments.app',
    'livedesign.app',
  ] as const) {
    it(`in All opened from ${app}’s editor, with the editor’s own Account, Notifications, API Tokens and Privacy`, () => {
      const { categories } = allModel(app, editorOwn());
      expectNoDuplicates(categories);
      const profile = categories.find((c) => c.id === 'account:account')!;
      // The editor's identity row gives way to the Profile's header; its Trash and Delete Account join the Profile.
      expect(profile.rows.map((r) => r.key)).toEqual(
        expect.arrayContaining(['account:identity', `${app}:trash`, `${app}:deleteAccount`]),
      );
      expect(profile.rows.some((r) => r.key === `${app}:identity`)).toBe(false);
      // Its own tokens become the Account section's, under Profile, where the host offered a link.
      expect(categories.filter((c) => c.label === 'API Tokens')).toHaveLength(1);
      // Its own accessibility row (not a shared one) sits under Account › Accessibility, under its name.
      const accessibility = categories.find((c) => c.id === 'account:accessibility')!;
      expect(
        accessibility.rows.find((r) => r.key === `${app}:highContrastFocus`)?.section,
      ).toBeTruthy();
      expect(
        categories.some((c) => c.group === app && /Account|Notifications|Privacy/.test(c.label)),
      ).toBe(false);
    });

    it(`on ${app}’s own side, from its catalogue, signed in and as a guest`, () => {
      const base = { current: app, catalogues, common: null, value, renderLogo, saver } as const;
      const signed = panelModel({ ...base, mode: 'app', account: signedIn });
      expectNoDuplicates(signed.categories);
      const guest = panelModel({
        ...base,
        mode: 'app',
        account: { guest: { signInHref: '/sign-in' } },
      });
      expectNoDuplicates(guest.categories);
      expect(guest.categories[0]).toMatchObject({ id: 'profile', label: 'Profile' });
      expect(signed.categories.some((c) => c.id === 'profile')).toBe(false);
    });
  }
});
