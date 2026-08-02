import { describe, it, expect } from 'vitest';
import {
  admitFrame,
  helloPresence,
  resolveCatchup,
  MAX_TAB_ID_LEN,
  type LoggedOp,
} from './diagram-room-rules';
import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from './limits';

const SESSION = { presenceId: 'p-server', verifiedRole: 'view' as const };

describe('helloPresence', () => {
  it('overrides the id and role the client claimed', () => {
    // The trust boundary (spec/61 §6): a joiner must not be able to announce
    // itself as somebody else, nor promote itself to an editor.
    const p = helloPresence(
      { id: 'p-someone-else', name: 'Ada', color: '#f00', role: 'edit' },
      SESSION,
    );
    expect(p.id).toBe('p-server');
    expect(p.role).toBe('view');
  });

  it('keeps the name, colour and tab the client claimed', () => {
    const p = helloPresence({ name: 'Ada', color: '#f00', tabId: 't1' }, SESSION);
    expect(p).toMatchObject({ name: 'Ada', color: '#f00', tabId: 't1' });
  });

  it('clamps every string it accepts', () => {
    const p = helloPresence(
      { name: 'n'.repeat(999), color: 'c'.repeat(999), tabId: 't'.repeat(999) },
      SESSION,
    );
    expect(p.name).toHaveLength(MAX_PARTICIPANT_NAME_LEN);
    expect(p.color).toHaveLength(MAX_COLOR_LEN);
    expect(p.tabId).toHaveLength(MAX_TAB_ID_LEN);
  });

  it('drops non-string and absent fields rather than trusting them', () => {
    const hostile = { name: 42, color: {}, tabId: [] } as unknown as Parameters<
      typeof helloPresence
    >[0];
    const p = helloPresence(hostile, SESSION);
    expect(p.name).toBe('');
    expect(p.color).toBe('');
    expect('tabId' in p).toBe(false);
    expect(helloPresence(null, SESSION)).toMatchObject({ name: '', color: '' });
  });

  it('smuggles no extra keys out of the claimed object', () => {
    // Built explicitly rather than spread, so the attachment cannot be used
    // as arbitrary storage.
    const p = helloPresence({ name: 'Ada', evil: 'x' } as never, SESSION);
    expect(Object.keys(p).sort()).toEqual(['color', 'id', 'name', 'role']);
  });
});

const op = (seq: number): LoggedOp => ({ seq, from: 'p1', op: { kind: 'element' } });

describe('resolveCatchup', () => {
  const room = { epoch: 'e1', seq: 5, opLog: [op(3), op(4), op(5)] };

  it('sends nothing when the client is already caught up', () => {
    expect(resolveCatchup({ epoch: 'e1', lastSeq: 5 }, room)).toEqual({ ops: [], resync: false });
    expect(resolveCatchup({ epoch: 'e1', lastSeq: 9 }, room)).toEqual({ ops: [], resync: false });
  });

  it('replays only the ops after lastSeq when they are still in the window', () => {
    const { ops, resync } = resolveCatchup({ epoch: 'e1', lastSeq: 3 }, room);
    expect(resync).toBe(false);
    expect(ops.map((o) => o.seq)).toEqual([4, 5]);
  });

  it('resyncs when the client is behind the trimmed log floor', () => {
    // It last applied seq 1, but the log now starts at 3, so the ops it
    // missed are gone and a replay would silently skip them.
    expect(resolveCatchup({ epoch: 'e1', lastSeq: 1 }, room)).toEqual({ ops: [], resync: true });
  });

  it('replays the whole log for a fresh client', () => {
    const { ops, resync } = resolveCatchup({ epoch: null, lastSeq: 0 }, room);
    expect(resync).toBe(false);
    expect(ops.map((o) => o.seq)).toEqual([3, 4, 5]);
  });

  it('resyncs a client that saw a previous room instance', () => {
    expect(resolveCatchup({ epoch: 'e0', lastSeq: 4 }, room)).toEqual({ ops: [], resync: true });
    // No epoch but prior progress is the same problem: we cannot map its seq.
    expect(resolveCatchup({ epoch: null, lastSeq: 4 }, room)).toEqual({ ops: [], resync: true });
  });

  it('treats an empty log as a floor above the current seq', () => {
    // Nothing logged yet: a caught-up client gets an empty delta, and one
    // claiming earlier progress cannot be served from a log that has nothing.
    const empty = { epoch: 'e1', seq: 0, opLog: [] };
    expect(resolveCatchup({ epoch: 'e1', lastSeq: 0 }, empty)).toEqual({ ops: [], resync: false });
  });

  it('does not hand back the room’s own log array', () => {
    // The room trims opLog in place; a returned reference would mutate under
    // the caller between resolving and sending.
    const { ops } = resolveCatchup({ epoch: null, lastSeq: 0 }, room);
    expect(ops).not.toBe(room.opLog);
  });
});

describe('admitFrame', () => {
  const CAP = 3;

  it('opens a window for a socket that has not sent before', () => {
    expect(admitFrame(undefined, 1000, CAP)).toEqual({
      admit: true,
      rate: { count: 1, windowStart: 1000 },
    });
  });

  it('counts frames inside the window without moving its start', () => {
    const first = admitFrame(undefined, 1000, CAP);
    const second = admitFrame(first.rate, 1400, CAP);
    expect(second).toEqual({ admit: true, rate: { count: 2, windowStart: 1000 } });
  });

  it('drops the frame once the window is at the cap', () => {
    const full = { count: CAP, windowStart: 1000 };
    expect(admitFrame(full, 1500, CAP)).toEqual({ admit: false, rate: full });
  });

  it('does not let a flooding socket extend its own window', () => {
    // Every dropped frame must leave windowStart alone, or a socket that
    // keeps sending would hold the window open forever and never reset.
    const full = { count: CAP, windowStart: 1000 };
    const after = admitFrame(admitFrame(full, 1500, CAP).rate, 1900, CAP);
    expect(after.rate.windowStart).toBe(1000);
    expect(after.admit).toBe(false);
  });

  it('starts a fresh window once a second has passed', () => {
    // The branch the room's own test needs a second DiagramRoom to reach.
    const full = { count: CAP, windowStart: 1000 };
    expect(admitFrame(full, 2000, CAP)).toEqual({
      admit: true,
      rate: { count: 1, windowStart: 2000 },
    });
  });

  it('treats the boundary as expiry, not as still inside the window', () => {
    expect(admitFrame({ count: 1, windowStart: 1000 }, 1999, CAP).rate.windowStart).toBe(1000);
    expect(admitFrame({ count: 1, windowStart: 1000 }, 2000, CAP).rate.windowStart).toBe(2000);
  });
});
