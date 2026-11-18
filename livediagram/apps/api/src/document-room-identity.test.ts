import { describe, expect, it, vi } from 'vitest';
import { DocumentRoom } from './document-room/document-room';
import type { ParticipantPresence } from './types';

// A new presence colour reaches people already in the room, live (liveworkspace/docs/specs/003-accounts/accounts.md
// "Profiles", "A change reaches the room at once"; docs/specs/015-api/api.md "Realtime model"; Work Tracker 1221): two
// sessions through the real room, one changing its colour over its open socket with an `identity` frame.

type Socket = {
  sent: string[];
  attachment: Record<string, unknown> & { presence: ParticipantPresence | null };
};

function room() {
  const sockets: Socket[] = [];
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(true),
      list: () => Promise.resolve(new Map()),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const doc = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (presenceId: string, role: 'edit' | 'view' = 'edit') => {
    const s: Socket = { sent: [], attachment: { presenceId, verifiedRole: role, presence: null } };
    sockets.push(s);
    return s;
  };
  const send = (s: Socket, frame: unknown) => doc.webSocketMessage(wsOf(s), JSON.stringify(frame));
  return { join, send };
}

const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = {
      send: (d: string) => void s.sent.push(d),
      serializeAttachment: (v: Socket['attachment']) => void (s.attachment = v),
      deserializeAttachment: () => s.attachment,
    } as unknown as WebSocket;
    wsCache.set(s, ws);
  }
  return ws;
}

const frames = (s: Socket) => s.sent.map((raw) => JSON.parse(raw) as { kind: string });
const rosters = (s: Socket) =>
  frames(s).filter((f) => f.kind === 'presence') as unknown as {
    participants: ParticipantPresence[];
  }[];
const lastRoster = (s: Socket) => rosters(s).at(-1)?.participants ?? [];

describe('a presence colour changed in the room', () => {
  it('reaches the other client at once, keeping the changer’s tab, with nothing else a join does', () => {
    const { join, send } = room();
    const ann = join('p-ann');
    const bob = join('p-bob');
    send(ann, { kind: 'hello', participant: { name: 'Ann', color: '#2563eb', tabId: 't1' } });
    send(bob, { kind: 'hello', participant: { name: 'Bob', color: '#16a34a' } });
    expect(lastRoster(bob).find((p) => p.id === 'p-ann')?.color).toBe('#2563eb');
    ann.sent.length = 0;
    bob.sent.length = 0;

    send(ann, { kind: 'identity', participant: { name: 'Ann', color: '#dc2626' } });

    // Bob sees Ann's new colour on the roster his cursors, avatars and selection rings read, without a reload.
    const seen = lastRoster(bob).find((p) => p.id === 'p-ann');
    expect(seen).toMatchObject({ name: 'Ann', color: '#dc2626', tabId: 't1', role: 'edit' });
    // Ann gets no join's replies (no cursor, format or baton frames), only the roster.
    expect(new Set(frames(ann).map((f) => f.kind))).toEqual(new Set(['presence']));
    expect(new Set(frames(bob).map((f) => f.kind))).toEqual(new Set(['presence']));
  });

  it('takes a new name the same way, and sends nothing when nothing changed', () => {
    const { join, send } = room();
    const ann = join('p-ann');
    const bob = join('p-bob');
    send(ann, { kind: 'hello', participant: { name: 'Ann', color: '#2563eb' } });
    send(bob, { kind: 'hello', participant: { name: 'Bob', color: '#16a34a' } });
    bob.sent.length = 0;
    send(ann, { kind: 'identity', participant: { name: 'Ann', color: '#2563eb' } });
    expect(bob.sent).toEqual([]);
    send(ann, { kind: 'identity', participant: { name: 'Ann Lee', color: '#2563eb' } });
    expect(lastRoster(bob).find((p) => p.id === 'p-ann')?.name).toBe('Ann Lee');
  });

  it('holds the hello’s rules: the id and role are the room’s, and an unsafe colour is no colour', () => {
    const { join, send } = room();
    const ann = join('p-ann', 'view');
    const bob = join('p-bob');
    send(ann, { kind: 'hello', participant: { name: 'Ann', color: '#2563eb' } });
    send(bob, { kind: 'hello', participant: { name: 'Bob', color: '#16a34a' } });
    send(ann, {
      kind: 'identity',
      participant: { id: 'p-bob', role: 'edit', name: 'Ann', color: 'url(https://x.example/a)' },
    });
    const seen = lastRoster(bob).find((p) => p.id === 'p-ann');
    expect(seen).toMatchObject({ id: 'p-ann', role: 'view', color: '' });
    expect(lastRoster(bob).filter((p) => p.id === 'p-bob')).toEqual([]);
  });

  it('is ignored before the session’s hello', () => {
    const { join, send } = room();
    const ann = join('p-ann');
    const bob = join('p-bob');
    send(bob, { kind: 'hello', participant: { name: 'Bob', color: '#16a34a' } });
    bob.sent.length = 0;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    send(ann, { kind: 'identity', participant: { name: 'Ann', color: '#dc2626' } });
    warn.mockRestore();
    expect(ann.attachment.presence).toBeNull();
    expect(bob.sent).toEqual([]);
  });
});
