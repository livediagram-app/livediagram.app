import type { CommunityAuthor } from '@livehuddle/api-schema';
import { communityService, communityServiceConfigured } from '../community-service';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS as COMMUNITY_CHECK_EVERY_MS,
  communityCheckDueAt,
  communityPostAuthor,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import { readDocumentMeta, type DocumentMeta } from './document-content';
import type { DocumentRoom } from './document-room';

// The document room's side of its Community post (document-room.ts, community-post.ts): what the doors read of the
// post, its periodic check, and its leaving with the canvas. Each function takes the room it acts for.

// The canvas's Community post's link as the doors read it: its code, and whether it opens the canvas now
// (community-post.ts openCommunityCode). Null for a canvas with no post.
export async function community(
  room: DocumentRoom,
  documentId?: string,
): Promise<{ code: string; open: boolean } | null> {
  if (documentId !== undefined) room.bindDocument(documentId);
  if (room.documentId === null || !room.hasSchema()) return null;
  return communityOf(room, room.documentId);
}

export async function communityOf(
  room: DocumentRoom,
  documentId: string,
): Promise<{ code: string; open: boolean } | null> {
  if (!room.hasSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post) return null;
  const meta = await readDocumentMeta(env, documentId);
  return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
}

// What a visitor through the canvas's Community post's open link is told of the post (docs/specs/025-community/
// community.md "Viewing a post's document"): its id at the service and who it shows as author. Null when `code`
// is not the post's link or the post does not open the canvas now.
export async function communityListing(
  room: DocumentRoom,
  documentId: string,
  code: string,
): Promise<{ postId: string; author: CommunityAuthor } | null> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post || post.shareCode !== code) return null;
  const meta = await readDocumentMeta(env, documentId);
  if (openCommunityCode(env, post, meta) !== code) return null;
  return { postId: post.postId, author: await communityPostAuthor(env, post) };
}

// A copy through the canvas's Community post's link is named after the post (docs/specs/025-community/
// community.md "Making a copy"): its title, when `code` is the post's link and the post is open. Null otherwise.
export async function communityPostTitle(
  room: DocumentRoom,
  documentId: string,
  code: string,
): Promise<string | null> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post || post.shareCode !== code) return null;
  const meta = await readDocumentMeta(env, documentId);
  return openCommunityCode(env, post, meta) ? post.title : null;
}

// A canvas going for good takes its Community post with it: the service hears it is gone. Best effort.
export async function leaveCommunity(room: DocumentRoom): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  if (!env || !documentId || !room.hasSchema() || !communityServiceConfigured(env)) return;
  room.ensureSchema();
  if (!(await readCommunityPost(env))) return;
  try {
    await communityService(env, '/sync', {
      method: 'POST',
      body: { documents: [], gone: [documentId] },
    });
  } catch (error) {
    console.warn('[community] gone not sent', { error: String(error) });
  }
}

// Ask the index where the Community post's canvas stands, and send the service what changed (community-post.ts).
export async function checkCommunity(room: DocumentRoom, now: number): Promise<void> {
  const env = room.roomEnv;
  const documentId = room.documentId;
  room.communityAt = null;
  if (!env || !documentId || !room.hasSchema()) return;
  let post: CommunityPost | null;
  try {
    const meta: DocumentMeta | null = await readDocumentMeta(env, documentId);
    post = await checkCommunityPost(env, documentId, meta, now);
  } catch (error) {
    console.warn('[community] check failed', { error: String(error) });
    post = await readCommunityPost(env);
    if (post) {
      room.communityAt = now + COMMUNITY_CHECK_EVERY_MS;
      return;
    }
  }
  room.communityAt = communityCheckDueAt(post);
}
