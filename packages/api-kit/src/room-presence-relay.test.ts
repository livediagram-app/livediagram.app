import { describe, expect, it } from 'vitest';
import {
  avatarReaches,
  batchFrame,
  PresenceRelay,
  REMEMBERED_WALKERS,
  type RelaySession,
  type RelayedOp,
} from './room-presence-relay';

// A socket stand-in: what it was sent, and the session the room has for it.
type Sock = { id: string; sent: string[]; session: RelaySession | null; scoped?: boolean };

function room(
  count: number,
  session: (i: number) => RelaySession | null = () => ({ tabId: 't1', batches: true }),
  sampleKinds?: ReadonlySet<string>,
) {
  const sockets: Sock[] = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    sent: [],
    session: session(i),
  }));
  const timers: { fn: () => void; ms: number }[] = [];
  let reads = 0;
  const relay = new PresenceRelay<Sock>({
    sockets: () => sockets,
    sessionOf: (s) => {
      reads++;
      return s.session;
    },
    // A scoped socket is withheld every frame, as a tab-scoped session is withheld another tab's.
    frameFor: (s, _payload: RelayedOp, serialized) => (s.scoped ? null : serialized),
    send: (s, frame) => void s.sent.push(frame),
    schedule: (fn, ms) => void timers.push({ fn, ms }),
    ...(sampleKinds ? { sampleKinds } : {}),
  });
  const runTimers = () => {
    for (const t of timers.splice(0)) t.fn();
  };
  return { relay, sockets, timers, runTimers, reads: () => reads };
}

const avatar = (tabId: string, x = 1) => ({
  kind: 'avatar',
  tabId,
  avatar: { x, y: 2, walking: true },
});
const parsed = (raw: string) =>
  JSON.parse(raw) as { kind: string; frames?: unknown[]; from?: string };

describe('avatarReaches', () => {
  it('reaches a socket on the op’s tab or its split pane, or of unknown tab', () => {
    const op = avatar('t1');
    expect(avatarReaches(op, { tabId: 't1' })).toBe(true);
    expect(avatarReaches(op, { tabId: 't2', besideTabId: 't1' })).toBe(true);
    expect(avatarReaches(op, { tabId: 't2' })).toBe(false);
    expect(avatarReaches(op, {})).toBe(true);
    expect(avatarReaches(op, null)).toBe(true);
  });

  it('sends leaving the mode, and a packet with no tab, to everyone', () => {
    expect(avatarReaches({ kind: 'avatar', tabId: 't1', avatar: null }, { tabId: 't2' })).toBe(
      true,
    );
    expect(avatarReaches({ kind: 'avatar', avatar: {} }, { tabId: 't2' })).toBe(true);
  });
});

describe('batchFrame', () => {
  it('sends a lone frame as itself and splices several into one batch', () => {
    expect(batchFrame(['{"kind":"op"}'])).toBe('{"kind":"op"}');
    const batch = batchFrame(['{"kind":"op","n":1}', '{"kind":"op","n":2}']);
    expect(JSON.parse(batch)).toEqual({
      kind: 'batch',
      frames: [
        { kind: 'op', n: 1 },
        { kind: 'op', n: 2 },
      ],
    });
  });
});

describe('PresenceRelay in a room of up to 10', () => {
  it('sends a sample to everyone else at once, and leaves other kinds to the room', () => {
    const { relay, sockets, timers } = room(3);
    expect(relay.relay(sockets[0]!, 'p0', avatar('t1'))).toBe(true);
    expect(relay.relay(sockets[0]!, 'p0', { kind: 'cursor', tabId: 't1', x: 1, y: 1 })).toBe(true);
    expect(sockets[0]!.sent).toEqual([]);
    expect(sockets[1]!.sent).toHaveLength(2);
    expect(parsed(sockets[1]!.sent[0]!)).toMatchObject({ kind: 'op', from: 'p0' });
    expect(timers).toEqual([]);
    expect(relay.relay(sockets[0]!, 'p0', { kind: 'select' })).toBe(false);
    expect(relay.relay(sockets[0]!, 'p0', null)).toBe(false);
    expect(sockets[1]!.sent).toHaveLength(2);
  });

  it('sends a character only to the sockets on its tab, and withholds what the host withholds', () => {
    const { relay, sockets } = room(3, (i) => ({ tabId: i === 2 ? 't2' : 't1' }));
    sockets[1]!.scoped = true;
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    expect(sockets[1]!.sent).toEqual([]);
    expect(sockets[2]!.sent).toEqual([]);
    relay.relay(sockets[0]!, 'p0', { kind: 'avatar', tabId: 't1', avatar: null });
    expect(sockets[2]!.sent).toHaveLength(1);
  });

  it('reads a session once, until told it changed', () => {
    const { relay, sockets, reads } = room(3, () => ({ tabId: 't1' }));
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    expect(reads()).toBe(2);
    relay.noteSession(sockets[1]!, { tabId: 't2' });
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    expect(sockets[1]!.sent).toHaveLength(2);
  });
});

describe('PresenceRelay in a busy room', () => {
  it('holds a step’s samples and sends each socket one frame, newest per sender and kind', () => {
    const { relay, sockets, timers, runTimers } = room(12);
    relay.relay(sockets[0]!, 'p0', avatar('t1', 1));
    relay.relay(sockets[0]!, 'p0', avatar('t1', 2));
    relay.relay(sockets[1]!, 'p1', avatar('t1', 3));
    relay.relay(sockets[1]!, 'p1', { kind: 'cursor', tabId: 't1', x: 1, y: 1 });
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(50);
    expect(sockets[5]!.sent).toEqual([]);
    runTimers();
    expect(sockets[5]!.sent).toHaveLength(1);
    const batch = parsed(sockets[5]!.sent[0]!);
    expect(batch.kind).toBe('batch');
    expect(batch.frames).toEqual([
      { kind: 'op', from: 'p0', op: avatar('t1', 2) },
      { kind: 'op', from: 'p1', op: avatar('t1', 3) },
      { kind: 'op', from: 'p1', op: { kind: 'cursor', tabId: 't1', x: 1, y: 1 } },
    ]);
    // The sender's own socket hears only the other walker.
    expect(parsed(sockets[0]!.sent[0]!).kind).toBe('batch');
    expect((parsed(sockets[0]!.sent[0]!).frames ?? []).length).toBe(2);
    expect(parsed(sockets[1]!.sent[0]!)).toMatchObject({ kind: 'op', from: 'p0' });
    // A new step schedules a new flush.
    relay.relay(sockets[0]!, 'p0', avatar('t1', 4));
    expect(timers).toHaveLength(1);
  });

  it('sends at once to an editor that does not take batches', () => {
    const { relay, sockets, timers } = room(12, (i) => ({ tabId: 't1', batches: i !== 3 }));
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    expect(sockets[3]!.sent).toHaveLength(1);
    expect(sockets[4]!.sent).toEqual([]);
    expect(timers).toHaveLength(1);
  });

  it('drops what is held for a socket that closed', () => {
    const { relay, sockets, runTimers } = room(12);
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    relay.forget(sockets[4]!, 'p4');
    runTimers();
    expect(sockets[4]!.sent).toEqual([]);
    expect(sockets[5]!.sent).toHaveLength(1);
  });
});

describe('PresenceRelay catch-up on a tab switch', () => {
  it('shows a socket arriving on a tab where everyone on it stands now', () => {
    const { relay, sockets } = room(4, (i) => ({ tabId: i === 3 ? 't2' : 't1' }));
    relay.relay(sockets[0]!, 'p0', avatar('t1', 10));
    relay.relay(sockets[1]!, 'p1', avatar('t1', 20));
    relay.relay(sockets[3]!, 'p3', avatar('t2', 30));
    relay.relay(sockets[3]!, 'p8', avatar('t3', 40));
    relay.relay(sockets[2]!, 'p2', avatar('t1', 5));
    relay.relay(sockets[2]!, 'p2', { kind: 'avatar', tabId: 't1', avatar: null });
    expect(sockets[3]!.sent.filter((f) => f.includes('"t1"'))).toHaveLength(1);
    relay.noteSession(sockets[3]!, { tabId: 't1' });
    sockets[3]!.sent.length = 0;
    relay.catchUp(sockets[3]!, 'p3');
    expect(sockets[3]!.sent.map((f) => parsed(f).from)).toEqual(['p0', 'p1']);
    // Withheld frames stay withheld.
    sockets[3]!.scoped = true;
    sockets[3]!.sent.length = 0;
    relay.catchUp(sockets[3]!, 'p3');
    expect(sockets[3]!.sent).toEqual([]);
  });

  it('forgets a walker whose socket closed, and keeps no more than a bound of them', () => {
    const { relay, sockets } = room(2);
    relay.relay(sockets[0]!, 'p0', avatar('t1'));
    relay.forget(sockets[0]!, 'p0');
    relay.forget(sockets[0]!, undefined);
    relay.catchUp(sockets[1]!, 'p1');
    expect(sockets[1]!.sent).toHaveLength(1);
    for (let i = 0; i <= REMEMBERED_WALKERS; i++) relay.relay(sockets[0]!, `w${i}`, avatar('t1'));
    sockets[1]!.sent.length = 0;
    relay.catchUp(sockets[1]!, 'p1');
    expect(sockets[1]!.sent).toHaveLength(REMEMBERED_WALKERS);
    expect(parsed(sockets[1]!.sent[0]!).from).toBe('w1');
  });
});

describe('PresenceRelay with a product’s own sample kinds', () => {
  const kinds = new Set(['avatar', 'cursor', 'avatar-voice']);
  const voice = (tabId: string, level: number) => ({ kind: 'avatar-voice', tabId, level });

  it('leaves a kind it was not given to the room', () => {
    const { relay, sockets } = room(3);
    expect(relay.relay(sockets[0]!, 'p0', voice('t1', 2))).toBe(false);
    expect(sockets[1]!.sent).toEqual([]);
  });

  it('sends a talking level to its tab only, at once in a small room', () => {
    const { relay, sockets } = room(3, (i) => ({ tabId: i === 2 ? 't2' : 't1' }), kinds);
    expect(relay.relay(sockets[0]!, 'p0', voice('t1', 2))).toBe(true);
    expect(sockets[1]!.sent.map((f) => parsed(f).kind)).toEqual(['op']);
    expect(sockets[2]!.sent).toEqual([]);
  });

  it('coalesces it per sender per step in a busy room, the stop winning over the level before it', () => {
    const { relay, sockets, runTimers } = room(12, undefined, kinds);
    relay.relay(sockets[0]!, 'p0', avatar('t1', 1));
    relay.relay(sockets[0]!, 'p0', voice('t1', 3));
    relay.relay(sockets[0]!, 'p0', voice('t1', 0));
    runTimers();
    expect(sockets[5]!.sent).toHaveLength(1);
    expect(parsed(sockets[5]!.sent[0]!).frames).toEqual([
      { kind: 'op', from: 'p0', op: avatar('t1', 1) },
      { kind: 'op', from: 'p0', op: voice('t1', 0) },
    ]);
  });
});
