'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsApiResult } from '../request';
import { useAccountPanelsHost } from './host';

export type Load<T> =
  { state: 'loading' } | { state: 'error'; error: string } | { state: 'ready'; data: T };

const toLoad = <T>(result: SettingsApiResult<T>): Load<T> =>
  result.ok ? { state: 'ready', data: result.data } : { state: 'error', error: result.error };

// Reads one account API path (over the panel host's request) when the panel opens, and again whenever `refresh` is
// called after a change. Only the newest read is shown: an older one that lands after it (the opening read overtaken
// by a refresh, a refresh for a path since left) is dropped, and so is any answer that arrives after the panel has
// gone.
export function useAccountData<T>(path: string): [Load<T>, () => Promise<void>] {
  const { request } = useAccountPanelsHost();
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  // Bumped by each read and on unmount; an answer applies only while its read is still the newest.
  const latest = useRef(0);

  const read = useCallback(async () => {
    const mine = ++latest.current;
    const result = await request<T>(path);
    if (mine === latest.current) setLoad(toLoad(result));
  }, [request, path]);

  useEffect(() => {
    void read();
    return () => {
      latest.current += 1;
    };
  }, [read]);

  return [load, read];
}
