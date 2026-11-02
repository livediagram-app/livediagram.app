'use client';

import { useCallback, useRef, useState } from 'react';
import type { CommunityPost } from '@liveworkspace/community';
import { useCommunitySite } from '../client';
import { CommunityApiError } from './api';

// One post's like, toggled optimistically: the heart and count flip at once, the server's answer then settles the
// count, and a failure rolls both back. A 404 means the post was hidden or removed while open, which the caller can
// say. Mount it under `key={post.id}` so a different post starts from its own state.

export type LikeState = {
  liked: boolean;
  likeCount: number;
  pending: boolean;
  // The post is no longer in the Community.
  gone: boolean;
  toggle: () => void;
};

export function useLike(post: Pick<CommunityPost, 'id' | 'liked' | 'likeCount'>): LikeState {
  const { api, telemetry } = useCommunitySite();
  const [state, setState] = useState({ liked: post.liked, likeCount: post.likeCount });
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);
  const inFlight = useRef(false);

  const toggle = useCallback(() => {
    if (inFlight.current || gone) return;
    inFlight.current = true;
    const before = state;
    const liking = !before.liked;
    setState({ liked: liking, likeCount: Math.max(0, before.likeCount + (liking ? 1 : -1)) });
    setPending(true);
    if (liking) telemetry.likedPost();
    else telemetry.unlikedPost();
    (liking ? api.likePost(post.id) : api.unlikePost(post.id))
      .then((res) => setState({ liked: res.liked, likeCount: res.likeCount }))
      .catch((err: unknown) => {
        setState(before);
        if (err instanceof CommunityApiError && err.status === 404) setGone(true);
      })
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  }, [api, gone, post.id, state, telemetry]);

  return { ...state, pending, gone, toggle };
}
