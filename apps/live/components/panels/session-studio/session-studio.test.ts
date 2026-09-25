import { describe, expect, it } from 'vitest';
import type { TabTimer, TabVote } from '@livediagram/diagram';
import {
  clampTimerMinutes,
  dialAngle,
  dialDragMinutes,
  dialFraction,
  formatMinutesLabel,
  initialStudioTool,
  minutesForDialAngle,
  studioToolStatus,
  votePhase,
  voteTurnout,
  wedgePath,
} from './session-studio';

const running: TabTimer = { mode: 'countdown', running: true, durationMs: 60_000, anchorAt: 1 };
const paused: TabTimer = { mode: 'stopwatch', running: false, frozenMs: 5_000 };
const vote = (patch: Partial<TabVote> = {}): TabVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: {},
  ...patch,
});

describe('initialStudioTool', () => {
  it('opens on the timer when nothing is set up', () => {
    expect(initialStudioTool({ timer: null, vote: null, pollRunning: false })).toBe('timer');
  });

  it('opens on whatever is live, ahead of anything idle', () => {
    expect(
      initialStudioTool({ timer: paused, vote: vote({ active: true }), pollRunning: false }),
    ).toBe('vote');
    expect(
      initialStudioTool({ timer: running, vote: vote({ active: false }), pollRunning: false }),
    ).toBe('timer');
  });

  it('prefers the poll when several things are live', () => {
    expect(initialStudioTool({ timer: running, vote: vote(), pollRunning: true })).toBe('poll');
  });

  it('falls back to an idle tool', () => {
    expect(initialStudioTool({ timer: paused, vote: null, pollRunning: false })).toBe('timer');
  });
});

describe('studioToolStatus', () => {
  it('reads live, idle, or nothing per tool', () => {
    const state = { timer: paused, vote: vote({ active: false }), pollRunning: false };
    expect(studioToolStatus('timer', state)).toBe('idle');
    expect(studioToolStatus('vote', state)).toBe('idle');
    expect(studioToolStatus('poll', state)).toBeNull();
  });
});

describe('timer dial', () => {
  it('measures angles clockwise from twelve', () => {
    expect(dialAngle(50, 50, 50, 0)).toBeCloseTo(0);
    expect(dialAngle(50, 50, 100, 50)).toBeCloseTo(Math.PI / 2);
    expect(dialAngle(50, 50, 50, 100)).toBeCloseTo(Math.PI);
    expect(dialAngle(50, 50, 0, 50)).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('maps a quarter turn to fifteen minutes and never to zero', () => {
    expect(minutesForDialAngle(Math.PI / 2)).toBe(15);
    expect(minutesForDialAngle(0)).toBe(60);
    expect(minutesForDialAngle(0.001)).toBe(60);
    expect(minutesForDialAngle(Math.PI * 2 - 0.001)).toBe(60);
  });

  it('fills the wedge by the hour and caps at one lap', () => {
    expect(dialFraction(0)).toBe(0);
    expect(dialFraction(30 * 60_000)).toBeCloseTo(0.5);
    expect(dialFraction(90 * 60_000)).toBe(1);
  });

  it('draws nothing for an empty wedge and a closed shape for a full one', () => {
    expect(wedgePath(50, 50, 40, 0)).toBe('');
    expect(wedgePath(50, 50, 40, 1)).toMatch(/Z$/);
    expect(wedgePath(50, 50, 40, 0.25)).toContain('A 40 40 0 0 1 90.000 50.000');
    expect(wedgePath(50, 50, 40, 0.75)).toContain('0 1 1');
  });

  it('sticks at the pin instead of wrapping past twelve', () => {
    expect(dialDragMinutes(58, 2)).toBe(60);
    expect(dialDragMinutes(2, 58)).toBe(1);
    expect(dialDragMinutes(20, 25)).toBe(25);
  });

  it('clamps minutes to the shared timer range', () => {
    expect(clampTimerMinutes(0)).toBe(1);
    expect(clampTimerMinutes(500)).toBe(120);
    expect(clampTimerMinutes(Number.NaN)).toBe(1);
  });

  it('labels durations in words', () => {
    expect(formatMinutesLabel(5)).toBe('5 min');
    expect(formatMinutesLabel(60)).toBe('1 hr');
    expect(formatMinutesLabel(90)).toBe('1 hr 30 min');
  });
});

describe('vote', () => {
  it('walks setup, casting, closed, results', () => {
    expect(votePhase(null)).toBe('setup');
    expect(votePhase(vote())).toBe('casting');
    expect(votePhase(vote({ active: false }))).toBe('closed');
    expect(votePhase(vote({ active: false, revealed: true }))).toBe('results');
  });

  it('counts dots and distinct voters', () => {
    expect(voteTurnout(vote({ votes: { a: ['p1', 'p1', 'p2'], b: ['p3'] } }))).toEqual({
      dots: 4,
      voters: 3,
    });
  });
});
