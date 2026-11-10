// The room's side of a post through its document's lifecycle (liveworkspace/docs/specs/007-community/community.md
// "What lives where", "Keeping in step"): the Trash and another owner remove it at the service and the room withdraws
// it, closing its link; archiving and deleting for good make it gone; restoring never brings it back; a closed
// document keeps it; a withdrawn row opens nothing and goes once the index has let its link go.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import type { CommunityAppClient } from './client';
import {
  checkCommunityPost,
  COMMUNITY_LISTED_QUERY,
  COMMUNITY_POST_TABLE,
  openCommunityCode,
  ownerCommunityState,
  readCommunityPost,
  saveCommunityPost,
  withdrawCommunityPost,
  type CommunityDocumentMeta,
  type CommunityIndex,
  type CommunityPostDb,
} from './post';

// The room's SQLite behind the D1 surface the post uses.
function roomDb(): CommunityPostDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec(COMMUNITY_POST_TABLE);
  const statement = (query: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(query, next),
    first: async <T>() =>
      (sql.prepare(query).get(...(values as SQLInputValue[])) as T | undefined) ?? null,
    run: async () => sql.prepare(query).run(...(values as SQLInputValue[])),
  });
  return {
    prepare: (query: string) => statement(query),
    batch: async (statements) => {
      for (const s of statements) await s.run();
    },
  };
}

class IndexError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`index ${status}`);
    this.name = 'IndexError';
    this.status = status;
  }
}

type Item = { trashedAt: number | null; ownerId: string; teamId: string | null };

// The index as anyone: one item, its links, and what revoking a link does.
function fakeIndex(item: Item | 'missing', links = ['CODE2345'], password = false) {
  const revoked: string[] = [];
  let revokeFails: number | null = null;
  const index: CommunityIndex = {
    getItem: async () => {
      if (item === 'missing') throw new IndexError(404);
      return { item };
    },
    listShareLinks: async () => ({ links: links.map((code) => ({ code })), passwordSet: password }),
    createShareLink: async () => ({ link: { code: 'NEW00001' } }),
    revokeShareLink: async (code) => {
      if (revokeFails !== null) throw new IndexError(revokeFails);
      revoked.push(code);
      links = links.filter((c) => c !== code);
    },
  };
  return {
    index,
    revoked,
    failRevoke: (status: number | null) => (revokeFails = status),
    setItem: (next: Item | 'missing') => (item = next),
    setLinks: (next: string[]) => (links = next),
  };
}

// The service: what it holds for the document, and the syncs it was sent (an away removes a listed post).
function fakeService(held: { state: 'listed' | 'hidden' } | null = { state: 'listed' }) {
  const syncs: unknown[] = [];
  let post = held;
  const service = {
    app: 'livediagram.app',
    sync: vi.fn(async (_env: unknown, sync: { documents: { state: string }[]; gone: string[] }) => {
      syncs.push(sync);
      if (sync.gone.length > 0) post = null;
      if (sync.documents.some((d) => d.state === 'away') && post?.state === 'listed') post = null;
      return new Response(null, { status: 204 });
    }),
    getPost: vi.fn(async () => (post ? { ...post, own: true } : null)),
  } as unknown as CommunityAppClient;
  return { service, syncs, drop: () => (post = null) };
}

const ENV = { COMMUNITY_KEY: 'k' };
const META: CommunityDocumentMeta = { ownerId: 'user_a', teamId: null };

async function published(db: CommunityPostDb) {
  await saveCommunityPost(
    db,
    { shareCode: 'CODE2345', authorId: 'user_a', postId: 'p1', title: 'A post', anonymous: false },
    1_000,
  );
}

const check = (
  db: CommunityPostDb,
  index: CommunityIndex,
  service: CommunityAppClient,
  meta: CommunityDocumentMeta | null = META,
  now = 10_000,
) =>
  checkCommunityPost({
    env: ENV,
    db,
    service,
    documentId: 'd1',
    meta,
    indexAs: () => index,
    now,
  });

const listed = async (db: CommunityPostDb) =>
  (await db.prepare(COMMUNITY_LISTED_QUERY).first<{ listed: number }>()) !== null;

describe('a post through its document’s lifecycle', () => {
  it('stays listed while the document is public', async () => {
    const db = roomDb();
    await published(db);
    const { index } = fakeIndex({ trashedAt: null, ownerId: 'user_a', teamId: null });
    const { service, syncs } = fakeService();
    const post = await check(db, index, service);
    expect(post).toMatchObject({ sentState: 'public', checkedAt: 10_000 });
    expect(syncs).toEqual([]);
    expect(await listed(db)).toBe(true);
  });

  it('to the Trash: removed at the service, withdrawn here, its link removed and its row gone', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: 5, ownerId: 'user_a', teamId: null });
    const { service, syncs } = fakeService();
    expect(await check(db, idx.index, service)).toBeNull();
    expect(syncs).toEqual([{ documents: [{ document: 'd1', state: 'away' }], gone: [] }]);
    expect(idx.revoked).toEqual(['CODE2345']);
    expect(await readCommunityPost(db)).toBeNull();
  });

  it('restored from the Trash: the post does not come back', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: 5, ownerId: 'user_a', teamId: null });
    const { service } = fakeService();
    await check(db, idx.index, service);
    idx.setItem({ trashedAt: null, ownerId: 'user_a', teamId: null });
    // Nothing kept, so nothing to send or open: its author shares it again to list it.
    expect(await check(db, idx.index, service, META, 20_000)).toBeNull();
    expect(await readCommunityPost(db)).toBeNull();
  });

  it('keeps it withdrawn (opening nothing) until the index lets the link go', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: 5, ownerId: 'user_a', teamId: null });
    const { service } = fakeService();
    idx.failRevoke(409);
    const kept = await check(db, idx.index, service);
    expect(kept).toMatchObject({ sentState: 'withdrawn', checkedAt: 10_000 });
    expect(openCommunityCode({}, kept, META)).toBeNull();
    expect(await ownerCommunityState(db)).toBeNull();
    expect(await listed(db)).toBe(false);
    // The next check only tries the link again.
    idx.failRevoke(null);
    expect(await check(db, idx.index, service, META, 20_000)).toBeNull();
    expect(idx.revoked).toEqual(['CODE2345']);
    expect(await readCommunityPost(db)).toBeNull();
  });

  it('takes a 404 on the link as already gone, and keeps the row on a refusal (a plain link would reopen it)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const post = (await readCommunityPost(db))!;
    const idx = fakeIndex({ trashedAt: null, ownerId: 'user_a', teamId: null });
    idx.failRevoke(403);
    expect(await withdrawCommunityPost(db, idx.index, post, 1)).toMatchObject({
      sentState: 'withdrawn',
    });
    expect(await withdrawCommunityPost(db, null, post, 2)).toMatchObject({ checkedAt: 2 });
    idx.failRevoke(404);
    expect(await withdrawCommunityPost(db, idx.index, post, 3)).toBeNull();
    expect(await readCommunityPost(db)).toBeNull();
  });

  it('now someone else’s: removed, and its link removed as the new owner', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: null, ownerId: 'user_b', teamId: 'team_1' });
    const { service, syncs } = fakeService();
    const asked: string[] = [];
    const post = await checkCommunityPost({
      env: ENV,
      db,
      service,
      documentId: 'd1',
      meta: { ownerId: 'user_b', teamId: 'team_1' },
      indexAs: (person) => {
        asked.push(person);
        return idx.index;
      },
      now: 10_000,
    });
    expect(post).toBeNull();
    expect(syncs).toEqual([{ documents: [{ document: 'd1', state: 'away' }], gone: [] }]);
    expect(asked).toEqual(['user_a', 'user_b']);
  });

  it('archived (every link dropped), deleted for good, or its account closed: gone', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    for (const [item, links, meta] of [
      [{ trashedAt: null, ownerId: 'user_a', teamId: null }, [], META],
      ['missing', ['CODE2345'], META],
      [{ trashedAt: null, ownerId: 'deleted', teamId: 't' }, ['CODE2345'], META],
      [{ trashedAt: null, ownerId: 'user_a', teamId: null }, ['CODE2345'], null],
    ] as const) {
      const db = roomDb();
      await published(db);
      const idx = fakeIndex(item as Item | 'missing', [...links]);
      const { service, syncs } = fakeService();
      expect(await check(db, idx.index, service, meta)).toBeNull();
      expect(syncs).toEqual([{ documents: [], gone: ['d1'] }]);
      expect(await readCommunityPost(db)).toBeNull();
    }
  });

  it('closed (a team or a share password): kept, and listed again once it opens', async () => {
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: null, ownerId: 'user_a', teamId: null }, ['CODE2345'], true);
    const { service, syncs } = fakeService();
    expect(await check(db, idx.index, service)).toMatchObject({ sentState: 'closed' });
    expect(await listed(db)).toBe(false);
    const open = fakeIndex({ trashedAt: null, ownerId: 'user_a', teamId: null });
    expect(await check(db, open.index, service, META, 20_000)).toMatchObject({
      sentState: 'public',
    });
    expect(syncs).toEqual([
      { documents: [{ document: 'd1', state: 'closed' }], gone: [] },
      { documents: [{ document: 'd1', state: 'public' }], gone: [] },
    ]);
  });

  it('removed by the sweep while public: withdrawn on the next check', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = roomDb();
    await published(db);
    const idx = fakeIndex({ trashedAt: null, ownerId: 'user_a', teamId: null });
    const { service, drop } = fakeService();
    drop();
    expect(await check(db, idx.index, service)).toBeNull();
    expect(idx.revoked).toEqual(['CODE2345']);
  });

  it('a hidden post in the Trash stays (hidden is final), unlisted', async () => {
    const db = roomDb();
    await published(db);
    await db.prepare('UPDATE community_post SET hidden_at = 5').run();
    const idx = fakeIndex({ trashedAt: 5, ownerId: 'user_a', teamId: null });
    const { service } = fakeService({ state: 'hidden' });
    expect(await check(db, idx.index, service)).toMatchObject({ sentState: 'away', hiddenAt: 5 });
    expect(idx.revoked).toEqual([]);
    expect(await listed(db)).toBe(false);
  });
});
