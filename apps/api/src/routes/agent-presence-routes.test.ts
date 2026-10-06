import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as roomClient from '../room-client';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// `PUT` / `DELETE .../tabs/:tabId/presence` (docs/specs/024-agents/agent-presence.md "Presence", blueprint "REST",
// E1 to E6): token callers only, through the participation gate; focus resolved against the tab's refs; the room
// keeps the entry.

let sql: SqliteD1;
let pending: Promise<unknown>[];
let put: ReturnType<typeof vi.spyOn>;
let del: ReturnType<typeof vi.spyOn>;

type Call = {
  method?: string;
  tab?: string;
  body?: unknown;
  token?: { id: string; readOnly?: boolean } | null;
  owner?: string | null;
  raw?: string;
};

function call({
  method = 'PUT',
  tab = 't1',
  body,
  token = { id: 'tok_1' },
  owner = 'owner',
  raw,
}: Call = {}) {
  return handleDocuments(
    makeTestRouteContext(method, `/api/documents/d1/tabs/${tab}/presence`, {
      env: sql.env,
      owner,
      token,
      ...(raw !== undefined ? { rawBody: raw } : body === undefined ? {} : { body }),
      waitUntil: (p) => void pending.push(p),
    }),
  );
}

beforeEach(() => {
  sql = sqliteD1();
  pending = [];
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'owner', 'Shop', 0, 1, 1);
    INSERT INTO participants (id, name, color, created_at) VALUES ('owner', 'Webber', '#3b82f6', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[{"id":"web-app","type":"shape","shape":"square","x":0,"y":0,"width":100,"height":60,"label":"Web app"},{"id":"web-api","type":"shape","shape":"square","x":200,"y":0,"width":100,"height":60,"label":"Web API"}]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
  put = vi
    .spyOn(roomClient, 'putAgentPresence')
    .mockResolvedValue({ ok: true, expiresAt: 31_000, created: true });
  del = vi.spyOn(roomClient, 'deleteAgentPresence').mockResolvedValue(true);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('PUT presence', () => {
  it('sets the owner’s presence with status, resolved focus and ttl, at the token’s level', async () => {
    const res = await call({
      body: { status: ' adding payment ', focus: ['web-app', 'web-app'], ttl: 60_000 },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      presence: { tabId: 't1', status: 'adding payment', focus: ['web-app'], expiresAt: 31_000 },
    });
    expect(put).toHaveBeenCalledWith(
      sql.env,
      expect.objectContaining({
        documentId: 'd1',
        tokenId: 'tok_1',
        tabId: 't1',
        name: 'Webber',
        color: '#3b82f6',
        role: 'edit',
        status: 'adding payment',
        focus: ['web-app'],
        ttlMs: 60_000,
        mode: 'set',
        personTag: expect.any(String),
      }),
    );
    expect(pending.length).toBe(1);
  });

  it('shows a read-only token as a viewer and counts no repeat set', async () => {
    put.mockResolvedValue({ ok: true, expiresAt: 31_000, created: false });
    await call({ body: {}, token: { id: 'tok_ro', readOnly: true } });
    expect(put).toHaveBeenCalledWith(
      sql.env,
      expect.objectContaining({ role: 'view', status: null, focus: [] }),
    );
    expect(pending).toEqual([]);
  });

  it('refuses a session, a stranger, a missing tab, and a malformed body', async () => {
    expect(await (await call({ body: {}, token: null })).json()).toEqual({
      error: 'presence_requires_token',
    });
    expect((await call({ body: {}, owner: 'stranger' })).status).toBe(403);
    expect((await call({ body: {}, tab: 't9' })).status).toBe(404);
    expect(await (await call({ raw: '{' })).json()).toEqual({ error: 'invalid_json' });
    expect(await (await call({ body: { ttl: 5 } })).json()).toEqual({ error: 'ttl_out_of_range' });
  });

  it('logs each refusal once, with its code', async () => {
    await call({ body: {}, token: null });
    expect(
      vi
        .mocked(console.warn)
        .mock.calls.filter((c) => c[0] === '[agent-presence] refused')
        .map((c) => c[1]),
    ).toEqual([
      {
        documentId: 'd1',
        tabId: 't1',
        method: 'PUT',
        tokenId: null,
        status: 403,
        code: 'presence_requires_token',
      },
    ]);
  });

  it('refuses focus that matches nothing or several, naming them', async () => {
    expect(await (await call({ body: { focus: ['nope', 'web-app'] } })).json()).toEqual({
      error: 'focus_not_found',
      refs: ['nope'],
    });
    const ambiguous = (await (await call({ body: { focus: ['web'] } })).json()) as {
      error: string;
      candidates: string[];
    };
    expect(ambiguous).toMatchObject({ error: 'focus_ambiguous', ref: 'web' });
    expect(ambiguous.candidates).toHaveLength(2);
  });

  it('answers 409 when the room is full and 503 when it cannot be reached', async () => {
    put.mockResolvedValueOnce({ ok: false, error: 'agent_presence_full' });
    expect(await (await call({ body: {} })).json()).toEqual({ error: 'agent_presence_full' });
    put.mockRejectedValueOnce(new roomClient.RoomUnavailableError('down'));
    expect(await (await call({ body: {} })).json()).toEqual({ error: 'room_unavailable' });
    put.mockRejectedValueOnce(new Error('bug'));
    await expect(call({ body: {} })).rejects.toThrow('bug');
  });
});

describe('DELETE presence', () => {
  it('clears without checking the tab, and answers 503 when the room cannot be reached', async () => {
    expect((await call({ method: 'DELETE', tab: 'gone' })).status).toBe(204);
    expect(del).toHaveBeenCalledWith(sql.env, 'd1', 'tok_1', 'gone');
    del.mockRejectedValueOnce(new roomClient.RoomUnavailableError('down'));
    expect((await call({ method: 'DELETE' })).status).toBe(503);
    del.mockRejectedValueOnce(new Error('bug'));
    await expect(call({ method: 'DELETE' })).rejects.toThrow('bug');
  });

  it('leaves other methods to the rest of the routes', async () => {
    expect((await call({ method: 'GET' })).status).not.toBe(200);
  });
});
