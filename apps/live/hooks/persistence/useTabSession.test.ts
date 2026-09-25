/* eslint-disable react-hooks/rules-of-hooks -- useTabSession calls no React hooks (every handler writes through commitTabs), so running it outside a component is safe; see the harness note below. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/diagram';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { useTabSession } from './useTabSession';

// useTabSession holds no React state (every handler writes through
// commitTabs), so it runs as a plain function over a tab array we own.
function harness(
  initial: Partial<Tab> = {},
  opts: { editsBlocked?: boolean; sessionToolsBlocked?: boolean } = {},
) {
  let tabs: Tab[] = [{ id: 't1', name: 'Tab 1', elements: [], ...initial } as Tab];
  const session = () =>
    useTabSession({
      editsBlocked: opts.editsBlocked ?? false,
      sessionToolsBlocked: opts.sessionToolsBlocked ?? false,
      activeId: 't1',
      activeTab: tabs[0]!,
      commitTabs: (map) => {
        tabs = map(tabs);
      },
      emitTabMeta: vi.fn(),
      selfId: 'me',
    });
  return { session, tab: () => tabs[0]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(track).mockClear();
});

describe('extendTimer', () => {
  it('pushes a running countdown’s end and length out together', () => {
    const h = harness({
      timer: { mode: 'countdown', running: true, durationMs: 300_000, anchorAt: 1_120_000 },
    });
    h.session().extendTimer(60_000);
    expect(h.tab().timer).toMatchObject({
      running: true,
      durationMs: 360_000,
      anchorAt: 1_180_000,
    });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'TimerExtended');
  });

  it('grows a paused countdown’s frozen remainder', () => {
    const h = harness({
      timer: { mode: 'countdown', running: false, durationMs: 300_000, frozenMs: 90_000 },
    });
    h.session().extendTimer(30_000);
    expect(h.tab().timer).toMatchObject({ durationMs: 330_000, frozenMs: 120_000 });
  });

  it('restarts a finished countdown from now rather than a past end instant', () => {
    const h = harness({
      timer: { mode: 'countdown', running: true, durationMs: 60_000, anchorAt: 900_000 },
    });
    h.session().extendTimer(60_000);
    expect(h.tab().timer?.anchorAt).toBe(1_060_000);
  });

  it('leaves a stopwatch, a blocked editor, and a non-positive delta alone', () => {
    const stopwatch = harness({ timer: { mode: 'stopwatch', running: true, anchorAt: 1 } });
    stopwatch.session().extendTimer(60_000);
    expect(stopwatch.tab().timer).toEqual({ mode: 'stopwatch', running: true, anchorAt: 1 });

    const countdown = { mode: 'countdown', running: true, durationMs: 1, anchorAt: 2 } as const;
    const blocked = harness({ timer: countdown }, { editsBlocked: true });
    blocked.session().extendTimer(60_000);
    expect(blocked.tab().timer).toEqual(countdown);

    const zero = harness({ timer: countdown });
    zero.session().extendTimer(0);
    expect(zero.tab().timer).toEqual(countdown);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('one dot per item', () => {
  it('bakes the choice into the vote only when it is on', () => {
    const on = harness();
    on.session().startVote(3, { hideCursors: false, hideCounts: false, onePerElement: true });
    expect(on.tab().vote?.onePerElement).toBe(true);

    const off = harness();
    off.session().startVote(3, { hideCursors: false, hideCounts: false });
    expect(off.tab().vote).not.toHaveProperty('onePerElement');
  });

  it('refuses a second dot on the same item but allows a different one', () => {
    const h = harness();
    h.session().startVote(3, { hideCursors: false, hideCounts: false, onePerElement: true });
    h.session().castVote('a');
    h.session().castVote('a');
    h.session().castVote('b');
    expect(h.tab().vote?.votes).toEqual({ a: ['me'], b: ['me'] });
  });

  it('still lets dots stack on an ordinary vote', () => {
    const h = harness();
    h.session().startVote(3, { hideCursors: false, hideCounts: false });
    h.session().castVote('a');
    h.session().castVote('a');
    expect(h.tab().vote?.votes).toEqual({ a: ['me', 'me'] });
  });
});

describe('while somebody else is facilitating (spec/149)', () => {
  it('refuses to start the timer', () => {
    const { session, tab } = harness({}, { sessionToolsBlocked: true });
    session().startTimer('countdown', 60_000);
    expect(tab().timer).toBeUndefined();
  });

  it('refuses to start, reveal, end or clear a vote', () => {
    const { session, tab } = harness({}, { sessionToolsBlocked: true });
    session().startVote(3);
    expect(tab().vote).toBeUndefined();
  });

  it('still lets you cast and retract your own dots, which is the point of a vote', () => {
    // Started by the facilitator, answered by the room.
    const running = harness();
    running.session().startVote(3);
    const voting = harness(running.tab(), { sessionToolsBlocked: true });
    voting.session().castVote('el-1');
    expect(voting.tab().vote?.votes).toEqual({ 'el-1': ['me'] });
    voting.session().retractVote('el-1');
    expect(voting.tab().vote?.votes['el-1'] ?? []).toEqual([]);
  });

  it('changes nothing when nobody is facilitating', () => {
    const { session, tab } = harness();
    session().startTimer('countdown', 60_000);
    expect(tab().timer?.running).toBe(true);
  });
});

describe('dot-vote telemetry (spec/22)', () => {
  const votedCalls = () =>
    vi.mocked(track).mock.calls.filter(([c, a]) => c === 'Element' && a === 'Voted');
  const retractedCalls = () =>
    vi
      .mocked(track)
      .mock.calls.filter(([c, a, t]) => c === 'Element' && a === 'Removed' && t === 'Vote');

  it('counts only the dots that were actually cast', () => {
    const h = harness();
    h.session().startVote(2, { hideCursors: false, hideCounts: false });
    h.session().castVote('a');
    h.session().castVote('b');
    // Budget spent: these presses cast nothing.
    h.session().castVote('c');
    h.session().castVote('a');
    expect(h.tab().vote?.votes).toEqual({ a: ['me'], b: ['me'] });
    expect(votedCalls()).toHaveLength(2);
  });

  it('does not count a second dot refused on a one-per-item vote', () => {
    const h = harness();
    h.session().startVote(3, { hideCursors: false, hideCounts: false, onePerElement: true });
    h.session().castVote('a');
    h.session().castVote('a');
    expect(votedCalls()).toHaveLength(1);
  });

  it('does not count a press with no vote open', () => {
    const h = harness();
    h.session().castVote('a');
    expect(votedCalls()).toHaveLength(0);
  });

  it('counts a retraction only when one of my dots came off', () => {
    const h = harness();
    h.session().startVote(3, { hideCursors: false, hideCounts: false });
    h.session().retractVote('a');
    expect(retractedCalls()).toHaveLength(0);
    h.session().castVote('a');
    h.session().retractVote('a');
    h.session().retractVote('a');
    expect(retractedCalls()).toHaveLength(1);
    expect(h.tab().vote?.votes.a ?? []).toEqual([]);
  });
});
