// A canvas's Community post as the canvas keeps it (docs/specs/025-community/community.md; liveworkspace/docs/
// community.md): every app's document room keeps its post the same way (@liveworkspace/community/app post.ts); this
// binds it to the canvas's own SQLite, the index as the post's author and livehuddle's participants. At most one
// row, in the canvas's own SQLite (document-schema.ts `community_post`).

import {
  checkCommunityPost as checkPost,
  communityPostAuthor as postAuthor,
  deleteCommunityPost as deletePost,
  ownerCommunityState,
  readCommunityPost as readPost,
  saveCommunityPost as savePost,
  updateCommunityPost as updatePost,
  type CommunityIndex,
  type CommunityPost,
} from '@liveworkspace/community/app';
import { communityAppClient } from '@liveworkspace/community/app';
import type { CommunityAuthor } from '@livehuddle/api-schema';
import { COMMUNITY_APP } from '../community-service';
import { indexFor } from '../index-service';
import { getParticipant } from '../liveworkspace/profiles';
import type { DocumentEnv, Env } from '../types';
import type { DocumentMeta } from './document-content';

export {
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  openCommunityCode,
  type CommunityPost,
} from '@liveworkspace/community/app';

const service = communityAppClient(COMMUNITY_APP);

export const readCommunityPost = (env: DocumentEnv) => readPost(env.DOCUMENT_DB);

// The post's state for the owner's read of the document (the header badge), null with no post.
export const readOwnerCommunityState = (env: DocumentEnv) => ownerCommunityState(env.DOCUMENT_DB);

export const saveCommunityPost = (
  env: DocumentEnv,
  post: Pick<CommunityPost, 'shareCode' | 'authorId' | 'postId' | 'title' | 'anonymous'>,
  now: number,
) => savePost(env.DOCUMENT_DB, post, now);
export const updateCommunityPost = (
  env: DocumentEnv,
  post: { title: string; anonymous: boolean; hiddenAt?: number | null },
) => updatePost(env.DOCUMENT_DB, post);
export const deleteCommunityPost = (env: DocumentEnv) => deletePost(env.DOCUMENT_DB);

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export const communityPostAuthor = (env: Env, post: CommunityPost): Promise<CommunityAuthor> =>
  postAuthor(post, (personId) => getParticipant(env, personId));

// The index as the post's author, in the canvas's team when it has one.
export const communityIndexAs =
  (env: Env) =>
  (authorId: string, teamId: string | null): CommunityIndex | null =>
    indexFor(env, { kind: 'delegate', personId: authorId, teams: teamId ? [teamId] : [] });

// Ask the index where the post's canvas stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached.
export const checkCommunityPost = (
  env: Env & DocumentEnv,
  documentId: string,
  meta: DocumentMeta | null,
  now: number,
): Promise<CommunityPost | null> =>
  checkPost({
    env,
    db: env.DOCUMENT_DB,
    service,
    documentId,
    meta,
    indexAs: communityIndexAs(env),
    now,
  });
