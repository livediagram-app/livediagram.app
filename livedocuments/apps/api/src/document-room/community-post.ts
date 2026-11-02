// A document's Community post as the document keeps it (docs/specs/025-community/community.md "Viewing a post's
// document"; liveworkspace/docs/specs/007-community/community.md "Keeping in step"): every app's document room keeps
// its post the same way (@liveworkspace/community/app post.ts); this binds it to the document's own SQLite, the index
// as the post's author and livedocuments' participants. At most one row (document-schema.ts `community_post`).

import {
  checkCommunityPost as checkPost,
  communityPostAuthor as postAuthor,
  leaveCommunity as leavePost,
  ownerCommunityState,
  readCommunityPost as readPost,
  type CommunityIndex,
  type CommunityPost,
} from '@liveworkspace/community/app';
import type { CommunityAuthor } from '@livedocuments/api-schema';
import { communityService } from '../community-service';
import { indexFor } from '../index-service';
import { getParticipant } from '../person/profiles';
import type { DocumentEnv, Env } from '../types';
import type { DocumentMeta } from './document-content';

export {
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  openCommunityCode,
  type CommunityPost,
} from '@liveworkspace/community/app';

export const readCommunityPost = (env: DocumentEnv) => readPost(env.DOCUMENT_DB);

// The post's state for the owner's read of the document (the header badge), null with no post.
export const readOwnerCommunityState = (env: DocumentEnv) => ownerCommunityState(env.DOCUMENT_DB);

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export const communityPostAuthor = (env: Env, post: CommunityPost): Promise<CommunityAuthor> =>
  postAuthor(post, (personId) => getParticipant(env, personId));

// The index as the post's author, in the document's team when it has one.
export const communityIndexAs =
  (env: Env) =>
  (authorId: string, teamId: string | null): CommunityIndex | null =>
    indexFor(env, { kind: 'delegate', personId: authorId, teams: teamId ? [teamId] : [] });

// Ask the index where the post's document stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached.
export const checkCommunityPost = (
  env: DocumentEnv,
  documentId: string,
  meta: DocumentMeta | null,
  now: number,
): Promise<CommunityPost | null> =>
  checkPost({
    env,
    db: env.DOCUMENT_DB,
    service: communityService,
    documentId,
    meta,
    indexAs: communityIndexAs(env),
    now,
  });

// A document going for good takes its post with it: the service hears it is gone. Best effort.
export const leaveCommunity = (env: DocumentEnv, documentId: string): Promise<void> =>
  leavePost(env, env.DOCUMENT_DB, communityService, documentId);
