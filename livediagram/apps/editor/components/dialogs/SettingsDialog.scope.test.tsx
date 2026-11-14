// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreferencesKeptLocally,
  rememberPreferencesKeptLocally,
} from '@liveworkspace/workbench/lib/preferences-local-only';

// The header's livediagram / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): one rule in every
// editor, from the shared Settings host. All only signed in, outside a workbench, and with preferences the account keeps.

const panel = vi.hoisted(() => ({ allowAll: null as boolean | null }));
vi.mock('@liveworkspace/settings-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/settings-ui')>()),
  SettingsPanel: ({ allowAll }: { allowAll: boolean }) => {
    panel.allowAll = allowAll;
    return null;
  },
}));
const who = vi.hoisted(() => ({ accountUserId: null as string | null, isSignedIn: false }));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({ useAccountBootstrap: () => who }));
const session = vi.hoisted(() => ({ value: null as object | null }));
vi.mock('@/components/providers/workbench-session-context', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useWorkbenchSession: () => session.value,
}));

vi.mock('@/lib/watch-relaunch', () => ({ requestWatchRelaunch: vi.fn() }));
vi.mock('@/lib/watch-topics', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // A mode is owed while its flag is up, for these tests.
  topicsOwed: (prefs: Record<string, unknown>, mode: string) => (prefs[mode] ? ['topic'] : []),
}));
const { SettingsDialog } = await import('./SettingsDialog');

function open() {
  render(<SettingsDialog settings={{}} onChange={() => {}} onClose={() => {}} />);
  return panel.allowAll;
}

function signIn() {
  who.accountUserId = 'user_1';
  who.isSignedIn = true;
}

afterEach(() => {
  cleanup();
  panel.allowAll = null;
  who.accountUserId = null;
  who.isSignedIn = false;
  session.value = null;
  __resetPreferencesKeptLocally();
});

describe('SettingsDialog This app or All', () => {
  it('shows a guest this app alone', () => {
    expect(open()).toBe(false);
  });

  it('offers a signed-in account All', () => {
    signIn();
    expect(open()).toBe(true);
  });

  it('shows a signed-in account inside a workbench this app alone', () => {
    signIn();
    session.value = { itemId: 'w1' };
    expect(open()).toBe(false);
  });

  it('shows an account whose preferences stay in this browser this app alone', () => {
    signIn();
    rememberPreferencesKeptLocally('user_1');
    expect(open()).toBe(false);
  });

  it('drops All once the api says it keeps none, while Settings is open', () => {
    signIn();
    expect(open()).toBe(true);
    act(() => rememberPreferencesKeptLocally('user_1'));
    expect(panel.allowAll).toBe(false);
  });
});

// Watch It Built (docs/specs/007-editor/watch-it-built.md "Settings"): a mode owed again as Settings closes, and not
// when it opened, opens its start panel.
describe('SettingsDialog tours on close', () => {
  it('reopens only the modes turned back on', async () => {
    const { requestWatchRelaunch } = await import('@/lib/watch-relaunch');
    const { relaunchTours } = await import('./SettingsDialog');
    relaunchTours({ draw: true } as never, { diagram: true, draw: true } as never);
    expect(vi.mocked(requestWatchRelaunch).mock.calls).toEqual([['diagram']]);
  });
});
