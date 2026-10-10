// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md "The Session strip": Timer, Vote and Poll in one strip,
// always there for an editor, only the running ones for a view-role visitor, and the Timer showing
// its clock while a timer runs.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@livediagram/document';
import { SessionClusterStrip } from './SessionClusterStrip';

afterEach(cleanup);

const paused: TabTimer = {
  mode: 'countdown',
  running: false,
  durationMs: 300_000,
  frozenMs: 125_000,
};

function strip(overrides: Partial<Parameters<typeof SessionClusterStrip>[0]> = {}) {
  const onToggle = vi.fn();
  render(
    <SessionClusterStrip
      timer={null}
      voteRunning={false}
      pollRunning={false}
      canStart
      open={null}
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return onToggle;
}

describe('SessionClusterStrip', () => {
  it('gives an editor all three tools while nothing runs, as icons', () => {
    strip();
    expect(screen.getByRole('button', { name: 'Open Timer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start a Vote' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start a Poll' })).toBeTruthy();
    expect(screen.queryByText(/\d:\d\d/)).toBeNull();
  });

  it('shows nothing to a view-role visitor while nothing runs', () => {
    const { container } = render(
      <SessionClusterStrip
        timer={null}
        voteRunning={false}
        pollRunning={false}
        canStart={false}
        open={null}
        onToggle={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows a view-role visitor only the running tools', () => {
    strip({ canStart: false, timer: paused, voteRunning: true });
    expect(screen.getByRole('button', { name: /^Timer / })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Vote' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Poll/ })).toBeNull();
  });

  it('shows the running timer clock on its button', () => {
    strip({ timer: paused });
    const button = screen.getByRole('button', { name: 'Timer 2:05' });
    expect(button.textContent).toContain('2:05');
  });

  it('names a stopwatch as one', () => {
    strip({ timer: { mode: 'stopwatch', running: false, frozenMs: 61_000 } });
    expect(screen.getByRole('button', { name: 'Stopwatch 1:01' })).toBeTruthy();
  });

  it('toggles each segment with its own id and button, pressed while open', () => {
    const onToggle = strip({ open: 'session-vote', voteRunning: true, timer: paused });
    const vote = screen.getByRole('button', { name: 'Open Vote' });
    expect(vote.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(vote);
    expect(onToggle).toHaveBeenCalledWith('session-vote', vote);
    const timer = screen.getByRole('button', { name: /^Timer / });
    fireEvent.click(timer);
    expect(onToggle).toHaveBeenCalledWith('session-timer', timer);
    const poll = screen.getByRole('button', { name: 'Start a Poll' });
    fireEvent.click(poll);
    expect(onToggle).toHaveBeenCalledWith('session-poll', poll);
  });
});
