// A design's Community post as the design keeps it (docs/specs/025-community/community.md "Viewing a post's
// design"; liveworkspace/docs/specs/007-community/community.md "Keeping in step"): every app's design room keeps
// its post the same way (@liveworkspace/community/app post.ts); this binds it to the design's own SQLite, the index
// as the post's author and livedesign's participants. At most one row (design-schema.ts `community_post`).

import {
  checkCommunityPost as checkPost,
  communityPostAuthor as postAuthor,
  leaveCommunity as leavePost,
  ownerCommunityState,
  readCommunityPost as readPost,
  type CommunityIndex,
  type CommunityPost,
} from '@liveworkspace/community/app';
import type { CommunityAuthor } from '@livedesign/api-schema';
import { communityService } from '../community-service';
import { indexFor } from '../index-service';
import { getParticipant } from '../accounts/profiles';
import type { DesignEnv, Env } from '../types';
import type { DesignMeta } from './design-content';

export {
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  openCommunityCode,
  type CommunityPost,
} from '@liveworkspace/community/app';

export const readCommunityPost = (env: DesignEnv) => readPost(env.DESIGN_DB);

// The post's state for the owner's read of the design (the header badge), null with no post.
export const readOwnerCommunityState = (env: DesignEnv) => ownerCommunityState(env.DESIGN_DB);

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export const communityPostAuthor = (env: Env, post: CommunityPost): Promise<CommunityAuthor> =>
  postAuthor(post, (personId) => getParticipant(env, personId));

// The index as the post's author, in the design's team when it has one.
export const communityIndexAs =
  (env: Env) =>
  (authorId: string, teamId: string | null): CommunityIndex | null =>
    indexFor(env, { kind: 'delegate', personId: authorId, teams: teamId ? [teamId] : [] });

// Ask the index where the post's design stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached.
export const checkCommunityPost = (
  env: DesignEnv,
  designId: string,
  meta: DesignMeta | null,
  now: number,
): Promise<CommunityPost | null> =>
  checkPost({
    env,
    db: env.DESIGN_DB,
    service: communityService,
    documentId: designId,
    meta,
    indexAs: communityIndexAs(env),
    now,
  });

// A design going for good takes its post with it: the service hears it is gone. Best effort.
export const leaveCommunity = (env: DesignEnv, designId: string): Promise<void> =>
  leavePost(env, env.DESIGN_DB, communityService, designId);
