// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md "The Session strip": the Timer, always there for an
// editor, only while one runs for a view-role visitor, and showing its clock while a timer runs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@livehuddle/document';
import {
  SessionClusterStrip,
  sessionStripTools,
  sessionToolsForSurface,
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
    <SessionClusterStrip timer={null} canStart open={null} onToggle={onToggle} {...overrides} />,
  );
  return onToggle;
}

describe('SessionClusterStrip', () => {
  // The Poll and the Vote left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements",
  // "The Vote").
  it('gives an editor the Timer while nothing runs, as an icon, and no Poll or Vote', () => {
    strip();
    expect(screen.getByRole('button', { name: 'Open Timer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Vote/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Poll/ })).toBeNull();
    expect(screen.queryByText(/\d:\d\d/)).toBeNull();
  });

  it('shows nothing to a view-role visitor while nothing runs', () => {
    const { container } = render(
      <SessionClusterStrip timer={null} canStart={false} open={null} onToggle={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows a view-role visitor the running timer', () => {
    strip({ canStart: false, timer: paused });
    expect(screen.getByRole('button', { name: /^Timer / })).toBeTruthy();
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

  it('toggles the Timer with its id and button, pressed while open', () => {
    const onToggle = strip({ open: 'session-timer', timer: paused });
    const timer = screen.getByRole('button', { name: /^Timer / });
    expect(timer.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(timer);
    expect(onToggle).toHaveBeenCalledWith('session-timer', timer);
  });

  it('shows nothing when the mode offers no Timer', () => {
    strip({ canStart: false, offersTimer: false, timer: paused });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('sessionStripTools', () => {
  it('offers the Timer on a meeting board, none in Diagram or Draw', () => {
    expect(sessionStripTools('workshop')).toEqual({ timer: true });
    expect(sessionStripTools(undefined)).toBeNull();
    expect(sessionStripTools('diagram')).toBeNull();
    expect(sessionStripTools('draw')).toBeNull();
  });
});

describe('stripCanStart', () => {
  it('offers the idle tools to an editor, never to a view role', () => {
    expect(stripCanStart(false)).toBe(true);
    expect(stripCanStart(true)).toBe(false);
  });
});

describe('stripSegmentGone', () => {
  const idle = { timer: false };
  const all = { timer: true };
  const workshop = sessionStripTools('workshop');

  it('keeps nothing open when no popover is', () => {
    expect(stripSegmentGone({ segment: null, tools: null, readOnly: false, running: idle })).toBe(
      false,
    );
  });

  it('closes when the strip or the Timer leaves (a mode switch)', () => {
    const at = { readOnly: false, running: all, segment: 'session-timer' } as const;
    expect(stripSegmentGone({ ...at, tools: null })).toBe(true);
    expect(stripSegmentGone({ ...at, tools: { timer: false } })).toBe(true);
  });

  it("keeps an editor's idle popover open where the strip offers starting one", () => {
    expect(
      stripSegmentGone({
        segment: 'session-timer',
        tools: workshop,
        readOnly: false,
        running: idle,
      }),
    ).toBe(false);
  });

  it("closes a view role's popover when its tool ends", () => {
    const at = { tools: workshop, readOnly: true };
    expect(stripSegmentGone({ ...at, segment: 'session-timer', running: all })).toBe(false);
    expect(stripSegmentGone({ ...at, segment: 'session-timer', running: idle })).toBe(true);
  });
});

describe('an embed has no Session strip', () => {
  it('hands the canvas chrome no session tools in an embed, and the tools elsewhere', () => {
    const tools = { timer: null };
    expect(sessionToolsForSurface(tools, true)).toBeUndefined();
    expect(sessionToolsForSurface(tools, false)).toBe(tools);
  });

  it('is what the editor host feeds the canvas chrome, so the Timer button cannot come back', () => {
    const host = readFileSync(join(__dirname, 'EditorCanvasHost.tsx'), 'utf8');
    expect(host).toContain('sessionTools={sessionToolsForSurface(sessionTools, embedMode)}');
    expect(host).not.toMatch(/sessionTools=\{sessionTools\}/);
  });
});
