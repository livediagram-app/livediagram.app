'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SettingsApiResult } from '../request';
import { useAccountPanelsHost } from './host';

export type Load<T> =
  { state: 'loading' } | { state: 'error'; error: string } | { state: 'ready'; data: T };

const toLoad = <T>(result: SettingsApiResult<T>): Load<T> =>
  result.ok ? { state: 'ready', data: result.data } : { state: 'error', error: result.error };

// Reads one account API path (over the panel host's request) when the panel opens, and again whenever `refresh` is
// called after a change. An answer that arrives after the panel has gone is dropped.
export function useAccountData<T>(path: string): [Load<T>, () => Promise<void>] {
  const { request } = useAccountPanelsHost();
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    void request<T>(path).then((result) => {
      if (live) setLoad(toLoad(result));
    });
    return () => {
      live = false;
    };
  }, [request, path]);

  const refresh = useCallback(async () => {
    setLoad(toLoad(await request<T>(path)));
  }, [request, path]);

  return [load, refresh];
}
