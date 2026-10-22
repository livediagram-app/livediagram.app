// @vitest-environment jsdom

// The Agenda face (docs/specs/012-collaboration/agenda.md "The face"): the live
// time left is the tab timer's only while it is the countdown the segment
// started, the running segment is not restarted by a press and says so, and
// Reset Agenda puts the card back to "not started".

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement, TabTimer } from '@livediagram/document';
import { AgendaFace } from './AgendaFace';
import { agendaStepLabel } from './agenda/AgendaStep';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

const agenda = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'a',
  type: 'shape',
  shape: 'agenda',
  x: 0,
  y: 0,
  width: 320,
  height: 300,
  agendaItems: [
    { label: 'Intro', minutes: 5 },
    { label: 'Retro', minutes: 10 },
  ],
  ...over,
});
// The countdown the Retro segment started at 990_000: 10 minutes, ending at 1_590_000, so 9:50 is left.
const theirs: TabTimer = {
  mode: 'countdown',
  running: true,
  durationMs: 600_000,
  anchorAt: 1_590_000,
  startedAt: 990_000,
};

const show = (el: ShapeElement, timer: TabTimer | undefined, extra = {}) =>
  render(
    <AgendaFace
      element={el}
      label=""
      textColor="#0f172a"
      surface="#ffffff"
      timer={timer}
      onPressItem={vi.fn()}
      {...extra}
    />,
  );

describe('AgendaFace', () => {
  it('shows the time left of the countdown the segment started', () => {
    show(agenda({ agendaCurrent: 1, agendaTimerStartedAt: 990_000 }), theirs);
    expect(screen.getByText('9:50')).toBeTruthy();
  });

  it('ignores a tab timer the segment did not start', () => {
    // Another countdown, started from the Timer menu later.
    show(agenda({ agendaCurrent: 1, agendaTimerStartedAt: 990_000 }), {
      ...theirs,
      startedAt: 995_000,
    });
    expect(screen.queryByText('9:50')).toBeNull();
    expect(screen.getAllByText('10m').length).toBeGreaterThan(0);
  });

  it('ignores a stopwatch, even one with the same start', () => {
    show(agenda({ agendaCurrent: 1, agendaTimerStartedAt: 990_000 }), {
      mode: 'stopwatch',
      running: true,
      anchorAt: 990_000,
      startedAt: 990_000,
    });
    expect(screen.queryByText('0:10')).toBeNull();
  });

  it('does not restart the running segment, and says it is running', () => {
    const onPressItem = vi.fn();
    show(agenda({ agendaCurrent: 1, agendaTimerStartedAt: 990_000 }), theirs, { onPressItem });
    const running = screen.getByRole('button', { name: 'Retro, running, 10 minutes' });
    expect((running as HTMLButtonElement).disabled).toBe(true);
    // The finished segment can be started again, and says so.
    expect(screen.getByRole('button', { name: 'Start Intro again, done, 5 minutes' })).toBeTruthy();
  });

  it('resets from its own menu while a segment is current', () => {
    const onReset = vi.fn();
    show(agenda({ agendaCurrent: 0, agendaTimerStartedAt: 990_000 }), undefined, { onReset });
    fireEvent.click(screen.getByRole('button', { name: 'Agenda options' }));
    fireEvent.click(screen.getByText('Reset Agenda'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('has no menu of its own before the agenda starts', () => {
    show(agenda(), undefined, { onReset: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Agenda options' })).toBeNull();
  });
});

describe('agendaStepLabel', () => {
  const base = { name: 'Intro', minutes: 5 };
  it('names the state and what a press does', () => {
    expect(agendaStepLabel({ ...base, state: 'ahead', running: false, pressable: true })).toBe(
      'Start Intro, 5 minutes',
    );
    expect(agendaStepLabel({ ...base, state: 'current', running: false, pressable: true })).toBe(
      'Restart Intro, current, 5 minutes',
    );
    expect(agendaStepLabel({ ...base, state: 'current', running: true, pressable: false })).toBe(
      'Intro, running, 5 minutes',
    );
    expect(agendaStepLabel({ ...base, state: 'ahead', running: false, pressable: false })).toBe(
      'Intro, not started, 5 minutes',
    );
    expect(agendaStepLabel({ ...base, state: 'done', running: false, pressable: false })).toBe(
      'Intro, done, 5 minutes',
    );
  });
});
