// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SettingsApiResult } from '../request';
import { AccountPanelsProvider } from './host';
import { useAccountData } from './useAccountData';

// An account panel's read (useAccountData): only the newest answer is shown, so a slow opening read can't overwrite
// what a refresh after a change brought back.

afterEach(cleanup);

function deferredHost() {
  const pending: { path: string; resolve: (r: SettingsApiResult<unknown>) => void }[] = [];
  const request = <T,>(path: string) =>
    new Promise<SettingsApiResult<T>>((resolve) => {
      pending.push({ path, resolve: resolve as (r: SettingsApiResult<unknown>) => void });
    });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccountPanelsProvider host={{ request: request as never }}>{children}</AccountPanelsProvider>
  );
  return { pending, wrapper };
}

describe('useAccountData', () => {
  it('keeps a refresh’s answer when the opening read lands after it', async () => {
    const { pending, wrapper } = deferredHost();
    const { result } = renderHook(() => useAccountData<{ n: number }>('/tokens'), { wrapper });
    expect(result.current[0]).toEqual({ state: 'loading' });
    let refreshed!: Promise<void>;
    act(() => {
      refreshed = result.current[1]();
    });
    expect(pending).toHaveLength(2);
    await act(async () => {
      pending[1]!.resolve({ ok: true, data: { n: 2 } });
      await refreshed;
    });
    expect(result.current[0]).toEqual({ state: 'ready', data: { n: 2 } });
    await act(async () => {
      pending[0]!.resolve({ ok: true, data: { n: 1 } });
      await Promise.resolve();
    });
    expect(result.current[0]).toEqual({ state: 'ready', data: { n: 2 } });
  });

  it('shows an error, and drops an answer that arrives after the panel has gone', async () => {
    const { pending, wrapper } = deferredHost();
    const { result, unmount } = renderHook(() => useAccountData('/teams'), { wrapper });
    await act(async () => {
      pending[0]!.resolve({ ok: false, status: 0, error: 'offline' });
      await Promise.resolve();
    });
    expect(result.current[0]).toEqual({ state: 'error', error: 'offline' });
    act(() => void result.current[1]());
    unmount();
    await act(async () => {
      pending[1]!.resolve({ ok: true, data: {} });
      await Promise.resolve();
    });
    expect(result.current[0]).toEqual({ state: 'error', error: 'offline' });
  });
});
