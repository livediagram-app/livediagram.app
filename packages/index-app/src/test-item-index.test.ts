import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { IndexError, type IndexClient } from '@liveworkspace/index-client';
import {
  bindTestRooms,
  testFolderPreviews,
  testIndexGrant,
  testItemGrant,
  testListFolders,
  testOutboxFlush,
  testRequestGrant,
  testRoomNamespace,
  type TestGrantCaller,
} from './test-item-index';

function index() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE item (id TEXT PRIMARY KEY, owner_id TEXT, team_id TEXT, created_at INTEGER);
    CREATE TABLE test_share_links (code TEXT PRIMARY KEY, item_id TEXT, role TEXT, level TEXT, tab_id TEXT,
      expires_at INTEGER);
    CREATE TABLE test_trash (item_id TEXT PRIMARY KEY);
    CREATE TABLE test_folders (id TEXT PRIMARY KEY, owner_id TEXT, team_id TEXT, parent_id TEXT, name TEXT);
    CREATE TABLE outbox (item_id TEXT, key TEXT);
    INSERT INTO item VALUES ('a', 'owner', 'team', 1), ('fresh', 'owner', NULL, 0);
    INSERT INTO test_share_links VALUES ('live', 'a', 'view', NULL, 't1', NULL),
      ('levelled', 'a', 'edit', 'comment', NULL, NULL), ('old', 'a', 'edit', NULL, NULL, 1);
    INSERT INTO test_folders VALUES ('f1', 'owner', NULL, NULL, 'Mine'), ('f2', 'x', 'team', 'f1', 'Team'),
      ('f3', 'x', NULL, NULL, 'Theirs');
  `);
  return sql;
}

const who = (over: Partial<TestGrantCaller> = {}): TestGrantCaller => ({
  person: null,
  teams: [],
  code: null,
  create: false,
  ...over,
});
const rule = { item: 'item', linkColumn: 'item_id' };

describe('testItemGrant', () => {
  it('grants the owner and the team edit, and a live link its role on its tab', () => {
    const sql = index();
    expect(testItemGrant(sql, 'a', who({ person: 'owner' }), rule)).toEqual(
      expect.objectContaining({ item: 'a', level: 'edit', sub: 'owner', team: 'team', tab: null }),
    );
    expect(testItemGrant(sql, 'a', who({ person: 'p', teams: ['team'] }), rule)?.level).toBe(
      'edit',
    );
    const link = testItemGrant(sql, 'a', who({ code: 'live' }), rule);
    expect(link).toEqual(
      expect.objectContaining({ level: 'view', tab: 't1', sub: 'link:live', shareCode: 'live' }),
    );
    expect(link).not.toHaveProperty('owner');
    expect(testItemGrant(sql, 'a', who({ person: 'p', code: 'live' }), rule)?.sub).toBe('p');
    expect(testItemGrant(sql, 'a', who({ code: 'old' }), rule)).toBeNull();
    expect(testItemGrant(sql, 'a', who({ code: 'nope' }), rule)).toBeNull();
    expect(testItemGrant(sql, 'a', who({ person: 'p' }), rule)).toBeNull();
  });

  it("reads a link's level before its role, when the app's links carry one", () => {
    const sql = index();
    expect(testItemGrant(sql, 'a', who({ code: 'levelled' }), rule)?.level).toBe('edit');
    expect(
      testItemGrant(sql, 'a', who({ code: 'levelled' }), { ...rule, linkLevel: true })?.level,
    ).toBe('comment');
  });

  it("grants a create the caller's own, and nothing else on an item not started", () => {
    const sql = index();
    expect(testItemGrant(sql, 'new', who({ person: 'p', create: true }), rule)?.sub).toBe('p');
    expect(
      testItemGrant(sql, 'fresh', who({ person: 'p', create: true }), { ...rule, owner: true })
        ?.owner,
    ).toBe('owner');
    expect(
      testItemGrant(sql, 'new', who({ person: 'p', create: true }), { ...rule, owner: true })
        ?.owner,
    ).toBe('p');
    expect(testItemGrant(sql, 'new', who({ create: true }), rule)).toBeNull();
    expect(testItemGrant(sql, 'new', who({ person: 'p' }), rule)).toBeNull();
    expect(testItemGrant(sql, 'a', who({ person: 'owner' }), { ...rule, owner: true })?.owner).toBe(
      'owner',
    );
  });

  it('says an item is in the Trash, and lets no link reach it there', () => {
    const sql = index();
    sql.exec("INSERT INTO test_trash VALUES ('a')");
    const trash = { ...rule, trashColumn: 'item_id' };
    expect(testItemGrant(sql, 'a', who({ person: 'owner' }), trash)?.trashed).toBe(true);
    expect(testItemGrant(sql, 'a', who({ code: 'live' }), trash)).toBeNull();
    expect(testItemGrant(sql, 'a', who({ code: 'live' }), rule)).not.toBeNull();
  });

  it('refuses a table name that is not one', () => {
    expect(() => testItemGrant(index(), 'a', who(), { ...rule, item: 'item; --' })).toThrow(
      /not a table/,
    );
  });
});

describe('the test index client', () => {
  it("answers a grant by the app's rule, and a 404 where it grants nothing", async () => {
    const sql = index();
    sql.exec("INSERT INTO test_trash VALUES ('a')");
    const grant = testIndexGrant(
      (id, w) => testItemGrant(sql, id, w, { ...rule, trashColumn: 'item_id' }),
      'owner',
      [],
    );
    expect(await grant('a')).toEqual(
      expect.objectContaining({ level: 'edit', tabId: null, trashed: true }),
    );
    await expect(grant('zzz', { code: 'x' })).rejects.toBeInstanceOf(IndexError);
    const plain = testIndexGrant((id, w) => testItemGrant(sql, id, w, rule), null, []);
    expect(await plain('a', { code: 'live' })).not.toHaveProperty('trashed');
  });

  it("turns a grant into an app's outcome: granted, refused, or the index out of reach", async () => {
    const ok = { grant: async () => ({ grant: 'g' }) } as unknown as IndexClient;
    const refused = {
      grant: async () => {
        throw new IndexError(403, 'forbidden');
      },
    } as unknown as IndexClient;
    const broken = {
      grant: async () => {
        throw new Error('boom');
      },
    } as unknown as IndexClient;
    expect(await testRequestGrant(ok, 'a', null)).toEqual({ ok: true, grant: { grant: 'g' } });
    expect(await testRequestGrant(refused, 'a', null)).toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
    });
    expect(await testRequestGrant(null, 'a', null)).toEqual({
      ok: false,
      status: 503,
      error: 'index_unavailable',
    });
    await expect(testRequestGrant(broken, 'a', null)).rejects.toThrow('boom');
  });

  it("lists a person's own folders and their teams', and previews only those", async () => {
    const sql = index();
    const listed = await testListFolders(sql, 'owner', ['team'])();
    expect(listed.folders.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(listed.folders[1]).toEqual(expect.objectContaining({ parentId: 'f1', teamId: 'team' }));
    expect((await testListFolders(sql, null, [])()).folders).toEqual([]);
    const previews = await testFolderPreviews(sql, 'owner', [])(['f1', 'f2', 'f3']);
    expect(previews).toEqual({ previews: [{ folderId: 'f1', itemCount: 0, items: [] }] });
    expect((await testFolderPreviews(sql, null, ['team'])(['f2'])).previews).toHaveLength(1);
  });
});

describe('testRoomNamespace', () => {
  it("answers the app's RPCs, and fetch 404 without the test's own namespace", async () => {
    const ns = testRoomNamespace(undefined, (id) => ({ named: () => id.toString() }));
    const id = ns.idFromName('a');
    expect(id.equals(ns.idFromName('a'))).toBe(true);
    expect(id.equals(ns.idFromName('b'))).toBe(false);
    expect(id.name).toBe('a');
    const stub = ns.get(id) as unknown as { fetch: typeof fetch; named: () => string };
    expect(stub.named()).toBe('a');
    expect((await stub.fetch('https://room/x')).status).toBe(404);
  });

  it("hands fetch to the test's own namespace, by its own id", async () => {
    const seen: unknown[] = [];
    const recorder = {
      idFromName: (name: string) => `rec:${name}`,
      get: (id: unknown) => ({
        fetch: async (input: string) => {
          seen.push([id, input]);
          return new Response('ok');
        },
      }),
    } as unknown as DurableObjectNamespace;
    const ns = testRoomNamespace(recorder, (id, roomOf) => ({ room: () => roomOf(id) }));
    const stub = ns.get(ns.idFromName('a')) as unknown as {
      fetch: typeof fetch;
      room: () => unknown;
    };
    expect(await (await stub.fetch('https://room/y')).text()).toBe('ok');
    expect(seen).toEqual([['rec:a', 'https://room/y']]);
    expect(stub.room()).not.toBeNull();
  });

  it('wraps the namespace a test sets later the same way', () => {
    const env: Record<string, unknown> = {};
    const wrapped: unknown[] = [];
    bindTestRooms(env, 'ROOM', undefined, (rooms) => {
      wrapped.push(rooms);
      return { wrapped: rooms } as unknown as DurableObjectNamespace;
    });
    expect(env.ROOM).toEqual({ wrapped: undefined });
    const next = {} as DurableObjectNamespace;
    env.ROOM = next;
    expect(env.ROOM).toEqual({ wrapped: next });
    expect(Object.keys(env)).toEqual(['ROOM']);
  });
});

describe('testOutboxFlush', () => {
  function outbox(keys: string[]) {
    const sql = index();
    for (const k of keys) sql.prepare('INSERT INTO outbox VALUES (?, ?)').run(k.split(':')[0]!, k);
    return sql;
  }
  const draining = (sql: DatabaseSync, log: string[], during?: () => Promise<void>) => {
    return async (itemId: string) => {
      log.push(itemId);
      await during?.();
      const row = sql.prepare('SELECT rowid FROM outbox WHERE item_id = ? LIMIT 1').get(itemId) as
        { rowid: number } | undefined;
      if (row) sql.prepare('DELETE FROM outbox WHERE rowid = ?').run(row.rowid);
      return {
        more: sql.prepare('SELECT 1 FROM outbox WHERE item_id = ?').get(itemId) !== undefined,
      };
    };
  };

  it('drains every item until each is empty, on every call (each)', async () => {
    const sql = outbox(['a:1', 'a:2', 'b:1']);
    const log: string[] = [];
    const flush = testOutboxFlush(sql, {
      itemColumn: 'item_id',
      mode: 'each',
      drain: draining(sql, log),
    });
    await flush();
    expect(log).toEqual(['a', 'a', 'b']);
    await flush();
    expect(log).toEqual(['a', 'a', 'b']);
  });

  it('skips an empty outbox, and a call made during a drain waits for it (serial)', async () => {
    const sql = outbox(['a:1']);
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const flush = testOutboxFlush(sql, {
      itemColumn: 'item_id',
      mode: 'serial',
      drain: draining(sql, log, () => gate),
    });
    const first = flush();
    const second = flush();
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['a']);
    await flush();
    expect(log).toEqual(['a']);
  });

  it('returns at once to a call made from inside a drain (reentrant)', async () => {
    const sql = outbox(['a:1']);
    const log: string[] = [];
    let inner: Promise<void> | null = null;
    const flush = testOutboxFlush(sql, {
      itemColumn: 'item_id',
      mode: 'reentrant',
      drain: draining(sql, log, async () => {
        inner = flush();
        await inner;
      }),
    });
    await flush();
    expect(inner).not.toBeNull();
    expect(log).toEqual(['a']);
  });

  it('frees the next call after a drain that failed', async () => {
    const sql = outbox(['a:1']);
    let fail = true;
    const flush = testOutboxFlush(sql, {
      itemColumn: 'item_id',
      mode: 'serial',
      drain: async () => {
        if (fail) throw new Error('down');
        sql.exec('DELETE FROM outbox');
        return { more: false };
      },
    });
    await expect(flush()).rejects.toThrow('down');
    fail = false;
    await flush();
    expect(sql.prepare('SELECT COUNT(*) AS n FROM outbox').get()).toEqual({ n: 0 });
  });
});
