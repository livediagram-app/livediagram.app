'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CommunityModerationItem, CommunityPostState } from '@livediagram/api-schema';
import { ApiError, apiListModeration, apiModeratePost } from '@/lib/api-client';

// The Moderation page's queue (docs/specs/025-community/community.md "Reports and moderation"):
// reported and hidden posts, and Hide / Restore on one. A 403 is its own status, since it is an answer
// (you are not an operator), not a failure to retry.
export type ModerationStatus = 'loading' | 'forbidden' | 'error' | 'ready';

export function useModerationQueue(ownerId: string | null) {
  const [status, setStatus] = useState<ModerationStatus>('loading');
  const [items, setItems] = useState<CommunityModerationItem[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    apiListModeration(ownerId).then(
      (list) => {
        if (cancelled) return;
        setItems(list);
        setStatus('ready');
      },
      (err: unknown) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ownerId, attempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  // Hide or Restore one post; the answer replaces its row. Throws so the row can say it failed.
  const moderate = useCallback(
    async (postId: string, state: CommunityPostState) => {
      if (!ownerId) return;
      const item = await apiModeratePost(ownerId, postId, state);
      setItems((prev) => prev.map((it) => (it.id === postId ? item : it)));
    },
    [ownerId],
  );

  return { status, items, reload, moderate };
}
