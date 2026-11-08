// @vitest-environment jsdom

// Settings > Account > Danger Zone: Reset All Settings, directly above Delete Account
// (docs/specs/007-editor/user-preferences.md). Signed in, one DELETE resets the account's settings in every app and
// this editor's copy drops to its defaults; a guest's resets only this editor's copy, in this browser.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsRequest } from '@liveworkspace/settings-ui';
import { SETTINGS_CATEGORIES, type SettingsResetSettingsRowSpec } from './settings-catalogue';

vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({ authLoaded: true, isSignedIn: false, user: null, signOut: vi.fn() }),
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));

const { SettingsResetSettingsRow } = await import('./SettingsAccountRows');

const account = SETTINGS_CATEGORIES.find((c) => c.id === 'account')!;
const ROW = account.rows.find((r) => r.kind === 'resetSettings') as SettingsResetSettingsRowSpec;
const STORED = { telemetryEnabled: false, tourSeen: true, showMinimap: false, uiScale: 1.25 };

// A reset that lands is told to the whole page (its row then says Settings Reset for a moment wherever it is drawn),
// so the one that succeeds signed in runs last.
afterEach(cleanup);

function confirmReset() {
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  const popover = screen.getByRole('alertdialog', { name: 'Reset all your settings?' });
  fireEvent.click(within(popover).getByRole('button', { name: 'Reset' }));
}

describe('Reset All Settings', () => {
  it('sits in the Danger Zone directly above Delete Account', () => {
    const keys = account.rows.map((r) => r.key);
    expect(ROW.section).toBe('Danger Zone');
    expect(ROW.label).toBe('Reset All Settings');
    expect(keys.indexOf('resetSettings')).toBe(keys.indexOf('deleteAccount') - 1);
  });

  it('for a guest, drops this editor’s copy to its defaults in this browser, sending nothing', async () => {
    const onChange = vi.fn();
    render(
      <SettingsResetSettingsRow
        row={ROW}
        settings={STORED}
        onChange={onChange}
        accountRequest={null}
      />,
    );
    expect(screen.getByText(/in this browser/)).toBeTruthy();
    confirmReset();
    expect(await screen.findByText('Settings Reset')).toBeTruthy();
    // Every key goes but the usage-events choice, a consent.
    expect(onChange).toHaveBeenCalledWith({ telemetryEnabled: false });
  });

  it('signed in, keeps everything when the server refuses, and says so with Try Again', async () => {
    const request = vi.fn(async () => ({
      ok: false,
      status: 0,
      error: 'offline',
    })) as unknown as SettingsRequest;
    const onChange = vi.fn();
    render(
      <SettingsResetSettingsRow
        row={ROW}
        settings={STORED}
        onChange={onChange}
        accountRequest={request}
      />,
    );
    confirmReset();
    const note = await screen.findByRole('alert');
    expect(note.textContent).toMatch(/Your settings weren’t reset/);
    expect(within(note).getByRole('button', { name: 'Try Again' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('signed in, resets the account’s settings in every app, then this editor’s copy', async () => {
    const order: string[] = [];
    const request = vi.fn(async (path: string, method?: string) => {
      order.push(`${method} ${path}`);
      return { ok: true, data: { all: { telemetryEnabled: false } } };
    }) as unknown as SettingsRequest;
    const onChange = vi.fn(() => order.push('local'));
    render(
      <SettingsResetSettingsRow
        row={ROW}
        settings={STORED}
        onChange={onChange}
        accountRequest={request}
      />,
    );
    expect(screen.getByText(/in every liveworkspace app/)).toBeTruthy();
    confirmReset();
    expect(await screen.findByText('Settings Reset')).toBeTruthy();
    expect(order).toEqual(['DELETE /settings', 'local']);
    expect(onChange).toHaveBeenCalledWith({ telemetryEnabled: false });
  });
});
