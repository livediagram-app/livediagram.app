'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CommunityOwnPost, CommunityPostInput } from '@livediagram/api-schema';
import {
  apiGetCommunityPost,
  apiPublishCommunityPost,
  apiRemoveCommunityPost,
} from '@/lib/api-client';
import { communityErrorMessage } from '@/lib/community-errors';
import { setCommunityState } from '@/lib/community-state-store';

// The owner's Community post on the open document (docs/specs/025-community/community.md
// "Publishing"), read when the Share dialog opens so its Community section shows the post as it is now
// (likes and copies move while the dialog is closed). `publish` covers both Share to Community and
// Edit Listing (the same PUT); both it and `remove` throw on failure so the caller can word the
// refusal where the person is looking.
export type UseCommunityPost = {
  post: CommunityOwnPost | null;
  loading: boolean;
  // Why the post couldn't be read, worded for the section; null when it could.
  error: string | null;
  publish: (input: CommunityPostInput) => Promise<CommunityOwnPost>;
  remove: () => Promise<void>;
};

type Loaded = { key: string; post: CommunityOwnPost | null; error: string | null };

export function useCommunityPost(opts: {
  ownerId: string | null;
  documentId: string | null;
  // Read only while the Share dialog is open (and for a document that can have a post at all).
  open: boolean;
}): UseCommunityPost {
  const { ownerId, documentId, open } = opts;
  const key = open && ownerId && documentId ? `${ownerId}|${documentId}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key || !ownerId || !documentId) return;
    let cancelled = false;
    apiGetCommunityPost(ownerId, documentId).then(
      (post) => {
        if (cancelled) return;
        setLoaded({ key, post, error: null });
        setCommunityState(documentId, post?.state ?? null);
      },
      (err: unknown) => {
        if (!cancelled) setLoaded({ key, post: null, error: communityErrorMessage(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, ownerId, documentId]);

  const publish = useCallback(
    async (input: CommunityPostInput) => {
      if (!ownerId || !documentId) throw new Error('no document');
      const post = await apiPublishCommunityPost(ownerId, documentId, input);
      setLoaded({ key: `${ownerId}|${documentId}`, post, error: null });
      setCommunityState(documentId, post.state);
      return post;
    },
    [ownerId, documentId],
  );

  const remove = useCallback(async () => {
    if (!ownerId || !documentId) return;
    await apiRemoveCommunityPost(ownerId, documentId);
    setLoaded({ key: `${ownerId}|${documentId}`, post: null, error: null });
    setCommunityState(documentId, null);
  }, [ownerId, documentId]);

  // A result for another document (or none yet) is loading; a reopen shows the last result for this
  // one at once while the fresh read lands.
  const current = loaded && loaded.key === key ? loaded : null;
  return {
    post: current?.post ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    publish,
    remove,
  };
}
