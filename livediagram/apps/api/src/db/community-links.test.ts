// What this api keeps of the Community, against a real schema (docs/specs/025-community/community.md): the community
// link a publish makes, the one rule every link door reads, what the sync finds to send, and a copy taken through a
// link. The posts themselves are the liveworkspace service's, tested there.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsServiceFor } from '../test-accounts-service';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  communityLinkAccess,
  communityLinkAuthor,
  deleteCommunityLink,
  getCommunityLinkByShareCode,
  markCommunityHidden,
  markCommunitySynced,
  pendingCommunitySync,
  saveNewCommunityLink,
} from './community-links';
import { copyDocument } from './documents';
import { getShareLink, listShareLinks } from './share';

let db: SqliteD1;

function addDocument(id: string, owner = 'user_author') {
  db.sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 1, 1)',
    )
    .run(id, owner, `Doc ${id}`);
}

const link = (documentId: string, authorId = 'user_author', anonymous = false) => ({
  shareCode: `code-${documentId}-${authorId}`,
  documentId,
  authorId,
  postId: `post-${documentId}`,
  title: 'Payments platform',
  anonymous,
});

beforeEach(() => {
  db = sqliteD1();
  accountsServiceFor(db.env).profiles.set('user_author', {
    name: 'Ada',
    color: '#f97316',
    createdAt: 1,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a community link', () => {
  it('is a view link that never expires, never listed with the owner’s links', async () => {
    addDocument('d1');
    await saveNewCommunityLink(db.env, link('d1'));
    expect(await getShareLink(db.env, 'code-d1-user_author')).toMatchObject({
      role: 'view',
      purpose: 'community',
      expiresAt: null,
      tabId: null,
    });
    expect(await listShareLinks(db.env, 'd1')).toEqual([]);
    expect(await getCommunityLinkByShareCode(db.env, 'code-d1-user_author')).toMatchObject({
      document_id: 'd1',
      post_id: 'post-d1',
      sent_state: 'public',
    });
  });

  it("replaces a previous owner's link on the same document, and refuses a second of the same owner", async () => {
    addDocument('d1', 'user_bob');
    await saveNewCommunityLink(db.env, link('d1'));
    await saveNewCommunityLink(db.env, link('d1', 'user_bob'));
    expect(
      db.sql.prepare("SELECT code FROM share_links WHERE purpose = 'community'").all(),
    ).toEqual([{ code: 'code-d1-user_bob' }]);
    await expect(
      saveNewCommunityLink(db.env, { ...link('d1', 'user_bob'), shareCode: 'other' }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('goes with Remove From Community', async () => {
    addDocument('d1');
    await saveNewCommunityLink(db.env, link('d1'));
    await deleteCommunityLink(db.env, 'code-d1-user_author');
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()).toEqual({ n: 0 });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM community_links').get()).toEqual({ n: 0 });
  });

  it('shows its author, or Anonymous', async () => {
    addDocument('d1');
    addDocument('d2');
    await saveNewCommunityLink(db.env, link('d1'));
    await saveNewCommunityLink(db.env, link('d2', 'user_author', true));
    const named = (await getCommunityLinkByShareCode(db.env, 'code-d1-user_author'))!;
    expect(await communityLinkAuthor(db.env, named)).toEqual({
      name: 'Ada',
      color: '#f97316',
      picture: null,
    });
    const anonymous = (await getCommunityLinkByShareCode(db.env, 'code-d2-user_author'))!;
    expect((await communityLinkAuthor(db.env, anonymous)).name).toBe('Anonymous');
  });
});

describe('the public rule every link door reads', () => {
  it('opens a link only while its post is not hidden and its document is public', async () => {
    addDocument('d1');
    await saveNewCommunityLink(db.env, link('d1'));
    const code = 'code-d1-user_author';
    expect(await communityLinkAccess(db.env, code)).toBe('public');
    for (const change of [
      'trashed_at = 5',
      "team_id = 'team-1'",
      "owner_id = 'user_bob'",
      "share_password = 'pw'",
    ]) {
      db.sql.prepare(`UPDATE documents SET ${change} WHERE id = 'd1'`).run();
      expect(await communityLinkAccess(db.env, code), change).toBe('closed');
      db.sql
        .prepare(
          "UPDATE documents SET trashed_at = NULL, team_id = NULL, owner_id = 'user_author', share_password = NULL WHERE id = 'd1'",
        )
        .run();
    }
    await markCommunityHidden(db.env, [{ document: 'd1', hiddenAt: 9 }]);
    expect(await communityLinkAccess(db.env, code)).toBe('closed');
    expect(await communityLinkAccess(db.env, 'not-a-post')).toBeNull();
  });

  it('closes every link while the Community is switched off', async () => {
    addDocument('d1');
    await saveNewCommunityLink(db.env, link('d1'));
    db.env.COMMUNITY_ENABLED = 'off';
    expect(await communityLinkAccess(db.env, 'code-d1-user_author')).toBe('closed');
  });
});

describe('the sync', () => {
  it('finds what changed since it last said, and what is gone', async () => {
    for (const id of ['d1', 'd2', 'd3', 'd4', 'd5']) {
      addDocument(id);
      await saveNewCommunityLink(db.env, link(id));
    }
    expect(await pendingCommunitySync(db.env, 500)).toEqual([]);
    db.sql.prepare("UPDATE documents SET trashed_at = 5 WHERE id = 'd1'").run();
    db.sql.prepare("UPDATE documents SET team_id = 'team-1' WHERE id = 'd2'").run();
    db.sql.prepare("DELETE FROM documents WHERE id = 'd3'").run();
    // An account deleted: its post's link goes, so its post does too.
    db.sql.prepare("DELETE FROM share_links WHERE document_id = 'd4'").run();
    const pending = await pendingCommunitySync(db.env, 500);
    expect(pending.sort((a, b) => a.documentId.localeCompare(b.documentId))).toEqual([
      { documentId: 'd1', state: 'away' },
      { documentId: 'd2', state: 'closed' },
      { documentId: 'd3', state: 'gone' },
      { documentId: 'd4', state: 'gone' },
    ]);
    expect(await pendingCommunitySync(db.env, 500, 'd2')).toEqual([
      { documentId: 'd2', state: 'closed' },
    ]);
    expect(await pendingCommunitySync(db.env, 2)).toHaveLength(2);
    await markCommunitySynced(db.env, pending);
    expect(await pendingCommunitySync(db.env, 500)).toEqual([]);
    expect(
      db.sql.prepare('SELECT document_id FROM community_links ORDER BY document_id').all(),
    ).toEqual([{ document_id: 'd1' }, { document_id: 'd2' }, { document_id: 'd5' }]);
  });

  it('keeps the first hide it hears of', async () => {
    addDocument('d1');
    await saveNewCommunityLink(db.env, link('d1'));
    await markCommunityHidden(db.env, [{ document: 'd1', hiddenAt: 9 }]);
    await markCommunityHidden(db.env, [{ document: 'd1', hiddenAt: 12 }]);
    expect(db.sql.prepare('SELECT hidden_at FROM community_links').get()).toEqual({ hidden_at: 9 });
  });
});

describe('a copy through a Community link', () => {
  it('carries the document without its comments or the people on its actions', async () => {
    addDocument('d1');
    const tab = {
      elements: [
        {
          id: 'e1',
          type: 'shape',
          commentThread: {
            comments: [{ id: 'c1', text: 'private note', authorId: 'user_author' }],
          },
          action: {
            id: 'a1',
            name: 'Follow up',
            description: '',
            assignee: { userId: 'user_jane', name: 'Jane' },
            teamId: null,
            assignerId: 'user_author',
            assignerName: 'Ada',
            status: 'open',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
    };
    db.sql
      .prepare("INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab', ?, 1)")
      .run(JSON.stringify(tab));
    db.sql
      .prepare(
        "INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1)",
      )
      .run();

    await copyDocument(db.env, 'd1', 'copy-1', 'guest-copier', 'Copy', null, true);
    const copied = db.sql
      .prepare(
        "SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = 'copy-1'",
      )
      .get() as { data: string };
    expect(copied.data).toContain('Follow up');
    for (const s of ['private note', 'user_jane', 'Jane', 'Ada', 'commentThread']) {
      expect(copied.data).not.toContain(s);
    }
    expect(
      db.sql.prepare("SELECT COUNT(*) AS n FROM collab_threads WHERE document_id = 'copy-1'").get(),
    ).toEqual({ n: 0 });

    await copyDocument(db.env, 'd1', 'copy-2', 'user_author', 'Copy', null);
    const plain = db.sql
      .prepare(
        "SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = 'copy-2'",
      )
      .get() as { data: string };
    expect(plain.data).toContain('private note');
  });
});
