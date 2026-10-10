import { describe, expect, it } from 'vitest';
import type { TabVote } from '@livediagram/document';
import {
  clampTimerMinutes,
  dialAngle,
  dialDragMinutes,
  dialFraction,
  formatMinutesLabel,
  minutesForDialAngle,
  voteRules,
  wedgePath,
} from './session-studio';

const vote = (patch: Partial<TabVote> = {}): TabVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: {},
  ...patch,
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

describe('voteRules', () => {
  const layers = [{ id: 'l2', name: 'Ideas' }];

  it('names the budget and nothing else for a plain vote', () => {
    expect(voteRules(vote(), layers)).toEqual(['3 dots each']);
  });

  it('adds one per item, the layer scope and the privacy in force', () => {
    const v = vote({ onePerElement: true, voteLayerId: 'l2', hideCursors: true, hideCounts: true });
    expect(voteRules(v, layers)).toEqual([
      '3 dots each',
      'One per item',
      'Ideas only',
      'Cursors hidden',
      'Counts hidden',
    ]);
  });

  it('brings cursors back when voting closes, and counts once results show', () => {
    const closed = vote({ active: false, hideCursors: true, hideCounts: true });
    expect(voteRules(closed, layers)).toEqual(['3 dots each', 'Counts hidden']);
    expect(voteRules({ ...closed, revealed: true }, layers)).toEqual(['3 dots each']);
  });
});
