import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livediagram/api-schema';
import { elementFingerprint, type Element } from '@livediagram/document';
import { createShareLink } from '../db/share';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Runtime } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The changeset routes end to end on real SQLite (docs/specs/024-agents/agent-changesets.md; blueprint
// "Testing"): submit, list, one, revert, with a recording room.

const OWNER = 'user_owner';
const box = (id: string, label = id, x = 0): Element =>
  ({ id, type: 'shape', shape: 'square', x, y: 0, width: 120, height: 60, label }) as Element;

type Selection = { elementIds: string[]; name: string; color: string; mine: boolean };

function room(selections: Selection[] | 'down' = []) {
  const calls: { url: string; body: unknown }[] = [];
  const binding = {
    for: () => ({
      fetch: async (input: string, init?: RequestInit) => {
        calls.push({ url: input, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (input.includes('/selections')) {
          return selections === 'down'
            ? new Response('no', { status: 500 })
            : Response.json({ selections });
        }
        return new Response(null, { status: 204 });
      },
    }),
  };
  return { calls, binding };
}

type Who = { owner?: string; token?: boolean; headers?: Record<string, string> };

// Work the routes schedule off the response path (telemetry, the Timeline), awaited by `settled`.
const pending: Promise<unknown>[] = [];
const settled = () => Promise.all(pending.splice(0));

function call(db: SqliteD1, method: string, path: string, body?: unknown, who: Who = {}) {
  const owner = who.owner ?? OWNER;
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      clerkUserId: who.token ? null : owner,
      verifiedUserId: owner,
      body,
      headers: who.headers,
      token: who.token ? { id: 'tok_1' } : null,
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

async function setUp(
  selections: Selection[] | 'down' = [],
  elements = [box('a'), box('b', 'b', 200)],
) {
  const r = room(selections);
  const db = sqliteD1({
    rooms: r.binding,
    TELEMETRY_ENABLED: 'true',
  } as unknown as Partial<Runtime>);
  db.sql.exec(
    `INSERT INTO participants (id, name, color, created_at) VALUES ('${OWNER}', 'Webber', '#123456', 1)`,
  );
  const created = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [{ id: 't1', name: 'Board', elements }],
  });
  expect(created.status).toBe(201);
  return { db, room: r };
}

const submit = (db: SqliteD1, body: unknown, who: Who = { token: true }, query = '') =>
  call(db, 'POST', `/api/documents/D/tabs/t1/changesets${query}`, body, who);
const stored = (db: SqliteD1, tab = 't1') =>
  (JSON.parse(db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab)!.data as string)
    .elements ?? []) as Element[];
const records = (db: SqliteD1) =>
  db.sql.prepare('SELECT * FROM agent_changesets ORDER BY rev').all() as Record<string, unknown>[];
const events = (db: SqliteD1) =>
  db.sql
    .prepare("SELECT action, type FROM events WHERE category = 'Agent'")
    .all()
    .map((r) => ({ ...r }));

afterEach(() => vi.restoreAllMocks());
const quiet = () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('submitting a changeset', () => {
  it('applies, records the token and the author, relays, logs and counts', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const res = await submit(
      db,
      {
        operations: [{ op: 'set', target: 'a', fields: { label: 'Sign in' } }],
        summary: '  rename a  ',
      },
      { token: true, headers: { 'X-Livediagram-Client': 'mcp' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      changeset: { id: string; rev: number; previousRev: number };
      text: string;
      warnings: string[];
    };
    expect(body.changeset).toMatchObject({ rev: 2, previousRev: 1, rebasedOver: 0 });
    expect(body.warnings).toContain('no_base');
    expect(body.text).toContain(body.changeset.id);
    expect(stored(db).find((e) => e.id === 'a')).toMatchObject({ label: 'Sign in' });
    expect(records(db)[0]).toMatchObject({
      token_id: 'tok_1',
      author_id: OWNER,
      author_name: 'Webber',
      author_color: '#123456',
      summary: 'rename a',
      changed: 1,
    });
    const relay = r.calls.find((c) => c.url.endsWith('/mutation'))!.body as {
      op: Record<string, unknown>;
    };
    expect(relay.op).toMatchObject({
      kind: 'changeset',
      id: body.changeset.id,
      rev: 2,
      prevRev: null,
      author: { name: 'Webber', color: '#123456' },
      summary: 'rename a',
      counts: { added: 0, changed: 1, removed: 0 },
    });
    expect(relay.op.agentKey).toMatch(/^[0-9a-f]{12}$/);
    expect(console.info).toHaveBeenCalledWith(
      '[changeset] applied',
      expect.objectContaining({ documentId: 'D', rev: 2, agent: true }),
    );
    await settled();
    expect(events(db)).toContainEqual({ action: 'Applied', type: 'Mcp' });
  });

  it("records no token for a person's session, and holds nothing against them", async () => {
    quiet();
    const { db } = await setUp([{ elementIds: ['a'], name: 'Bea', color: '#f00', mine: false }]);
    const res = await submit(db, { operations: [{ op: 'rm', target: 'a' }] }, {});
    expect(res.status).toBe(200);
    expect(records(db)[0]).toMatchObject({ token_id: null, removed: 1 });
  });

  it("creates a tab with a replace on an id the document lacks, and refuses another document's tab", async () => {
    quiet();
    const { db, room: r } = await setUp();
    const res = await call(
      db,
      'POST',
      '/api/documents/D/tabs/t2/changesets',
      { replace: { graph: { nodes: [{ id: 'x', label: 'X' }], edges: [] }, name: 'Detail' } },
      { token: true },
    );
    expect(res.status).toBe(200);
    expect(db.sql.prepare("SELECT name, rev FROM tabs WHERE id = 't2'").get()).toEqual({
      name: 'Detail',
      rev: 1,
    });
    expect(records(db)[0]).toMatchObject({ created_tab: 1, rev: 1 });
    const relay = r.calls.find((c) => c.url.endsWith('/mutation'))!.body as {
      op: { tab?: { name: string } };
    };
    expect(relay.op.tab).toMatchObject({ name: 'Detail' });

    await call(db, 'POST', '/api/documents', {
      id: 'E',
      name: 'Other',
      tabs: [{ id: 'theirs', name: 'T', elements: [] }],
    });
    const taken = await call(
      db,
      'POST',
      '/api/documents/D/tabs/theirs/changesets',
      { replace: { elements: [] } },
      { token: true },
    );
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: 'tab_id_taken' });
  });

  it('writes nothing on any refusal, and says why', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const before = stored(db);
    const refusals = [
      [
        { operations: [{ op: 'set', target: 'nope', fields: { label: 'x' } }] },
        422,
        'target_not_found',
      ],
      [{ operations: [{ op: 'paint', target: 'a' }] }, 400, 'unknown_operation'],
      [{ operations: 'set a label="x' }, 400, 'parse_error'],
      [{ operations: 'set nope label=x' }, 422, 'target_not_found'],
      [{ operations: 7 }, 400, 'invalid_body'],
      [{ operations: [], replace: { elements: [] } }, 400, 'invalid_body'],
      [
        {
          operations: [{ op: 'set', target: 'a', fields: { label: 'x' } }],
          summary: 'x'.repeat(81),
        },
        422,
        'invalid_value',
      ],
      [
        { operations: [{ op: 'set', target: 'a', fields: {} }], base: { rev: 99 } },
        400,
        'invalid_base',
      ],
      [
        { operations: [{ op: 'set', target: 'a', fields: {} }], strict: true },
        400,
        'strict_needs_base',
      ],
      [
        {
          operations: Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () => ({
            op: 'rm',
            target: 'a',
          })),
        },
        413,
        'too_large',
      ],
    ] as const;
    for (const [body, status, error] of refusals) {
      const res = await submit(db, body);
      expect(res.status, error).toBe(status);
      expect(await res.json(), error).toMatchObject({ error });
    }
    expect(stored(db)).toEqual(before);
    expect(records(db)).toEqual([]);
    expect(r.calls.some((c) => c.url.endsWith('/mutation'))).toBe(false);
  });

  it('applies the line form, answering the result lines', async () => {
    quiet();
    const { db } = await setUp();
    const res = await submit(db, { operations: 'set a fill=green\nconnect a -> b label=next' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      text: string;
      lint: { measures: { boxes: number } } | null;
    };
    expect(body.text.split('\n').at(-1)).toMatch(
      /^rev 1→2 · cs_\w+ · lint (clean|\d+ \w+(, \d+ \w+)*) · revert: /,
    );
    expect(body.lint).toMatchObject({ measures: { boxes: 2, arrows: 1 } });
    expect(body.text.split('\n').slice(0, 2)).toEqual([
      '~ a  fill →green · textSize →md',
      '+ next  a→b "next"',
    ]);
    expect(stored(db).find((e) => e.id === 'next')).toMatchObject({
      type: 'arrow',
      label: 'next',
    });
  });

  it('answers a dry run with the plan only', async () => {
    quiet();
    const { db } = await setUp();
    const res = await submit(
      db,
      { operations: [{ op: 'rm', target: 'b' }] },
      { token: true },
      '?dryRun=1',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      dryRun: true,
      changeset: null,
      text: expect.stringMatching(/dry run · rev 1 · lint clean · nothing written$/),
      lint: { counts: { error: 0, warning: 0, info: 0 }, measures: { boxes: 1 } },
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'b']);
    expect(records(db)).toEqual([]);
  });

  it('writes nothing for a changeset that changes nothing', async () => {
    quiet();
    const { db } = await setUp();
    const res = await submit(db, {
      operations: [{ op: 'set', target: 'a', fields: { label: 'a' } }],
    });
    expect(await res.json()).toMatchObject({ changeset: null });
    expect(records(db)).toEqual([]);
  });

  it('lets an edit share link submit, and refuses a view link', async () => {
    quiet();
    const { db } = await setUp();
    await createShareLink(db.env, 'D', 'EDITCODE', 'edit');
    await createShareLink(db.env, 'D', 'VIEWCODE', 'view');
    const edit = await submit(
      db,
      { operations: [{ op: 'rm', target: 'b' }] },
      { owner: 'guest-1', headers: { 'X-Share-Code': 'EDITCODE' } },
    );
    expect(edit.status).toBe(200);
    const view = await submit(
      db,
      { operations: [{ op: 'rm', target: 'a' }] },
      { owner: 'guest-2', headers: { 'X-Share-Code': 'VIEWCODE' } },
    );
    expect(view.status).toBe(403);
  });
});

describe('held elements', () => {
  it("refuses a token's changeset on an element a person holds, naming them, and writes nothing", async () => {
    quiet();
    const { db } = await setUp([
      { elementIds: ['a', 'x'], name: 'Bea', color: '#f00', mine: false },
    ]);
    const res = await submit(db, {
      operations: [{ op: 'set', target: 'a', fields: { label: 'z' } }],
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'elements_held',
      held: [{ id: 'a', by: { name: 'Bea', color: '#f00' } }],
    });
    expect(records(db)).toEqual([]);
    await settled();
    expect(events(db)).toContainEqual({ action: 'Held', type: 'Api' });
  });

  it("never holds against the agent's owner", async () => {
    quiet();
    const { db } = await setUp([
      { elementIds: ['a'], name: 'Webber', color: '#123456', mine: true },
    ]);
    expect((await submit(db, { operations: [{ op: 'rm', target: 'a' }] })).status).toBe(200);
  });

  it('applies when the room cannot answer, and logs it', async () => {
    quiet();
    const { db } = await setUp('down');
    expect((await submit(db, { operations: [{ op: 'rm', target: 'a' }] })).status).toBe(200);
    expect(console.warn).toHaveBeenCalledWith(
      '[changeset] selections-unreachable',
      expect.objectContaining({ documentId: 'D' }),
    );
  });
});

describe('conflicts', () => {
  it('rebases over writes that left the targets alone', async () => {
    quiet();
    const { db } = await setUp();
    const a = stored(db).find((e) => e.id === 'a')!;
    await submit(db, { operations: [{ op: 'set', target: 'b', fields: { label: 'other' } }] }, {});
    const res = await submit(db, {
      operations: [{ op: 'set', target: 'a', fields: { label: 'mine' } }],
      base: { rev: 1, elements: { a: elementFingerprint(a) } },
    });
    expect(await res.json()).toMatchObject({ changeset: { rebasedOver: 1 } });
  });

  it("refuses a target changed since the agent's read, with the element now", async () => {
    quiet();
    const { db } = await setUp();
    const a = stored(db).find((e) => e.id === 'a')!;
    await submit(db, { operations: [{ op: 'set', target: 'a', fields: { label: 'person' } }] }, {});
    const res = await submit(db, {
      operations: [{ op: 'set', target: 'a', fields: { label: 'agent' } }],
      base: { rev: 1, elements: { a: elementFingerprint(a) } },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: 'changeset_conflict',
      rev: 2,
      conflicts: [{ id: 'a', reason: 'changed', now: { label: 'person' } }],
    });
    await settled();
    expect(events(db)).toContainEqual({ action: 'Conflicted', type: 'Api' });
  });

  it('answers stale_tab for strict on a moved tab', async () => {
    quiet();
    const { db } = await setUp();
    await submit(db, { operations: [{ op: 'rm', target: 'b' }] }, {});
    const res = await submit(db, {
      operations: [{ op: 'rm', target: 'a' }],
      base: { rev: 1 },
      strict: true,
    });
    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({ error: 'stale_tab', rev: 2 });
  });
});

describe('the history and one changeset', () => {
  it('lists newest first, showing the token id to its author only, and reads one with its text', async () => {
    quiet();
    const { db } = await setUp();
    const first = (await (
      await submit(db, { operations: [{ op: 'rm', target: 'b' }], summary: 'drop b' })
    ).json()) as { changeset: { id: string }; text: string };
    await submit(db, { operations: [{ op: 'set', target: 'a', fields: { label: 'z' } }] });
    const mine = (await (await call(db, 'GET', '/api/documents/D/changesets')).json()) as {
      changesets: { id: string; tokenId?: string }[];
    };
    expect(mine.changesets).toHaveLength(2);
    expect(mine.changesets[1]).toMatchObject({
      id: first.changeset.id,
      tokenId: 'tok_1',
      summary: 'drop b',
      agent: true,
    });
    await createShareLink(db.env, 'D', 'VIEWCODE', 'view');
    const theirs = (await (
      await call(db, 'GET', '/api/documents/D/changesets?limit=1', undefined, {
        owner: 'guest',
        headers: { 'X-Share-Code': 'VIEWCODE' },
      })
    ).json()) as { changesets: Record<string, unknown>[] };
    expect(theirs.changesets).toHaveLength(1);
    expect(theirs.changesets[0]).not.toHaveProperty('tokenId');
    expect((await call(db, 'GET', '/api/documents/D/changesets?limit=0')).status).toBe(400);
    const one = await call(db, 'GET', `/api/documents/D/changesets/${first.changeset.id}`);
    expect(await one.json()).toMatchObject({
      changeset: { id: first.changeset.id },
      text: first.text,
    });
  });
});

describe('reverting', () => {
  it('applies the inverse as a new changeset by the reverter, and a second revert changes nothing', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const cs = (await (await submit(db, { operations: [{ op: 'rm', target: 'b' }] })).json()) as {
      changeset: { id: string };
    };
    const res = await call(
      db,
      'POST',
      `/api/documents/D/changesets/${cs.changeset.id}/revert`,
      undefined,
      { headers: { 'X-Livediagram-Client': 'editor' } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      reverted: 1,
      kept: [],
      changeset: { rev: 3 },
      lint: { measures: { boxes: 2 } },
    });
    expect(stored(db).map((e) => e.id)).toEqual(['a', 'b']);
    expect(records(db)[1]).toMatchObject({ revert_of: cs.changeset.id, token_id: null, added: 1 });
    expect(r.calls.filter((c) => c.url.endsWith('/mutation'))).toHaveLength(2);
    await settled();
    expect(events(db)).toContainEqual({ action: 'Reverted', type: 'Editor' });
    const again = await call(db, 'POST', `/api/documents/D/changesets/${cs.changeset.id}/revert`);
    expect(await again.json()).toMatchObject({
      changeset: null,
      reverted: 0,
      kept: [{ id: 'b', reason: 'present' }],
    });
  });

  it('keeps an element a person changed since', async () => {
    quiet();
    const { db } = await setUp();
    const cs = (await (
      await submit(db, { operations: [{ op: 'set', target: 'a', fields: { label: 'agent' } }] })
    ).json()) as { changeset: { id: string } };
    await submit(db, { operations: [{ op: 'set', target: 'a', fields: { label: 'person' } }] }, {});
    const res = await call(db, 'POST', `/api/documents/D/changesets/${cs.changeset.id}/revert`);
    expect(await res.json()).toMatchObject({
      changeset: null,
      kept: [{ id: 'a', reason: 'changed' }],
    });
  });

  it('empties a tab the changeset created and keeps it', async () => {
    quiet();
    const { db } = await setUp();
    const cs = (await (
      await call(
        db,
        'POST',
        '/api/documents/D/tabs/t2/changesets',
        { replace: { elements: [box('x')] } },
        { token: true },
      )
    ).json()) as { changeset: { id: string } };
    await call(db, 'POST', `/api/documents/D/changesets/${cs.changeset.id}/revert`);
    expect(stored(db, 't2')).toEqual([]);
  });

  it('refuses a viewer, and answers 404 for a changeset swept or of another document', async () => {
    quiet();
    const { db } = await setUp();
    const cs = (await (await submit(db, { operations: [{ op: 'rm', target: 'b' }] })).json()) as {
      changeset: { id: string };
    };
    await createShareLink(db.env, 'D', 'VIEWCODE', 'view');
    const viewer = await call(
      db,
      'POST',
      `/api/documents/D/changesets/${cs.changeset.id}/revert`,
      undefined,
      { owner: 'g', headers: { 'X-Share-Code': 'VIEWCODE' } },
    );
    expect(viewer.status).toBe(403);
    db.sql.exec('DELETE FROM agent_changesets');
    expect(
      (await call(db, 'POST', `/api/documents/D/changesets/${cs.changeset.id}/revert`)).status,
    ).toBe(404);
  });
});

describe('agent presence after a changeset (docs/specs/024-agents/agent-presence.md "Presence")', () => {
  const presenceCalls = (r: { calls: { url: string; body: unknown }[] }) =>
    r.calls.filter((c) => c.url.includes('/presence'));

  it('refreshes the token’s presence after a write, not after a dry run or a session’s write', async () => {
    quiet();
    const { db, room: r } = await setUp();
    await submit(db, { operations: 'set a label=A1' }, { token: true }, '?dryRun=1');
    await submit(db, { operations: 'set a label=A2' }, { token: false });
    await settled();
    expect(presenceCalls(r)).toEqual([]);
    await submit(db, { operations: 'set a label=A3' });
    await settled();
    expect(presenceCalls(r)).toEqual([
      {
        url: 'https://room/presence',
        body: expect.objectContaining({
          tokenId: 'tok_1',
          tabId: 't1',
          name: 'Webber',
          mode: 'refresh',
          role: 'edit',
        }),
      },
    ]);
  });

  it('refreshes after a token’s revert too', async () => {
    quiet();
    const { db, room: r } = await setUp();
    const written = (await (await submit(db, { operations: 'set a label=A1' })).json()) as {
      changeset: { id: string };
    };
    await settled();
    r.calls.splice(0);
    const res = await call(
      db,
      'POST',
      `/api/documents/D/changesets/${written.changeset.id}/revert`,
      undefined,
      { token: true },
    );
    expect(res.status).toBe(200);
    await settled();
    expect(presenceCalls(r)).toHaveLength(1);
  });
});
