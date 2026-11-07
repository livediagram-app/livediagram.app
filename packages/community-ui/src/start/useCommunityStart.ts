'use client';

import { useEffect, useState } from 'react';
import {
  communityStartInHand,
  fetchCommunityStart,
  type CommunityStartPosts,
  type CommunityStartSource,
} from './start-client';

// Start With's Community tiles for a template picker (liveworkspace/docs/specs/007-community/community.md "Start
// With"). Call it in the picker itself, so its one request goes out when a picker first opens, after it has painted,
// and never on the app's page load. Until the answer arrives, and whenever it cannot (switched off, unreachable), it
// is empty: the picker draws its templates as ever and the tiles join below them, reserving nothing, so nothing moves.
// A picker opened again in the same session draws them on its first frame. `ask` false skips it (a picker whose app
// has no Community).
export function useCommunityStart(source: CommunityStartSource, ask = true): CommunityStartPosts {
  const { app, communityApi, apiBase } = source;
  const [posts, setPosts] = useState<CommunityStartPosts | undefined>(() =>
    ask ? communityStartInHand({ app, communityApi }) : undefined,
  );
  useEffect(() => {
    if (!ask || posts) return;
    let live = true;
    void fetchCommunityStart({ app, communityApi, apiBase }).then((next) => {
      if (live) setPosts(next);
    });
    return () => {
      live = false;
    };
  }, [app, communityApi, apiBase, ask, posts]);
  return (ask && posts) || EMPTY;
}

const EMPTY: CommunityStartPosts = Object.freeze({});
