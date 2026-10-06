'use client';

import { useCallback, useRef, useState } from 'react';
import type { CommunityPost } from '@livediagram/api-schema';
import { CommunityApiError, likePost, unlikePost } from './api';
import { communityTelemetry } from './telemetry';

// One post's like, toggled optimistically (blueprint §5, §11 INP): the heart and count flip at once,
// the server's answer then settles the count, and a failure rolls both back. A 404 means the post was
// hidden or removed while open (blueprint §6), which the caller can say. Mount it under
// `key={post.id}` so a different post starts from its own state.

export type LikeState = {
  liked: boolean;
  likeCount: number;
  pending: boolean;
  // The post is no longer in the Community.
  gone: boolean;
  toggle: () => void;
};

export function useLike(post: Pick<CommunityPost, 'id' | 'liked' | 'likeCount'>): LikeState {
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
    if (liking) communityTelemetry.likedPost();
    else communityTelemetry.unlikedPost();
    (liking ? likePost(post.id) : unlikePost(post.id))
      .then((res) => setState({ liked: res.liked, likeCount: res.likeCount }))
      .catch((err: unknown) => {
        setState(before);
        if (err instanceof CommunityApiError && err.status === 404) setGone(true);
      })
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  }, [gone, post.id, state]);

  return { ...state, pending, gone, toggle };
}
