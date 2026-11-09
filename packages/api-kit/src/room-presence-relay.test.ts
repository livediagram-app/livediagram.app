import { describe, expect, it } from 'vitest';
import {
  batchFrame,
  PresenceRelay,
  tabReaches,
  type RelayFrame,
  type RelaySession,
  type RelayedOp,
  type SampleTrack,
} from './room-presence-relay';

// A socket stand-in: what it was sent, and the session the room has for it.
type Sock = { id: string; sent: string[]; session: RelaySession | null; scoped?: boolean };

function room(
  count: number,
  session: (i: number) => RelaySession | null = () => ({ tabId: 't1', batches: true }),
  extra: {
    sampleKinds?: ReadonlySet<string>;
    tracks?: Record<string, SampleTrack<RelaySession>>;
  } = {},
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
    ...extra,
  });
  const runTimers = () => {
    for (const t of timers.splice(0)) t.fn();
  };
  return { relay, sockets, timers, runTimers, reads: () => reads };
}

const cursor = (x = 1) => ({ kind: 'cursor', tabId: 't1', x, y: 1 });
const parsed = (raw: string) =>
  JSON.parse(raw) as { kind: string; frames?: unknown[]; from?: string; op?: unknown };

describe('tabReaches', () => {
  it('reaches a socket on the tab or its split pane, or of unknown tab', () => {
    expect(tabReaches('t1', { tabId: 't1' })).toBe(true);
    expect(tabReaches('t1', { tabId: 't2', besideTabId: 't1' })).toBe(true);
    expect(tabReaches('t1', { tabId: 't2' })).toBe(false);
    expect(tabReaches('t1', {})).toBe(true);
    expect(tabReaches('t1', null)).toBe(true);
  });

  it('sends a sample with no tab to everyone', () => {
    expect(tabReaches(undefined, { tabId: 't2' })).toBe(true);
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
  it('sends a cursor to everyone else at once, and leaves other kinds to the room', () => {
    const { relay, sockets, timers } = room(3, (i) => ({ tabId: i === 2 ? 't2' : 't1' }));
    expect(relay.relay(sockets[0]!, 'p0', cursor())).toBe(true);
    expect(sockets[0]!.sent).toEqual([]);
    expect(sockets[1]!.sent).toHaveLength(1);
    // A cursor is not its tab's alone.
    expect(sockets[2]!.sent).toHaveLength(1);
    expect(parsed(sockets[1]!.sent[0]!)).toMatchObject({ kind: 'op', from: 'p0' });
    expect(timers).toEqual([]);
    expect(relay.relay(sockets[0]!, 'p0', { kind: 'select' })).toBe(false);
    expect(relay.relay(sockets[0]!, 'p0', { kind: 'avatar', tabId: 't1', avatar: {} })).toBe(false);
    expect(relay.relay(sockets[0]!, 'p0', null)).toBe(false);
    expect(sockets[1]!.sent).toHaveLength(1);
  });

  it('withholds what the host withholds', () => {
    const { relay, sockets } = room(3);
    sockets[1]!.scoped = true;
    relay.relay(sockets[0]!, 'p0', cursor());
    expect(sockets[1]!.sent).toEqual([]);
    expect(sockets[2]!.sent).toHaveLength(1);
  });

  it('reads a session once, until told it changed', () => {
    const { relay, sockets, reads } = room(3, () => ({ tabId: 't1' }), {
      sampleKinds: new Set(['cursor', 'game-input']),
    });
    const input = { kind: 'game-input', tabId: 't1' };
    relay.relay(sockets[0]!, 'p0', input);
    relay.relay(sockets[0]!, 'p0', input);
    expect(reads()).toBe(2);
    relay.noteSession(sockets[1]!, { tabId: 't2' });
    relay.relay(sockets[0]!, 'p0', input);
    expect(sockets[1]!.sent).toHaveLength(2);
  });
});

describe('PresenceRelay in a busy room', () => {
  it('holds a step’s samples and sends each socket one frame, newest per sender', () => {
    const { relay, sockets, timers, runTimers } = room(12);
    relay.relay(sockets[0]!, 'p0', cursor(1));
    relay.relay(sockets[0]!, 'p0', cursor(2));
    relay.relay(sockets[1]!, 'p1', cursor(3));
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(50);
    expect(sockets[5]!.sent).toEqual([]);
    runTimers();
    expect(sockets[5]!.sent).toHaveLength(1);
    const batch = parsed(sockets[5]!.sent[0]!);
    expect(batch.kind).toBe('batch');
    expect(batch.frames).toEqual([
      { kind: 'op', from: 'p0', op: cursor(2) },
      { kind: 'op', from: 'p1', op: cursor(3) },
    ]);
    // The sender's own socket hears only the other sender, as a lone frame.
    expect(parsed(sockets[0]!.sent[0]!)).toMatchObject({ kind: 'op', from: 'p1' });
    expect(parsed(sockets[1]!.sent[0]!)).toMatchObject({ kind: 'op', from: 'p0' });
    // A new step schedules a new flush.
    relay.relay(sockets[0]!, 'p0', cursor(4));
    expect(timers).toHaveLength(1);
  });

  it('sends at once to an editor that does not take batches', () => {
    const { relay, sockets, timers } = room(12, (i) => ({ tabId: 't1', batches: i !== 3 }));
    relay.relay(sockets[0]!, 'p0', cursor());
    expect(sockets[3]!.sent).toHaveLength(1);
    expect(sockets[4]!.sent).toEqual([]);
    expect(timers).toHaveLength(1);
  });

  it('drops what is held for a socket that closed', () => {
    const { relay, sockets, runTimers } = room(12);
    relay.relay(sockets[0]!, 'p0', cursor());
    relay.forget(sockets[4]!, 'p4');
    runTimers();
    expect(sockets[4]!.sent).toEqual([]);
    expect(sockets[5]!.sent).toHaveLength(1);
  });
});

describe('PresenceRelay with a product’s own sample kinds', () => {
  const kinds = new Set(['cursor', 'avatar-voice']);
  const voice = (tabId: string, level: number) => ({ kind: 'avatar-voice', tabId, level });

  it('leaves a kind it was not given to the room', () => {
    const { relay, sockets } = room(3);
    expect(relay.relay(sockets[0]!, 'p0', voice('t1', 2))).toBe(false);
    expect(sockets[1]!.sent).toEqual([]);
  });

  it('sends a talking level to its tab only, at once in a small room', () => {
    const { relay, sockets } = room(3, (i) => ({ tabId: i === 2 ? 't2' : 't1' }), {
      sampleKinds: kinds,
    });
    expect(relay.relay(sockets[0]!, 'p0', voice('t1', 2))).toBe(true);
    expect(sockets[1]!.sent.map((f) => parsed(f).kind)).toEqual(['op']);
    expect(sockets[2]!.sent).toEqual([]);
  });

  it('coalesces it per sender per kind per step in a busy room, the stop winning over the level before it', () => {
    const { relay, sockets, runTimers } = room(12, undefined, { sampleKinds: kinds });
    relay.relay(sockets[0]!, 'p0', cursor(1));
    relay.relay(sockets[0]!, 'p0', voice('t1', 3));
    relay.relay(sockets[0]!, 'p0', voice('t1', 0));
    runTimers();
    expect(sockets[5]!.sent).toHaveLength(1);
    expect(parsed(sockets[5]!.sent[0]!).frames).toEqual([
      { kind: 'op', from: 'p0', op: cursor(1) },
      { kind: 'op', from: 'p0', op: voice('t1', 0) },
    ]);
  });
});

describe('PresenceRelay with a track', () => {
  // A stand-in track: reaches only a socket on tab `t1`, sends a session on `t1` a marked copy, keeps the last
  // frame per sender for a catch-up, and records what it was told to forget.
  function track() {
    const kept = new Map<string, RelayFrame>();
    const forgotten: string[] = [];
    const marked = (frame: RelayFrame): RelayFrame => {
      const payload = { ...frame.payload, op: { ...(frame.payload.op as object), marked: true } };
      return { payload, serialized: JSON.stringify(payload) };
    };
    const kind: SampleTrack<RelaySession> = {
      route(from, _op, frame) {
        kept.set(from, frame);
        return {
          reaches: (session) => session?.tabId !== 't2',
          frameFor: (session) => (session?.tabId === 't1' ? marked(frame) : frame),
        };
      },
      catchUp: (selfId) => [...kept].filter(([from]) => from !== selfId).map(([, frame]) => frame),
      forget: (presenceId) => void forgotten.push(presenceId),
    };
    return { kind, forgotten };
  }
  const walk = (x: number) => ({ kind: 'walk', tabId: 't1', x });

  it('relays the track’s kind without naming it, to whom and as the track says', () => {
    const t = track();
    const { relay, sockets } = room(4, (i) => (i === 3 ? null : { tabId: `t${i}` }), {
      tracks: { walk: t.kind },
    });
    expect(relay.relay(sockets[0]!, 'p0', walk(1))).toBe(true);
    expect(parsed(sockets[1]!.sent[0]!).op).toEqual({ ...walk(1), marked: true });
    expect(sockets[2]!.sent).toEqual([]);
    expect(parsed(sockets[3]!.sent[0]!).op).toEqual(walk(1));
    // The track's kind joins the room's own, which still relay.
    expect(relay.relay(sockets[0]!, 'p0', cursor())).toBe(true);
  });

  it('shows a socket that switched tab what the track keeps, withheld frames staying withheld', () => {
    const t = track();
    const { relay, sockets } = room(3, () => ({ tabId: 't1' }), { tracks: { walk: t.kind } });
    relay.relay(sockets[0]!, 'p0', walk(1));
    relay.relay(sockets[1]!, 'p1', walk(2));
    sockets[2]!.sent.length = 0;
    relay.catchUp(sockets[2]!, 'p1');
    expect(sockets[2]!.sent.map((f) => parsed(f).from)).toEqual(['p0']);
    sockets[2]!.scoped = true;
    sockets[2]!.sent.length = 0;
    relay.catchUp(sockets[2]!, 'p1');
    expect(sockets[2]!.sent).toEqual([]);
  });

  it('tells the track a presence left, and nothing for a socket that had none', () => {
    const t = track();
    const { relay, sockets } = room(2, undefined, { tracks: { walk: t.kind } });
    relay.forget(sockets[0]!, 'p0');
    relay.forget(sockets[1]!, undefined);
    expect(t.forgotten).toEqual(['p0']);
  });
});
