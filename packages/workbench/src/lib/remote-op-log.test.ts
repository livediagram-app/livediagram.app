import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import {
  REMOTE_OP_LOG_LIMIT,
  clearedStacks,
  rebasedSnapshot,
  remoteOpCount,
  stacksAfterStep,
  stacksWithoutRedo,
  stepBack,
  stepForward,
  withPresent,
  withRemoteOp,
  type RebasingHistory,
  type RemoteOp,
} from './remote-op-log';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Locked decisions": a peer's op lands in every undo
// and redo snapshot. The lazy log must show the person exactly what applying it to every snapshot on arrival did.

type State = Readonly<Record<string, number>>;
type H = RebasingHistory<State>;

// The eager history the log replaced, kept here as the reference.
type Eager = { past: State[]; present: State; future: State[] };
const eager = {
  step: (h: Eager, present: State, limit: number): Eager => ({
    past: [...h.past, h.present].slice(-limit),
    present,
    future: [],
  }),
  undo: (h: Eager, limit: number): Eager => ({
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1]!,
    future: [h.present, ...h.future].slice(0, limit),
  }),
  cancel: (h: Eager): Eager => ({
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1]!,
    future: h.future,
  }),
  redo: (h: Eager, limit: number): Eager => ({
    past: [...h.past, h.present].slice(-limit),
    present: h.future[0]!,
    future: h.future.slice(1),
  }),
  clearRedo: (h: Eager): Eager => ({ ...h, future: [] }),
  remote: (h: Eager, op: RemoteOp<State>): Eager => ({
    past: h.past.map(op),
    present: op(h.present),
    future: h.future.map(op),
  }),
};

const lazy = {
  step: (h: H, present: State, limit: number): H => ({
    ...h,
    ...stacksAfterStep(h, limit),
    present,
  }),
  undo: (h: H, limit: number): H => {
    const { snapshot, stacks } = stepBack(h, limit, true);
    return { ...h, ...stacks, present: snapshot };
  },
  cancel: (h: H, limit: number): H => {
    const { snapshot, stacks } = stepBack(h, limit, false);
    return { ...h, ...stacks, present: snapshot };
  },
  redo: (h: H, limit: number): H => {
    const { snapshot, stacks } = stepForward(h, limit);
    return { ...h, ...stacks, present: snapshot };
  },
  clearRedo: (h: H): H => ({ ...h, ...stacksWithoutRedo(h) }),
};

// Adds to one key, as a run: consecutive adds to the same key apply in one call (counted in `runCalls`).
let runCalls = 0;
const addAll = (s: State, key: string, items: readonly unknown[]): State => {
  runCalls++;
  return { ...s, [key]: (s[key] ?? 0) + (items as number[]).reduce((a, b) => a + b, 0) };
};
function adding(key: string, value: number): RemoteOp<State> {
  return Object.assign((s: State) => ({ ...s, [key]: (s[key] ?? 0) + value }), {
    run: { key, items: [value], applyAll: addAll },
  });
}

// Ops that do not commute, and some that change nothing: a set, an add (in a run), a delete, a double.
function randomOp(rand: () => number): RemoteOp<State> {
  // Many keys, so an op's mark outlives the ops after it; the runs add to two keys nothing else writes.
  const key = `k${Math.floor(rand() * 30)}`;
  const value = 1 + Math.floor(rand() * 5);
  const kind = Math.floor(rand() * 5);
  if (kind === 0) return (s) => (s[key] === value ? s : { ...s, [key]: value });
  if (kind === 1) return (s) => ({ ...s, [key]: (s[key] ?? 0) + value });
  if (kind === 2) {
    return (s) => {
      if (!(key in s)) return s;
      const { [key]: _gone, ...rest } = s;
      void _gone;
      return rest;
    };
  }
  if (kind === 3) return adding(rand() < 0.7 ? 'sum' : 'total', value);
  return (s) => (key in s ? { ...s, [key]: s[key]! * 2 } : s);
}

function expectSame(lz: H, eg: Eager) {
  expect(lz.present).toEqual(eg.present);
  expect(lz.past).toHaveLength(eg.past.length);
  expect(lz.future).toHaveLength(eg.future.length);
  eg.past.forEach((s, i) => expect(rebasedSnapshot(lz, 'past', i)).toEqual(s));
  eg.future.forEach((s, i) => expect(rebasedSnapshot(lz, 'future', i)).toEqual(s));
}

describe('remote op log, against applying every op to every snapshot', () => {
  for (const [seed, limit, remoteShare, steps] of [
    [1, 6, 0.5, 3000],
    [2, 40, 0.3, 3000],
    [3, 4, 0.9, 4000],
    [4, 600, 0.95, 2500],
    // Snapshots at nearly every log position, with the log past its limit: what retiring must keep right.
    [5, 1000, 0.6, 4000],
  ] as const) {
    it(`matches the eager history (seed ${seed}, ${limit} steps kept)`, () => {
      const rand = seededRandom(seed);
      let lz: H = { past: [], present: {}, future: [] };
      let eg: Eager = { past: [], present: {}, future: [] };
      for (let n = 0; n < steps; n++) {
        const roll = rand();
        if (roll < remoteShare) {
          const op = randomOp(rand);
          lz = withRemoteOp(lz, op);
          eg = eager.remote(eg, op);
        } else {
          const action = Math.floor(rand() * 6);
          if (action === 0 || action === 1) {
            const present = { ...eg.present, mine: n };
            lz = lazy.step(lz, present, limit);
            eg = eager.step(eg, present, limit);
          } else if (action === 2 && eg.past.length > 0) {
            lz = lazy.undo(lz, limit);
            eg = eager.undo(eg, limit);
          } else if (action === 3 && eg.future.length > 0) {
            lz = lazy.redo(lz, limit);
            eg = eager.redo(eg, limit);
          } else if (action === 4 && eg.past.length > 0) {
            lz = lazy.cancel(lz, limit);
            eg = eager.cancel(eg);
          } else if (action === 5) {
            lz = lazy.clearRedo(lz);
            eg = eager.clearRedo(eg);
          }
        }
        expect(lz.present).toEqual(eg.present);
        expect(remoteOpCount(lz)).toBeLessThanOrEqual(REMOTE_OP_LOG_LIMIT);
        if (n % 97 === 0) expectSame(lz, eg);
      }
      expectSame(lz, eg);
      // Unwind every step both ways: each restore must match.
      while (eg.past.length > 0) {
        lz = lazy.undo(lz, limit);
        eg = eager.undo(eg, limit);
        expect(lz.present).toEqual(eg.present);
      }
      while (eg.future.length > 0) {
        lz = lazy.redo(lz, limit);
        eg = eager.redo(eg, limit);
        expect(lz.present).toEqual(eg.present);
      }
    });
  }
  it('keeps every snapshot right when the log passes its limit, a snapshot at every position', () => {
    let lz: H = { past: [], present: {}, future: [] };
    let eg: Eager = { past: [], present: {}, future: [] };
    for (let n = 0; n < 2 * REMOTE_OP_LOG_LIMIT + 20; n++) {
      const present = { ...eg.present, mine: n };
      lz = lazy.step(lz, present, 4 * REMOTE_OP_LOG_LIMIT);
      eg = eager.step(eg, present, 4 * REMOTE_OP_LOG_LIMIT);
      // Every op leaves a mark: a run of adds, or a set no later op overwrites before its next turn.
      const op = n % 3 === 0 ? adding('sum', 1) : (s: State) => ({ ...s, [`k${n % 7}`]: n });
      lz = withRemoteOp(lz, op);
      eg = eager.remote(eg, op);
      expect(remoteOpCount(lz)).toBeLessThanOrEqual(REMOTE_OP_LOG_LIMIT);
    }
    expectSame(lz, eg);
  });
});

describe('remote op log costs', () => {
  const counting = () => {
    const seen: State[] = [];
    const op: RemoteOp<State> = (s) => {
      seen.push(s);
      return { ...s, peer: (s.peer ?? 0) + 1 };
    };
    return { seen, op };
  };
  const deep = (n: number): H => ({
    past: Array.from({ length: n }, (_, i) => ({ mine: i })),
    present: { mine: n },
    future: Array.from({ length: n }, (_, i) => ({ mine: n + 1 + i })),
  });

  it('applies an op to the present alone, however deep the history', () => {
    const { seen, op } = counting();
    let h = deep(500);
    for (let i = 0; i < 20; i++) h = withRemoteOp(h, op);
    expect(seen).toHaveLength(20);
    expect(h.present).toEqual({ mine: 500, peer: 20 });
    expect(remoteOpCount(h)).toBe(20);
  });

  it('gives a restored snapshot only the ops it is missing', () => {
    const { seen, op } = counting();
    let h = deep(3);
    h = withRemoteOp(h, op);
    h = withRemoteOp(h, op);
    h = lazy.step(h, { ...h.present, mine: 9 }, 10);
    h = withRemoteOp(h, op);
    seen.length = 0;
    // The newest snapshot was taken after two ops: undo replays one.
    h = lazy.undo(h, 10);
    expect(seen).toHaveLength(1);
    expect(h.present).toEqual({ mine: 3, peer: 3 });
    // The one below it predates all three.
    seen.length = 0;
    h = lazy.undo(h, 10);
    expect(seen).toHaveLength(3);
    expect(h.present).toEqual({ mine: 2, peer: 3 });
  });

  it('keeps the ops back to the oldest snapshot only, and none without one', () => {
    const { op } = counting();
    let h: H = { past: [], present: {}, future: [] };
    h = withRemoteOp(h, op);
    expect(h.remote).toBeUndefined();
    h = lazy.step(h, { mine: 1 }, 2);
    h = withRemoteOp(h, op);
    h = lazy.step(h, { ...h.present, mine: 2 }, 2);
    h = withRemoteOp(h, op);
    expect(remoteOpCount(h)).toBe(2);
    // The cap drops the oldest snapshot, and the op only it lacked goes with it.
    h = lazy.step(h, { ...h.present, mine: 3 }, 2);
    expect(remoteOpCount(h)).toBe(1);
    h = { ...h, ...clearedStacks<State>() };
    expect(h.remote).toBeUndefined();
  });

  it(`holds at most ${REMOTE_OP_LOG_LIMIT} ops: past that, the snapshots behind take the oldest half`, () => {
    const { seen, op } = counting();
    let h = deep(2);
    for (let i = 0; i < REMOTE_OP_LOG_LIMIT; i++) h = withRemoteOp(h, op);
    expect(seen).toHaveLength(REMOTE_OP_LOG_LIMIT);
    h = withRemoteOp(h, op);
    const half = REMOTE_OP_LOG_LIMIT / 2;
    // The present, then the oldest REMOTE_OP_LOG_LIMIT + 1 - half ops on each of the four snapshots.
    expect(seen).toHaveLength(REMOTE_OP_LOG_LIMIT + 1 + 4 * (REMOTE_OP_LOG_LIMIT + 1 - half));
    expect(remoteOpCount(h)).toBe(half);
    expect(rebasedSnapshot(h, 'past', 0)).toEqual({ mine: 0, peer: REMOTE_OP_LOG_LIMIT + 1 });
  });

  it('applies a run of ops that go together in one call', () => {
    let h = deep(1);
    for (let i = 0; i < 10; i++) h = withRemoteOp(h, adding('k', 1));
    h = withRemoteOp(h, adding('other', 1));
    for (let i = 0; i < 5; i++) h = withRemoteOp(h, adding('k', 2));
    runCalls = 0;
    expect(rebasedSnapshot(h, 'past', 0)).toEqual({ mine: 0, k: 20, other: 1 });
    // Ten adds to k, then one to other (applied alone, not as a run), then five to k.
    expect(runCalls).toBe(2);
  });

  it('keeps the history itself for an op that changes nothing with no snapshot to log it for', () => {
    const h: H = { past: [], present: { a: 1 }, future: [] };
    expect(withRemoteOp(h, (s) => s)).toBe(h);
    expect(withRemoteOp(h, (s) => ({ ...s, a: 2 })).present).toEqual({ a: 2 });
  });

  it('leaves the snapshots themselves untouched, so they keep sharing', () => {
    const h0 = deep(4);
    let h = h0;
    for (let i = 0; i < 20; i++) h = withRemoteOp(h, (s) => ({ ...s, peer: i }));
    h.past.forEach((s, i) => expect(s).toBe(h0.past[i]));
    h.future.forEach((s, i) => expect(s).toBe(h0.future[i]));
  });
});

describe('withPresent', () => {
  it('hands back the very same history when the present is unchanged, so React renders nothing', () => {
    const present: State = { a: 1 };
    const h: RebasingHistory<State> = { past: [{ a: 0 }], present, future: [] };
    expect(withPresent(h, present)).toBe(h);
  });

  it('swaps in a new present and keeps the stacks as they were', () => {
    const h: RebasingHistory<State> = { past: [{ a: 0 }], present: { a: 1 }, future: [{ a: 2 }] };
    const next = withPresent(h, { a: 5 });
    expect(next).not.toBe(h);
    expect(next.present).toEqual({ a: 5 });
    expect(next.past).toBe(h.past);
    expect(next.future).toBe(h.future);
  });
});
