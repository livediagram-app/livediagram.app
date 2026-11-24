import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_CALL_SETTLE_MS } from '@liveworkspace/index-client';
import type { DocumentRoom } from './document-room';

// A call's Space tells the index who is in it (docs/specs/012-collaboration/calls-from-items.md "The room"): once it
// settles, each person once, only when something moved, and never in a Space that is no call.

const callPeople = vi.fn(async (_id: string, _push: unknown) => {});
let client: { callPeople: typeof callPeople } | null = { callPeople };
vi.mock('../index-service', () => ({ indexAppClient: () => client }));

const { markItemCall, noteItemCall, peopleHere, clearItemCallForTests } =
  await import('./room-item-call');

type Session = { presence: { key?: string; name: string } | null; verifiedName?: string };

function fakeRoom(stored: string | null = null) {
  const storage = new Map<string, unknown>(stored ? [['item-call', stored]] : []);
  const sockets: { ws: WebSocket; session: Session }[] = [];
  const room = {
    documentId: 'space1' as string | null,
    roomEnv: { INDEX_ORIGIN: 'https://x', INDEX_KEY: 'k' } as unknown,
    bindDocument: vi.fn(),
    state: {
      storage: {
        get: async (k: string) => storage.get(k),
        put: async (k: string, v: unknown) => void storage.set(k, v),
      },
      getWebSockets: () => sockets.map((s) => s.ws),
    },
    readSession: (ws: WebSocket) => sockets.find((s) => s.ws === ws)?.session ?? null,
  };
  const join = (session: Session, readyState = 1) => {
    const ws = { readyState } as unknown as WebSocket;
    sockets.push({ ws, session });
    return ws;
  };
  const leave = (ws: WebSocket) =>
    sockets.splice(
      sockets.findIndex((s) => s.ws === ws),
      1,
    );
  return { room: room as unknown as DocumentRoom, storage, join, leave };
}

let rooms: DocumentRoom[] = [];
const made = (stored: string | null = null) => {
  const r = fakeRoom(stored);
  rooms.push(r.room);
  return r;
};

beforeEach(() => {
  vi.useFakeTimers();
  callPeople.mockClear();
  client = { callPeople };
});
afterEach(() => {
  for (const r of rooms) clearItemCallForTests(r);
  rooms = [];
  vi.useRealTimers();
});

const settle = async () => {
  await vi.advanceTimersByTimeAsync(ITEM_CALL_SETTLE_MS);
};

describe('peopleHere', () => {
  it('counts each person once, by key, with the name they show, and not a socket leaving', () => {
    const { room, join } = made();
    join({ presence: { key: 'a', name: 'Ada' }, verifiedName: 'Ada L' });
    join({ presence: { key: 'a', name: 'Ada' } });
    const leaving = join({ presence: { key: 'b', name: 'Ben' } });
    join({ presence: { key: 'c', name: 'Cy' } }, 3);
    join({ presence: null });
    join({ presence: { name: 'No key' } });
    expect(peopleHere(room)).toEqual({ people: 2, names: ['Ada L', 'Ben'] });
    expect(peopleHere(room, leaving)).toEqual({ people: 1, names: ['Ada L'] });
  });
});

describe('a call Space', () => {
  it('keeps the id, then tells the index who is here once it settles, and only when it moved', async () => {
    const { room, storage, join, leave } = made();
    const ada = join({ presence: { key: 'a', name: 'Ada' } });
    await markItemCall(room, 'space1', 'ic_1');
    expect(storage.get('item-call')).toBe('ic_1');
    expect(callPeople).not.toHaveBeenCalled();
    await settle();
    expect(callPeople).toHaveBeenCalledWith('space1', { people: 1, names: ['Ada'] });

    // Joins within one settle are one push.
    join({ presence: { key: 'b', name: 'Ben' } });
    noteItemCall(room);
    join({ presence: { key: 'c', name: 'Cy' } });
    noteItemCall(room);
    await settle();
    expect(callPeople).toHaveBeenCalledTimes(2);
    expect(callPeople).toHaveBeenLastCalledWith('space1', {
      people: 3,
      names: ['Ada', 'Ben', 'Cy'],
    });

    // Nothing moved: nobody told.
    noteItemCall(room);
    await settle();
    expect(callPeople).toHaveBeenCalledTimes(2);

    leave(ada);
    noteItemCall(room);
    await settle();
    expect(callPeople).toHaveBeenLastCalledWith('space1', { people: 2, names: ['Ben', 'Cy'] });
  });

  it('reads the id from storage after an eviction', async () => {
    const { room, join } = made('ic_2');
    join({ presence: { key: 'a', name: 'Ada' } });
    noteItemCall(room);
    await settle();
    expect(callPeople).toHaveBeenCalledWith('space1', { people: 1, names: ['Ada'] });
  });

  it('tells again on the next change after a failed push', async () => {
    const { room, join } = made('ic_3');
    join({ presence: { key: 'a', name: 'Ada' } });
    callPeople.mockRejectedValueOnce(new Error('down'));
    noteItemCall(room);
    await settle();
    noteItemCall(room);
    await settle();
    expect(callPeople).toHaveBeenCalledTimes(2);
  });
});

describe('a Space that is no call', () => {
  it('reads storage once and tells nobody', async () => {
    const { room, join } = made();
    join({ presence: { key: 'a', name: 'Ada' } });
    noteItemCall(room);
    await settle();
    noteItemCall(room);
    await settle();
    expect(callPeople).not.toHaveBeenCalled();
  });

  it('tells nobody without an index, or a room not yet bound', async () => {
    client = null;
    const { room, join } = made('ic_4');
    join({ presence: { key: 'a', name: 'Ada' } });
    noteItemCall(room);
    await settle();
    expect(callPeople).not.toHaveBeenCalled();
    client = { callPeople };
    const other = made('ic_5');
    (other.room as unknown as { documentId: string | null }).documentId = null;
    noteItemCall(other.room);
    await settle();
    expect(callPeople).not.toHaveBeenCalled();
  });
});
