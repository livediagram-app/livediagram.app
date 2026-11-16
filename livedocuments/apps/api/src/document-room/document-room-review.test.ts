import { describe, expect, it, vi } from 'vitest';

// The room's reading of the review settings (docs/specs/007-editor/suggestions.md "Suggest Only"): who is on
// Suggest Only, the people seen joining, and each Participant told where it stands.
vi.mock('./document-room-content', () => ({ ensureSchema: () => {} }));

import { applyParticipantArticleOps, type Tab } from '@livedocuments/document';
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

  // The share code is the client's to send (`?s=`): a person who opened a Suggest Only link once is held to it on
  // every later session, whatever they open with, until the Editor lifts them or the link (role tests).
  describe('a person pinned to a Suggest Only link', () => {
    const article: Tab = {
      id: 't1',
      name: 'Tab',
      elements: [],
      articles: { f1: { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Hello' }] }] } },
    } as never;
    const directWrite = [
      {
        kind: 'put' as const,
        block: { id: 'b1', type: 'paragraph' as const, runs: [{ text: 'Hello there' }] },
      },
    ];
    const writeAs = (suggestBy: string | null) =>
      applyParticipantArticleOps(article, 'f1', directWrite, suggestBy ? { suggestBy } : {});

    it('opened through the link, then reopened without ?s=: still suggesting, and a direct write refused', () => {
      const { room, writes, join } = fakeRoom(JSON.stringify({ links: ['C1'] }));
      const first = part('A', { shareCode: 'C1', collabKey: 'key-A' });
      const one = join(first);
      participantJoined(room, one.ws, first as never, first.presence as never);
      expect((JSON.parse(writes.at(-1)!) as { pins: unknown }).pins).toEqual([
        { key: 'key-A', code: 'C1', at: expect.any(Number) },
      ]);
      // A later session with no share code: the same verified key.
      const again = part('A2', { shareCode: null, collabKey: 'key-A' });
      const two = join(again);
      participantJoined(room, two.ws, again as never, again.presence as never);
      expect(two.log).toEqual([
        { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly: true } },
      ]);
      const by = suggestByOf(room, again as never);
      expect(by).toBe('key-A');
      expect(writeAs(by)).toEqual({ result: 'refused', reason: 'not-suggestion' });
      // Without the pin the same write would have gone straight in.
      expect(writeAs(null).result).toBe('applied');
    });

    it('holds a guest or signed-in person who comes back through another, ordinary Participant link', () => {
      const { room, writes, join } = fakeRoom(JSON.stringify({ links: ['C1'] }));
      for (const key of ['guest-key', 'user-key']) {
        const first = part(key, { shareCode: 'C1', collabKey: key });
        const s = join(first);
        participantJoined(room, s.ws, first as never, first.presence as never);
        const other = part(`${key}-2`, { shareCode: 'C2', collabKey: key });
        expect(suggestByOf(room, other as never)).toBe(key);
      }
      expect(
        (JSON.parse(writes.at(-1)!) as { pins: { key: string }[] }).pins.map((p) => p.key),
      ).toEqual(['user-key', 'guest-key']);
    });

    it('pins only a server-verified key: a key the client named is not held', () => {
      const { room, writes, join } = fakeRoom(JSON.stringify({ links: ['C1'] }));
      const named = part('B', { shareCode: 'C1' });
      const s = join(named);
      participantJoined(room, s.ws, named as never, named.presence as never);
      expect((JSON.parse(writes.at(-1)!) as { pins: unknown }).pins).toEqual([]);
    });

    it('leaves a person with an Editor grant alone, pinned or not', () => {
      const { room } = fakeRoom(
        JSON.stringify({ links: ['C1'], pins: [{ key: 'key-E', code: 'C1', at: 1 }] }),
      );
      const editor = {
        presence: { id: 'E', name: 'E', color: '#abc', role: 'edit', key: 'key-E' },
        collabKey: 'key-E',
        shareCode: null,
      };
      expect(suggestByOf(room, editor as never)).toBeNull();
    });

    it('lets go once the Editor lifts the link', () => {
      const { room, setStored } = fakeRoom(
        JSON.stringify({ links: ['C1'], pins: [{ key: 'key-A', code: 'C1', at: 1 }] }),
      );
      const again = part('A', { shareCode: null, collabKey: 'key-A' });
      expect(suggestByOf(room, again as never)).toBe('key-A');
      setStored(JSON.stringify({ links: [], pins: [{ key: 'key-A', code: 'C1', at: 1 }] }));
      reviewChanged(room);
      expect(suggestByOf(room, again as never)).toBeNull();
    });
  });
});
