// A document's Community post as the document keeps it (liveworkspace/docs/specs/007-community/community.md "What
// lives where", "Keeping in step"): the share code of its link (an index share link, view, never expiring), the
// post's id at the service, what the link's doors show of it, and the listing state last sent. At most one row, in
// the document's own SQLite (its room's `community_post`, COMMUNITY_POST_TABLE). Every app's document room keeps it
// the same way; the posts themselves, their likes, copies and reports are the service's.
//
// Where the post's document stands is the index's (its Trash, its team, its share password, its owner): the document
// asks it as the post's author (checkCommunityPost), from its own alarm, every COMMUNITY_CHECK_MS while it has a
// post, and sends the service what changed. The same check hears whether the service hid the post after reports.

import {
  COMMUNITY_ANONYMOUS_AUTHOR,
  COMMUNITY_UNKNOWN_AUTHOR,
  type CommunityAuthor,
} from '../authors';
import type { CommunityDocumentState } from '../service';
import {
  communityEnabled,
  communityServiceConfigured,
  type CommunityAppClient,
  type CommunityAppEnv,
} from './client';

// How often a document with a post asks the index where it stands, and the service whether it hid the post. A change
// at the index (the document to the Trash, into a team, behind a password) reaches the listing within this.
export const COMMUNITY_CHECK_MS = 10 * 60_000;

// The room's table, for its schema. An app adds its own triggers on it (its summary outbox).
export const COMMUNITY_POST_TABLE = `CREATE TABLE IF NOT EXISTS community_post (
  share_code TEXT    PRIMARY KEY,
  author_id  TEXT    NOT NULL,
  post_id    TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 1,
  hidden_at  INTEGER NULL,
  sent_state TEXT    NULL,
  checked_at INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;`;

// Listed in the Community, as the document's summary reads it: a post not hidden after reports, whose document the
// listing last heard was public (nothing heard yet, just after publishing, counts).
export const COMMUNITY_LISTED_QUERY = `SELECT 1 AS listed FROM community_post
        WHERE hidden_at IS NULL AND (sent_state IS NULL OR sent_state = 'public') LIMIT 1`;

// The document's own SQLite behind the D1 surface, as much of it as the post needs.
export type CommunityPostStatement = {
  bind(...values: unknown[]): CommunityPostStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type CommunityPostDb = {
  prepare(sql: string): CommunityPostStatement;
  batch(statements: CommunityPostStatement[]): Promise<unknown>;
};

// What the post's checks read of the document itself: its owner and team. Null once it is gone.
export type CommunityDocumentMeta = { ownerId: string; teamId: string | null };

// The index as the post's author: the document's item, its share links, and making and removing the community link.
export type CommunityIndex = {
  getItem(
    id: string,
  ): Promise<{ item: { trashedAt: number | null; ownerId: string; teamId: string | null } }>;
  listShareLinks(id: string): Promise<{ links: { code: string }[]; passwordSet: boolean }>;
  createShareLink(
    id: string,
    input: { level: 'view'; expiry: 'never'; public: true },
  ): Promise<{ link: { code: string } }>;
  revokeShareLink(code: string): Promise<unknown>;
};

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

export async function readCommunityPost(db: CommunityPostDb): Promise<CommunityPost | null> {
  const row = await db
    .prepare(
      'SELECT share_code, author_id, post_id, title, anonymous, hidden_at, sent_state, checked_at FROM community_post LIMIT 1',
    )
    .first<CommunityPostRow>();
  return postOf(row ?? null);
}

// The post's state as the owner's read of the document carries it (`communityState`), so the editor's header badge
// reads Public after a reload, not only right after publishing: 'listed' unless reports hid it, null with no post.
export async function ownerCommunityState(
  db: CommunityPostDb,
): Promise<'listed' | 'hidden' | null> {
  const post = await readCommunityPost(db);
  return post ? (post.hiddenAt === null ? 'listed' : 'hidden') : null;
}

// The share code that opens the document as its Community post right now, or null: the Community switched on, a post
// not hidden after reports, and the document still its author's own (not a team's). The index refuses the link
// itself for a document in the Trash or behind a password, so a grant through it never reaches here then.
export function openCommunityCode(
  env: Pick<CommunityAppEnv, 'COMMUNITY_ENABLED'>,
  post: CommunityPost | null,
  meta: CommunityDocumentMeta | null,
): string | null {
  if (!post || !meta || !communityEnabled(env)) return null;
  if (post.hiddenAt !== null) return null;
  if (meta.ownerId !== post.authorId || meta.teamId !== null) return null;
  return post.shareCode;
}

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity as the app
// knows it (`participant`: their name and colour, or null when it knows none).
export async function communityPostAuthor(
  post: CommunityPost,
  participant: (personId: string) => Promise<{ name: string; color: string } | null>,
): Promise<CommunityAuthor> {
  if (post.anonymous) return COMMUNITY_ANONYMOUS_AUTHOR;
  const p = await participant(post.authorId);
  if (!p) return COMMUNITY_UNKNOWN_AUTHOR;
  return { name: p.name, color: p.color, picture: null };
}

// After the service took a first publish: the post, replacing any previous owner's.
export async function saveCommunityPost(
  db: CommunityPostDb,
  post: Pick<CommunityPost, 'shareCode' | 'authorId' | 'postId' | 'title' | 'anonymous'>,
  now: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM community_post'),
    db
      .prepare(
        `INSERT INTO community_post (share_code, author_id, post_id, title, anonymous, sent_state, checked_at)
       VALUES (?, ?, ?, ?, ?, 'public', ?)`,
      )
      .bind(post.shareCode, post.authorId, post.postId, post.title, post.anonymous ? 1 : 0, now),
  ]);
}

// After an Edit Listing: what the link's doors show of the post.
export async function updateCommunityPost(
  db: CommunityPostDb,
  post: { title: string; anonymous: boolean; hiddenAt?: number | null },
): Promise<void> {
  await db
    .prepare(
      'UPDATE community_post SET title = ?, anonymous = ?, hidden_at = COALESCE(hidden_at, ?)',
    )
    .bind(post.title, post.anonymous ? 1 : 0, post.hiddenAt ?? null)
    .run();
}

// Remove From Community: the post goes (its index share link is removed by the caller).
export async function deleteCommunityPost(db: CommunityPostDb): Promise<void> {
  await db.prepare('DELETE FROM community_post').run();
}

// When the document next asks where its post stands, or null for a document with no post.
export function communityCheckDueAt(post: Pick<CommunityPost, 'checkedAt'> | null): number | null {
  return post ? post.checkedAt + COMMUNITY_CHECK_MS : null;
}

// The index's refusal for an item or link that is not there (or no longer the asker's): the post's document is gone.
function isGone(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return err instanceof Error && err.name === 'IndexError' && (status === 404 || status === 403);
}

// Where the post's document stands, as the listing knows it ("document_state"): 'gone' once the document or its link
// is gone; 'away' in the Trash or no longer the author's; 'closed' in a team or behind a share password (a public post
// cannot ask for one); else 'public'. `index` is the index as the post's author, null when there is none.
export async function communityStateOf(
  index: CommunityIndex | null,
  documentId: string,
  post: CommunityPost,
  meta: CommunityDocumentMeta | null,
): Promise<CommunityDocumentState | 'gone'> {
  if (!meta) return 'gone';
  if (meta.ownerId !== post.authorId) return 'away';
  if (!index) throw new Error('no index');
  try {
    const [{ item }, share] = await Promise.all([
      index.getItem(documentId),
      index.listShareLinks(documentId),
    ]);
    if (!share.links.some((l) => l.code === post.shareCode)) return 'gone';
    if (item.trashedAt !== null || item.ownerId !== post.authorId) return 'away';
    if (item.teamId !== null || share.passwordSet) return 'closed';
    return 'public';
  } catch (err) {
    if (isGone(err)) return 'gone';
    throw err;
  }
}

export type CommunityCheck = {
  env: CommunityAppEnv;
  db: CommunityPostDb;
  service: CommunityAppClient;
  documentId: string;
  meta: CommunityDocumentMeta | null;
  // The index as the post's author (they own the document, in its team if it has one); null when there is none.
  indexAs: (authorId: string, teamId: string | null) => CommunityIndex | null;
  now: number;
};

// Ask the index where the post's document stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached: the alarm
// tries again on its next check.
export async function checkCommunityPost(check: CommunityCheck): Promise<CommunityPost | null> {
  const { env, db, service, documentId, meta, now } = check;
  const post = await readCommunityPost(db);
  if (!post) return null;
  if (!communityServiceConfigured(env)) return post;
  const index = meta ? check.indexAs(post.authorId, meta.teamId) : null;
  const state = await communityStateOf(index, documentId, post, meta);
  if (state !== post.sentState) {
    const sync =
      state === 'gone'
        ? { documents: [], gone: [documentId] }
        : { documents: [{ document: documentId, state }], gone: [] };
    const res = await service.sync(env, sync);
    if (!res.ok) throw new Error(`community sync answered ${res.status}`);
    console.info('[community] state sent', { state });
  }
  if (state === 'gone') {
    await deleteCommunityPost(db);
    return null;
  }
  let hiddenAt = post.hiddenAt;
  if (hiddenAt === null) {
    const found = await service.getPost(env, documentId, post.authorId);
    if (found?.state === 'hidden') hiddenAt = now;
  }
  await db
    .prepare('UPDATE community_post SET sent_state = ?, hidden_at = ?, checked_at = ?')
    .bind(state, hiddenAt, now)
    .run();
  return { ...post, sentState: state, hiddenAt, checkedAt: now };
}

// A document going for good takes its post with it: the service hears it is gone. Best effort.
export async function leaveCommunity(
  env: CommunityAppEnv,
  db: CommunityPostDb,
  service: CommunityAppClient,
  documentId: string,
): Promise<void> {
  if (!communityServiceConfigured(env)) return;
  try {
    if (!(await readCommunityPost(db))) return;
    await service.sync(env, { documents: [], gone: [documentId] });
  } catch (error) {
    console.warn('[community] gone not sent', { error: String(error) });
  }
}
