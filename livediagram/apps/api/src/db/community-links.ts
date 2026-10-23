// What this api keeps of the Community (docs/specs/025-community/community.md; liveworkspace/docs/community.md):
// each post's community link and the little its doors need. The posts themselves, their likes, copies and reports
// are liveworkspace's (community-service.ts). Migration 0100.

import {
  COMMUNITY_ANONYMOUS_AUTHOR,
  COMMUNITY_UNKNOWN_AUTHOR,
  type CommunityAuthor,
  type CommunityDocumentState,
} from '@livediagram/api-schema';
import { communityEnabled } from '../community-enabled';
import type { Env } from '../types';
import { getParticipant } from './participants';
import { generateShareCode } from './share';

export type CommunityLinkRow = {
  share_code: string;
  document_id: string;
  author_id: string;
  post_id: string;
  title: string;
  anonymous: number;
  hidden_at: number | null;
  sent_state: string | null;
};

const LINK_COLS =
  'cl.share_code, cl.document_id, cl.author_id, cl.post_id, cl.title, cl.anonymous, cl.hidden_at, cl.sent_state';

// Where a post's document stands (`d` its documents row, `s` its community link's share_links row): 'gone' once the
// document is deleted for good or its link went with its author's account; 'away' in the Trash
// or no longer the post's author's (a teammate moved it out of a team into their own library); 'closed' in a team
// library or behind a share password (team documents cannot be published, and a public post cannot ask for a
// password); else 'public'. liveworkspace lists a post only while its document is 'public', and My Shares leaves
// out an 'away' one.
export const DOCUMENT_STATE_SQL = `CASE
    WHEN d.id IS NULL OR s.code IS NULL THEN 'gone'
    WHEN d.trashed_at IS NOT NULL OR d.owner_id <> cl.author_id THEN 'away'
    WHEN d.team_id IS NOT NULL OR d.share_password IS NOT NULL THEN 'closed'
    ELSE 'public' END`;

// G4: the one test every community link passes through (communityLinkAccess) and the Public badge reads: the post
// not hidden after reports, and its document public.
export const PUBLIC_LINK = `cl.hidden_at IS NULL AND d.trashed_at IS NULL AND d.team_id IS NULL
  AND d.owner_id = cl.author_id AND d.share_password IS NULL`;

export async function getCommunityLinkForDocument(
  env: Env,
  documentId: string,
): Promise<CommunityLinkRow | null> {
  return env.DB.prepare(`SELECT ${LINK_COLS} FROM community_links cl WHERE cl.document_id = ?`)
    .bind(documentId)
    .first<CommunityLinkRow>();
}

export async function getCommunityLinkByShareCode(
  env: Env,
  shareCode: string,
): Promise<CommunityLinkRow | null> {
  return env.DB.prepare(`SELECT ${LINK_COLS} FROM community_links cl WHERE cl.share_code = ?`)
    .bind(shareCode)
    .first<CommunityLinkRow>();
}

// Whether a Community post's link is open to the public right now: 'public' when it passes the public rule, 'closed'
// when the post exists but does not, null when the code is no post's link. One rule for every door that reads
// through the link.
export async function communityLinkAccess(
  env: Env,
  shareCode: string,
): Promise<'public' | 'closed' | null> {
  // Switched off, every community link is closed (docs/specs/025-community/community.md "Turning the Community
  // off"). This is the one gate the grant, the share resolve and the card image all pass through.
  if (!communityEnabled(env)) return 'closed';
  const row = await env.DB.prepare(
    `SELECT (${PUBLIC_LINK}) AS open FROM community_links cl JOIN documents d ON d.id = cl.document_id
      WHERE cl.share_code = ?`,
  )
    .bind(shareCode)
    .first<{ open: number }>();
  if (!row) return null;
  return row.open ? 'public' : 'closed';
}

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export async function communityLinkAuthor(
  env: Env,
  link: CommunityLinkRow,
): Promise<CommunityAuthor> {
  if (link.anonymous) return COMMUNITY_ANONYMOUS_AUTHOR;
  const p = await getParticipant(env, link.author_id);
  if (!p) return COMMUNITY_UNKNOWN_AUTHOR;
  return { name: p.name, color: p.color, picture: null };
}

// A fresh community link code. Nothing is written until liveworkspace has taken the post (saveNewCommunityLink).
export function newCommunityLinkCode(): string {
  return generateShareCode();
}

// After liveworkspace took a first publish: the community link (view role, never expiring, all tabs) and what this
// api keeps of the post, in one batch, replacing a previous owner's link on the same document. Throws on a UNIQUE
// failure: another publish of the same document got here first.
export async function saveNewCommunityLink(
  env: Env,
  link: {
    shareCode: string;
    documentId: string;
    authorId: string;
    postId: string;
    title: string;
    anonymous: boolean;
  },
  now: number = Date.now(),
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM share_links WHERE purpose = 'community' AND document_id = ? AND code <> ?",
    ).bind(link.documentId, link.shareCode),
    env.DB.prepare('DELETE FROM community_links WHERE document_id = ? AND author_id <> ?').bind(
      link.documentId,
      link.authorId,
    ),
    env.DB.prepare(
      "INSERT INTO share_links (code, document_id, role, created_at, expiry, expires_at, tab_id, purpose) VALUES (?, ?, 'view', ?, NULL, NULL, NULL, 'community')",
    ).bind(link.shareCode, link.documentId, now),
    env.DB.prepare(
      `INSERT INTO community_links (share_code, document_id, author_id, post_id, title, anonymous, sent_state)
       VALUES (?, ?, ?, ?, ?, ?, 'public')`,
    ).bind(
      link.shareCode,
      link.documentId,
      link.authorId,
      link.postId,
      link.title,
      link.anonymous ? 1 : 0,
    ),
  ]);
}

// After an Edit Listing: what the link's doors show of the post.
export async function updateCommunityLink(
  env: Env,
  shareCode: string,
  post: { title: string; anonymous: boolean; hiddenAt?: number | null },
): Promise<void> {
  await env.DB.prepare(
    'UPDATE community_links SET title = ?, anonymous = ?, hidden_at = COALESCE(hidden_at, ?) WHERE share_code = ?',
  )
    .bind(post.title, post.anonymous ? 1 : 0, post.hiddenAt ?? null, shareCode)
    .run();
}

// Remove From Community, or a first publish undone: the link and what this api kept of the post.
export async function deleteCommunityLink(env: Env, shareCode: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM share_links WHERE code = ? AND purpose = 'community'").bind(
      shareCode,
    ),
    env.DB.prepare('DELETE FROM community_links WHERE share_code = ?').bind(shareCode),
  ]);
}

// What has changed since the last sync: every post whose document now stands somewhere other than where this api
// last said, or is gone. One document's alone when `documentId` is given (right after a change to it); every one
// otherwise (the cron). `limit` keeps a sync to what one request may carry.
export async function pendingCommunitySync(
  env: Env,
  limit: number,
  documentId?: string,
): Promise<{ documentId: string; state: CommunityDocumentState | 'gone' }[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM (
       SELECT cl.document_id AS document_id, cl.sent_state AS sent_state, ${DOCUMENT_STATE_SQL} AS state
         FROM community_links cl LEFT JOIN documents d ON d.id = cl.document_id
         LEFT JOIN share_links s ON s.code = cl.share_code
        ${documentId ? 'WHERE cl.document_id = ?1' : ''})
      WHERE sent_state IS NOT state
      LIMIT ${documentId ? '?2' : '?1'}`,
  )
    .bind(...(documentId ? [documentId, limit] : [limit]))
    .all<{ document_id: string; state: CommunityDocumentState | 'gone' }>();
  return (result.results ?? []).map((r) => ({ documentId: r.document_id, state: r.state }));
}

// liveworkspace has heard: what was sent is now the last word, and a gone document's row goes. One statement per
// state, not per document: D1 counts statements against an invocation's query limit, and a batch can be 500.
export async function markCommunitySynced(
  env: Env,
  sent: { documentId: string; state: CommunityDocumentState | 'gone' }[],
): Promise<void> {
  const byState = new Map<string, string[]>();
  for (const { documentId, state } of sent) {
    const documents = byState.get(state) ?? [];
    documents.push(documentId);
    byState.set(state, documents);
  }
  if (byState.size === 0) return;
  await env.DB.batch(
    [...byState].map(([state, documents]) =>
      state === 'gone'
        ? env.DB.prepare(
            'DELETE FROM community_links WHERE document_id IN (SELECT value FROM json_each(?))',
          ).bind(JSON.stringify(documents))
        : env.DB.prepare(
            'UPDATE community_links SET sent_state = ? WHERE document_id IN (SELECT value FROM json_each(?))',
          ).bind(state, JSON.stringify(documents)),
    ),
  );
}

// The newest hide this api has heard of: the next pull asks for hides from then on.
export async function latestCommunityHide(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT MAX(hidden_at) AS at FROM community_links').first<{
    at: number | null;
  }>();
  return row?.at ?? 0;
}

// Posts liveworkspace hid after reports: their links close for good.
export async function markCommunityHidden(
  env: Env,
  hidden: { document: string; hiddenAt: number }[],
): Promise<void> {
  if (hidden.length === 0) return;
  // One statement, however many: each link takes its own document's hide time from the list.
  await env.DB.prepare(
    `UPDATE community_links
        SET hidden_at = (SELECT json_extract(h.value, '$.hiddenAt') FROM json_each(?1) h
                          WHERE json_extract(h.value, '$.document') = community_links.document_id)
      WHERE hidden_at IS NULL
        AND document_id IN (SELECT json_extract(value, '$.document') FROM json_each(?1))`,
  )
    .bind(JSON.stringify(hidden))
    .run();
}
