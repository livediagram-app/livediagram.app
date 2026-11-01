// livehuddle's side of the liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md; docs/specs/025-community/
// community.md): the shared app client (@liveworkspace/community/app) bound to this app. The posts, likes,
// copies and reports live there; each canvas keeps its own post's link (document-room/community-post.ts), and tells
// the service what only it knows: who may publish, where its canvas stands, and who copied it.

import { communityAppClient, type CommunityAppCall } from '@liveworkspace/community/app';
import type { CommunityAppPublish } from '@livehuddle/api-schema';
import type { Env } from './types';

export {
  communityKeyHeaders,
  communityServiceConfigured,
  copierHash,
} from '@liveworkspace/community/app';
import { COMMUNITY_APP } from '@livehuddle/api-schema';

// Borrowed from livediagram until the community app is cut (@livehuddle/api-schema COMMUNITY_APP).
export { COMMUNITY_APP };

const client = communityAppClient(COMMUNITY_APP);

export const communityService = (env: Env, path: string, init?: CommunityAppCall) =>
  client.call(env, path, init);
export const getServicePost = (env: Env, documentId: string, ownerId: string) =>
  client.getPost(env, documentId, ownerId);
export const publishServicePost = (env: Env, documentId: string, publish: CommunityAppPublish) =>
  client.publishPost(env, documentId, publish);
export const removeServicePost = (env: Env, documentId: string, ownerId: string) =>
  client.removePost(env, documentId, ownerId);
export const countCommunityCopy = (env: Env, documentId: string, copierId: string, ip: string) =>
  client.countCopy(env, documentId, copierId, ip);
export const forgetCommunityCopier = (env: Env, ownerId: string) =>
  client.forgetCopier(env, ownerId);
export const mergeCommunityCopier = (env: Env, fromId: string, toId: string) =>
  client.mergeCopier(env, fromId, toId);
