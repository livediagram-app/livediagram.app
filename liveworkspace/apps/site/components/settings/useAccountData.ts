'use client';

import { useCallback, useEffect, useState } from 'react';
import { accountApi, type ApiResult } from '@/lib/account-api';

export type Load<T> =
  { state: 'loading' } | { state: 'error'; error: string } | { state: 'ready'; data: T };

const toLoad = <T>(result: ApiResult<T>): Load<T> =>
  result.ok ? { state: 'ready', data: result.data } : { state: 'error', error: result.error };

// Reads one account API path when the page opens, and again whenever `refresh` is called after a
// change. An answer that arrives after the page has moved on is dropped.
export function useAccountData<T>(path: string): [Load<T>, () => Promise<void>] {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    void accountApi<T>(path).then((result) => {
      if (live) setLoad(toLoad(result));
    });
    return () => {
      live = false;
    };
  }, [path]);

  const refresh = useCallback(async () => {
    setLoad(toLoad(await accountApi<T>(path)));
  }, [path]);

  return [load, refresh];
}
