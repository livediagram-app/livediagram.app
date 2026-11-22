import { describe, expect, it } from 'vitest';
import type { ItemGrant } from '@liveworkspace/index-app';
import { exportDocumentCopy } from '../document-room/document-content';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { handleDocuments } from './documents';
import { makeTestRouteContext } from './test-route-context';

// Suggestions are retired (docs/specs/007-editor/suggestions.md "Writing stored with a suggestion"). An article stored
// while they existed may still hold one, and the plain tab read and a copy send the stored JSON, not the writing as
// read: neither may carry the suggested words or who suggested them (SG1, SG2).

const OWNER = 'user_owner';
const VISITOR = 'guest_00000000-0000-4000-8000-000000000002';
const LEAKS = ['"sg"', 'UNACCEPTED', 'user_secret', 'Sam Suggester'];

const viewGrant: ItemGrant = {
  item: 'D',
  level: 'view',
  tab: null,
  sub: VISITOR,
  team: null,
  exp: 9_999_999_999,
  shareCode: 'LINK',
  token: 'signed',
};

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: { body?: unknown; token?: boolean; grant?: ItemGrant; owner?: string } = {},
) {
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: opts.owner ?? OWNER,
      accountUserId: opts.token ? null : (opts.owner ?? OWNER),
      verifiedUserId: opts.owner ?? OWNER,
      body: opts.body,
      token: opts.token ? { id: 'tok_1' } : null,
      ...(opts.grant ? { grant: opts.grant } : {}),
      waitUntil: () => {},
    }),
  );
}

// A document whose one tab was stored with a pending insertion, written straight to the row as an older save left it.
async function documentWithSuggestion(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/documents', {
    body: { id: 'D', name: 'Report', tabs: [{ id: 't1', name: 'Report', elements: [] }] },
  });
  expect(res.status).toBe(201);
  const sg = { id: 's1', k: 'ins', by: 'user_secret', n: 'Sam Suggester', at: 1 };
  const data = JSON.stringify({
    elements: [],
    articles: {
      f1: {
        blocks: [
          { id: 'b1', type: 'paragraph', runs: [{ text: 'Kept.' }, { text: 'UNACCEPTED', sg }] },
        ],
      },
    },
  });
  db.sql.prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?').run(data, 't1');
  return db;
}

describe('an article stored with a suggestion', () => {
  it("is read without it by a link's visitor, an agent token and the owner (SG1)", async () => {
    const db = await documentWithSuggestion();
    const readers = [{ grant: viewGrant, owner: VISITOR }, { token: true }, {}];
    for (const reader of readers) {
      const res = await call(db, 'GET', '/api/documents/D/tabs/t1', reader);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('Kept.');
      for (const leaked of LEAKS) expect(body).not.toContain(leaked);
    }
  });

  it('is copied without it, through a Community link or not (SG2)', async () => {
    const db = await documentWithSuggestion();
    for (const community of [false, true]) {
      const copy = (await exportDocumentCopy(db.env, 'D', null, null, community))!;
      expect(copy.tabs[0]!.data).toContain('Kept.');
      for (const leaked of LEAKS) expect(copy.tabs[0]!.data).not.toContain(leaked);
    }
  });
});
