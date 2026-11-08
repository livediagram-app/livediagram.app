// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsApiResult, SettingsRequest } from '../request';
import { STORED_APP_IDS, storeFor } from '../store';
import { resetAccountSettings, resetBrowserSettings } from './reset-account';
import {
  RESET_DONE_MS,
  RESET_SETTINGS_ACCOUNT,
  RESET_SETTINGS_BROWSER,
  ResetSettingsRow,
} from './ResetSettingsRow';
import {
  __forgetSettingsResets,
  announceSettingsReset,
  lastSettingsResetAt,
  useSettingsResetGeneration,
} from './reset-signal';

// Reset All Settings (liveworkspace/docs/specs/010-site/site.md "Settings", "Reset All Settings"; accounts.md
// "Resetting every setting"): the row asks first, says Settings Reset, and offers Try Again on a refusal; an account's
// reset is one DELETE that leaves the page's kept scopes at the answer and tells every panel; a guest's touches only
// the editor's own copy.

const ROW = { key: 'resetSettings', label: 'Reset All Settings', description: 'searchable' };
const ok = async (): Promise<SettingsApiResult<unknown>> => ({ ok: true, data: { all: {} } });

afterEach(() => {
  vi.useRealTimers();
  __forgetSettingsResets();
});

function ask() {
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  return screen.getByRole('alertdialog', { name: 'Reset all your settings?' });
}

describe('the Reset All Settings row', () => {
  it('says what it reaches: every app for an account, this browser for a guest', () => {
    const { rerender } = render(<ResetSettingsRow row={ROW} reach="account" reset={ok} />);
    expect(screen.getByText(RESET_SETTINGS_ACCOUNT)).toBeTruthy();
    expect(RESET_SETTINGS_ACCOUNT).toMatch(/profile, API tokens, webhooks and sign-ins stay/);
    rerender(<ResetSettingsRow row={ROW} reach="browser" reset={ok} />);
    expect(screen.getByText(RESET_SETTINGS_BROWSER)).toBeTruthy();
    expect(RESET_SETTINGS_BROWSER).toMatch(/in this browser/);
  });

  it('asks first, and a kept answer changes nothing', () => {
    const reset = vi.fn(ok);
    render(<ResetSettingsRow row={ROW} reach="account" reset={reset} />);
    const popover = ask();
    expect(within(popover).getByText('This can’t be undone.')).toBeTruthy();
    expect(within(popover).getByText(/Tours will offer again/)).toBeTruthy();
    fireEvent.click(within(popover).getByRole('button', { name: 'Cancel' }));
    expect(reset).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset' }));
  });

  it('resets on Reset, says Settings Reset for a moment, then gives the button back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reset = vi.fn(ok);
    render(<ResetSettingsRow row={ROW} reach="browser" reset={reset} />);
    fireEvent.click(within(ask()).getByRole('button', { name: 'Reset' }));
    expect(reset).toHaveBeenCalledTimes(1);
    const done = await screen.findByRole('status');
    expect(done.textContent).toBe('Settings Reset');
    // The button it replaced had the keyboard: the note takes it.
    expect(document.activeElement).toBe(done);
    await act(async () => {
      vi.advanceTimersByTime(RESET_DONE_MS + 10);
    });
    const button = screen.getByRole('button', { name: 'Reset' });
    expect(document.activeElement).toBe(button);
  });

  it('shows Resetting… while the reset is on its way', async () => {
    let answer: (value: SettingsApiResult<unknown>) => void = () => {};
    const reset = () => new Promise<SettingsApiResult<unknown>>((resolve) => (answer = resolve));
    render(<ResetSettingsRow row={ROW} reach="account" reset={reset} />);
    fireEvent.click(within(ask()).getByRole('button', { name: 'Reset' }));
    const busy = screen.getByRole('button', { name: 'Resetting…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await act(async () => answer({ ok: true, data: null }));
    expect(await screen.findByText('Settings Reset')).toBeTruthy();
  });

  it('says a refusal under the row, and Try Again resets without asking again', async () => {
    const reset = vi
      .fn<() => Promise<SettingsApiResult<unknown>>>()
      .mockResolvedValueOnce({ ok: false, status: 0, error: 'offline' })
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'failed' })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, data: null });
    render(<ResetSettingsRow row={ROW} reach="account" reset={reset} />);
    fireEvent.click(within(ask()).getByRole('button', { name: 'Reset' }));
    const note = await screen.findByRole('alert');
    expect(note.textContent).toMatch(/Your settings weren’t reset\. Couldn’t reach liveworkspace/);

    fireEvent.click(within(note).getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /Your settings weren’t reset\. Please try again\./,
      ),
    );
    // A request that throws reads as offline.
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t reach liveworkspace/),
    );
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Settings Reset')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('drawn again by a reset that just landed, still says Settings Reset', () => {
    announceSettingsReset();
    render(<ResetSettingsRow row={ROW} reach="account" reset={ok} />);
    expect(screen.getByRole('status').textContent).toBe('Settings Reset');
  });

  it('drawn after the moment has passed, offers Reset', () => {
    announceSettingsReset(Date.now() - RESET_DONE_MS - 1);
    render(<ResetSettingsRow row={ROW} reach="account" reset={ok} />);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  });

  it('does nothing once it has gone before the answer came', async () => {
    let answer: (value: SettingsApiResult<unknown>) => void = () => {};
    const reset = () => new Promise<SettingsApiResult<unknown>>((resolve) => (answer = resolve));
    const { unmount } = render(<ResetSettingsRow row={ROW} reach="account" reset={reset} />);
    fireEvent.click(within(ask()).getByRole('button', { name: 'Reset' }));
    unmount();
    await act(async () => answer({ ok: true, data: null }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('resetting an account’s settings', () => {
  const requestOf = (answer: SettingsApiResult<unknown>) => {
    const calls: { path: string; method: string | undefined }[] = [];
    const request = (async (path: string, method?: string) => {
      calls.push({ path, method });
      return answer;
    }) as SettingsRequest;
    return { request, calls };
  };

  it('sends one DELETE, drops the host’s copy, sets every app’s kept scopes and tells every panel', async () => {
    const { request, calls } = requestOf({ ok: true, data: { all: { telemetryEnabled: false } } });
    const store = storeFor(request);
    store.remember('liveplanner.app', { all: { reduceMotion: true }, app: { homeBanner: false } });
    const apply = vi.fn();
    const { result: generation } = renderHook(() => useSettingsResetGeneration());
    expect(generation.current).toBe(0);

    const answer = await act(() => resetAccountSettings(request, apply));
    expect(answer).toEqual({ ok: true, data: { all: { telemetryEnabled: false } } });
    expect(calls).toEqual([{ path: '/settings', method: 'DELETE' }]);
    expect(apply).toHaveBeenCalledTimes(1);
    for (const app of STORED_APP_IDS) {
      // Kept, so the panel drawn again reads nothing.
      expect(await store.loadApp(app)).toEqual({
        ok: true,
        data: { all: { telemetryEnabled: false }, app: {} },
      });
    }
    expect(calls).toHaveLength(1);
    expect(generation.current).toBe(1);
    expect(Date.now() - lastSettingsResetAt()).toBeLessThan(RESET_DONE_MS);
  });

  it('takes an answer without `all` as nothing kept', async () => {
    const { request } = requestOf({ ok: true, data: {} });
    const answer = await resetAccountSettings(request, () => {});
    expect(answer).toEqual({ ok: true, data: { all: {} } });
  });

  it('changes nothing when the server refuses', async () => {
    const { request } = requestOf({ ok: false, status: 401, error: 'signed_out' });
    const store = storeFor(request);
    store.remember('livediagram.app', { all: {}, app: { showMinimap: false } });
    const apply = vi.fn();
    const answer = await resetAccountSettings(request, apply);
    expect(answer).toEqual({ ok: false, status: 401, error: 'signed_out' });
    expect(apply).not.toHaveBeenCalled();
    expect(await store.loadApp('livediagram.app')).toEqual({
      ok: true,
      data: { all: {}, app: { showMinimap: false } },
    });
    expect(lastSettingsResetAt()).toBe(0);
  });
});

describe('resetting a guest’s settings', () => {
  it('drops only the editor’s own copy, sending nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const apply = vi.fn();
    expect(await resetBrowserSettings(apply)).toEqual({ ok: true, data: { all: {} } });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lastSettingsResetAt()).toBe(0);
    fetchSpy.mockRestore();
  });
});
