// A canvas's Community post as the canvas keeps it (docs/specs/025-community/community.md; liveworkspace/docs/
// community.md): the share code of its link (an index share link, view, never expiring), the post's id at the
// liveworkspace Community service, what the link's doors show of it, and the listing state last sent. At most one
// row, in the canvas's own SQLite (document-schema.ts `community_post`). The posts themselves, their likes, copies
// and reports are the service's (community-service.ts).
//
// Where the post's canvas stands is the index's (its Trash, its team, its share password, its owner): the canvas
// asks it as the post's author (checkCommunityPost), from its own alarm, every COMMUNITY_CHECK_MS while it has a
// post, and sends the service what changed. The same check hears whether the service hid the post after reports.

import {
  COMMUNITY_ANONYMOUS_AUTHOR,
  COMMUNITY_UNKNOWN_AUTHOR,
  type CommunityAuthor,
  type CommunityDocumentState,
} from '@livediagram/api-schema';
import { IndexError } from '@liveworkspace/index-client';
import { communityEnabled } from '../community-enabled';
import { communityService, communityServiceConfigured, getServicePost } from '../community-service';
import { indexFor } from '../index-service';
import { getParticipant } from '../liveworkspace/profiles';
import type { DocumentEnv, Env } from '../types';
import type { DocumentMeta } from './document-content';

// How often a canvas with a post asks the index where it stands, and the service whether it hid the post. A change
// at the index (the canvas to the Trash, into a team, behind a password) reaches the Community listing within this.
export const COMMUNITY_CHECK_MS = 10 * 60_000;

export type CommunityPost = {
  shareCode: string;
  authorId: string;
  postId: string;
  title: string;
  anonymous: boolean;
  hiddenAt: number | null;
  sentState: CommunityDocumentState | 'gone' | null;
  checkedAt: number;
};

type CommunityPostRow = {
  share_code: string;
  author_id: string;
  post_id: string;
  title: string;
  anonymous: number;
  hidden_at: number | null;
  sent_state: string | null;
  checked_at: number;
};

function postOf(row: CommunityPostRow | null): CommunityPost | null {
  if (!row) return null;
  return {
    shareCode: row.share_code,
    authorId: row.author_id,
    postId: row.post_id,
    title: row.title,
    anonymous: row.anonymous === 1,
    hiddenAt: row.hidden_at,
    sentState: (row.sent_state as CommunityPost['sentState']) ?? null,
    checkedAt: row.checked_at,
  };
}

export async function readCommunityPost(env: DocumentEnv): Promise<CommunityPost | null> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT share_code, author_id, post_id, title, anonymous, hidden_at, sent_state, checked_at FROM community_post LIMIT 1',
  ).first<CommunityPostRow>();
  return postOf(row ?? null);
}

// The share code that opens the canvas as its Community post right now, or null: the Community switched on, a post
// not hidden after reports, and the canvas still its author's own (not a team's). The index refuses the link
// itself for a canvas in the Trash or behind a password, so a grant through it never reaches here then.
export function openCommunityCode(
  env: Pick<Env, 'COMMUNITY_ENABLED'>,
  post: CommunityPost | null,
  meta: DocumentMeta | null,
): string | null {
  if (!post || !meta || !communityEnabled(env)) return null;
  if (post.hiddenAt !== null) return null;
  if (meta.ownerId !== post.authorId || meta.teamId !== null) return null;
  return post.shareCode;
}

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export async function communityPostAuthor(env: Env, post: CommunityPost): Promise<CommunityAuthor> {
  if (post.anonymous) return COMMUNITY_ANONYMOUS_AUTHOR;
  const p = await getParticipant(env, post.authorId);
  if (!p) return COMMUNITY_UNKNOWN_AUTHOR;
  return { name: p.name, color: p.color, picture: null };
}

// After the service took a first publish: the post, replacing any previous owner's.
export async function saveCommunityPost(
  env: DocumentEnv,
  post: Pick<CommunityPost, 'shareCode' | 'authorId' | 'postId' | 'title' | 'anonymous'>,
  now: number,
): Promise<void> {
  await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare('DELETE FROM community_post'),
    env.DOCUMENT_DB.prepare(
      `INSERT INTO community_post (share_code, author_id, post_id, title, anonymous, sent_state, checked_at)
       VALUES (?, ?, ?, ?, ?, 'public', ?)`,
    ).bind(post.shareCode, post.authorId, post.postId, post.title, post.anonymous ? 1 : 0, now),
  ]);
}

// After an Edit Listing: what the link's doors show of the post.
export async function updateCommunityPost(
  env: DocumentEnv,
  post: { title: string; anonymous: boolean; hiddenAt?: number | null },
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    'UPDATE community_post SET title = ?, anonymous = ?, hidden_at = COALESCE(hidden_at, ?)',
  )
    .bind(post.title, post.anonymous ? 1 : 0, post.hiddenAt ?? null)
    .run();
}

// Remove From Community: the post goes (its index share link is removed by the caller).
export async function deleteCommunityPost(env: DocumentEnv): Promise<void> {
  await env.DOCUMENT_DB.prepare('DELETE FROM community_post').run();
}

// When the canvas next asks where its post stands, or null for a canvas with no post.
export function communityCheckDueAt(post: CommunityPost | null): number | null {
  return post ? post.checkedAt + COMMUNITY_CHECK_MS : null;
}

// Where the post's canvas stands, as the listing knows it (liveworkspace/docs/specs/007-community/community.md "document_state"): 'gone'
// once the canvas or its link is gone; 'away' in the Trash or no longer the author's; 'closed' in a team or behind a
// share password (a public post cannot ask for one); else 'public'.
export async function communityStateOf(
  env: Env,
  documentId: string,
  post: CommunityPost,
  meta: DocumentMeta | null,
): Promise<CommunityDocumentState | 'gone'> {
  if (!meta) return 'gone';
  if (meta.ownerId !== post.authorId) return 'away';
  const client = indexFor(env, {
    kind: 'delegate',
    personId: post.authorId,
    teams: meta.teamId ? [meta.teamId] : [],
  });
  if (!client) throw new Error('no index');
  try {
    const [{ item }, share] = await Promise.all([
      client.getItem(documentId),
      client.listShareLinks(documentId),
    ]);
    if (!share.links.some((l) => l.code === post.shareCode)) return 'gone';
    if (item.trashedAt !== null || item.ownerId !== post.authorId) return 'away';
    if (item.teamId !== null || share.passwordSet) return 'closed';
    return 'public';
  } catch (err) {
    if (err instanceof IndexError && (err.status === 404 || err.status === 403)) return 'gone';
    throw err;
  }
}

// Ask the index where the post's canvas stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached: the alarm
// tries again on its next check.
export async function checkCommunityPost(
  env: Env & DocumentEnv,
  documentId: string,
  meta: DocumentMeta | null,
  now: number,
): Promise<CommunityPost | null> {
  const post = await readCommunityPost(env);
  if (!post) return null;
  if (!communityServiceConfigured(env)) return post;
  const state = await communityStateOf(env, documentId, post, meta);
  if (state !== post.sentState) {
    const sync =
      state === 'gone'
        ? { documents: [], gone: [documentId] }
        : { documents: [{ document: documentId, state }], gone: [] };
    const res = await communityService(env, '/sync', { method: 'POST', body: sync });
    if (!res.ok) throw new Error(`community sync answered ${res.status}`);
    console.info('[community] state sent', { state });
  }
  if (state === 'gone') {
    await deleteCommunityPost(env);
    return null;
  }
  let hiddenAt = post.hiddenAt;
  if (hiddenAt === null) {
    const found = await getServicePost(env, documentId, post.authorId);
    if (found?.state === 'hidden') hiddenAt = now;
  }
  await env.DOCUMENT_DB.prepare(
    'UPDATE community_post SET sent_state = ?, hidden_at = ?, checked_at = ?',
  )
    .bind(state, hiddenAt, now)
    .run();
  return { ...post, sentState: state, hiddenAt, checkedAt: now };
}
