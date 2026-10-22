import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { createShareLink, saveNewCommunityLink } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// docs/specs/025-community/community.md "Making a copy": a copy through a Community post's link is named after the
// post the visitor chose, never after the author's own document name; any other copy keeps "Copy of".

async function arrange() {
  const db = sqliteD1();
  db.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'user_author', 'Untitled Mind Map', 1, 1, 1);
  `);
  await saveNewCommunityLink(db.env, {
    shareCode: 'COMMUNITY23456',
    documentId: 'd1',
    authorId: 'user_author',
    postId: 'post1',
    title: 'Team offsite mind map',
    anonymous: true,
  });
  return { db, code: 'COMMUNITY23456' };
}

function copy(db: Awaited<ReturnType<typeof arrange>>['db'], code: string, body: unknown = {}) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents/d1/copy', {
      env: db.env,
      owner: 'guest-visitor',
      body,
      headers: { 'X-Share-Code': code },
    }),
  );
}

const nameOf = async (res: Response) =>
  (await res.json<{ document: { name: string } }>()).document.name;

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/documents/:id/copy through a Community link', () => {
  it("names the copy after the post's title", async () => {
    const { db, code } = await arrange();
    const res = await copy(db, code);
    expect(res.status).toBe(201);
    expect(await nameOf(res)).toBe('Team offsite mind map');
  });

  it('keeps a name the caller asked for', async () => {
    const { db, code } = await arrange();
    expect(await nameOf(await copy(db, code, { name: 'My offsite' }))).toBe('My offsite');
  });

  it('keeps "Copy of" for any other view link', async () => {
    const { db } = await arrange();
    const link = await createShareLink(db.env, 'd1', 'VIEWLINK234567', 'view');
    expect(await nameOf(await copy(db, link.code))).toBe('Copy of Untitled Mind Map');
  });
});
