import { describe, expect, it } from 'vitest';

import {
  clampTimerMinutes,
  dialAngle,
  dialDragMinutes,
  dialPressGrabsHandle,
  dialFraction,
  formatMinutesLabel,
  minutesForDialAngle,
  wedgePath,
} from './session-studio';

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

  it('takes hold of the handle when a press lands on it, measured round the dial', () => {
    // A 1-minute handle pressed a hair left of twelve reads as 60: still the handle.
    expect(dialPressGrabsHandle(1, 60)).toBe(true);
    expect(dialPressGrabsHandle(1, 2)).toBe(true);
    expect(dialPressGrabsHandle(30, 31)).toBe(true);
    // Past one lap the handle sits at twelve.
    expect(dialPressGrabsHandle(90, 59)).toBe(true);
    // Anywhere else is a jump.
    expect(dialPressGrabsHandle(1, 45)).toBe(false);
    expect(dialPressGrabsHandle(30, 20)).toBe(false);
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
