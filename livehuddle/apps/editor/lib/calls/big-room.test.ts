// A big room hears its talkers (docs/specs/012-collaboration/meeting-rooms-and-stage.md "A big room hears its
// talkers", "Cost"; Work Tracker #482).
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  BIG_ROOM_AFTER,
  capBigRoom,
  MAX_ROOM_TALKERS,
  NEAREST_IN_ROOM,
  RECENT_TALK_MS,
  type BigRoomInput,
} from './big-room';
import { nextHeard, type Point } from './hearing';
import type { CallZoning } from './zones';

const NOW = 100_000;

// `n` people in one room, in a row 40 px apart, the first `inOpen` of them in the open instead.
function floor(n: number, inOpen = 0) {
  const walkers = new Map<string, Point>();
  const of = new Map<string, string | null>();
  for (let i = 0; i < n; i++) {
    walkers.set(`p${i}`, { x: i * 40, y: 0 });
    of.set(`p${i}`, i < inOpen ? null : 'floor');
  }
  return { walkers, of };
}

function input(
  n: number,
  self: string,
  talked: Record<string, number> = {},
  prev: ReadonlySet<string> = new Set(),
): BigRoomInput {
  const { walkers, of } = floor(n);
  const others = new Map([...walkers].filter(([id]) => id !== self));
  const zoning: CallZoning = { self: 'floor', of };
  return {
    heard: nextHeard(new Set(), walkers.get(self)!, others, zoning),
    prev,
    self: walkers.get(self)!,
    walkers: others,
    zoning,
    talkedAt: (id) => talked[id],
    now: NOW,
  };
}

describe('capBigRoom', () => {
  it('leaves a room of up to BIG_ROOM_AFTER others alone', () => {
    const small = input(BIG_ROOM_AFTER + 1, 'p0');
    expect(small.heard.size).toBe(BIG_ROOM_AFTER);
    expect(capBigRoom(small)).toBe(small.heard);
  });

  it('receives the nearest few and whoever talked lately in a big room', () => {
    const big = input(30, 'p0', { p20: NOW - 1000, p25: NOW - RECENT_TALK_MS - 1 });
    const got = capBigRoom(big);
    expect([...got].sort()).toEqual(['p1', 'p2', 'p20', 'p3']);
    expect(got.size).toBe(NEAREST_IN_ROOM + 1);
  });

  it('keeps one near you received until two more are nearer, so walking past flickers nobody', () => {
    const prev = new Set(['p4', 'p5', 'p6']);
    const got = capBigRoom(input(30, 'p0', {}, prev));
    expect([...got].sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('receives at most MAX_ROOM_TALKERS talkers, the ones who talked last', () => {
    const talked: Record<string, number> = {};
    for (let i = 10; i < 30; i++) talked[`p${i}`] = NOW - (30 - i) * 100;
    const got = capBigRoom(input(30, 'p0', talked));
    expect(got.size).toBe(NEAREST_IN_ROOM + MAX_ROOM_TALKERS);
    expect(got.has('p29')).toBe(true);
    expect(got.has('p21')).toBe(false);
  });

  it('answers the same set itself when nothing changed', () => {
    const first = capBigRoom(input(30, 'p0'));
    expect(capBigRoom(input(30, 'p0', {}, first))).toBe(first);
  });

  it('keeps everyone heard outside the room, and caps nothing without a position', () => {
    const { walkers, of } = floor(30, 2);
    const self = walkers.get('p5')!;
    const others = new Map([...walkers].filter(([id]) => id !== 'p5'));
    // You stand in the open with p0 and p1; the room is walled off, so nothing to cap.
    const zoning: CallZoning = { self: null, of };
    const heard = nextHeard(new Set(), self, others, zoning);
    const got = capBigRoom({
      heard,
      prev: new Set(),
      self,
      walkers: others,
      zoning,
      talkedAt: () => undefined,
      now: NOW,
    });
    expect(got).toBe(heard);
    const blind = { ...input(30, 'p0'), self: null };
    expect(capBigRoom(blind)).toBe(blind.heard);
  });

  // The measurement the spec quotes: a full Coworking floor, everyone in its one room, two of them talking.
  it('cuts a 30-person floor from 870 microphone streams to at most 150', () => {
    const talked = { p7: NOW - 2000, p22: NOW - 9000 };
    let before = 0;
    let after = 0;
    for (let i = 0; i < 30; i++) {
      const one = input(30, `p${i}`, talked);
      before += one.heard.size;
      after += capBigRoom(one).size;
    }
    expect(before).toBe(870);
    expect(after).toBeLessThanOrEqual(150);
    // Measured: 143 (the 3 nearest each, plus the two talkers for everyone not already beside them).
    expect(after).toBe(143);
  });

  it('chooses for a full floor in well under a millisecond', () => {
    const one = input(100, 'p50', { p7: NOW - 2000 });
    const ms = cpuMsOf(() => {
      for (let n = 0; n < 200; n++) capBigRoom(one);
    });
    // 200 choices in a room of 100. Measured 33 ms CPU on a loaded laptop (about 0.17 ms a choice).
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
