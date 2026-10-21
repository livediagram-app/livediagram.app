// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md "The Session strip": Timer, Vote and Poll in one strip,
// always there for an editor, only the running ones for a view-role visitor, and the Timer showing
// its clock while a timer runs.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@liveplanner/document';
import {
  SessionClusterStrip,
  sessionStripTools,
  stripCanStart,
  stripSegmentGone,
} from './SessionClusterStrip';

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

  it('carries your dots left on the Vote button while casting is open', () => {
    strip({ voteRunning: true, voteDotsLeft: 2 });
    const vote = screen.getByRole('button', { name: 'Open Vote (2 dots left)' });
    expect(vote.textContent).toContain('2');
  });

  it('leaves Poll out where the mode does not offer it', () => {
    strip({ offersPoll: false, pollRunning: true });
    expect(screen.queryByRole('button', { name: /Poll/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Timer' })).toBeTruthy();
  });
});

describe('Pages: a running Vote or Poll only', () => {
  // Pages passes canStart false and offersTimer false (sessionStripTools runningOnly).
  const pages = { canStart: false, offersTimer: false } as const;

  it('shows nothing while nothing runs, even to an editor', () => {
    strip(pages);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the running vote and poll so they can be controlled', () => {
    strip({ ...pages, voteRunning: true, pollRunning: true });
    expect(screen.getByRole('button', { name: 'Open Vote' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Poll' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Timer/ })).toBeNull();
  });

  it('shows only the one that runs', () => {
    strip({ ...pages, pollRunning: true });
    expect(screen.getByRole('button', { name: 'Open Poll' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Vote/ })).toBeNull();
  });

  it('never shows a Timer, running or not', () => {
    strip({ ...pages, timer: paused });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('sessionStripTools', () => {
  it('offers all three in Workshop, Timer and Vote in Plan, none in Diagram or Draw', () => {
    expect(sessionStripTools('workshop')).toEqual({ timer: true, vote: true, poll: true });
    expect(sessionStripTools('plan')).toEqual({ timer: true, vote: true, poll: false });
    expect(sessionStripTools(undefined)).toBeNull();
    expect(sessionStripTools('diagram')).toBeNull();
    expect(sessionStripTools('draw')).toBeNull();
  });

  it('offers Pages a running Vote or Poll only', () => {
    expect(sessionStripTools('pages')).toEqual({
      timer: false,
      vote: true,
      poll: true,
      runningOnly: true,
    });
  });

});

describe('stripCanStart', () => {
  it('offers the idle tools to an editor, never in a running-only strip or to a view role', () => {
    expect(stripCanStart(sessionStripTools('workshop')!, false)).toBe(true);
    expect(stripCanStart(sessionStripTools('workshop')!, true)).toBe(false);
    expect(stripCanStart(sessionStripTools('pages')!, false)).toBe(false);
  });
});

describe('stripSegmentGone', () => {
  const idle = { timer: false, vote: false, poll: false };
  const all = { timer: true, vote: true, poll: true };
  const pages = sessionStripTools('pages');
  const workshop = sessionStripTools('workshop');

  it('keeps nothing open when no popover is', () => {
    expect(stripSegmentGone({ segment: null, tools: null, readOnly: false, running: idle })).toBe(
      false,
    );
  });

  it('closes when the strip or that tool leaves (a mode switch)', () => {
    const at = { readOnly: false, running: all };
    expect(stripSegmentGone({ ...at, segment: 'session-vote', tools: null })).toBe(true);
    expect(
      stripSegmentGone({ ...at, segment: 'session-poll', tools: sessionStripTools('plan') }),
    ).toBe(true);
    expect(stripSegmentGone({ ...at, segment: 'session-timer', tools: pages })).toBe(true);
  });

  it("keeps an editor's idle popover open where the strip offers starting one", () => {
    for (const segment of ['session-timer', 'session-vote', 'session-poll'] as const)
      expect(stripSegmentGone({ segment, tools: workshop, readOnly: false, running: idle })).toBe(
        false,
      );
  });

  it("closes an editor's Vote and Poll in Pages when the activity ends, never offering the set-up", () => {
    const at = { tools: pages, readOnly: false };
    expect(stripSegmentGone({ ...at, segment: 'session-vote', running: all })).toBe(false);
    expect(stripSegmentGone({ ...at, segment: 'session-vote', running: idle })).toBe(true);
    expect(stripSegmentGone({ ...at, segment: 'session-poll', running: all })).toBe(false);
    expect(stripSegmentGone({ ...at, segment: 'session-poll', running: idle })).toBe(true);
  });

  it("closes a view role's popover when its tool ends", () => {
    const at = { tools: workshop, readOnly: true };
    expect(stripSegmentGone({ ...at, segment: 'session-timer', running: all })).toBe(false);
    expect(stripSegmentGone({ ...at, segment: 'session-timer', running: idle })).toBe(true);
  });
});
