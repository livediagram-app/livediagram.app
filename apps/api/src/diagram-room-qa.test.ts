import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyQaAction, type QaNote } from '@livediagram/diagram';

// The Q&A board's write queue in the room (spec/151), under the failure the
// dot vote once had (spec/39): one person's write carried a snapshot from
// before somebody else's vote and replaced it.
//
// The fake D1 below yields on every read and write, so without the queue each
// request would read the row before any of them wrote: the worst interleaving
// a room voting in the same second can produce. With it, every vote must land,
// each write must take its own rev, and peers must receive the states in rev
// order.

const { store } = vi.hoisted(() => ({
  store: { data: '', reads: 0, inFlight: 0, maxInFlight: 0 },
}));
const tick = () => new Promise((r) => setTimeout(r, 0));
vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  getTabData: async () => {
    store.inFlight++;
    store.maxInFlight = Math.max(store.maxInFlight, store.inFlight);
    store.reads++;
    const snapshot = store.data;
    await tick();
    return snapshot;
  },
  swapTabData: async (_env: unknown, _d: string, _t: string, expected: string, next: string) => {
    await tick();
    store.inFlight--;
    if (store.data !== expected) return false;
    store.data = next;
    return true;
  },
}));

import { DiagramRoom } from './diagram-room';

const board = (notes: QaNote[], rev: number) =>
  JSON.stringify({
    elements: [
      {
        id: 'b1',
        type: 'shape',
        shape: 'qa-board',
        x: 0,
        y: 0,
        width: 360,
        height: 460,
        label: 'Q',
        qaNotes: notes,
        qaRev: rev,
      },
    ],
  });

function newRoom() {
  const sockets: WebSocket[] = [];
  const kv = new Map<string, unknown>();
  const state = {
    acceptWebSocket: (ws: WebSocket) => void sockets.push(ws),
    getWebSockets: () => [...sockets],
    storage: {
      get: (k: string) => Promise.resolve(kv.get(k)),
      put: (k: string, v: unknown) => Promise.resolve(void kv.set(k, v)),
      setAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DiagramRoom(state as unknown as DurableObjectState, {} as never);
  const sent: string[] = [];
  const peer = {
    send: (d: string) => void sent.push(d),
    serializeAttachment: () => {},
    deserializeAttachment: () => ({
      presenceId: 'p',
      verifiedRole: 'view',
      presence: { id: 'p', name: '', color: '' },
    }),
  };
  sockets.push(peer as unknown as WebSocket);
  return { room, sent };
}

const write = (room: DiagramRoom, voterId: string, action: unknown) =>
  room.fetch(
    new Request('https://room/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diagramId: 'd1',
        tabId: 't1',
        elementId: 'b1',
        action,
        actor: { voterId, author: null, now: 5 },
      }),
    }),
  );

beforeEach(() => {
  store.data = board([{ id: 'n1', text: 'a', at: 1, voters: [] }], 0);
  store.reads = 0;
  store.inFlight = 0;
  store.maxInFlight = 0;
});

describe('DiagramRoom Q&A write queue', () => {
  it('loses no vote when a room votes in the same instant', async () => {
    const { room, sent } = newRoom();
    const voters = Array.from({ length: 40 }, (_, i) => `voter-${i}`);
    const results = await Promise.all(
      voters.map((v) => write(room, v, { type: 'vote', noteId: 'n1', on: true })),
    );
    expect(results.map((r) => r.status)).toEqual(voters.map(() => 200));

    const final = JSON.parse(store.data) as { elements: { qaNotes: QaNote[]; qaRev: number }[] };
    expect([...final.elements[0]!.qaNotes[0]!.voters].sort()).toEqual([...voters].sort());
    expect(final.elements[0]!.qaRev).toBe(40);
    // Single file: never two board writes against the row at once, and no
    // lost race to retry (one read per write).
    expect(store.maxInFlight).toBe(1);
    expect(store.reads).toBe(40);

    // Peers got every state, in rev order, each a superset of the last.
    const ops = sent
      .map((m) => JSON.parse(m) as { op: { kind: string; rev: number; notes: QaNote[] } })
      .filter((m) => m.op.kind === 'qa')
      .map((m) => m.op);
    expect(ops.map((o) => o.rev)).toEqual(voters.map((_, i) => i + 1));
    expect(ops.map((o) => o.notes[0]!.voters.length)).toEqual(voters.map((_, i) => i + 1));
  });

  it('keeps adds, votes and withdrawals from many people in any interleaving', async () => {
    const { room } = newRoom();
    const actions: [string, unknown][] = [
      ['a', { type: 'vote', noteId: 'n1', on: true }],
      ['b', { type: 'add', id: 'n2', text: 'b', anonymous: true }],
      ['c', { type: 'vote', noteId: 'n1', on: true }],
      ['a', { type: 'vote', noteId: 'n1', on: false }],
      ['d', { type: 'vote', noteId: 'n1', on: true }],
    ];
    await Promise.all(actions.map(([v, a]) => write(room, v, a)));
    // The queue runs them in arrival order, so the result is exactly the
    // reducer applied in that order: nothing dropped, nothing doubled.
    const expected = actions.reduce(
      (notes, [v, a]) => applyQaAction(notes, a as never, { voterId: v, author: null, now: 5 }),
      [{ id: 'n1', text: 'a', at: 1, voters: [] }] as QaNote[],
    );
    const final = JSON.parse(store.data) as { elements: { qaNotes: QaNote[] }[] };
    expect(final.elements[0]!.qaNotes).toEqual(expected);
    expect(final.elements[0]!.qaNotes[0]!.voters).toEqual(['c', 'd']);
  });

  it('keeps working after a write fails', async () => {
    const { room } = newRoom();
    const bad = await write(room, 'a', { type: 'vote', noteId: 'n1', on: true }).then(() =>
      room.fetch(new Request('https://room/qa', { method: 'POST', body: 'not json' })),
    );
    expect(bad.status).toBe(400);
    const ok = await write(room, 'b', { type: 'vote', noteId: 'n1', on: true });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { rev: number }).rev).toBe(2);
  });
});
