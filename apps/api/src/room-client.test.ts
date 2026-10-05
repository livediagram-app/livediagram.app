import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab, TabLedger } from '@livediagram/document';
import type { Env } from './types';
import {
  broadcastShareOp,
  relayElementDelta,
  deleteAgentPresence,
  putAgentPresence,
  refreshAgentPresence,
  RoomUnavailableError,
  mergeRoomLedger,
  parseRoomCursor,
  readRoomSelections,
  relayChangeset,
  relayTabRename,
} from './room-client';

const card: ShapeElement = {
  id: 'card',
  type: 'shape',
  shape: 'done-check',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};
const tab: Tab = { id: 't1', name: 'T', elements: [card] };

// The room's answer: b cast at seq 5.
const ledger: TabLedger = {
  elements: { card: { responses: { b: { value: 'done', at: 1, seq: 5 } } } },
};

function envWith(fetch: (url: string, init?: RequestInit) => Promise<Response>) {
  const stubFetch = vi.fn(fetch);
  const env = {
    DOCUMENT_ROOM: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: stubFetch }),
    },
  } as unknown as Env;
  return { env, stubFetch };
}

describe('mergeRoomLedger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  it("merges the room's answers the saver hadn't seen", async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    const { tab: merged } = await mergeRoomLedger(env, 'd1', tab, 'ep:4');
    expect((merged.elements[0] as ShapeElement).responses?.map((r) => r.participantId)).toEqual([
      'b',
    ]);
    expect(stubFetch.mock.calls[0]![0]).toBe('https://room/ledger?tab=t1&epoch=ep');
  });

  it('leaves a save with no cursor alone', async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    expect((await mergeRoomLedger(env, 'd1', tab, null)).tab).toBe(tab);
    expect(stubFetch).not.toHaveBeenCalled();
  });

  it('asks the room of a personal document too: every server-stored document has one', async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    await mergeRoomLedger(env, 'personal', tab, 'ep:4');
    expect(stubFetch).toHaveBeenCalledOnce();
  });

  it('saves unmerged when the room cannot answer', async () => {
    const { env } = envWith(async () => {
      throw new Error('room down');
    });
    expect((await mergeRoomLedger(env, 'd1', tab, 'ep:4')).tab).toBe(tab);
  });
});

describe('parseRoomCursor', () => {
  it('reads epoch:seq, including an epoch with its own colons', () => {
    expect(parseRoomCursor('a:b:12')).toEqual({ epoch: 'a:b', seq: 12 });
  });

  it('rejects anything else', () => {
    expect(parseRoomCursor('nope')).toBeNull();
    expect(parseRoomCursor('ep:-1')).toBeNull();
    expect(parseRoomCursor('ep:1.5')).toBeNull();
    expect(parseRoomCursor(':3')).toBeNull();
  });
});

// The worker telling a room a share link changed (docs/specs/013-workspace/tab-scoped-share-links.md): the
// op reaches the room's broadcast endpoint, and a room that can't be reached
// is logged, never thrown, because the D1 write it follows is the real change.
describe('broadcastShareOp', () => {
  it("posts the op to the document's room", async () => {
    const { env, stubFetch } = envWith(async () => new Response(null, { status: 204 }));
    await broadcastShareOp(env, 'd1', { kind: 'share-rescoped', code: 'ABCD2345' });
    const [url, init] = stubFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://room/broadcast');
    expect(JSON.parse(init.body as string)).toEqual({
      op: { kind: 'share-rescoped', code: 'ABCD2345' },
    });
  });

  it('logs and carries on when the room cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = envWith(async () => {
      throw new Error('room down');
    });
    await expect(
      broadcastShareOp(env, 'd1', { kind: 'share-revoked', code: 'ABCD2345' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[room-broadcast] share-revoked did not reach the room',
      'd1',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});

// The changeset relay and the held check's read (docs/specs/024-agents/agent-changesets.md "What
// the room does").
describe('relayChangeset', () => {
  const op = {
    kind: 'changeset' as const,
    tabId: 't1',
    id: 'cs_0000000001',
    rev: 2,
    prevRev: null,
    author: { name: 'Webber', color: '#0ea5e9' },
    counts: { added: 1, changed: 0, removed: 0 },
  };

  it("posts one changeset op to the document's room", async () => {
    const { env, stubFetch } = envWith(async () => new Response(null, { status: 204 }));
    expect(await relayChangeset(env, 'personal', op)).toBe(true);
    const [url, init] = stubFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://room/mutation');
    expect(JSON.parse(init.body as string)).toEqual({ op });
  });

  it('logs and answers false when the room refuses or cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const refused = envWith(async () => new Response('bad op', { status: 400 }));
    expect(await relayChangeset(refused.env, 'd1', op)).toBe(false);
    const down = envWith(async () => {
      throw new Error('room down');
    });
    expect(await relayChangeset(down.env, 'd1', op)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[changeset] relay-failed',
      expect.objectContaining({ documentId: 'd1', tabId: 't1', changesetId: 'cs_0000000001' }),
    );
    warn.mockRestore();
  });
});

describe('relayTabRename', () => {
  it("posts the tab-meta op an editor's own rename sends", async () => {
    const { env, stubFetch } = envWith(async () => new Response(null, { status: 204 }));
    await relayTabRename(env, 'd1', 't1', 'Renamed');
    const [url, init] = stubFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://room/mutation');
    expect(JSON.parse(init.body as string)).toEqual({
      op: { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } },
    });
  });
});

describe('readRoomSelections', () => {
  it("asks for the tab's selections with the person tag", async () => {
    const selections = [{ elementIds: ['a'], name: 'Bea', color: '#f00', mine: false }];
    const { env, stubFetch } = envWith(async () => Response.json({ selections }));
    expect(await readRoomSelections(env, 'd1', 't1', 'tag1')).toEqual(selections);
    expect(stubFetch.mock.calls[0]![0]).toBe('https://room/selections?tab=t1&person=tag1');
  });

  it('answers null and logs when the room cannot answer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = envWith(async () => new Response('no', { status: 500 }));
    expect(await readRoomSelections(env, 'd1', 't1', null)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[changeset] selections-unreachable',
      expect.objectContaining({ documentId: 'd1', tabId: 't1' }),
    );
    warn.mockRestore();
  });
});

describe('agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room")', () => {
  const write = {
    documentId: 'd1',
    tokenId: 'tok_1',
    tabId: 't1',
    personTag: 'p',
    shareCode: null,
    name: 'Webber',
    color: '#000',
    role: 'edit' as const,
    status: null,
    focus: [],
    ttlMs: 30_000,
    mode: 'set' as const,
  };

  it('puts an entry, reads a full room, and throws when the room is unreachable', async () => {
    const answers = [
      Response.json({ expiresAt: 5, created: true }),
      Response.json({ error: 'agent_presence_full' }, { status: 409 }),
      new Response('x', { status: 500 }),
    ];
    const { env, stubFetch } = envWith(async () => answers.shift()!);
    expect(await putAgentPresence(env, write)).toEqual({ ok: true, expiresAt: 5, created: true });
    expect(JSON.parse(stubFetch.mock.calls[0]![1]!.body as string)).not.toHaveProperty(
      'documentId',
    );
    expect(await putAgentPresence(env, write)).toEqual({ ok: false, error: 'agent_presence_full' });
    await expect(putAgentPresence(env, write)).rejects.toBeInstanceOf(RoomUnavailableError);
    const down = envWith(async () => {
      throw new Error('gone');
    });
    await expect(putAgentPresence(down.env, write)).rejects.toThrow('room unavailable');
  });

  it('clears an entry by token and tab, throwing when the room cannot answer', async () => {
    const { env, stubFetch } = envWith(async () => Response.json({ cleared: true }));
    expect(await deleteAgentPresence(env, 'd1', 'tok 1', 't1')).toBe(true);
    expect(stubFetch.mock.calls[0]![0]).toBe('https://room/presence?token=tok%201&tab=t1');
    await expect(
      deleteAgentPresence(
        envWith(async () => new Response('', { status: 500 })).env,
        'd1',
        't',
        't',
      ),
    ).rejects.toBeInstanceOf(RoomUnavailableError);
    await expect(
      deleteAgentPresence(
        envWith(async () => {
          throw new Error('x');
        }).env,
        'd1',
        't',
        't',
      ),
    ).rejects.toBeInstanceOf(RoomUnavailableError);
  });

  it('refreshes for a changeset, swallowing a full or unreachable room', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { env, stubFetch } = envWith(async () => Response.json({ expiresAt: 5, created: false }));
    const { mode: _m, status: _s, focus: _f, ttlMs: _t, ...refresh } = write;
    await refreshAgentPresence(env, refresh);
    expect(JSON.parse(stubFetch.mock.calls[0]![1]!.body as string)).toMatchObject({
      mode: 'refresh',
      ttlMs: 30_000,
      status: null,
      focus: [],
    });
    await refreshAgentPresence(
      envWith(async () => Response.json({}, { status: 409 })).env,
      refresh,
    );
    await refreshAgentPresence(envWith(async () => new Response('', { status: 500 })).env, refresh);
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      '[agent-presence] refresh refused',
      '[agent-presence] refresh failed',
    ]);
    warn.mockRestore();
  });
});

describe('relayElementDelta (agent-presence PR26)', () => {
  it('relays the delta, and logs a room that refused it or could not be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const delta = { kind: 'comment-resolve', resolved: true } as const;
    const ok = envWith(async () => new Response(null, { status: 204 }));
    expect(await relayElementDelta(ok.env, 'd1', 't1', 'a', delta)).toBe(true);
    expect(JSON.parse(ok.stubFetch.mock.calls[0]![1]!.body as string)).toEqual({
      op: { kind: 'el-delta', tabId: 't1', elementId: 'a', delta },
    });
    expect(
      await relayElementDelta(
        envWith(async () => new Response('bad op', { status: 400 })).env,
        'd1',
        't1',
        'a',
        delta,
      ),
    ).toBe(false);
    const down = envWith(async () => {
      throw new Error('gone');
    });
    expect(await relayElementDelta(down.env, 'd1', 't1', 'a', delta)).toBe(false);
    expect(warn.mock.calls).toEqual([
      [
        '[room-mutation] el-delta did not reach the room',
        { documentId: 'd1', tabId: 't1', delta: 'comment-resolve', error: 'status 400' },
      ],
      [
        '[room-mutation] el-delta did not reach the room',
        { documentId: 'd1', tabId: 't1', delta: 'comment-resolve', error: 'Error: gone' },
      ],
    ]);
    warn.mockRestore();
  });
});
