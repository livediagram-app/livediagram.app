import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { VERSION_NAMED_MAX } from '@liveknowledge/api-schema';
import type { Element } from '@liveknowledge/document';
import { deleteSnapshot, listSnapshots } from '@liveworkspace/snapshots/server';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { captureTelemetry, TELEMETRY_ON } from '@liveworkspace/telemetry/testing';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The version routes end to end on real SQLite (docs/specs/006-document/version-history.md; blueprint "Testing"):
// every role, restore through the room, Make a Copy and naming, with a recording room.

const OWNER = 'user_owner';
const box = (id: string, label = id, x = 0): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 120,
  height: 60,
  label,
});

type Selection = { elementIds: string[]; name: string; color: string; mine: boolean };

function room(selections: Selection[] = []) {
  const calls: { url: string; body: unknown }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (input: string, init?: RequestInit) => {
        calls.push({ url: input, body: init?.body ? sentJson(init) : null });
        if (input.includes('/selections')) return Response.json({ selections });
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { calls, binding };
}

type Who = {
  owner?: string;
  token?: boolean;
  headers?: Record<string, string>;
  community?: boolean;
};

const pending: Promise<unknown>[] = [];
const settled = () => Promise.all(pending.splice(0));

function call(db: SqliteD1, method: string, path: string, body?: unknown, who: Who = {}) {
  const owner = who.owner ?? OWNER;
  const ctx = makeTestRouteContext(method, path, {
    env: db.env,
    owner,
    accountUserId: who.token ? null : owner,
    verifiedUserId: owner,
    body,
    headers: who.headers,
    token: who.token ? { id: 'tok_1' } : null,
    waitUntil: (p) => void pending.push(p),
    ...(who.community
      ? {
          grant: {
            item: 'D',
            level: 'edit' as const,
            tab: null,
            sub: owner,
            team: null,
            exp: 9_999_999_999,
            shareCode: 'POST',
            token: 't',
          },
        }
      : {}),
  });
  if (who.community) ctx.community = { code: 'POST', open: true };
  return handleDocuments(ctx);
}

let sent: ReturnType<typeof captureTelemetry> = [];

async function setUp(selections: Selection[] = []) {
  const r = room(selections);
  const db = sqliteD1({ DOCUMENT_ROOM: r.binding, ...TELEMETRY_ON } as unknown as Partial<Env>);
  sent = captureTelemetry();
  clearTestProfiles();
  setTestProfile(OWNER, 'Webber', '#123456');
  const created = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [
      { id: 't1', name: 'Board', elements: [box('a'), box('b', 'b', 200)] },
      { id: 't2', name: 'Other', elements: [] },
    ],
  });
  expect(created.status).toBe(201);
  return { db, room: r };
}

const base = '/api/documents/D/tabs/t1/versions';
const change = (db: SqliteD1, operations: unknown[], who: Who = {}) =>
  call(db, 'POST', '/api/documents/D/tabs/t1/changesets', { operations }, who);
const stored = (db: SqliteD1, tab = 't1') =>
  JSON.parse(db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab)!.data as string) as {
    elements: Element[];
    look?: unknown;
  };
const versionRows = (db: SqliteD1) =>
  db.sql
    .prepare('SELECT id, kind, name, rev FROM tab_versions WHERE tab_id = ? ORDER BY rev')
    .all('t1') as { id: string; kind: string; name: string | null; rev: number }[];

type VersionRow = { id: string; name: string | null; rev: number; kind: string };

// A version kept before Work Tracker 1097: a row of tab_versions holding `a` labelled `label`, as the old Name This
// Version wrote it.
function legacyVersion(
  db: SqliteD1,
  v: { id: string; rev: number; name: string | null; label: string },
): string {
  const data = JSON.stringify({ elements: [box('a', v.label), box('b', 'b', 200)] });
  db.sql
    .prepare(
      `INSERT INTO tab_versions (id, tab_id, rev, kind, name, author_id, author_name, author_color, tab_name, data,
                                 bytes, element_count, saved_at, created_at)
       VALUES (?, 't1', ?, 'manual', ?, ?, 'Webber', '#123456', 'Board', ?, ?, 2, 1, 1)`,
    )
    .run(v.id, v.rev, v.name, OWNER, data, data.length);
  return v.id;
}

// A named version of the tab as it is now, then the label of `a` changed after it.
async function namedThenChanged(db: SqliteD1) {
  const named = await call(db, 'POST', base, { name: 'Before' });
  expect(named.status).toBe(201);
  const { version } = await named.json<{ version: { id: string; name: string; rev: number } }>();
  expect((await change(db, [{ op: 'set', target: 'a', fields: { label: 'After' } }])).status).toBe(
    200,
  );
  return version;
}

afterEach(() => {
  vi.restoreAllMocks();
});
const quiet = () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('who sees and does what', () => {
  it('lets every level look, and only an Editor or a Participant restore, copy or name', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    testShareLink(db, 'D', 'VIEW', 'view');
    testShareLink(db, 'D', 'PART', 'participate');
    testShareLink(db, 'D', 'EDIT', 'edit');
    const viewer = { owner: 'guest-v', headers: { 'X-Share-Code': 'VIEW' } };
    const participant = { owner: 'guest-p', headers: { 'X-Share-Code': 'PART' } };
    const editor = { owner: 'guest-e', headers: { 'X-Share-Code': 'EDIT' } };
    for (const who of [viewer, participant, editor]) {
      expect((await call(db, 'GET', base, undefined, who)).status).toBe(200);
      expect((await call(db, 'GET', `${base}/${version.id}`, undefined, who)).status).toBe(200);
    }
    for (const who of [viewer]) {
      expect((await call(db, 'POST', `${base}/${version.id}/restore`, {}, who)).status).toBe(403);
      expect((await call(db, 'POST', `${base}/${version.id}/copy`, {}, who)).status).toBe(403);
      expect((await call(db, 'POST', base, { name: 'Mine' }, who)).status).toBe(403);
      expect((await call(db, 'PUT', `${base}/${version.id}/name`, { name: 'X' }, who)).status).toBe(
        403,
      );
    }
    const restored = await call(db, 'POST', `${base}/${version.id}/restore`, {}, editor);
    expect(restored.status).toBe(200);
    expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label: 'a' });
    expect((await call(db, 'POST', `${base}/${version.id}/copy`, {}, editor)).status).toBe(201);
    expect((await call(db, 'POST', `${base}/${version.id}/restore`, {}, participant)).status).toBe(
      200,
    );
  });

  it('keeps a stranger and a Community visitor out, and reads another tab as missing', async () => {
    quiet();
    const { db } = await setUp();
    expect((await call(db, 'GET', base, undefined, { owner: 'stranger' })).status).toBe(404);
    expect((await call(db, 'POST', `${base}/v_x/restore`, {}, { owner: 'stranger' })).status).toBe(
      403,
    );
    expect((await call(db, 'GET', base, undefined, { owner: 'g', community: true })).status).toBe(
      404,
    );
    testShareLink(db, 'D', 'TAB2', 'edit', 'never', 't2');
    const tabLink = { owner: 'guest-t', headers: { 'X-Share-Code': 'TAB2' } };
    expect((await call(db, 'GET', base, undefined, tabLink)).status).toBe(404);
    expect((await call(db, 'POST', `${base}/v_x/restore`, {}, tabLink)).status).toBe(404);
    const own = await call(db, 'GET', '/api/documents/D/tabs/t2/versions', undefined, tabLink);
    expect(own.status).toBe(200);
  });

  it('never lets a tab link make a copy', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    testShareLink(db, 'D', 'TAB1', 'edit', 'never', 't1');
    const res = await call(
      db,
      'POST',
      `${base}/${version.id}/copy`,
      {},
      {
        owner: 'guest-t',
        headers: { 'X-Share-Code': 'TAB1' },
      },
    );
    expect(res.status).toBe(403);
  });

  it('answers a missing tab and a missing version as not found', async () => {
    quiet();
    const { db } = await setUp();
    expect((await call(db, 'GET', '/api/documents/D/tabs/nope/versions')).status).toBe(404);
    expect((await call(db, 'GET', `${base}/v_missing`)).status).toBe(404);
    expect((await call(db, 'GET', '/api/documents/ZZ/tabs/t1/versions')).status).toBe(404);
    // Not a version door: left to the next handler.
    expect((await call(db, 'DELETE', `${base}/v_missing`)).status).not.toBe(200);
  });
});

describe('reading', () => {
  it('lists newest first and opens one with its body as it was', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    const list = await (await call(db, 'GET', base)).json<{ versions: { id: string }[] }>();
    expect(list.versions.map((v) => v.id)).toEqual([version.id]);
    const one = await call(db, 'GET', `${base}/${version.id}`);
    const body = await one.json<{
      version: { name: string };
      tab: { id: string; name: string; elements: Element[] };
    }>();
    expect(body.version.name).toBe('Before');
    expect(body.tab).toMatchObject({ id: 't1', name: 'Board' });
    expect(body.tab.elements.find((e) => e.id === 'a')).toMatchObject({ label: 'a' });
  });

  it("hides other people's comment authors from a visitor", async () => {
    quiet();
    const { db } = await setUp();
    const thread = { id: 'th', comments: [{ id: 'c', authorId: OWNER, text: 'hi', createdAt: 1 }] };
    await change(db, [{ op: 'set', target: 'a', fields: { commentThread: thread } }]);
    const named = await (
      await call(db, 'POST', base, { name: 'With a comment' })
    ).json<{
      version: { id: string };
    }>();
    testShareLink(db, 'D', 'VIEW', 'view');
    const res = await call(db, 'GET', `${base}/${named.version.id}`, undefined, {
      owner: 'guest-v',
      headers: { 'X-Share-Code': 'VIEW' },
    });
    expect(JSON.stringify(await res.json())).not.toContain(OWNER);
  });
});

describe('restoring', () => {
  it('writes one changeset, keeps an Undo version, relays and counts', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const version = await namedThenChanged(db);
    r.calls.length = 0;
    const res = await call(
      db,
      'POST',
      `${base}/${version.id}/restore`,
      {},
      {
        headers: { 'X-Liveknowledge-Client': 'editor' },
      },
    );
    expect(res.status).toBe(200);
    const { restored } = await res.json<{
      restored: { tabId: string; rev: number; changesetId: string; undoVersionId: string };
    }>();
    expect(restored.tabId).toBe('t1');
    expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label: 'a' });
    const undo = versionRows(db).find((v) => v.id === restored.undoVersionId)!;
    expect(undo.kind).toBe('restore');
    const record = db.sql
      .prepare('SELECT summary FROM agent_changesets WHERE id = ?')
      .get(restored.changesetId) as { summary: string };
    expect(record.summary).toBe('Restored “Before”');
    const relay = r.calls.find((c) => c.url.endsWith('/mutation'))!.body as {
      op: { kind: string };
    };
    expect(relay.op.kind).toBe('changeset');
    await settled();
    expect(sent.filter((e) => e.category === 'Version')).toContainEqual(
      expect.objectContaining({ action: 'Restored', type: 'Editor' }),
    );
    // Undo is restoring the kept version: the content comes back.
    const back = await call(db, 'POST', `${base}/${restored.undoVersionId}/restore`, {});
    expect(back.status).toBe(200);
    expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label: 'After' });
  });

  it('answers nothing restored when the content is already the same', async () => {
    quiet();
    const { db } = await setUp();
    const named = await (
      await call(db, 'POST', base, { name: 'Now' })
    ).json<{
      version: { id: string };
    }>();
    const res = await call(db, 'POST', `${base}/${named.version.id}/restore`, {});
    expect(await res.json()).toEqual({ restored: null });
  });

  it('reuses the version that already holds the revision as the Undo', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    const now = await (
      await call(db, 'POST', base, { name: 'Current' })
    ).json<{
      version: { id: string };
    }>();
    const res = await call(db, 'POST', `${base}/${version.id}/restore`, {});
    const { restored } = await res.json<{ restored: { undoVersionId: string } }>();
    expect(restored.undoVersionId).toBe(now.version.id);
  });

  it('sends the look a version had as a tab-meta op', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const named = await (
      await call(db, 'POST', base, { name: 'Plain' })
    ).json<{
      version: { id: string };
    }>();
    db.sql
      .prepare('UPDATE tabs SET data = json_set(data, ?, ?), rev = rev + 1 WHERE id = ?')
      .run('$.pattern', 'dots', 't1');
    r.calls.length = 0;
    const res = await call(db, 'POST', `${base}/${named.version.id}/restore`, {});
    const { restored } = await res.json<{ restored: { changesetId: string | null } }>();
    expect(restored.changesetId).toBeNull();
    expect(stored(db)).not.toHaveProperty('pattern');
    const meta = r.calls
      .map((c) => (c.body as { op?: { kind: string; clear?: string[] } } | null)?.op)
      .find((op) => op?.kind === 'tab-meta');
    expect(meta?.clear).toContain('pattern');
  });

  it("holds an agent's restore off elements a person has selected", async () => {
    quiet();
    const { db } = await setUp([{ elementIds: ['a'], name: 'Bea', color: '#f00', mine: false }]);
    const version = await namedThenChanged(db);
    const res = await call(db, 'POST', `${base}/${version.id}/restore`, {}, { token: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'elements_held' });
  });
});

describe('a version that no longer reads', () => {
  it('is not found to open, restore or copy, in either store', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    // The snapshots' store: a chunk gone.
    db.sql.prepare('DELETE FROM snapshot_chunks WHERE snapshot_id = ?').run(version.id);
    // The old store: a body that no longer parses.
    legacyVersion(db, { id: 'v_broken', rev: 900, name: 'Broken', label: 'x' });
    db.sql.prepare("UPDATE tab_versions SET data = '{' WHERE id = 'v_broken'").run();
    for (const id of [version.id, 'v_broken']) {
      expect((await call(db, 'GET', `${base}/${id}`)).status).toBe(404);
      expect((await call(db, 'POST', `${base}/${id}/restore`, {})).status).toBe(404);
      expect((await call(db, 'POST', `${base}/${id}/copy`, {})).status).toBe(404);
    }
  });
});

// Work Tracker 1097: Name This Version keeps its version in the snapshots' store, and every version kept before stays in
// tab_versions and keeps working (docs/specs/006-document/version-history.md "Where versions are kept").
describe('the two stores', () => {
  const list = async (db: SqliteD1, who: Who = {}) =>
    (await (await call(db, 'GET', base, undefined, who)).json<{ versions: VersionRow[] }>())
      .versions;

  it('keeps Name This Version in the snapshots store, apart from the document snapshots', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    expect(version.id).toMatch(/^s_/);
    expect(versionRows(db)).toEqual([]);
    const scoped = db.sql
      .prepare('SELECT item_id, kind, name FROM snapshots WHERE id = ?')
      .get(version.id) as { item_id: string; kind: string; name: string };
    expect(scoped).toEqual({ item_id: 'tab:t1', kind: 'manual', name: 'Before' });
    // The document's own snapshots (item id the document's) never list or delete a tab's version.
    expect(await listSnapshots(db.env.DOCUMENT_DB, 'D')).toEqual([]);
    expect(await deleteSnapshot(db.env.DOCUMENT_DB, 'D', version.id)).toBe(false);
    expect((await list(db)).map((v) => v.id)).toEqual([version.id]);
  });

  it('opens, restores, copies and renames a version kept before the change (old store only)', async () => {
    quiet();
    const { db } = await setUp();
    const old = legacyVersion(db, { id: 'v_legacy', rev: 0, name: 'Legacy', label: 'old a' });
    await change(db, [{ op: 'set', target: 'a', fields: { label: 'Now' } }]);
    expect(await list(db)).toEqual([expect.objectContaining({ id: old, name: 'Legacy' })]);
    const one = await call(db, 'GET', `${base}/${old}`);
    expect(one.status).toBe(200);
    const read = await one.json<{ tab: { elements: Element[] } }>();
    expect(read.tab.elements.find((e) => e.id === 'a')).toMatchObject({ label: 'old a' });
    const restored = await call(db, 'POST', `${base}/${old}/restore`, {});
    expect(restored.status).toBe(200);
    expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label: 'old a' });
    const { restored: done } = await restored.json<{ restored: { undoVersionId: string } }>();
    expect((await call(db, 'POST', `${base}/${done.undoVersionId}/restore`, {})).status).toBe(200);
    expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label: 'Now' });
    expect((await call(db, 'POST', `${base}/${old}/copy`, {})).status).toBe(201);
    const renamed = await call(db, 'PUT', `${base}/${old}/name`, { name: 'Legacy 2' });
    expect((await renamed.json<{ version: VersionRow }>()).version).toMatchObject({
      id: old,
      name: 'Legacy 2',
    });
    // It stayed where it was: nothing moved into the snapshots store.
    expect(versionRows(db).find((v) => v.id === old)).toMatchObject({ name: 'Legacy 2' });
    const moved = db.sql.prepare('SELECT COUNT(*) AS n FROM tab_named_versions').get() as {
      n: number;
    };
    expect(moved.n).toBe(0);
  });

  it('lists both stores as one list, newest first, and restores from each', async () => {
    quiet();
    const { db } = await setUp();
    const old = legacyVersion(db, { id: 'v_legacy', rev: 0, name: 'Legacy', label: 'old a' });
    const fresh = await namedThenChanged(db);
    const both = await list(db);
    expect(both.map((v) => v.id)).toEqual([fresh.id, old]);
    expect(Object.keys(both[0]!).sort()).toEqual(Object.keys(both[1]!).sort());
    for (const [id, label] of [
      [old, 'old a'],
      [fresh.id, 'a'],
    ] as const) {
      expect((await call(db, 'POST', `${base}/${id}/restore`, {})).status).toBe(200);
      expect(stored(db).elements.find((e) => e.id === 'a')).toMatchObject({ label });
    }
  });

  it('counts names in both stores toward the cap', async () => {
    quiet();
    const { db } = await setUp();
    for (let i = 0; i < VERSION_NAMED_MAX - 1; i += 1) {
      legacyVersion(db, { id: `v_fill${i}`, rev: 1000 + i, name: `N${i}`, label: 'x' });
    }
    expect((await call(db, 'POST', base, { name: 'Last' })).status).toBe(201);
    await change(db, [{ op: 'set', target: 'a', fields: { label: 'Later' } }]);
    const over = await call(db, 'POST', base, { name: 'Too many' });
    expect(over.status).toBe(409);
  });

  it('unnames a new-store version into an automatic one, and the editor sees its id kept', async () => {
    quiet();
    const { db } = await setUp();
    const version = await namedThenChanged(db);
    const res = await call(db, 'PUT', `${base}/${version.id}/name`, { name: null });
    expect((await res.json<{ version: VersionRow }>()).version).toMatchObject({
      id: version.id,
      name: null,
      kind: 'manual',
    });
    expect(versionRows(db)).toEqual([expect.objectContaining({ id: version.id, name: null })]);
    expect((await call(db, 'GET', `${base}/${version.id}`)).status).toBe(200);
  });

  it('keeps Name This Version in tab_versions when the snapshots store cannot be written', async () => {
    quiet();
    const { db } = await setUp();
    const old = legacyVersion(db, { id: 'v_legacy', rev: 0, name: 'Legacy', label: 'old a' });
    db.sql.exec('DROP TABLE tab_named_versions');
    const named = await call(db, 'POST', base, { name: 'Fallback' });
    expect(named.status).toBe(201);
    const { version } = await named.json<{ version: VersionRow }>();
    expect(version.id).toMatch(/^v_/);
    expect((await list(db)).map((v) => v.id)).toEqual([version.id, old]);
    expect(console.warn).toHaveBeenCalledWith(
      '[versions] refused',
      expect.objectContaining({ reason: 'store' }),
      expect.anything(),
    );
  });

  it('lets every level look at both stores, and only an Editor or a Participant name or restore', async () => {
    quiet();
    const { db } = await setUp();
    const old = legacyVersion(db, { id: 'v_legacy', rev: 0, name: 'Legacy', label: 'old a' });
    const fresh = await namedThenChanged(db);
    testShareLink(db, 'D', 'VIEW', 'view');
    testShareLink(db, 'D', 'PART', 'participate');
    testShareLink(db, 'D', 'EDIT', 'edit');
    const viewer = { owner: 'guest-v', headers: { 'X-Share-Code': 'VIEW' } };
    const participant = { owner: 'guest-p', headers: { 'X-Share-Code': 'PART' } };
    const editor = { owner: 'guest-e', headers: { 'X-Share-Code': 'EDIT' } };
    for (const who of [viewer, participant, editor]) {
      expect((await list(db, who)).map((v) => v.id)).toEqual([fresh.id, old]);
      for (const id of [old, fresh.id]) {
        expect((await call(db, 'GET', `${base}/${id}`, undefined, who)).status).toBe(200);
      }
    }
    for (const who of [viewer]) {
      for (const id of [old, fresh.id]) {
        expect((await call(db, 'POST', `${base}/${id}/restore`, {}, who)).status).toBe(403);
        expect((await call(db, 'PUT', `${base}/${id}/name`, { name: 'X' }, who)).status).toBe(403);
      }
    }
    for (const id of [old, fresh.id]) {
      expect((await call(db, 'POST', `${base}/${id}/restore`, {}, editor)).status).toBe(200);
      expect((await call(db, 'PUT', `${base}/${id}/name`, { name: 'E' }, editor)).status).toBe(200);
      expect((await call(db, 'PUT', `${base}/${id}/name`, { name: 'P' }, participant)).status).toBe(
        200,
      );
    }
    expect((await call(db, 'GET', base, undefined, { owner: 'g', community: true })).status).toBe(
      404,
    );
  });
});

describe('making a copy', () => {
  it('adds a tab with the content and without the comments', async () => {
    quiet();
    const { db } = await setUp();
    const thread = { id: 'th', comments: [{ id: 'c', authorId: OWNER, text: 'hi', createdAt: 1 }] };
    await change(db, [{ op: 'set', target: 'a', fields: { commentThread: thread } }]);
    const named = await (
      await call(db, 'POST', base, { name: 'Kept' })
    ).json<{
      version: { id: string };
    }>();
    const res = await call(db, 'POST', `${base}/${named.version.id}/copy`, {});
    expect(res.status).toBe(201);
    const { tab } = await res.json<{ tab: { id: string; name: string } }>();
    expect(tab.name).toBe('Board (copy)');
    const copy = stored(db, tab.id);
    expect(copy.elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(copy.elements[0]).not.toHaveProperty('commentThread');
    const named2 = await call(db, 'POST', `${base}/${named.version.id}/copy`, { name: 'Pitch' });
    expect((await named2.json<{ tab: { name: string } }>()).tab.name).toBe('Pitch');
    await settled();
    expect(sent.filter((e) => e.category === 'Version' && e.action === 'Copied')).toHaveLength(2);
  });
});

describe('naming', () => {
  it('names the version holding the revision, renames and unnames', async () => {
    quiet();
    const { db } = await setUp();
    const first = await (
      await call(db, 'POST', base, { name: 'One' })
    ).json<{
      version: { id: string; kind: string };
    }>();
    expect(first.version.kind).toBe('manual');
    const again = await (
      await call(db, 'POST', base, { name: 'Two' })
    ).json<{
      version: { id: string; name: string };
    }>();
    expect(again.version).toMatchObject({ id: first.version.id, name: 'Two' });
    const renamed = await call(db, 'PUT', `${base}/${first.version.id}/name`, { name: 'Three' });
    expect((await renamed.json<{ version: { name: string } }>()).version.name).toBe('Three');
    const unnamed = await call(db, 'PUT', `${base}/${first.version.id}/name`, { name: '' });
    expect((await unnamed.json<{ version: { name: string | null } }>()).version.name).toBeNull();
  });

  it('refuses no name and a name past the cap', async () => {
    quiet();
    const { db } = await setUp();
    expect((await call(db, 'POST', base, { name: '  ' })).status).toBe(400);
    expect((await call(db, 'POST', base, {})).status).toBe(400);
    const one = await (
      await call(db, 'POST', base, { name: 'One' })
    ).json<{
      version: { id: string };
    }>();
    expect((await call(db, 'PUT', `${base}/${one.version.id}/name`, { name: 3 })).status).toBe(400);
    for (let i = 0; i < VERSION_NAMED_MAX; i += 1) {
      db.sql
        .prepare(
          `INSERT INTO tab_versions (id, tab_id, rev, kind, name, tab_name, data, bytes, element_count, saved_at, created_at)
           VALUES (?, 't1', ?, 'manual', ?, 'Board', '{"elements":[]}', 15, 0, 1, 1)`,
        )
        .run(`v_fill${i}`, 1000 + i, `N${i}`);
    }
    await change(db, [{ op: 'set', target: 'a', fields: { label: 'Later' } }]);
    const over = await call(db, 'POST', base, { name: 'Too many' });
    expect(over.status).toBe(409);
    expect(await over.json()).toMatchObject({ error: 'too_many_names' });
    const unnamedOne = await call(db, 'PUT', `${base}/${one.version.id}/name`, { name: null });
    expect(unnamedOne.status).toBe(200);
    expect((await call(db, 'PUT', `${base}/${one.version.id}/name`, { name: 'Back' })).status).toBe(
      409,
    );
  });
});

describe('an agent changeset', () => {
  it('keeps the content it changes first, once per burst', async () => {
    quiet();
    const { db } = await setUp();
    const agent = { token: true };
    await change(db, [{ op: 'set', target: 'a', fields: { label: 'A1' } }], agent);
    await change(db, [{ op: 'set', target: 'a', fields: { label: 'A2' } }], agent);
    expect(versionRows(db).filter((v) => v.kind === 'agent')).toHaveLength(1);
  });
});
