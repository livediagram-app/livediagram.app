// @vitest-environment jsdom

// The session panes' wiring (the set-up and live tools the Session strip's popovers open,
// docs/specs/012-collaboration/session-tools.md): each control calls the right session verb with
// the right arguments. The dial
// maths and phase logic are covered as pure functions in
// session-studio.test.ts; this file is about the buttons.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@livehuddle/document';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { TimerPane } from './TimerPane';

function Timer(p: SessionToolsProps) {
  return <TimerPane {...p} />;
}

function props(overrides: Partial<SessionToolsProps> = {}) {
  return {
    timer: null,
    onStartTimer: vi.fn(),
    onPauseTimer: vi.fn(),
    onResumeTimer: vi.fn(),
    onResetTimer: vi.fn(),
    onClearTimer: vi.fn(),
    onExtendTimer: vi.fn(),
    ...overrides,
  } satisfies SessionToolsProps;
}

const running: TabTimer = {
  mode: 'countdown',
  running: true,
  durationMs: 300_000,
  anchorAt: Date.now() + 120_000,
};

afterEach(cleanup);

describe('session panes', () => {
  it('starts a countdown at the preset picked', () => {
    const p = props();
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '10m' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 10 min countdown/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('countdown', 600_000);
  });

  it('sets the length from the dial with the keyboard', () => {
    const p = props();
    render(<Timer {...p} />);
    const dial = screen.getByRole('slider', { name: /Countdown length/ });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    expect(dial.getAttribute('aria-valuenow')).toBe('10');
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(dial.getAttribute('aria-valuenow')).toBe('1');
  });

  it('starts a stopwatch from the Stopwatch mode', () => {
    const p = props();
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Stopwatch' }));
    fireEvent.click(screen.getByRole('button', { name: /Start stopwatch/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('stopwatch');
  });

  it('drives a running countdown: extend, pause, reset, end', () => {
    const p = props({ timer: running });
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+1 min' }));
    expect(p.onExtendTimer).toHaveBeenCalledWith(60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(p.onPauseTimer).toHaveBeenCalled();
    expect(p.onResetTimer).toHaveBeenCalled();
    expect(p.onClearTimer).toHaveBeenCalled();
  });
});
