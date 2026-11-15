// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreferencesKeptLocally,
  rememberPreferencesKeptLocally,
} from '@liveworkspace/workbench/lib/preferences-local-only';

// The header's livehuddle / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): one rule in every
// editor, from the shared Settings host. All only signed in, and with preferences the account keeps.

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

vi.mock('@/lib/avatar-tour', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestAvatarTourRelaunch: vi.fn(),
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

  it('has no workbench to hide All in: signed in is enough', () => {
    signIn();
    expect(open()).toBe(true);
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

// The Receptionist's welcome (docs/specs/008-canvas/receptionist.md): its row turned on from off has him welcome again.
describe('SettingsDialog tours on close', () => {
  it('asks the Receptionist again only when his row was turned on from off', async () => {
    const { requestAvatarTourRelaunch } = await import('@/lib/avatar-tour');
    const { relaunchTours } = await import('./SettingsDialog');
    relaunchTours({ avatarTourSeen: true }, { avatarTourSeen: true });
    expect(requestAvatarTourRelaunch).not.toHaveBeenCalled();
    relaunchTours({ avatarTourSeen: true }, {});
    expect(requestAvatarTourRelaunch).toHaveBeenCalledOnce();
  });
});
