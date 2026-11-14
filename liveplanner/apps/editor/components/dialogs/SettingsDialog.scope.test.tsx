// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreferencesKeptLocally,
  rememberPreferencesKeptLocally,
} from '@liveworkspace/workbench/lib/preferences-local-only';

// The header's liveplanner / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): one rule in every
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

vi.mock('@/lib/plan-tour', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestPlanTourRelaunch: vi.fn(),
}));
vi.mock('@/lib/form-tour', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestFormTourRelaunch: vi.fn(),
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

// The Plan and Forms tours (docs/specs/026-plan/plan-tour.md, docs/specs/030-forms/forms.md): a row turned on from
// off reruns its tour on close.
describe('SettingsDialog tours on close', () => {
  it('reruns each tour only when its row was turned on from off', async () => {
    const { requestPlanTourRelaunch, PLAN_TOUR_TRACKS } = await import('@/lib/plan-tour');
    const { requestFormTourRelaunch } = await import('@/lib/form-tour');
    const { relaunchTours } = await import('./SettingsDialog');
    const all = { planTourTracks: [...PLAN_TOUR_TRACKS], formTourSeen: true } as never;
    relaunchTours(all, all);
    expect(requestPlanTourRelaunch).not.toHaveBeenCalled();
    expect(requestFormTourRelaunch).not.toHaveBeenCalled();
    relaunchTours(all, { planTourTracks: [], formTourSeen: false });
    expect(requestPlanTourRelaunch).toHaveBeenCalledOnce();
    expect(requestFormTourRelaunch).toHaveBeenCalledOnce();
  });
});
