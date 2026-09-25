import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './index';
import {
  canCastVote,
  isVotable,
  isVotableInVote,
  isVoteHost,
  timerDisplayMs,
  timerDone,
  voteHidesCursors,
  voteHidesTallies,
  voteTotals,
  applyVoteDelta,
  votesSpentBy,
  type TabTimer,
  type TabVote,
} from './session';

describe('timerDisplayMs / timerDone', () => {
  it('countdown running shows remaining off the absolute end-time, floored at 0', () => {
    const t: TabTimer = { mode: 'countdown', running: true, durationMs: 60_000, anchorAt: 100_000 };
    expect(timerDisplayMs(t, 70_000)).toBe(30_000); // 30s left
    expect(timerDisplayMs(t, 100_000)).toBe(0);
    expect(timerDisplayMs(t, 105_000)).toBe(0); // never negative
    expect(timerDone(t, 99_000)).toBe(false);
    expect(timerDone(t, 100_000)).toBe(true);
  });

  it('countdown paused shows the frozen remaining (or the duration before any run)', () => {
    expect(
      timerDisplayMs(
        { mode: 'countdown', running: false, durationMs: 60_000, frozenMs: 42_000 },
        0,
      ),
    ).toBe(42_000);
    // Never started: fall back to the configured duration.
    expect(timerDisplayMs({ mode: 'countdown', running: false, durationMs: 60_000 }, 0)).toBe(
      60_000,
    );
  });

  it('stopwatch running counts up from the anchor; paused shows the frozen elapsed', () => {
    expect(timerDisplayMs({ mode: 'stopwatch', running: true, anchorAt: 5_000 }, 12_000)).toBe(
      7_000,
    );
    expect(timerDisplayMs({ mode: 'stopwatch', running: false, frozenMs: 7_000 }, 99_000)).toBe(
      7_000,
    );
    // A stopwatch is never "done".
    expect(timerDone({ mode: 'stopwatch', running: true, anchorAt: 0 }, 9_999)).toBe(false);
  });
});

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...overrides,
});

describe('isVotable', () => {
  it('allows shapes, stickies, and images', () => {
    expect(isVotable(shape('a'))).toBe(true);
    expect(isVotable(shape('c', { shape: 'circle' }))).toBe(true);
    expect(isVotable({ id: 's', type: 'sticky', x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(
      isVotable({ id: 'i', type: 'image', x: 0, y: 0, width: 1, height: 1, imageId: null }),
    ).toBe(true);
  });

  // Behaviour elements (spec/103-107) DO something when pressed. A votable
  // one would give the same tap two meanings, decided by whether a vote
  // happened to be running.
  it('rejects the interactive Behaviour shapes', () => {
    for (const kind of ['mode-button', 'portal', 'session-button', 'reveal', 'picker'] as const) {
      expect(isVotable(shape(kind, { shape: kind } as Partial<ShapeElement>))).toBe(false);
    }
  });

  it('rejects frames (section backdrops) and non-content kinds', () => {
    expect(isVotable(shape('f', { shape: 'frame' }))).toBe(false);
    expect(isVotable({ id: 't', type: 'text', x: 0, y: 0, width: 1, height: 1, label: 'x' })).toBe(
      false,
    );
    expect(
      isVotable({
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 1, y: 1 },
      }),
    ).toBe(false);
    expect(isVotable({ id: 'n', type: 'annotation', x: 0, y: 0, width: 44, height: 44 })).toBe(
      false,
    );
  });
});

describe('vote tallies', () => {
  const vote: TabVote = {
    active: true,
    revealed: false,
    votesPerPerson: 3,
    votes: {
      e1: ['ann', 'ann', 'bob'], // 3 dots (ann stacked two)
      e2: ['bob'], // 1 dot
      e3: [], // none — excluded from totals
    },
  };

  it('votesSpentBy counts a participant across every element, including stacks', () => {
    expect(votesSpentBy(vote, 'ann')).toBe(2);
    expect(votesSpentBy(vote, 'bob')).toBe(2);
    expect(votesSpentBy(vote, 'cat')).toBe(0);
  });

  it('voteTotals collapses to per-element counts, dropping zero-dot elements', () => {
    expect(voteTotals(vote)).toEqual({ e1: 3, e2: 1 });
  });
});

describe('vote host (spec/39)', () => {
  const base: TabVote = { active: true, revealed: false, votesPerPerson: 3, votes: {} };

  it('only the starter drives their vote', () => {
    const v: TabVote = { ...base, startedBy: 'ann' };
    expect(isVoteHost(v, 'ann')).toBe(true);
    expect(isVoteHost(v, 'bob')).toBe(false);
  });

  it('a vote saved before hosts existed stays drivable by anyone', () => {
    // Otherwise an in-flight legacy vote would be unendable — nobody
    // matches an absent starter.
    expect(isVoteHost(base, 'anyone')).toBe(true);
  });

  it('no vote means nobody to host', () => {
    expect(isVoteHost(null, 'ann')).toBe(false);
    expect(isVoteHost(undefined, 'ann')).toBe(false);
  });
});

describe('vote privacy (spec/39)', () => {
  const open: TabVote = { active: true, revealed: false, votesPerPerson: 3, votes: {} };

  it('a vote saved before privacy shipped (flags absent) hides nothing', () => {
    expect(voteHidesCursors(open)).toBe(false);
    expect(voteHidesTallies(open)).toBe(false);
    expect(voteHidesTallies({ ...open, active: false })).toBe(false);
  });

  it('neither helper fires without a vote', () => {
    expect(voteHidesCursors(null)).toBe(false);
    expect(voteHidesCursors(undefined)).toBe(false);
    expect(voteHidesTallies(null)).toBe(false);
    expect(voteHidesTallies(undefined)).toBe(false);
  });

  it('hideCursors applies only while casting is open — End vote restores cursors', () => {
    const v = { ...open, hideCursors: true };
    expect(voteHidesCursors(v)).toBe(true);
    // End vote: casting closed, results not yet shown. Cursors come back
    // here rather than waiting for the reveal.
    expect(voteHidesCursors({ ...v, active: false })).toBe(false);
    expect(voteHidesCursors({ ...v, active: false, revealed: true })).toBe(false);
  });

  it('hideCounts survives End vote and lifts only at the reveal', () => {
    const v = { ...open, hideCounts: true };
    expect(voteHidesTallies(v)).toBe(true);
    // Still hidden in the ended-but-unrevealed gap — "Show results" is the gate.
    expect(voteHidesTallies({ ...v, active: false })).toBe(true);
    expect(voteHidesTallies({ ...v, active: false, revealed: true })).toBe(false);
  });

  it('the two switches are independent', () => {
    const cursorsOnly: TabVote = { ...open, hideCursors: true };
    expect(voteHidesTallies(cursorsOnly)).toBe(false);
    const countsOnly: TabVote = { ...open, hideCounts: true };
    expect(voteHidesCursors(countsOnly)).toBe(false);
  });
});

describe('vote layer scoping (spec/96)', () => {
  const vote = (over: Partial<TabVote> = {}): TabVote => ({
    active: true,
    revealed: false,
    votesPerPerson: 3,
    votes: {},
    ...over,
  });
  const layers = [
    { id: 'layer:default', name: 'Layer 1' },
    { id: 'l2', name: 'Layer 2' },
  ];

  it('an unscoped vote leaves every layer votable', () => {
    const el = shape('a', { layerId: 'l2' });
    expect(isVotableInVote(el, vote(), layers)).toBe(true);
    expect(isVotableInVote(el, vote({ voteLayerId: undefined }), layers)).toBe(true);
  });

  it('a scoped vote takes dots only on its own layer', () => {
    const on = shape('a', { layerId: 'l2' });
    const off = shape('b', { layerId: 'layer:default' });
    const v = vote({ voteLayerId: 'l2' });
    expect(isVotableInVote(on, v, layers)).toBe(true);
    expect(isVotableInVote(off, v, layers)).toBe(false);
  });

  it('pre-layers elements resolve to the base layer rather than becoming unvotable', () => {
    // Everything authored before spec/74 carries no layerId. A raw
    // comparison would drop all of it the moment a scope was set.
    const legacy = shape('a');
    expect(legacy.layerId).toBeUndefined();
    expect(isVotableInVote(legacy, vote({ voteLayerId: 'layer:default' }), layers)).toBe(true);
    expect(isVotableInVote(legacy, vote({ voteLayerId: 'l2' }), layers)).toBe(false);
  });

  it('the kind rule still wins — a frame on the votable layer is still not votable', () => {
    const frame = shape('f', { shape: 'frame', layerId: 'l2' });
    expect(isVotableInVote(frame, vote({ voteLayerId: 'l2' }), layers)).toBe(false);
  });

  it('with no vote, only the kind rule applies (there is no scope to fail)', () => {
    expect(isVotableInVote(shape('a'), null, layers)).toBe(true);
    expect(isVotableInVote(shape('f', { shape: 'frame' }), null, layers)).toBe(false);
  });
});

describe('canCastVote', () => {
  const base: TabVote = { active: true, revealed: false, votesPerPerson: 3, votes: { a: ['me'] } };

  it('lets dots stack on one element by default', () => {
    expect(canCastVote(base, 'me', 'a')).toBe(true);
  });

  it('refuses a second dot on the same element when the vote is one per element', () => {
    const vote = { ...base, onePerElement: true };
    expect(canCastVote(vote, 'me', 'a')).toBe(false);
    expect(canCastVote(vote, 'me', 'b')).toBe(true);
    expect(canCastVote(vote, 'you', 'a')).toBe(true);
  });

  it('refuses once the budget is spent, and once casting has closed', () => {
    expect(canCastVote({ ...base, votes: { a: ['me', 'me', 'me'] } }, 'me', 'b')).toBe(false);
    expect(canCastVote({ ...base, active: false }, 'me', 'b')).toBe(false);
  });
});

describe('applyVoteDelta — concurrent dots must not clobber (spec/39)', () => {
  const vote = (votes: Record<string, string[]> = {}): TabVote => ({
    active: true,
    revealed: false,
    votesPerPerson: 6,
    votes,
  });

  it('adds one dot', () => {
    expect(applyVoteDelta(vote(), 'e1', 'ariel', 1).votes).toEqual({ e1: ['ariel'] });
  });

  it('stacks a second dot from the same person', () => {
    const once = applyVoteDelta(vote(), 'e1', 'ariel', 1);
    expect(applyVoteDelta(once, 'e1', 'ariel', 1).votes).toEqual({ e1: ['ariel', 'ariel'] });
  });

  it('removes only the LAST of that person’s dots', () => {
    const v = vote({ e1: ['ariel', 'pete', 'ariel'] });
    expect(applyVoteDelta(v, 'e1', 'ariel', -1).votes).toEqual({ e1: ['ariel', 'pete'] });
  });

  it('returns the SAME object when there is nothing to remove', () => {
    // Lets the caller skip a render and an autosave on a no-op.
    const v = vote({ e1: ['pete'] });
    expect(applyVoteDelta(v, 'e1', 'ariel', -1)).toBe(v);
    expect(applyVoteDelta(v, 'nothing-here', 'ariel', -1)).toBe(v);
  });

  it('never mutates the vote it was given', () => {
    const v = vote({ e1: ['pete'] });
    applyVoteDelta(v, 'e1', 'ariel', 1);
    expect(v.votes).toEqual({ e1: ['pete'] });
  });

  // THE bug: two people casting inside one propagation window used to lose a
  // dot, because the map travelled as a whole-object replacement built from a
  // snapshot taken before the other dot arrived. Deltas commute, so applying
  // them in either order has to reach the same place.
  it('is order-independent for two people on different elements', () => {
    const ariel = (v: TabVote) => applyVoteDelta(v, 'e1', 'ariel', 1);
    const pete = (v: TabVote) => applyVoteDelta(v, 'e2', 'pete', 1);
    expect(pete(ariel(vote())).votes).toEqual(ariel(pete(vote())).votes);
    expect(pete(ariel(vote())).votes).toEqual({ e1: ['ariel'], e2: ['pete'] });
  });

  it('is order-independent for two people on the SAME element', () => {
    const ariel = (v: TabVote) => applyVoteDelta(v, 'e1', 'ariel', 1);
    const pete = (v: TabVote) => applyVoteDelta(v, 'e1', 'pete', 1);
    const a = pete(ariel(vote())).votes.e1!;
    const b = ariel(pete(vote())).votes.e1!;
    expect([...a].sort()).toEqual([...b].sort());
    expect(a).toHaveLength(2);
  });

  it('keeps everybody’s dots when a whole room votes in any order', () => {
    // Six voters, six dots each — the retro that lost votes.
    const casts: { el: string; who: string }[] = [];
    for (const who of ['a', 'b', 'c', 'd', 'e', 'f']) {
      for (let i = 0; i < 6; i++) casts.push({ el: `e${i}`, who });
    }
    const apply = (order: typeof casts) =>
      order.reduce((v, c) => applyVoteDelta(v, c.el, c.who, 1), vote());
    const forwards = apply(casts);
    const backwards = apply([...casts].reverse());
    expect(votesSpentBy(forwards, 'a')).toBe(6);
    // Every dot survives whatever order the ops land in, which is the property
    // the old whole-object patch did not have.
    for (const who of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(votesSpentBy(backwards, who), who).toBe(6);
    }
    expect(Object.values(forwards.votes).flat()).toHaveLength(36);
    expect(Object.values(backwards.votes).flat()).toHaveLength(36);
  });

  it('applies a peer’s dot even when that peer is out of budget locally', () => {
    // Budget is a rule about whether a person MAY cast, checked where the
    // press happens. A dot a peer already cast is a fact; refusing it here
    // would leave that peer's screen disagreeing with the room forever.
    const spent = vote({ e1: ['ariel', 'ariel', 'ariel', 'ariel', 'ariel', 'ariel'] });
    expect(votesSpentBy(applyVoteDelta(spent, 'e2', 'ariel', 1), 'ariel')).toBe(7);
  });
});
