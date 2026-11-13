import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MERGE_WINDOW_MS } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import type { SqliteD1 } from '../test-sqlite-d1';
import type { ItemGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { OWNER, box, call, documentWith, recordAdd, revOf, stored } from './tab-save-test-kit';

// The editor's whole-tab save (docs/specs/024-agents/blueprints/agent-changesets.md "The tab PUT"):
// refused to tokens, merged with the changesets the saver had not seen, written at the revision it
// read.

const save = (
  db: SqliteD1,
  elements: Element[],
  headers: Record<string, string> = {},
  extra = {},
) =>
  call(db, 'PUT', '/api/documents/D/tabs/t1', {
    body: { id: 't1', name: 'Board', elements, ...extra },
    headers,
  });

afterEach(() => vi.restoreAllMocks());

describe('the tab PUT', () => {
  // A malformed element is refused by the schema gate like any other, never thrown on by the migrations that run
  // before it: a step chip's label a number, not text, threw in settleChips and answered 500.
  it('refuses a malformed chip as an invalid tab, not a server error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const step = { ...box('s'), shape: 'step', label: 5 } as unknown as Element;
    const res = await save(db, [box('a'), step]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid tab' });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
  });

  it('refuses an API token with use_changesets, naming the route, before reading anything', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { id: 't1', name: 'Board', elements: [] },
      token: true,
    });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({
      error: 'use_changesets',
      message:
        'Agents and scripts write tabs with changesets: POST /api/documents/D/tabs/t1/changesets',
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
    expect(info).toHaveBeenCalledWith('[changeset] whole-tab-refused', {
      documentId: 'D',
      tabId: 't1',
      tokenId: 'tok_1',
    });
  });

  // docs/specs/024-agents/agent-changesets.md: a workbench session is a person's editor, not a token, so its
  // whole-tab save goes through as the owner's own.
  it('saves a workbench session tab as a person editor would', async () => {
    const db = await documentWith([box('a')]);
    const res = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/D/tabs/t1', {
        env: db.env,
        owner: OWNER,
        accountUserId: null,
        verifiedUserId: OWNER,
        token: null,
        workbench: { sessionId: 's', ownerId: OWNER, documentId: 'D' } as never,
        body: { id: 't1', name: 'Board', elements: [box('a'), box('b')] },
      }),
    );
    expect(res.status).toBe(200);
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('answers the new revision and strips record fields from the body', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const res = await save(
      db,
      [box('a', 'b')],
      {},
      { rev: 99, documentId: 'X', orderIndex: 7, updatedAt: 1 },
    );
    expect(res.status).toBe(200);
    const { tab } = (await res.json()) as {
      tab: { rev: number; documentId: string; orderIndex: number };
    };
    expect(tab).toMatchObject({ rev: 2, documentId: 'D', orderIndex: 0 });
    const data: unknown = JSON.parse(
      db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string,
    );
    expect(data).not.toHaveProperty('rev');
    expect(data).not.toHaveProperty('documentId');
  });

  it('merges a changeset the saver had not seen, and logs it', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const seen = revOf(db);
    recordAdd(db, box('n'));
    const res = await save(db, [box('a', 'edited')], { 'X-Changeset-Seen': String(seen) });
    expect(res.status).toBe(200);
    expect(stored(db).map((e) => [e.id, (e as { label?: string }).label])).toEqual([
      ['a', 'edited'],
      ['n', 'n'],
    ]);
    expect(info).toHaveBeenCalledWith(
      '[changeset] merged-on-save',
      expect.objectContaining({ documentId: 'D', tabId: 't1', elements: 1 }),
    );
  });

  it('merges nothing the saver has already seen', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const rev = recordAdd(db, box('n'));
    await save(db, [box('a')], { 'X-Changeset-Seen': String(rev) });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
  });

  it('without the header (an older editor), merges the last 10 minutes only', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    recordAdd(db, box('old'), Date.now() - CHANGESET_MERGE_WINDOW_MS - 1000);
    recordAdd(db, box('recent'));
    await save(db, [box('a')]);
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'recent']);
  });

  it('reads an unparsable header as absent, and logs it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    recordAdd(db, box('recent'));
    await save(db, [box('a')], { 'X-Changeset-Seen': 'soon' });
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'recent']);
    expect(warn).toHaveBeenCalledWith(
      '[changeset] seen-invalid',
      expect.objectContaining({ length: 4 }),
    );
  });

  it('repeats a lost race once, merging what won, then answers tab_busy', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    const seen = String(revOf(db));
    // A changeset lands between the save's read and its write, once.
    const batch = db.env.DOCUMENT_DB.batch.bind(db.env.DOCUMENT_DB);
    let interleave = 1;
    db.env.DOCUMENT_DB.batch = async (statements: D1PreparedStatement[]) => {
      // Only a tab write meets the race: the document's reads (its outline, the outbox drain) batch too.
      const writesTab = statements.some((st) =>
        /INSERT INTO tabs\b/.test((st as unknown as { query: string }).query),
      );
      if (writesTab && interleave > 0) {
        interleave -= 1;
        recordAdd(db, box(`raced${interleave}`));
      }
      return batch(statements);
    };
    expect((await save(db, [box('a', 'mine')], { 'X-Changeset-Seen': seen })).status).toBe(200);
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'raced0']);

    interleave = 5;
    expect((await save(db, [box('a')], { 'X-Changeset-Seen': seen })).status).toBe(409);
  });
});

describe('the tab read', () => {
  it('carries the revision in the body and as a weak ETag', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWith([box('a')]);
    await save(db, [box('a', 'b')]);
    const res = await call(db, 'GET', '/api/documents/D/tabs/t1');
    expect(res.headers.get('ETag')).toBe('W/"2"');
    expect((await res.json<{ tab: { rev: number } }>()).tab.rev).toBe(2);
  });
});

// Each document stores its own tabs (its Durable Object), so a tab id is the document's own: a save makes a new tab or
// revises one of this document's.
describe('a tab id', () => {
  it('still saves a brand new tab, and the owner keeps saving their own', async () => {
    const db = await documentWith([box('a')]);
    const fresh = await call(db, 'PUT', '/api/documents/D/tabs/t2', {
      body: { id: 't2', name: 'Second', elements: [box('b')] },
    });
    expect(fresh.status).toBeLessThan(300);
    const again = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { id: 't1', name: 'Board', elements: [box('a', 'Edited')] },
    });
    expect(again.status).toBeLessThan(300);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md "A tab's name is structure": a tab-scoped editor's
// whole-tab save keeps the stored name, whatever name it carries.
describe('a tab-scoped whole-tab save', () => {
  it('saves the content and keeps the stored name', async () => {
    const db = await documentWith([]);
    const scoped: ItemGrant = {
      item: 'D',
      level: 'edit',
      tab: 't1',
      sub: 'link:abc',
      team: null,
      exp: 2_000_000_000,
      shareCode: 'abc',
      token: 'g',
    };
    const res = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/D/tabs/t1', {
        env: db.env,
        owner: 'guest_v',
        body: { id: 't1', name: 'Renamed', elements: [box('a')] },
        grant: scoped,
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json<{ tab: { name: string } }>()).tab.name).toBe('Board');
    expect(db.sql.prepare("SELECT name FROM tabs WHERE id = 't1'").get()).toEqual({
      name: 'Board',
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a']);
  });

  // Its tab deleted while the editor was open reads as missing rather than coming back.
  it("never recreates a tab-scoped editor's deleted tab", async () => {
    const db = await documentWith([box('a')]);
    db.sql.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    const res = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/D/tabs/t1', {
        env: db.env,
        owner: 'guest_v',
        body: { id: 't1', name: 'Back again', elements: [box('a')] },
        grant: {
          item: 'D',
          level: 'edit',
          tab: 't1',
          sub: 'link:abc',
          team: null,
          exp: 2_000_000_000,
          shareCode: 'abc',
          token: 'g',
        },
      }),
    );
    expect(res.status).toBe(404);
    expect(db.sql.prepare("SELECT id FROM tabs WHERE id = 't1'").get()).toBeUndefined();
  });
});
