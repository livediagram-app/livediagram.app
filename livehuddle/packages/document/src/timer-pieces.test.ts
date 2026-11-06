import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMER_MS,
  STOPWATCH_MAX_MS,
  clampTimerMinutes,
  createShape,
  formatPieceTimer,
  idlePieceTimer,
  isPieceTimer,
  isTimerPieceShape,
  pausePieceTimer,
  pieceTimerOf,
  pieceTimerPhase,
  pieceTimerReadout,
  pieceTimerShown,
  pieceTimerTaken,
  resetPieceTimer,
  samePieceTimer,
  setPieceTimerMinutes,
  startPieceTimer,
  stopwatchTicks,
  timerDigitSize,
  type PieceTimer,
} from './index';
import { shapeValidationIssue } from './validate-shape';

// docs/specs/009-elements/timer-and-stopwatch.md "The time" and "The state".

const MIN = 60_000;

describe('a new piece', () => {
  it('is placed idle at its size, aspect locked, with nothing stored', () => {
    const timer = createShape('timer', 0, 0);
    expect(timer).toMatchObject({ width: 128, height: 88, aspectLocked: true, label: '' });
    expect(timer).not.toHaveProperty('pieceTimer');
    expect(createShape('stopwatch', 0, 0)).toMatchObject({ width: 104, height: 112 });
    expect(pieceTimerOf(timer)).toEqual(idlePieceTimer('timer'));
    expect(pieceTimerReadout('timer', pieceTimerOf(timer), 0)).toBe('5:00');
    expect(pieceTimerReadout('stopwatch', idlePieceTimer('stopwatch'), 0)).toBe('0:00');
    expect(isTimerPieceShape('timer') && isTimerPieceShape('stopwatch')).toBe(true);
    expect(isTimerPieceShape('world-clock')).toBe(false);
  });

  it('reads an invalid stored clock as idle, and validation names the field', () => {
    expect(pieceTimerOf({ shape: 'timer', pieceTimer: { running: 1 } })).toEqual(
      idlePieceTimer('timer'),
    );
    const bad = { ...createShape('timer', 0, 0), pieceTimer: { running: true } };
    expect(JSON.stringify(shapeValidationIssue(bad))).toContain('pieceTimer');
    const good = {
      ...createShape('stopwatch', 0, 0),
      pieceTimer: { running: false, startedAt: 0, accumulatedMs: 5, durationMs: 0 },
    };
    expect(shapeValidationIssue(good)).toBeNull();
  });
});

describe('the verbs', () => {
  const idle = idlePieceTimer('timer');

  it('counts a Timer down from its own clock, and pauses and resumes where it stood', () => {
    const run = startPieceTimer('timer', idle, 1_000);
    expect(pieceTimerShown('timer', run, 61_000)).toBe(DEFAULT_TIMER_MS - MIN);
    expect(pieceTimerPhase('timer', run, 61_000)).toBe('running');
    const held = pausePieceTimer('timer', run, 61_000);
    expect(held).toEqual({
      running: false,
      startedAt: 0,
      accumulatedMs: MIN,
      durationMs: DEFAULT_TIMER_MS,
    });
    expect(pieceTimerPhase('timer', held, 99_999)).toBe('paused');
    const again = startPieceTimer('timer', held, 200_000);
    expect(pieceTimerShown('timer', again, 230_000)).toBe(DEFAULT_TIMER_MS - MIN - 30_000);
  });

  it('runs out at zero, never below, and Restart starts again from its full length', () => {
    const run = startPieceTimer('timer', idle, 0);
    expect(pieceTimerShown('timer', run, DEFAULT_TIMER_MS + 5_000)).toBe(0);
    expect(pieceTimerPhase('timer', run, DEFAULT_TIMER_MS)).toBe('done');
    const held = pausePieceTimer('timer', run, DEFAULT_TIMER_MS + 5_000);
    expect(held.accumulatedMs).toBe(DEFAULT_TIMER_MS);
    expect(pieceTimerPhase('timer', held, 0)).toBe('done');
    const restart = startPieceTimer('timer', held, 10);
    expect(restart).toEqual({
      running: true,
      startedAt: 10,
      accumulatedMs: 0,
      durationMs: DEFAULT_TIMER_MS,
    });
  });

  it('counts a Stopwatch up, never backwards, and caps a forgotten one', () => {
    const sw = startPieceTimer('stopwatch', idlePieceTimer('stopwatch'), 1_000);
    expect(pieceTimerShown('stopwatch', sw, 4_500)).toBe(3_500);
    // A clock that went back never counts below what was counted.
    expect(pieceTimerTaken(sw, 500)).toBe(0);
    expect(pieceTimerTaken(sw, 1_000 + STOPWATCH_MAX_MS * 2)).toBe(STOPWATCH_MAX_MS);
    expect(pieceTimerPhase('stopwatch', sw, 1e12)).toBe('running');
    const held = pausePieceTimer('stopwatch', sw, 4_500);
    expect(held.accumulatedMs).toBe(3_500);
  });

  it('resets to idle and sets a new length as a new round, clamped to 1 to 120 minutes', () => {
    const run = startPieceTimer('timer', idle, 0);
    expect(resetPieceTimer(run)).toEqual(idle);
    expect(setPieceTimerMinutes(25)).toEqual({ ...idle, durationMs: 25 * MIN });
    expect(setPieceTimerMinutes(0).durationMs).toBe(MIN);
    expect(setPieceTimerMinutes(500).durationMs).toBe(120 * MIN);
    expect(clampTimerMinutes(Number.NaN)).toBe(5);
    expect(clampTimerMinutes(7.4)).toBe(7);
  });

  it('compares states field by field', () => {
    expect(samePieceTimer(idle, { ...idle })).toBe(true);
    expect(samePieceTimer(idle, { ...idle, accumulatedMs: 1 })).toBe(false);
  });
});

describe('the bounds', () => {
  const ok: PieceTimer = { running: false, startedAt: 0, accumulatedMs: 0, durationMs: 5 * MIN };
  it('takes a whole clock in range for its kind', () => {
    expect(isPieceTimer(ok, 'timer')).toBe(true);
    expect(isPieceTimer({ ...ok, durationMs: 0 }, 'stopwatch')).toBe(true);
    expect(isPieceTimer(ok, 'stopwatch')).toBe(false);
    expect(isPieceTimer({ ...ok, accumulatedMs: STOPWATCH_MAX_MS + 1 }, 'timer')).toBe(false);
    expect(isPieceTimer({ ...ok, startedAt: -1 }, 'timer')).toBe(false);
    expect(isPieceTimer('x', 'timer')).toBe(false);
  });
});

describe('the readout', () => {
  it('rounds a Timer up and a Stopwatch down, m:ss under an hour and h:mm:ss from one', () => {
    expect(formatPieceTimer(299_001, 'up')).toBe('5:00');
    expect(formatPieceTimer(299_001, 'down')).toBe('4:59');
    expect(formatPieceTimer(1, 'up')).toBe('0:01');
    expect(formatPieceTimer(0, 'up')).toBe('0:00');
    expect(formatPieceTimer(3_600_000, 'down')).toBe('1:00:00');
    expect(formatPieceTimer(3_725_000, 'down')).toBe('1:02:05');
    expect(formatPieceTimer(-5, 'down')).toBe('0:00');
  });

  it('shrinks the digits once the readout grows to h:mm:ss', () => {
    expect(timerDigitSize('timer', '59:59')).toBeGreaterThan(timerDigitSize('timer', '1:00:00'));
    expect(timerDigitSize('stopwatch', '0:00')).toBeGreaterThan(
      timerDigitSize('stopwatch', '10:00:00'),
    );
  });

  it('draws twelve ticks round the stopwatch face', () => {
    expect(stopwatchTicks()).toHaveLength(12);
  });
});
