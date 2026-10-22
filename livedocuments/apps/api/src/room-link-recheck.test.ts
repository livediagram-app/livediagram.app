import { describe, expect, it, vi } from 'vitest';
import { DocumentRoom } from './document-room';
import { rescopeShareLink, deleteShareLink } from './db/share';
import { recheckAdmittedLink, shareLinkChange } from './room-link-recheck';
import { sqliteD1 } from './test-sqlite-d1';

// docs/specs/013-workspace/tab-scoped-share-links.md "Rescoping": a session that joins the room just
// after its link was revoked or rescoped missed the broadcast, so the room reads the link once more
// on joining and tells that session itself. Against real SQLite with every migration applied.

function arrange() {
  const db = sqliteD1();
  db.sql.exec(`
    INSERT INTO documents (id, owner_id, name, saved_at, created_at, shareable)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Roadmap', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Pricing', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO share_links (code, document_id, role, created_at, tab_id)
      VALUES ('SCOPED2345', 'd1', 'view', 1, 't2');
  `);
  return db;
}

const admitted = { shareCode: 'SCOPED2345', tabScope: 't2', documentId: 'd1' };

describe('shareLinkChange', () => {
  it('is nothing while the link opens what the session holds', () => {
    expect(shareLinkChange(admitted, { tabId: 't2' })).toBeNull();
    expect(shareLinkChange({ ...admitted, tabScope: null }, { tabId: null })).toBeNull();
  });

  it('is a rescope when the link opens another scope, either way', () => {
    expect(shareLinkChange(admitted, { tabId: null })).toBe('share-rescoped');
    expect(shareLinkChange(admitted, { tabId: 't1' })).toBe('share-rescoped');
    expect(shareLinkChange({ ...admitted, tabScope: null }, { tabId: 't1' })).toBe(
      'share-rescoped',
    );
  });

  it('is a revoke when the link is gone', () => {
    expect(shareLinkChange(admitted, null)).toBe('share-revoked');
  });
});

describe('recheckAdmittedLink', () => {
  it('finds nothing on an unchanged link', async () => {
    const { env } = arrange();
    expect(await recheckAdmittedLink(env, admitted)).toBeNull();
  });

  it('finds the widening that landed while the session joined', async () => {
    const { env } = arrange();
    await rescopeShareLink(env, 'SCOPED2345', null);
    expect(await recheckAdmittedLink(env, admitted)).toEqual({
      kind: 'share-rescoped',
      code: 'SCOPED2345',
    });
  });

  it('finds a revoke, and a link that names another document as none', async () => {
    const { env } = arrange();
    expect(await recheckAdmittedLink(env, { ...admitted, documentId: 'd2' })).toEqual({
      kind: 'share-revoked',
      code: 'SCOPED2345',
    });
    await deleteShareLink(env, 'SCOPED2345');
    expect(await recheckAdmittedLink(env, admitted)).toEqual({
      kind: 'share-revoked',
      code: 'SCOPED2345',
    });
  });

  it('counts a link whose tab was deleted as revoked', async () => {
    const db = arrange();
    db.sql.exec(`DELETE FROM document_tabs WHERE tab_id = 't2'`);
    expect((await recheckAdmittedLink(db.env, admitted))?.kind).toBe('share-revoked');
  });
});

// The room's side: the accepted socket is told and closed exactly as a broadcast would have.
type Socket = {
  sent: string[];
  closed?: [number, string];
  attachment: unknown;
  send: (data: string) => void;
  close: (code: number, reason: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
};

function socket(): Socket {
  const s: Socket = {
    sent: [],
    attachment: null,
    send: (data) => void s.sent.push(data),
    close: (code, reason) => {
      s.closed = [code, reason];
    },
    serializeAttachment: (value) => {
      s.attachment = value;
    },
    deserializeAttachment: () => s.attachment,
  };
  return s;
}

function room(env: ReturnType<typeof arrange>['env'] | undefined) {
  const sockets: WebSocket[] = [];
  const state = {
    acceptWebSocket: (ws: WebSocket) => void sockets.push(ws),
    getWebSockets: () => [...sockets],
    storage: {
      get: async () => undefined,
      put: async () => {},
      delete: async () => false,
      list: async () => new Map(),
      setAlarm: async () => {},
      deleteAlarm: async () => {},
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  return new DocumentRoom(state as unknown as DurableObjectState, env);
}

const join = (r: DocumentRoom, ws: Socket, tabScope: string | null, code: string | null) =>
  r.acceptSession(
    ws as unknown as WebSocket,
    'view',
    tabScope,
    code,
    false,
    null,
    null,
    null,
    'd1',
  );

describe('DocumentRoom.recheckJoinedLink', () => {
  it('tells a session that joined on a since-widened link, then closes it', async () => {
    const { env } = arrange();
    const r = room(env);
    const visitor = socket();
    join(r, visitor, 't2', 'SCOPED2345');
    await rescopeShareLink(env, 'SCOPED2345', null);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await r.recheckJoinedLink(visitor as unknown as WebSocket);
    expect(visitor.sent.map((f) => JSON.parse(f) as unknown)).toEqual([
      { kind: 'op', from: 'system', op: { kind: 'share-rescoped', code: 'SCOPED2345' } },
    ]);
    expect(visitor.closed).toEqual([4003, 'share-rescoped']);
    expect(info).toHaveBeenCalledWith('[room-link] joined on a changed link', {
      kind: 'share-rescoped',
    });
    info.mockRestore();
  });

  it('leaves a session on an unchanged link, and one with no code, alone', async () => {
    const { env } = arrange();
    const r = room(env);
    const visitor = socket();
    const owner = socket();
    join(r, visitor, 't2', 'SCOPED2345');
    join(r, owner, null, null);
    await r.recheckJoinedLink(visitor as unknown as WebSocket);
    await r.recheckJoinedLink(owner as unknown as WebSocket);
    expect(visitor.sent).toEqual([]);
    expect(visitor.closed).toBeUndefined();
    expect(owner.closed).toBeUndefined();
  });

  it('keeps the session when the read fails, and says so', async () => {
    const { env } = arrange();
    const broken = {
      ...env,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('D1 down');
            },
          }),
        }),
      },
    } as unknown as typeof env;
    const r = room(broken);
    const visitor = socket();
    join(r, visitor, 't2', 'SCOPED2345');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await r.recheckJoinedLink(visitor as unknown as WebSocket);
    expect(visitor.closed).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[room-link] join recheck failed', {
      error: 'Error: D1 down',
    });
    warn.mockRestore();
  });

  it('does nothing in a room built without an env', async () => {
    const r = room(undefined);
    const visitor = socket();
    join(r, visitor, 't2', 'SCOPED2345');
    await r.recheckJoinedLink(visitor as unknown as WebSocket);
    expect(visitor.sent).toEqual([]);
  });
});
