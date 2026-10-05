'use client';

import { isAbortError } from '@livediagram/api-schema';
import { useEffect, useState } from 'react';
import type { CommunityPostResponse } from '@livediagram/api-schema';
import { fetchPost } from '@/lib/api';
import { communityTelemetry } from '@/lib/telemetry';

// One post and its More Like This (blueprint §5 "Post page"). A missing, hidden or trashed post (404)
// or a page with no id is `notFound`; any other failure is `error`. The result remembers which id it
// answered, so "loading" is derived and a stale answer is dropped. `Community·Opened·Post` fires once
// per post that loads.

export type PostLoad =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; data: CommunityPostResponse };

type Result = { id: string; reload: number; load: Exclude<PostLoad, { status: 'loading' }> };

export function usePost(id: string | null): { load: PostLoad; retry: () => void } {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchPost(id, controller.signal)
      .then((data) => {
        setResult({
          id,
          reload,
          load: data ? { status: 'ready', data } : { status: 'notFound' },
        });
        if (data) communityTelemetry.openedPost();
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        console.warn('[community] post load failed', err);
        setResult({ id, reload, load: { status: 'error' } });
      });
    return () => controller.abort();
  }, [id, reload]);

  const load: PostLoad = !id
    ? { status: 'notFound' }
    : result && result.id === id && result.reload === reload
      ? result.load
      : { status: 'loading' };
  return { load, retry: () => setReload((n) => n + 1) };
}
