import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, testDocument } from '../test-sqlite-d1';
import { saveCommunityPost } from '../document-room/community-post';

// What the index is asked to name a copy (it makes the copy, and names one it is given no title for "Copy of …").
const { copies } = vi.hoisted(() => ({
  copies: [] as { id: string; input: { title?: string } }[],
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    copyItem: async (id: string, input: { title?: string } = {}) => {
      copies.push({ id, input });
      return {
        item: {
          id: `${id}-copy`,
          ownerId: 'guest-visitor',
          teamId: null,
          folderId: null,
          title: input.title ?? 'Copy of Untitled Mind Map',
          source: null,
          intent: null,
          summary: {},
          sharedVia: null,
          createdAt: 1,
          updatedAt: 1,
        },
      };
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocumentIndexRoutes } from './document-index-routes';

// docs/specs/025-community/community.md "Making a copy": a copy through a Community post's link is named after the
// post the visitor chose, never after the author's own document name; any other copy keeps "Copy of".

async function arrange() {
  const db = sqliteD1();
  testDocument(db, 'd1', 'user_author', { name: 'Untitled Mind Map' });
  await saveCommunityPost(
    db.env,
    {
      shareCode: 'COMMUNITY23456',
      authorId: 'user_author',
      postId: 'post1',
      title: 'Team offsite mind map',
      anonymous: true,
    },
    1,
  );
  return { db, code: 'COMMUNITY23456' };
}

async function copy(
  db: Awaited<ReturnType<typeof arrange>>['db'],
  code: string,
  body: unknown = {},
): Promise<Response> {
  const ctx = makeTestRouteContext('POST', '/api/documents/d1/copy', {
    env: db.env,
    owner: 'guest-visitor',
    body,
    headers: { 'X-Share-Code': code },
  });
  return (await handleDocumentIndexRoutes(ctx))!;
}

const nameOf = async (res: Response) =>
  (await res.json<{ document: { name: string } }>()).document.name;

beforeEach(() => {
  copies.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/documents/:id/copy through a Community link', () => {
  it("names the copy after the post's title", async () => {
    const { db, code } = await arrange();
    const res = await copy(db, code);
    expect(res.status).toBe(201);
    expect(await nameOf(res)).toBe('Team offsite mind map');
    expect(copies).toEqual([{ id: 'd1', input: { title: 'Team offsite mind map' } }]);
  });

  it('keeps a name the caller asked for', async () => {
    const { db, code } = await arrange();
    expect(await nameOf(await copy(db, code, { name: 'My offsite' }))).toBe('My offsite');
  });

  it('leaves any other view link to the index\'s "Copy of"', async () => {
    const { db } = await arrange();
    expect(await nameOf(await copy(db, 'VIEWLINK234567'))).toBe('Copy of Untitled Mind Map');
    expect(copies).toEqual([{ id: 'd1', input: {} }]);
  });
});
