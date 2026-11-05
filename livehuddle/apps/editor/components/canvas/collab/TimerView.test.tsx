// @vitest-environment jsdom

// The Timer and Stopwatch faces (docs/specs/009-elements/timer-and-stopwatch.md): the readout, the state word, the
// controls as the piece's own buttons, and who sees them ("Share roles").

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyElementDelta,
  createShape,
  type ElementDelta,
  type ShapeElement,
} from '@livehuddle/document';
import { PIECE_CONTROL_ATTR } from '@/lib/piece-control';
import { setTimerPieceControls } from '@/lib/timer-piece-controls';
import { runningTickers } from '@/lib/timer-ticker';
import { TimerView } from './TimerView';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);

const piece = (kind: 'timer' | 'stopwatch', over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), id: 'p', ...over }) as ShapeElement;

let sent: { id: string; delta: ElementDelta }[] = [];
const take = (allowed: boolean) =>
  act(() =>
    setTimerPieceControls({ takePart: allowed, send: (id, delta) => sent.push({ id, delta }) }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  sent = [];
});

afterEach(() => {
  cleanup();
  act(() => setTimerPieceControls(null));
  vi.useRealTimers();
});

describe('TimerView', () => {
  it('draws a placement preview idle, with no buttons', () => {
    take(true);
    render(<TimerView element={piece('timer')} />);
    expect(screen.getByRole('img', { name: 'Timer, 5:00 left, Ready' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a Viewer the time and no buttons', () => {
    take(false);
    render(<TimerView element={piece('timer')} live />);
    expect(screen.getByRole('img', { name: 'Timer, 5:00 left, Ready' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives an Editor or Participant Start and Set, each a piece control', () => {
    take(true);
    render(<TimerView element={piece('timer')} live />);
    const start = screen.getByRole('button', { name: 'Start Timer' });
    expect(start.hasAttribute(PIECE_CONTROL_ATTR)).toBe(true);
    expect(screen.getByRole('button', { name: 'Set Timer Length' })).toBeTruthy();
    // Nothing to reset before it has run.
    expect(screen.queryByRole('button', { name: 'Reset Timer' })).toBeNull();
  });

  it('sends a press as a piece-timer delta, and counts down from it on the one ticker', () => {
    take(true);
    let el = piece('timer');
    const { rerender } = render(<TimerView element={el} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Timer' }));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.id).toBe('p');
    expect(sent[0]!.delta).toEqual({
      kind: 'piece-timer',
      state: { running: true, startedAt: T0, accumulatedMs: 0, durationMs: 300_000 },
    });
    el = applyElementDelta(el, sent[0]!.delta) as ShapeElement;
    rerender(<TimerView element={el} live />);
    expect(runningTickers()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole('img', { name: 'Timer, 3:59 left, Running' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause Timer' })).toBeTruthy();
  });

  it("reaches Time's Up, stops ticking and offers Restart", () => {
    take(true);
    const el = piece('timer', {
      pieceTimer: { running: true, startedAt: T0, accumulatedMs: 0, durationMs: 60_000 },
    });
    const { container } = render(<TimerView element={el} live />);
    act(() => {
      vi.advanceTimersByTime(60_250);
    });
    expect(screen.getByRole('img', { name: "Timer, 0:00 left, Time's Up" })).toBeTruthy();
    expect(container.querySelector('.lh-timer-flash')).toBeTruthy();
    expect(runningTickers()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Restart Timer' }));
    expect(sent.at(-1)!.delta).toMatchObject({
      state: { running: true, accumulatedMs: 0, durationMs: 60_000 },
    });
  });

  it('sets a new length from the popover, resetting to it', async () => {
    // The popover loads on the first press of Set: real timers, so the wait for it can settle.
    vi.useRealTimers();
    take(true);
    render(<TimerView element={piece('timer')} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Set Timer Length' }));
    fireEvent.click(await screen.findByRole('button', { name: '10 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'One minute more' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Timer' }));
    expect(sent.at(-1)!.delta).toEqual({
      kind: 'piece-timer',
      state: { running: false, startedAt: 0, accumulatedMs: 0, durationMs: 660_000 },
    });
    expect(screen.queryByRole('dialog', { name: 'Timer length' })).toBeNull();
  });
});

// docs/specs/008-canvas/avatar-mode.md "Clicking a piece": a Timer or Stopwatch is a `use` piece, so a click
// anywhere on its face while walking presses its main control, Start or Pause, never the reader.
describe('the main action in Avatar mode', () => {
  it('marks Start, then Pause, as the main control on both faces, and nothing else', () => {
    take(true);
    for (const kind of ['timer', 'stopwatch'] as const) {
      const name = kind === 'timer' ? 'Timer' : 'Stopwatch';
      const { container, unmount } = render(
        <TimerView
          element={piece(kind, {
            pieceTimer: {
              running: true,
              startedAt: T0,
              accumulatedMs: 0,
              durationMs: kind === 'timer' ? 300_000 : 0,
            },
          })}
          live
        />,
      );
      const mains = container.querySelectorAll('[data-piece-main]');
      expect(mains).toHaveLength(1);
      expect(mains[0]!.getAttribute('aria-label')).toBe(`Pause ${name}`);
      unmount();
    }
    const { container } = render(<TimerView element={piece('timer')} live />);
    expect(container.querySelector('[data-piece-main]')!.getAttribute('aria-label')).toBe(
      'Start Timer',
    );
  });

  it('gives a Viewer no main control, so a click falls to the reader', () => {
    take(false);
    const { container } = render(<TimerView element={piece('stopwatch')} live />);
    expect(container.querySelector('[data-piece-main]')).toBeNull();
  });
});

describe('the Stopwatch face', () => {
  it('counts up while running and offers Reset once paused, with no Set', () => {
    take(true);
    const el = piece('stopwatch', {
      pieceTimer: { running: false, startedAt: 0, accumulatedMs: 75_000, durationMs: 0 },
    });
    render(<TimerView element={el} live />);
    expect(screen.getByRole('img', { name: 'Stopwatch, 1:15 taken, Paused' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set Timer Length' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Stopwatch' }));
    expect(sent.at(-1)!.delta).toEqual({
      kind: 'piece-timer',
      state: { running: false, startedAt: 0, accumulatedMs: 0, durationMs: 0 },
    });
  });

  it('ticks a running Stopwatch once a second', () => {
    take(false);
    const el = piece('stopwatch', {
      pieceTimer: { running: true, startedAt: T0, accumulatedMs: 0, durationMs: 0 },
    });
    render(<TimerView element={el} live />);
    act(() => {
      vi.advanceTimersByTime(3_100);
    });
    expect(screen.getByRole('img', { name: 'Stopwatch, 0:03 taken, Running' })).toBeTruthy();
  });
});
