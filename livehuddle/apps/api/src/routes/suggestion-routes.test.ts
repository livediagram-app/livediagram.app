import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SuggestionsResponse } from '@livehuddle/api-schema';
import { SUGGESTION_TEXT_MAX, SUGGESTIONS_MAX, type Element } from '@livehuddle/document';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { utcDay } from './suggestion-routes';

// The Suggestion Box's routes (docs/specs/009-elements/team-pieces.md "Suggestion Box", "The wire"): a Participant or
// an Editor drops, only an Editor reads and removes, a note keeps nothing about its writer, and it never reaches a tab
// read.

const OWNER = 'guest_00000000-0000-4000-8000-000000000001';
const VISITOR = 'guest_00000000-0000-4000-8000-000000000002';
let sql: SqliteD1;
let pending: Promise<unknown>[];
let info: { mock: { calls: unknown[][] } };

const box = (id: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'suggestion-box',
    x: 0,
    y: 0,
    width: 64,
    height: 112,
    label: '',
    ...extra,
  }) as unknown as Element;

function seed(elements: Element[]) {
  sql.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ elements }), 't1');
}

type Call = { method?: string; path: string; body?: unknown; owner?: string | null; code?: string };

function call({ method = 'POST', path, body, owner = OWNER, code }: Call) {
  return handleDocuments(
    makeTestRouteContext(method, `/api/documents/d1${path}`, {
      env: sql.env,
      owner,
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
      ...(body === undefined ? {} : { body }),
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

const drop = (text: string, extra: Partial<Call> = {}) =>
  call({ path: '/tabs/t1/suggestions', body: { elementId: 'b', text }, ...extra });
const list = async (extra: Partial<Call> = {}) =>
  call({ method: 'GET', path: '/tabs/t1/suggestions?elementId=b', ...extra });

beforeEach(() => {
  sql = sqliteD1();
  pending = [];
  sql.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
      VALUES ('d1', '${OWNER}', 'Studio', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Detail', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
  `);
  testShareLink(sql, 'd1', 'TAKE', 'participate');
  testShareLink(sql, 'd1', 'LOOK', 'view');
  testShareLink(sql, 'd1', 'EDIT', 'edit');
  testShareLink(sql, 'd1', 'TAB2', 'participate', 't2');
  seed([box('b'), box('shut', { locked: true }), { ...box('sq'), shape: 'square' } as Element]);
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dropping a note', () => {
  it('lets a Participant drop one, answering nothing that could point back at it', async () => {
    const res = await drop('  More plants please  ', { owner: VISITOR, code: 'TAKE' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({});
    const rows = sql.sql.prepare('SELECT * FROM suggestions').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    // The row is the note and its day: no column could hold who dropped it.
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['day', 'document_id', 'element_id', 'id', 'tab_id', 'text'].sort(),
    );
    expect(rows[0]).toMatchObject({ text: 'More plants please', day: utcDay(Date.now()) });
    expect(JSON.stringify(rows)).not.toContain(VISITOR);
  });

  it('logs neither the writer nor the text', async () => {
    await drop('A secret idea', { owner: VISITOR, code: 'TAKE' });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).toContain('[suggestions] dropped');
    expect(logged).not.toContain(VISITOR);
    expect(logged).not.toContain('secret');
  });

  it('keeps the note out of the tab', async () => {
    await drop('Hidden from the tab', { owner: VISITOR, code: 'TAKE' });
    const tab = await db.getTab(sql.env, 'd1', 't1');
    expect(JSON.stringify(tab)).not.toContain('Hidden from the tab');
    expect(pending).toHaveLength(0);
  });

  it('lets an Editor drop one too', async () => {
    expect((await drop('From an editor', { owner: VISITOR, code: 'EDIT' })).status).toBe(201);
    expect((await drop('From the owner')).status).toBe(201);
  });

  it('refuses a Viewer, and a link confined to another tab', async () => {
    expect((await drop('No', { owner: VISITOR, code: 'LOOK' })).status).toBe(403);
    expect((await drop('No', { owner: VISITOR, code: 'TAB2' })).status).toBe(404);
    expect((await drop('No', { owner: null })).status).toBe(400);
  });

  it('refuses no text, too much text, no box and a box that is not one', async () => {
    expect((await drop('   ')).status).toBe(400);
    expect((await drop('x'.repeat(SUGGESTION_TEXT_MAX + 1))).status).toBe(400);
    expect((await drop('x'.repeat(SUGGESTION_TEXT_MAX))).status).toBe(201);
    expect((await call({ path: '/tabs/t1/suggestions', body: { text: 'x' } })).status).toBe(400);
    expect(
      (await call({ path: '/tabs/t1/suggestions', body: { elementId: 'zz', text: 'x' } })).status,
    ).toBe(404);
    expect(
      (await call({ path: '/tabs/t1/suggestions', body: { elementId: 'sq', text: 'x' } })).status,
    ).toBe(404);
    // A box saved locked before locking left takes notes like any other (not-in-livehuddle.md "Element and Tab
    // Locking").
    const old = await call({
      path: '/tabs/t1/suggestions',
      body: { elementId: 'shut', text: 'x' },
    });
    expect(old.status).toBe(201);
    expect(
      (await call({ path: '/tabs/t9/suggestions', body: { elementId: 'b', text: 'x' } })).status,
    ).toBe(404);
  });

  it('refuses a drop into a full box', async () => {
    const insert = sql.sql.prepare(
      "INSERT INTO suggestions (id, document_id, tab_id, element_id, text, day) VALUES (?, 'd1', 't1', 'b', 'x', '2026-11-07')",
    );
    for (let i = 0; i < SUGGESTIONS_MAX; i += 1) insert.run(`s${i}`);
    const res = await drop('One more');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'box_full' });
  });

  it('lets only one of two racing drops take the last place', async () => {
    const insert = sql.sql.prepare(
      "INSERT INTO suggestions (id, document_id, tab_id, element_id, text, day) VALUES (?, 'd1', 't1', 'b', 'x', '2026-11-07')",
    );
    for (let i = 0; i < SUGGESTIONS_MAX - 1; i += 1) insert.run(`s${i}`);
    const [a, b] = await Promise.all([
      drop('Left', { owner: VISITOR, code: 'TAKE' }),
      drop('Right', { owner: VISITOR, code: 'TAKE' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const { n } = sql.sql
      .prepare("SELECT COUNT(*) AS n FROM suggestions WHERE element_id = 'b'")
      .get() as { n: number };
    expect(n).toBe(SUGGESTIONS_MAX);
  });
});

describe('reading and removing', () => {
  it('shows an Editor the notes newest first, as text and day only', async () => {
    await drop('First', { owner: VISITOR, code: 'TAKE' });
    await drop('Second', { owner: VISITOR, code: 'TAKE' });
    const res = await list({ owner: VISITOR, code: 'EDIT' });
    expect(res.status).toBe(200);
    const { suggestions } = (await res.json()) as SuggestionsResponse;
    expect(suggestions.map((s) => s.text)).toEqual(['Second', 'First']);
    expect(Object.keys(suggestions[0]!).sort()).toEqual(['day', 'id', 'text']);
  });

  it('never shows a Participant or a Viewer the notes, their own included', async () => {
    await drop('Mine', { owner: VISITOR, code: 'TAKE' });
    expect((await list({ owner: VISITOR, code: 'TAKE' })).status).toBe(403);
    expect((await list({ owner: VISITOR, code: 'LOOK' })).status).toBe(403);
  });

  it('asks which box', async () => {
    expect((await call({ method: 'GET', path: '/tabs/t1/suggestions' })).status).toBe(400);
  });

  it('lets an Editor remove one, and only an Editor', async () => {
    await drop('Remove me');
    const { suggestions } = (await (await list()).json()) as SuggestionsResponse;
    const path = `/tabs/t1/suggestions/${suggestions[0]!.id}`;
    expect((await call({ method: 'DELETE', path, owner: VISITOR, code: 'TAKE' })).status).toBe(403);
    expect((await call({ method: 'DELETE', path })).status).toBe(204);
    expect((await call({ method: 'DELETE', path })).status).toBe(404);
    const after: SuggestionsResponse = await (await list()).json();
    expect(after.suggestions).toEqual([]);
  });

  it('answers other methods as not allowed', async () => {
    expect((await call({ method: 'PUT', path: '/tabs/t1/suggestions' })).status).toBe(405);
    expect((await call({ method: 'GET', path: '/tabs/t1/suggestions/x' })).status).toBe(405);
  });

  it("removes a tab's notes with the tab", async () => {
    await drop('Gone with the tab');
    await db.deleteTabRow(sql.env, 'd1', 't1');
    const rows = sql.sql.prepare('SELECT * FROM suggestions').all();
    expect(rows).toEqual([]);
  });
});

describe('utcDay', () => {
  it('is the UTC date whatever the clock', () => {
    expect(utcDay(Date.UTC(2026, 10, 7, 23, 59))).toBe('2026-11-07');
    expect(utcDay(Date.UTC(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
