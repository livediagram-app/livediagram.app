// The document lists say which documents are listed in the Community (docs/specs/025-community/community.md
// "In the Explorer"), against the real migrations: the Explorer's Public badge reads it. Only the listed state goes
// out; a hidden post reads as not listed, so its moderation state stays owner-only.

import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { listDocumentsByOwner, listDocumentsByTeam } from './documents';

const OWNER = 'owner-1';

function setUp() {
  const db = sqliteD1();
  const addDocument = (id: string, teamId: string | null = null) =>
    db.sql
      .prepare(
        'INSERT INTO documents (id, owner_id, name, shareable, team_id, saved_at, created_at) VALUES (?, ?, ?, 1, ?, 1, 1)',
      )
      .run(id, OWNER, id, teamId);
  const publish = (documentId: string, state: 'listed' | 'hidden') => {
    db.sql
      .prepare(
        "INSERT INTO share_links (code, document_id, role, created_at, purpose) VALUES (?, ?, 'view', 1, 'community')",
      )
      .run(`code-${documentId}`, documentId);
    db.sql
      .prepare(
        `INSERT INTO community_posts (id, document_id, share_code, author_id, title, description, category, search_text,
           state, published_at, updated_at) VALUES (?, ?, ?, ?, 'P', 'A post.', 'other', 'p', ?, 1, 1)`,
      )
      .run(`post-${documentId}`, documentId, `code-${documentId}`, OWNER, state);
  };
  return { ...db, addDocument, publish };
}

describe('a document list says which documents are listed in the Community', () => {
  it('marks a listed post, and neither a hidden post nor no post', async () => {
    const { env, addDocument, publish } = setUp();
    addDocument('listed');
    addDocument('hidden');
    addDocument('unpublished');
    publish('listed', 'listed');
    publish('hidden', 'hidden');
    const list = await listDocumentsByOwner(env, OWNER);
    expect(Object.fromEntries(list.map((d) => [d.id, d.communityListed]))).toEqual({
      listed: true,
      hidden: false,
      unpublished: false,
    });
  });

  it('marks a listed team document too', async () => {
    const { env, sql, addDocument, publish } = setUp();
    sql
      .prepare(
        "INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES ('t1', 'T', NULL, 1, 1)",
      )
      .run();
    addDocument('team-doc', 't1');
    publish('team-doc', 'listed');
    const [row] = await listDocumentsByTeam(env, 't1');
    expect(row?.communityListed).toBe(true);
  });
});
