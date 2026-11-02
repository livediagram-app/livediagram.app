'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CommunityOwnPost,
  CommunityPostInput,
  CommunityPostState,
} from '@liveworkspace/community';
import { communityErrorMessage } from './community-errors';
import type { CommunityOwnerClient, CommunityWords } from './host';

// The owner's Community post on a document (liveworkspace/docs/specs/007-community/community.md "The Share dialog's
// Community tab"), read when the Share dialog opens so its Community tab shows the post as it is now (likes and copies
// move while the dialog is closed). `publish` covers both Share to Community and Edit Listing (the same PUT); both it
// and `remove` throw on failure so the caller can word the refusal where the person is looking.
type UseCommunityPost = {
  post: CommunityOwnPost | null;
  loading: boolean;
  // Why the post couldn't be read, worded for the section; null when it could.
  error: string | null;
  publish: (input: CommunityPostInput) => Promise<CommunityOwnPost>;
  remove: () => Promise<void>;
};

type Loaded = { key: string; post: CommunityOwnPost | null; error: string | null };

export function useCommunityPost(opts: {
  client: CommunityOwnerClient;
  // Who and what the post is for: a change of either reads again.
  ownerId: string | null;
  documentId: string | null;
  // Read only while the Share dialog is open (and for a document that can have a post at all).
  open: boolean;
  words: CommunityWords;
  // The post's state as each read, publish and remove leaves it (the editor's header badge follows it).
  onStateChange?: (state: CommunityPostState | null) => void;
}): UseCommunityPost {
  const { client, ownerId, documentId, open, words } = opts;
  const key = open && ownerId && documentId ? `${ownerId}|${documentId}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // The latest client, words and listener, read when an answer lands, so a host that builds them per render does not
  // read the post again on every render.
  const latest = useRef({ client, words, onStateChange: opts.onStateChange });
  latest.current = { client, words, onStateChange: opts.onStateChange };

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    latest.current.client.get().then(
      (post) => {
        if (cancelled) return;
        setLoaded({ key, post, error: null });
        latest.current.onStateChange?.(post?.state ?? null);
      },
      (err: unknown) => {
        if (!cancelled) {
          setLoaded({ key, post: null, error: communityErrorMessage(err, latest.current.words) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const publish = useCallback(
    async (input: CommunityPostInput) => {
      if (!key) throw new Error('no document');
      const post = await latest.current.client.publish(input);
      setLoaded({ key, post, error: null });
      latest.current.onStateChange?.(post.state);
      return post;
    },
    [key],
  );

  const remove = useCallback(async () => {
    if (!key) return;
    await latest.current.client.remove();
    setLoaded({ key, post: null, error: null });
    latest.current.onStateChange?.(null);
  }, [key]);

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
