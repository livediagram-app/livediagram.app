import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './index';
import {
  isVotable,
  timerDisplayMs,
  timerDone,
  voteHidesCursors,
  voteHidesTallies,
  voteTotals,
  voteWinners,
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

  it('voteWinners returns the max-count element(s); empty when no dots', () => {
    expect(voteWinners(vote)).toEqual(['e1']);
    expect(voteWinners({ ...vote, votes: {} })).toEqual([]);
    // Ties return all joint winners.
    expect(
      voteWinners({ ...vote, votes: { a: ['x', 'y'], b: ['p', 'q'], c: ['z'] } }).sort(),
    ).toEqual(['a', 'b']);
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
