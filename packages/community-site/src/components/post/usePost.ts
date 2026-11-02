'use client';

import { isAbortError } from '@liveworkspace/api-schema/http-errors';
import { useEffect, useState } from 'react';
import type { CommunityPostResponse } from '@liveworkspace/community';
import { useCommunitySite } from '../../client';

// One post and its More Like This. A missing, hidden or trashed post (404)
// or a page with no id is `notFound`; any other failure is `error`. The result remembers which id it
// answered, so "loading" is derived and a stale answer is dropped. `Community·Opened·Post` fires once
// per post that loads.

type PostLoad =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; data: CommunityPostResponse };

type Result = { id: string; reload: number; load: Exclude<PostLoad, { status: 'loading' }> };

export function usePost(id: string | null): { load: PostLoad; retry: () => void } {
  const { api, telemetry } = useCommunitySite();
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api
      .fetchPost(id, controller.signal)
      .then((data) => {
        setResult({
          id,
          reload,
          load: data ? { status: 'ready', data } : { status: 'notFound' },
        });
        if (data) telemetry.openedPost();
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        console.warn('[community] post load failed', err);
        setResult({ id, reload, load: { status: 'error' } });
      });
    return () => controller.abort();
  }, [api, id, reload, telemetry]);

  const load: PostLoad = !id
    ? { status: 'notFound' }
    : result && result.id === id && result.reload === reload
      ? result.load
      : { status: 'loading' };
  return { load, retry: () => setReload((n) => n + 1) };
}
