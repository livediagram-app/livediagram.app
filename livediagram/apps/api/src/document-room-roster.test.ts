import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { DocumentRoom } from './document-room/document-room';
import type { ParticipantPresence } from './types';

// The presence roster in a full room (docs/specs/015-api/api.md "Realtime model"): 100 sockets (the room cap) through
// the real room, holding what a repeat hello sends, what each socket's roster holds, and what one broadcast spends.

type Socket = { sent: string[]; attachment: { presence: ParticipantPresence | null } };

const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';

function fullRoom(size: number) {
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
  const room = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const hello = (s: Socket, name: string) =>
    room.webSocketMessage(
      wsOf(s),
      JSON.stringify({
        kind: 'hello',
        participant: {
          name,
          color: '#abc',
          tabId: 't1',
          ...((s.attachment as { account?: boolean }).account ? { picture: PICTURE } : {}),
        },
      }),
    );
  for (let i = 0; i < size; i++) {
    const s: Socket = {
      sent: [],
      attachment: {
        presenceId: `p${i}`,
        verifiedRole: i % 2 ? 'view' : 'edit',
        account: i % 3 === 0,
        presence: null,
      } as Socket['attachment'],
    };
    sockets.push(s);
    hello(s, `Person ${i}`);
  }
  for (const s of sockets) s.sent.length = 0;
  return { room, sockets, hello };
}

// The room compares sockets by identity, so every frame from one fake comes through one WebSocket object.
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

const kindsOf = (s: Socket) => s.sent.map((raw) => (JSON.parse(raw) as { kind: string }).kind);

describe('the roster in a full room', () => {
  it('sends nobody anything for 50 repeat hellos that change nothing; the sender alone still hears its own replies', () => {
    const { sockets, hello } = fullRoom(100);
    const viewer = sockets[1]!;
    for (let i = 0; i < 50; i++) hello(viewer, 'Person 1');
    for (const s of sockets) if (s !== viewer) expect(s.sent).toEqual([]);
    expect(new Set(kindsOf(viewer))).toEqual(new Set(['cursor', 'format', 'facilitator']));
    hello(viewer, 'Person One');
    for (const s of sockets) expect(kindsOf(s).filter((k) => k === 'presence')).toHaveLength(1);
  });

  it("sends each socket everyone else's presence, pictures to accounts only, as the room always has", () => {
    const { room, sockets } = fullRoom(100);
    room.broadcastPresence();
    for (const [i, s] of sockets.entries()) {
      expect(s.sent).toHaveLength(1);
      const others = sockets.filter((o) => o !== s).map((o) => o.attachment.presence!);
      const account = i % 3 === 0;
      const expected = others.map((p) => {
        if (account || p.picture === undefined) return p;
        const { picture: _hidden, ...rest } = p;
        return rest;
      });
      expect(JSON.parse(s.sent[0]!)).toEqual({
        kind: 'presence',
        participants: expected,
        agents: [],
      });
    }
  });

  // Measured 2.5 ms of CPU for one broadcast at 100 sockets when each socket's roster was stringified whole, and
  // 0.3 ms once each entry is serialised once (the api-kit roster).
  it('broadcasts one roster to 100 sockets well inside its CPU budget', () => {
    const { room } = fullRoom(100);
    room.broadcastPresence();
    const cpu = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) room.broadcastPresence();
    });
    expect(cpu / 10).toBeLessThan(cpuBudgetMs(2));
  });
});
