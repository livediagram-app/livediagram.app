// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AccountHost, SettingsCategory } from '@liveworkspace/settings-ui';

// The Settings host every editor binds (docs/specs/007-editor/user-preferences.md "This app or All"). The shared
// panel is stood in for, so these read what the host hands it: whether All is offered, the Account section's pieces
// and the footer.

const panel = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
const cloud = vi.hoisted(() => ({ hostsMade: 0 }));
vi.mock('@liveworkspace/settings-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/settings-ui')>()),
  SettingsPanel: (props: Record<string, unknown>) => {
    panel.props = props;
    return (
      <div>
        {props.footer as ReactNode}
        <button type="button" onClick={props.onClose as () => void}>
          Close
        </button>
      </div>
    );
  },
  useCloudSync: (host: unknown) => (host ? { connected: false } : null),
}));
const auth = vi.hoisted(() => ({
  user: null as null | Record<string, string | undefined>,
}));
vi.mock('../providers/deferred-auth', () => ({ useDeferredAuth: () => auth }));

const { EditorSettingsDialog, settingsAllowAll } = await import('./EditorSettingsDialog');
const { __resetPreferencesKeptLocally, rememberPreferencesKeptLocally } =
  await import('../../lib/preferences-local-only');

type Prefs = { quickAdd?: boolean };
const CATEGORY = {
  id: 'editor',
  label: 'Editor',
  icon: null,
  rows: [],
} as unknown as SettingsCategory;

const binding = {
  app: { id: 'livedocuments.app' as const, name: 'livedocuments' },
  kit: {} as never,
  request: vi.fn() as never,
  accountPanels: { renderTokens: () => 'tokens' },
  cloudSyncHost: () => {
    cloud.hostsMade += 1;
    return {} as never;
  },
  renderLogo: () => null,
  model: vi.fn(
    (
      categories: readonly SettingsCategory[],
      _s: Prefs,
      _c: unknown,
      o: { accountRequest: unknown },
    ) => (o.accountRequest ? categories : []),
  ),
  memoryKey: 'livedocuments:settings-view:v1',
  noun: 'document',
  onCategoryOpened: () => {},
};

type Open = {
  accountId?: string | null;
  workbench?: boolean;
  settings?: Prefs;
  onClosing?: (a: Prefs, b: Prefs) => void;
};

function open({ accountId = null, workbench = false, settings = {}, onClosing }: Open = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <EditorSettingsDialog<readonly SettingsCategory[], Prefs>
      binding={binding}
      settings={settings}
      onChange={onChange}
      onClose={onClose}
      accountId={accountId}
      workbench={workbench}
      emailEnabled
      categories={[CATEGORY]}
      onClosing={onClosing}
    />,
  );
  return { ...view, onChange, onClose };
}

const offered = () => panel.props!.allowAll as boolean;
const account = () => panel.props!.account as AccountHost;

afterEach(() => {
  cleanup();
  panel.props = null;
  auth.user = null;
  cloud.hostsMade = 0;
  __resetPreferencesKeptLocally();
});

describe('settingsAllowAll', () => {
  it('offers All only signed in, outside a workbench, with preferences the account keeps', () => {
    expect(settingsAllowAll(true, false, false)).toBe(true);
    expect(settingsAllowAll(false, false, false)).toBe(false);
    expect(settingsAllowAll(true, true, false)).toBe(false);
    expect(settingsAllowAll(true, false, true)).toBe(false);
  });
});

describe('EditorSettingsDialog This app or All', () => {
  it('shows a guest this app alone, with no account pieces, and says their settings stay here', () => {
    open();
    expect(offered()).toBe(false);
    expect(account().identity).toBeNull();
    expect(account().profile).toBeUndefined();
    expect(account().renderTokens).toBeUndefined();
    expect(account().cloudSync).toBeNull();
    expect(cloud.hostsMade).toBe(0);
    expect(
      screen.getByText(/Settings are kept in this browser and apply to every document/),
    ).toBeTruthy();
  });

  it('offers a signed-in account All, its profile, panels and Cloud Sync', () => {
    auth.user = { fullName: 'Ada Lovelace', email: 'ada@example.com', createdAt: '2026-01-01' };
    open({ accountId: 'user_1' });
    expect(offered()).toBe(true);
    expect(account().identity).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      joined: '2026-01-01',
    });
    expect(account().profile).toBeDefined();
    expect(account().renderTokens).toBeDefined();
    expect(account().cloudSync).not.toBeNull();
    expect(account().phone).toBeNull();
    expect(account().emails).toBe(true);
    // Reset All Settings reaches the account where All does.
    expect(panel.props!.own).toEqual([CATEGORY]);
    expect(
      screen.getByText(/Settings sync to your account and apply to every document/),
    ).toBeTruthy();
  });

  it('names the account by whatever it has', () => {
    auth.user = { username: 'ada' };
    open({ accountId: 'user_1' });
    expect(account().identity?.name).toBe('ada');
    cleanup();
    auth.user = { email: 'ada@example.com' };
    open({ accountId: 'user_1' });
    expect(account().identity?.name).toBe('ada@example.com');
    cleanup();
    auth.user = {};
    open({ accountId: 'user_1' });
    expect(account().identity?.name).toBe('Your account');
  });

  it('shows a signed-in account in a workbench this app alone', () => {
    open({ accountId: 'user_1', workbench: true });
    expect(offered()).toBe(false);
    expect(account().profile).toBeUndefined();
    expect(panel.props!.own).toEqual([]);
  });

  it('shows an account whose preferences stay in this browser this app alone', () => {
    rememberPreferencesKeptLocally('user_1');
    open({ accountId: 'user_1' });
    expect(offered()).toBe(false);
    expect(account().renderTokens).toBeUndefined();
    // Nothing syncs to the account, so the footer says where they are kept.
    expect(screen.queryByText(/sync to your account/)).toBeNull();
    expect(
      screen.getByText(
        'Settings are kept in this browser and apply to every document you open here.',
      ),
    ).toBeTruthy();
  });

  it('drops All the moment the api says it keeps none', () => {
    open({ accountId: 'user_1' });
    expect(offered()).toBe(true);
    act(() => rememberPreferencesKeptLocally('user_1'));
    expect(offered()).toBe(false);
  });

  it('keeps All for an account when someone else on the page is kept locally', () => {
    rememberPreferencesKeptLocally('guest_1');
    open({ accountId: 'user_1' });
    expect(offered()).toBe(true);
  });
});

describe('EditorSettingsDialog', () => {
  it('writes an Account switch with no row of its own straight to the preferences', () => {
    const { onChange } = open({ accountId: 'user_1', settings: { quickAdd: false } });
    account().shared!.set('emailDigest', true);
    expect(onChange).toHaveBeenCalledWith({ quickAdd: false, emailDigest: true });
  });

  it('frames the shared panel with the editor’s memory key, landing nowhere in particular', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(panel.props!.memoryKey).toBe('livedocuments:settings-view:v1');
    expect(panel.props!.focus).toBeNull();
    expect(panel.props!.initialCategoryId).toBeNull();
    expect(panel.props!.initialSectionId).toBeNull();
  });

  it('tells the editor what it opened and closed on, then closes', () => {
    const onClosing = vi.fn();
    const { onClose, rerender } = open({ settings: { quickAdd: false }, onClosing });
    rerender(
      <EditorSettingsDialog<readonly SettingsCategory[], Prefs>
        binding={binding}
        settings={{ quickAdd: true }}
        onChange={() => {}}
        onClose={onClose}
        accountId={null}
        workbench={false}
        emailEnabled
        categories={[CATEGORY]}
        onClosing={onClosing}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClosing).toHaveBeenCalledWith({ quickAdd: false }, { quickAdd: true });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes without an editor hook too', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
