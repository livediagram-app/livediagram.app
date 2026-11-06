import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { roomZones } from '@livehuddle/document';
import {
  meetingLive,
  resetMeetingLive,
  sameLive,
  setMeetingLive,
  type SignLive,
} from './meeting-live';
import { zonesOfWalkers } from './useMeetingPieces';
import { onKnock, receiveKnockOp } from './knock-inbox';
import type { KnockEvent } from './knock-inbox';

afterEach(resetMeetingLive);

const sign = (over: Partial<SignLive> = {}): SignLive => ({
  roomId: 'r',
  name: 'Kitchen',
  status: 'free',
  count: 0,
  since: null,
  selfInside: false,
  pod: false,
  people: [],
  ...over,
});

describe('the meeting pieces store', () => {
  it('keeps an unchanged snapshot object, so its face does not re-render', () => {
    setMeetingLive(new Map([['a', sign()]]));
    const first = meetingLive('a');
    setMeetingLive(new Map([['a', sign()]]));
    expect(meetingLive('a')).toBe(first);
    setMeetingLive(new Map([['a', sign({ count: 2, status: 'in-use', since: 1 })]]));
    expect(meetingLive('a')).not.toBe(first);
  });

  it("compares a Screen's people by id and name, in order", () => {
    const a = { roomId: 'r', inside: [{ id: 'p1', name: 'Sam' }] };
    expect(sameLive(a, { roomId: 'r', inside: [{ id: 'p1', name: 'Sam' }] })).toBe(true);
    expect(sameLive(a, { roomId: 'r', inside: [{ id: 'p1', name: 'Ana' }] })).toBe(false);
    expect(sameLive(a, sign())).toBe(false);
    expect(sameLive(undefined, sign())).toBe(false);
  });

  it("compares a sign's people and pod, so a face wakes when who is inside changes", () => {
    const sam = { id: 'p1', name: 'Sam', color: '#0ea5e9', self: false };
    expect(sameLive(sign({ people: [sam] }), sign({ people: [{ ...sam }] }))).toBe(true);
    expect(sameLive(sign({ people: [sam] }), sign({ people: [{ ...sam, name: 'Ana' }] }))).toBe(
      false,
    );
    expect(sameLive(sign({ people: [sam] }), sign({ people: [{ ...sam, color: '#000' }] }))).toBe(
      false,
    );
    expect(sameLive(sign({ people: [sam] }), sign({ people: [] }))).toBe(false);
    expect(sameLive(sign(), sign({ pod: true }))).toBe(false);
  });
});

describe('zonesOfWalkers', () => {
  it('puts each walker in its innermost room, and nobody on the open floor', () => {
    const zones = roomZones([
      { id: 'big', type: 'shape', shape: 'room', x: 0, y: 0, width: 480, height: 320 },
      { id: 'pod', type: 'shape', shape: 'office-pod', x: 100, y: 100, width: 176, height: 144 },
    ]);
    const by = zonesOfWalkers(
      [
        { id: 'a', at: { x: 30, y: 250 } },
        { id: 'b', at: { x: 188, y: 200 } },
        { id: 'c', at: { x: 900, y: 900 } },
      ],
      zones,
    );
    expect(by.get('big')?.map((w) => w.id)).toEqual(['a']);
    expect(by.get('pod')?.map((w) => w.id)).toEqual(['b']);
    expect(zonesOfWalkers([{ id: 'a', at: { x: 1, y: 1 } }], []).size).toBe(0);
  });

  // A worst case: many walkers and rooms, on every presence change, inside a CPU-time budget.
  it('zones 200 walkers against 50 rooms quickly', () => {
    const els = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      type: 'shape',
      shape: 'room',
      x: (i % 10) * 500,
      y: Math.floor(i / 10) * 400,
      width: 480,
      height: 320,
    }));
    const zones = roomZones(els);
    const walkers = Array.from({ length: 200 }, (_, i) => ({
      id: `w${i}`,
      at: { x: i * 23, y: i * 9 },
    }));
    const run = () => {
      for (let n = 0; n < 100; n++) zonesOfWalkers(walkers, zones);
    };
    // Warm up, then CPU time (docs/ci.md "Speed budgets"): 100 runs well inside 500 ms, i.e. under 5 ms each.
    run();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(run)));
    expect(best).toBeLessThan(cpuBudgetMs(500));
  });
});

describe('the knock inbox', () => {
  it('hands on parsed knocks and answers, and drops anything malformed', () => {
    const seen = vi.fn<(e: KnockEvent) => void>();
    const off = onKnock(seen);
    receiveKnockOp('p1', { kind: 'avatar-knock', tabId: 't', roomId: 'r' });
    receiveKnockOp('p2', {
      kind: 'avatar-knock-answer',
      tabId: 't',
      targetId: 'me',
      roomId: 'r',
      answer: 'later',
    });
    receiveKnockOp('p3', { kind: 'avatar-knock', tabId: 't' });
    off();
    receiveKnockOp('p1', { kind: 'avatar-knock', tabId: 't', roomId: 'r' });
    expect(seen.mock.calls.map(([e]) => [e.type, e.from])).toEqual([
      ['knock', 'p1'],
      ['answer', 'p2'],
    ]);
  });
});
