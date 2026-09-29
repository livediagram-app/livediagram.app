import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab, TabLedger } from '@livediagram/document';
import type { Env } from './types';
import { broadcastShareOp, mergeRoomLedger, parseRoomCursor } from './room-client';

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

function envWith(fetch: (url: string) => Promise<Response>) {
  const stubFetch = vi.fn(fetch);
  const env = {
    DOCUMENT_ROOM: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: stubFetch }),
    },
  } as unknown as Env;
  return { env, stubFetch };
}

const shared = { id: 'd1', shareable: true, teamId: null };

describe('mergeRoomLedger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  it("merges the room's answers the saver hadn't seen", async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    const { tab: merged } = await mergeRoomLedger(env, shared, tab, 'ep:4');
    expect((merged.elements[0] as ShapeElement).responses?.map((r) => r.participantId)).toEqual([
      'b',
    ]);
    expect(stubFetch.mock.calls[0]![0]).toBe('https://room/ledger?tab=t1&epoch=ep');
  });

  it('leaves the save alone for a document with no room, or a save with no cursor', async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    expect(
      (await mergeRoomLedger(env, { id: 'd1', shareable: false, teamId: null }, tab, 'ep:4')).tab,
    ).toBe(tab);
    expect((await mergeRoomLedger(env, shared, tab, null)).tab).toBe(tab);
    expect(stubFetch).not.toHaveBeenCalled();
  });

  it('asks the room for a team document too', async () => {
    const { env, stubFetch } = envWith(async () => Response.json(ledger));
    await mergeRoomLedger(env, { id: 'd1', shareable: false, teamId: 'team' }, tab, 'ep:4');
    expect(stubFetch).toHaveBeenCalledOnce();
  });

  it('saves unmerged when the room cannot answer', async () => {
    const { env } = envWith(async () => {
      throw new Error('room down');
    });
    expect((await mergeRoomLedger(env, shared, tab, 'ep:4')).tab).toBe(tab);
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
