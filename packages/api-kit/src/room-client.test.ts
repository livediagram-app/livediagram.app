import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRoomClient,
  parseRoomCursor,
  roomMutationInit,
  RoomUnavailableError,
} from './room-client';
import { LEDGER_LOCK_ELEMENTS_MAX } from './room-ledger-store';

type Tab = { id: string; merged?: number };
type Ledger = { elements?: Record<string, unknown> };
type Env = { fetch: (url: string, init?: RequestInit) => Promise<Response> };

const client = createRoomClient<Env, 'designId', Tab, Ledger>({
  roomStub: (env) => ({ fetch: env.fetch }) as unknown as DurableObjectStub,
  idKey: 'designId',
  metaKind: 'design-meta',
  relayTimeoutMs: 50,
  selectionsTimeoutMs: 50,
  activityTtlMs: 9_000,
  mergeLedgerIntoTab: (tab, _ledger, seq) => ({ ...tab, merged: seq }),
  ledgerCommentAuthors: () => new Map([['c1', { authorName: 'A', authorColor: '#000' }]]),
});

const answering = (res: Response | (() => Promise<Response>)) => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
    typeof res === 'function' ? res() : res.clone(),
  );
  return { env: { fetch }, fetch };
};
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const down = () => Promise.reject(new Error('down'));
const presence = {
  designId: 'd1',
  tokenId: 'tok',
  tabId: 't1',
  personTag: null,
  shareCode: null,
  name: 'Agent',
  color: '#fff',
  role: 'edit' as const,
};

let warn: { mockRestore: () => void } | undefined;
const warnSpy = () => (warn = vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  warn?.mockRestore();
  vi.useRealTimers();
});

describe('parseRoomCursor', () => {
  it('reads `<epoch>:<seq>` and refuses anything else', () => {
    expect(parseRoomCursor('e:1:5')).toEqual({ epoch: 'e:1', seq: 5 });
    expect(parseRoomCursor(null)).toBeNull();
    expect(parseRoomCursor(':5')).toBeNull();
    expect(parseRoomCursor('e:-1')).toBeNull();
    expect(parseRoomCursor(`${'x'.repeat(101)}:1`)).toBeNull();
  });
});

describe('roomMutationInit', () => {
  it('asks for ordering only when told to', () => {
    expect(roomMutationInit({ kind: 'a' }).body).toBe('{"op":{"kind":"a"}}');
    expect(roomMutationInit({ kind: 'a' }, true).body).toBe('{"op":{"kind":"a"},"ordered":true}');
  });
});

describe('roomFetch', () => {
  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const { env } = answering(() => new Promise<Response>(() => {}));
    const call = client.roomFetch(env, 'd1', '/x', undefined, 10);
    const settled = expect(call).rejects.toThrow('room timeout after 10 ms');
    await vi.advanceTimersByTimeAsync(10);
    await settled;
  });
});

describe('the ledger merge', () => {
  it('merges only with a cursor and a ledger the room answered', async () => {
    const { env, fetch } = answering(ok({ elements: {} }));
    const fetched = await client.fetchRoomLedger(env, 'd1', 't 1', 'e:3');
    expect(fetch.mock.calls[0]![0]).toBe('https://room/ledger?tab=t%201&epoch=e&since=3');
    const merged = client.applyRoomLedger({ id: 't 1' }, fetched);
    expect(merged.tab).toEqual({ id: 't 1', merged: 3 });
    expect(merged.commentAuthors.get('c1')?.authorName).toBe('A');
    expect(client.applyRoomLedger({ id: 'x' }, null).commentAuthors.size).toBe(0);
  });

  it('answers null for no cursor, a refusal, a bad body or a throw', async () => {
    expect(await client.fetchRoomLedger(answering(ok()).env, 'd1', 't', null)).toBeNull();
    const refused = answering(new Response('', { status: 500 })).env;
    expect(await client.fetchRoomLedger(refused, 'd1', 't', 'e:1')).toBeNull();
    expect(await client.fetchRoomLedger(answering(ok(null)).env, 'd1', 't', 'e:1')).toBeNull();
    expect(await client.fetchRoomLedger(answering(ok({})).env, 'd1', 't', 'e:1')).toBeNull();
    expect(await client.fetchRoomLedger(answering(down).env, 'd1', 't', 'e:1')).toBeNull();
  });
});

describe('the lock read', () => {
  it('posts the element ids and the vote, and answers the ledger', async () => {
    const { env, fetch } = answering(ok({ elements: { a: 1 } }));
    expect(
      await client.fetchLedgerEntries(env, 'd1', 't1', { elementIds: ['a'], vote: true }),
    ).toEqual({ elements: { a: 1 } });
    expect(fetch.mock.calls[0]![0]).toBe('https://room/ledger-entries');
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      tab: 't1',
      elements: ['a'],
      vote: true,
    });
  });

  it('asks for the vote alone, and for many elements in chunks it merges', async () => {
    const one = answering(ok({ elements: {}, vote: 'v' }));
    expect(
      await client.fetchLedgerEntries(one.env, 'd1', 't1', { elementIds: [], vote: true }),
    ).toEqual({ elements: {}, vote: 'v' });
    let n = 0;
    const many = answering(async () => {
      n += 1;
      return ok({ elements: { [`e${n}`]: n } });
    });
    const ids = Array.from({ length: LEDGER_LOCK_ELEMENTS_MAX + 1 }, (_, i) => `x${i}`);
    const merged = await client.fetchLedgerEntries(many.env, 'd1', 't1', {
      elementIds: ids,
      vote: true,
    });
    expect(many.fetch).toHaveBeenCalledTimes(2);
    expect(merged?.elements).toEqual({ e1: 1, e2: 2 });
    const second = JSON.parse(many.fetch.mock.calls[1]![1]!.body as string) as {
      elements: string[];
      vote: boolean;
    };
    expect(second).toEqual({ tab: 't1', elements: [`x${LEDGER_LOCK_ELEMENTS_MAX}`], vote: false });
  });

  it('answers null for a refusal, a bad body, a throw, or a later chunk that fails', async () => {
    const want = { elementIds: ['a'], vote: false };
    const refused = answering(new Response('', { status: 500 })).env;
    expect(await client.fetchLedgerEntries(refused, 'd1', 't', want)).toBeNull();
    expect(await client.fetchLedgerEntries(answering(ok(null)).env, 'd1', 't', want)).toBeNull();
    expect(await client.fetchLedgerEntries(answering(ok({})).env, 'd1', 't', want)).toBeNull();
    expect(await client.fetchLedgerEntries(answering(down).env, 'd1', 't', want)).toBeNull();
    let calls = 0;
    const halfway = answering(() =>
      calls++ === 0 ? Promise.resolve(ok({ elements: {} })) : down(),
    );
    const ids = Array.from({ length: LEDGER_LOCK_ELEMENTS_MAX + 1 }, (_, i) => `x${i}`);
    expect(
      await client.fetchLedgerEntries(halfway.env, 'd1', 't', { elementIds: ids, vote: false }),
    ).toBeNull();
  });
});

describe('relays', () => {
  it('answers true when the room took the op', async () => {
    const { env, fetch } = answering(ok());
    expect(await client.relayElementDelta(env, 'd1', 't1', 'e1', { kind: 'comment' })).toBe(true);
    expect(await client.relayChangeset(env, 'd1', { tabId: 't1', id: 'cs' })).toBe(true);
    expect(await client.relayTabRename(env, 'd1', 't1', 'N')).toBe(true);
    expect(
      await client.relayItemRename(env, 'd1', 'Name', [
        { id: 'a', name: 'A', orderIndex: 0, folder: 'F' },
        { id: 'b', name: 'B', orderIndex: 1 },
      ]),
    ).toBe(true);
    const renameBody = JSON.parse(fetch.mock.calls[3]![1]!.body as string) as { op: unknown };
    expect(renameBody.op).toEqual({
      kind: 'design-meta',
      name: 'Name',
      tabs: [
        { id: 'a', name: 'A', orderIndex: 0, folder: 'F' },
        { id: 'b', name: 'B', orderIndex: 1 },
      ],
    });
  });

  it('logs a refusal or a throw under the product id key and answers false', async () => {
    warnSpy();
    const refused = answering(new Response('', { status: 503 })).env;
    expect(await client.relayElementDelta(refused, 'd1', 't1', 'e1', { kind: 'comment' })).toBe(
      false,
    );
    expect(warn).toHaveBeenLastCalledWith('[room-mutation] el-delta did not reach the room', {
      designId: 'd1',
      tabId: 't1',
      delta: 'comment',
      error: 'status 503',
    });
    const thrown = answering(down).env;
    expect(await client.relayChangeset(thrown, 'd1', { tabId: 't1', id: 'cs' })).toBe(false);
    expect(warn).toHaveBeenLastCalledWith('[changeset] relay-failed', {
      designId: 'd1',
      tabId: 't1',
      changesetId: 'cs',
      error: 'Error: down',
    });
    expect(await client.relayItemRename(thrown, 'd1', 'N', [])).toBe(false);
    expect(warn).toHaveBeenLastCalledWith('[room-mutation] design-meta did not reach the room', {
      designId: 'd1',
      error: 'Error: down',
    });
    expect(await client.relayTabRename(refused, 'd1', 't1', 'N')).toBe(false);
    expect(warn).toHaveBeenLastCalledWith('[room-mutation] tab-meta did not reach the room', {
      designId: 'd1',
      error: 'status 503',
    });
  });

  it('counts the ops that reached the room', async () => {
    warnSpy();
    let n = 0;
    const { env } = answering(async () => {
      n += 1;
      return n === 2 ? new Response('', { status: 500 }) : ok();
    });
    expect(
      await client.relayRoomOps(env, 'd1', [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }], '[t]'),
    ).toBe(2);
    expect(warn).toHaveBeenCalledWith('[t] relay-missed', {
      designId: 'd1',
      op: 'b',
      error: 'status 500',
    });
  });

  it('broadcasts best-effort, ordered when asked', async () => {
    warnSpy();
    const { env, fetch } = answering(ok());
    await client.broadcastShareOp(env, 'd1', { kind: 'share-revoked', code: 'c' });
    await client.broadcastOp(env, 'd1', { kind: 'items' }, 'items', true);
    expect(fetch.mock.calls[0]![0]).toBe('https://room/broadcast');
    expect(fetch.mock.calls[1]![1]!.body).toBe('{"op":{"kind":"items"},"ordered":true}');
    await client.broadcastOp(answering(down).env, 'd1', {}, 'items');
    expect(warn).toHaveBeenCalledWith(
      '[room-broadcast] items did not reach the room',
      'd1',
      expect.any(Error),
    );
  });
});

describe('readRoomSelections', () => {
  it('answers the selections, or null with a warning', async () => {
    warnSpy();
    const sel = [{ elementIds: ['a'], name: 'N', color: '#000', mine: false }];
    const { env, fetch } = answering(ok({ selections: sel }));
    expect(await client.readRoomSelections(env, 'd1', 't1', null)).toEqual(sel);
    expect(fetch.mock.calls[0]![0]).toBe('https://room/selections?tab=t1&person=');
    expect(
      await client.readRoomSelections(answering(ok({})).env, 'd1', 't1', 'p', 'views'),
    ).toBeNull();
    expect(warn).toHaveBeenLastCalledWith('[views] selections-unreachable', {
      designId: 'd1',
      tabId: 't1',
      error: 'Error: no selections',
    });
    const refused = answering(new Response('', { status: 500 })).env;
    expect(await client.readRoomSelections(refused, 'd1', 't1', 'p')).toBeNull();
    expect(warn).toHaveBeenLastCalledWith('[changeset] selections-unreachable', {
      designId: 'd1',
      tabId: 't1',
      error: 'Error: status 500',
    });
  });
});

describe('agent presence', () => {
  const write = { ...presence, status: null, focus: [], ttlMs: 1, mode: 'set' as const };

  it('puts presence without the id key in the body', async () => {
    const { env, fetch } = answering(ok({ expiresAt: 5, created: true }));
    expect(await client.putAgentPresence(env, write)).toEqual({
      ok: true,
      expiresAt: 5,
      created: true,
    });
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string) as { tokenId: string };
    expect(body).not.toHaveProperty('designId');
    expect(body.tokenId).toBe('tok');
  });

  it('answers full on 409 and throws RoomUnavailableError otherwise', async () => {
    const full = answering(new Response('', { status: 409 })).env;
    expect(await client.putAgentPresence(full, write)).toEqual({
      ok: false,
      error: 'agent_presence_full',
    });
    const refused = answering(new Response('', { status: 500 })).env;
    await expect(client.putAgentPresence(refused, write)).rejects.toThrow(RoomUnavailableError);
    await expect(client.putAgentPresence(answering(down).env, write)).rejects.toThrow(
      'room unavailable: Error: down',
    );
  });

  it('deletes presence, or throws when the room cannot answer', async () => {
    const { env, fetch } = answering(ok({ cleared: true }));
    expect(await client.deleteAgentPresence(env, 'd1', 'tok', 't1')).toBe(true);
    expect(fetch.mock.calls[0]![0]).toBe('https://room/presence?token=tok&tab=t1');
    const refused = answering(new Response('', { status: 500 })).env;
    await expect(client.deleteAgentPresence(refused, 'd1', 'tok', 't1')).rejects.toThrow(
      RoomUnavailableError,
    );
    await expect(
      client.deleteAgentPresence(answering(down).env, 'd1', 'tok', 't1'),
    ).rejects.toThrow(RoomUnavailableError);
  });

  it('refreshes for the activity window and logs a refusal or failure', async () => {
    warnSpy();
    const { env, fetch } = answering(ok({ expiresAt: 1, created: false }));
    await client.refreshAgentPresence(env, presence);
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ mode: 'refresh', ttlMs: 9_000, status: null, focus: [] });
    expect(warn).not.toHaveBeenCalled();
    await client.refreshAgentPresence(answering(new Response('', { status: 409 })).env, presence);
    expect(warn).toHaveBeenLastCalledWith('[agent-presence] refresh refused', {
      designId: 'd1',
      tabId: 't1',
      error: 'agent_presence_full',
    });
    await client.refreshAgentPresence(answering(down).env, presence);
    expect(warn).toHaveBeenLastCalledWith('[agent-presence] refresh failed', {
      designId: 'd1',
      tabId: 't1',
      error: 'RoomUnavailableError: room unavailable: Error: down',
    });
  });
});
