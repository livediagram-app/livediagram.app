import { describe, expect, it, vi } from 'vitest';

// The room's reading of the review settings (docs/specs/007-editor/suggestions.md "Suggest Only"): who is on
// Suggest Only, the people seen joining, and each Participant told where it stands.
vi.mock('./document-room-content', () => ({ ensureSchema: () => {} }));

import type { DocumentRoom } from './document-room';
import {
  participantJoined,
  readRoomReview,
  reviewChanged,
  suggestByOf,
} from './document-room-review';

type Session = {
  presence: { id: string; name: string; color: string; role: string; key?: string } | null;
  collabKey?: string;
  shareCode?: string | null;
};

function fakeRoom(stored: string | null, schema = true) {
  let review = stored;
  const writes: string[] = [];
  const sessions = new Map<WebSocket, Session>();
  const sent = new Map<WebSocket, unknown[]>();
  const room = {
    storedSchema: () => schema,
    state: {
      storage: {
        sql: {
          exec: (q: string, ...binds: unknown[]) => {
            if (q.startsWith('UPDATE')) {
              review = String(binds[0]);
              writes.push(review);
            }
            return { toArray: () => [{ review }] };
          },
        },
      },
      getWebSockets: () => [...sessions.keys()],
    },
    readSession: (ws: WebSocket) => sessions.get(ws) ?? null,
    opRates: new Map(),
  } as unknown as DocumentRoom;
  const join = (session: Session) => {
    const log: unknown[] = [];
    const ws = { send: (d: string) => void log.push(JSON.parse(d)) } as unknown as WebSocket;
    sessions.set(ws, session);
    sent.set(ws, log);
    return { ws, log };
  };
  return { room, writes, join, setStored: (v: string) => void (review = v) };
}

const part = (id: string, extra: Partial<Session> = {}): Session => ({
  presence: { id, name: id, color: '#abc', role: 'participate', key: `key-${id}` },
  ...extra,
});

describe('the room’s review settings', () => {
  it('reads none from a room with no schema, and the settings once from one with', () => {
    expect(readRoomReview(fakeRoom(null, false).room).links).toEqual([]);
    const { room, setStored } = fakeRoom(JSON.stringify({ links: ['C1'] }));
    expect(readRoomReview(room).links).toEqual(['C1']);
    setStored(JSON.stringify({ links: ['C2'] }));
    expect(readRoomReview(room).links).toEqual(['C1']);
  });

  it('puts a Participant on Suggest Only by its link or its person, and nobody else', () => {
    const { room } = fakeRoom(JSON.stringify({ links: ['C1'], people: [{ key: 'key-B' }] }));
    expect(suggestByOf(room, part('A', { shareCode: 'C1', collabKey: 'key-A' }) as never)).toBe(
      'key-A',
    );
    expect(suggestByOf(room, part('B') as never)).toBe('key-B');
    expect(suggestByOf(room, part('C', { shareCode: 'C9' }) as never)).toBeNull();
    const editor = {
      presence: { id: 'E', name: 'E', color: '#abc', role: 'edit' },
      shareCode: 'C1',
    };
    expect(suggestByOf(room, editor as never)).toBeNull();
    // A session with no collab key writes nothing any suggestion's author matches.
    const keyless = {
      presence: { id: 'K', name: 'K', color: '#abc', role: 'participate' },
      shareCode: 'C1',
    };
    expect(suggestByOf(room, keyless as never)).toBe('\u0000');
  });

  it('notes a Participant joining once, and tells it whether it suggests', () => {
    const { room, writes, join } = fakeRoom(JSON.stringify({ links: ['C1'] }));
    const a = part('A', { shareCode: 'C1' });
    const { ws, log } = join(a);
    participantJoined(room, ws, a as never, a.presence as never);
    participantJoined(room, ws, a as never, a.presence as never);
    expect(writes).toHaveLength(1);
    expect((JSON.parse(writes[0]!) as { seen: unknown }).seen).toEqual([
      { key: 'key-A', name: 'A', at: expect.any(Number) },
    ]);
    expect(log).toEqual([
      { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly: true } },
      { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly: true } },
    ]);
    const viewer = { presence: { id: 'V', name: 'V', color: '#abc', role: 'view' } };
    const v = join(viewer);
    participantJoined(room, v.ws, viewer as never, viewer.presence as never);
    expect(v.log).toEqual([]);
    const keyless = { presence: { id: 'K', name: 'K', color: '#abc', role: 'participate' } };
    const k = join(keyless);
    participantJoined(room, k.ws, keyless as never, keyless.presence as never);
    expect(writes).toHaveLength(1);
    expect(k.log).toEqual([
      { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly: false } },
    ]);
  });

  it('writes nothing where there is no schema yet', () => {
    const { room, writes, join } = fakeRoom(null, false);
    const a = part('A');
    const { ws } = join(a);
    participantJoined(room, ws, a as never, a.presence as never);
    expect(writes).toEqual([]);
  });

  it('tells every Participant where it stands when an Editor changes the settings', () => {
    const { room, join, setStored } = fakeRoom(null);
    const a = join(part('A', { shareCode: 'C1' }));
    const e = join({ presence: { id: 'E', name: 'E', color: '#abc', role: 'edit' } });
    join({ presence: null });
    expect(readRoomReview(room).links).toEqual([]);
    setStored(JSON.stringify({ links: ['C1'] }));
    reviewChanged(room);
    expect(a.log).toEqual([
      { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly: true } },
    ]);
    expect(e.log).toEqual([]);
  });
});
