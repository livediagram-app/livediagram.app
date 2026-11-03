import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { presenceStepMs } from '@livediagram/api-schema';
import { DocumentRoom } from './document-room/document-room';

// The avatar fan-out bound (docs/specs/015-api/api.md "A busy room bounds its presence fan-out", and the measured
// numbers in docs/specs/008-canvas/avatar-mode.md "A busy room"): walks 10, 32 and 100 characters through the real
// room for one simulated second, each at the editors' stepped cadence, and holds what the room sends and spends.

type Socket = { sent: string[]; attachment: unknown };

function newRoom() {
  const sockets: Socket[] = [];
  const kv = new Map<string, unknown>();
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: (k: string) => Promise.resolve(kv.get(k)),
      put: (k: string, v: unknown) => Promise.resolve(void kv.set(k, v)),
      delete: (k: string) => Promise.resolve(kv.delete(k)),
      list: () => Promise.resolve(new Map()),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (id: string, tabId: string, batches = true) => {
    const s: Socket = {
      sent: [],
      attachment: { presenceId: id, verifiedRole: 'view', presence: null },
    };
    sockets.push(s);
    room.webSocketMessage(
      wsOf(s),
      JSON.stringify({
        kind: 'hello',
        participant: { name: id, color: '#abc', tabId },
        ...(batches ? { batches: true } : {}),
      }),
    );
    return s;
  };
  return { room, join, sockets };
}

// The room compares sockets by identity, so every frame from one fake comes through one WebSocket object.
const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = {
      send: (d: string) => void s.sent.push(d),
      serializeAttachment: (v: unknown) => void (s.attachment = v),
      deserializeAttachment: () => s.attachment,
    } as unknown as WebSocket;
    wsCache.set(s, ws);
  }
  return ws;
}

// One walking packet, the size an editor sends.
const avatarOp = (tabId: string, step: number) => ({
  kind: 'avatar',
  tabId,
  avatar: {
    x: 400 + step * 8.7,
    y: 300,
    facing: 'right',
    config: { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' },
    walking: true,
    stepFrame: step % 2,
    lift: 0,
    wave: null,
    seatedOn: null,
    holding: null,
  },
});
const say = (room: DocumentRoom, s: Socket, op: unknown) =>
  room.webSocketMessage(wsOf(s), JSON.stringify({ kind: 'op', op }));

type Frame = { kind: string; from?: string; op?: { kind: string }; frames?: Frame[] };
const opsIn = (raw: string): Frame[] => {
  const msg = JSON.parse(raw) as Frame;
  if (msg.kind === 'batch') return msg.frames ?? [];
  return msg.kind === 'op' ? [msg] : [];
};

// Everyone walking on one tab for one simulated second: what each socket was sent, and the room's CPU time.
function walkOneSecond(walkers: number) {
  const { room, join, sockets } = newRoom();
  for (let i = 0; i < walkers; i++) join(`p${i}`, 't1');
  for (const s of sockets) s.sent.length = 0;
  const every = presenceStepMs(walkers);
  const cpu = cpuMsOf(() => {
    for (let t = 0, step = 0; t < 1000; t += every, step++) {
      for (const s of sockets) say(room, s, avatarOp('t1', step));
      vi.advanceTimersByTime(every);
    }
    vi.advanceTimersByTime(every);
  });
  const frames = sockets.map((s) => s.sent.length);
  const delivered = sockets.reduce((n, s) => n + s.sent.flatMap(opsIn).length, 0);
  return { every, frames, delivered, cpu };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the avatar fan-out bound', () => {
  it('leaves a room of 10 exactly as it was: every packet at once, to everyone else', () => {
    const { every, frames, delivered } = walkOneSecond(10);
    expect(every).toBe(33);
    const packets = Math.ceil(1000 / 33);
    expect(delivered).toBe(10 * 9 * packets);
    expect(frames.every((n) => n === 9 * packets)).toBe(true);
  });

  it.each([32, 100])('sends each socket of %i walkers one frame a step', (walkers) => {
    const { every, frames, delivered } = walkOneSecond(walkers);
    const steps = Math.ceil(1000 / every) + 1;
    // Before the bound, each socket of 100 walkers was sent 2,970 frames a second; now one a step.
    expect(Math.max(...frames)).toBeLessThanOrEqual(steps);
    // Every walker still reaches every other socket once a step.
    expect(delivered).toBeGreaterThanOrEqual(walkers * (walkers - 1) * (steps - 2));
  });

  it('relays 100 walkers within its CPU budget', () => {
    walkOneSecond(32);
    // Measured at about 43 ms of CPU for the simulated second on an M-series Mac; on workerd the same walk once
    // took the room's whole core (avatar-mode.md "A busy room").
    const cpu = Math.min(walkOneSecond(100).cpu, walkOneSecond(100).cpu);
    expect(cpu).toBeLessThan(cpuBudgetMs(150));
  });
});

describe('the avatar relay in the room', () => {
  it('sends a character only to its tab, and catches a session up when it switches', () => {
    const { room, join } = newRoom();
    const walker = join('p0', 't1');
    const sameTab = join('p1', 't1');
    const otherTab = join('p2', 't2');
    say(room, walker, avatarOp('t1', 1));
    expect(sameTab.sent.flatMap(opsIn).map((f) => f.op?.kind)).toContain('avatar');
    expect(otherTab.sent.flatMap(opsIn).some((f) => f.op?.kind === 'avatar')).toBe(false);
    say(room, otherTab, { kind: 'tab-focus', tabId: 't1' });
    const caught = otherTab.sent.flatMap(opsIn).filter((f) => f.op?.kind === 'avatar');
    expect(caught).toHaveLength(1);
    // A cursor is relayed as before.
    say(room, walker, { kind: 'cursor', tabId: 't1', x: 1, y: 2 });
    expect(otherTab.sent.flatMap(opsIn).some((f) => f.op?.kind === 'cursor')).toBe(true);
  });

  it('sends an editor that does not take batches every packet on its own, even in a busy room', () => {
    const { room, join, sockets } = newRoom();
    for (let i = 0; i < 11; i++) join(`p${i}`, 't1');
    const old = join('old', 't1', false);
    for (const s of sockets) s.sent.length = 0;
    say(room, sockets[0]!, avatarOp('t1', 1));
    say(room, sockets[1]!, avatarOp('t1', 1));
    expect(old.sent.map((raw) => (JSON.parse(raw) as Frame).kind)).toEqual(['op', 'op']);
    expect(sockets[2]!.sent).toEqual([]);
    vi.advanceTimersByTime(presenceStepMs(12));
    expect((JSON.parse(sockets[2]!.sent[0]!) as Frame).kind).toBe('batch');
  });

  it('forgets a walker whose socket closed', () => {
    const { room, join } = newRoom();
    const walker = join('p0', 't1');
    const later = join('p1', 't2');
    say(room, walker, avatarOp('t1', 1));
    room.webSocketClose(wsOf(walker));
    later.sent.length = 0;
    say(room, later, { kind: 'tab-focus', tabId: 't1' });
    expect(later.sent.flatMap(opsIn).some((f) => f.op?.kind === 'avatar')).toBe(false);
  });
});
