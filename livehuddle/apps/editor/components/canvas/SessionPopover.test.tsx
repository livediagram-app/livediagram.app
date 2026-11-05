// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md "The Session strip": what the Timer button opens. Set-up
// while idle, the live dial while running, the dial alone for a view-role visitor, and the
// facilitator lock.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@livehuddle/document';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { SessionPopover, type SessionPopoverProps } from './SessionPopover';

afterEach(cleanup);

// jsdom has no ResizeObserver; the popover measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function session(overrides: Partial<SessionToolsProps> = {}): SessionToolsProps {
  return {
    timer: null,
    onStartTimer: vi.fn(),
    onPauseTimer: vi.fn(),
    onResumeTimer: vi.fn(),
    onResetTimer: vi.fn(),
    onClearTimer: vi.fn(),
    onExtendTimer: vi.fn(),
    ...overrides,
  };
}

function popover(overrides: Partial<SessionPopoverProps> = {}) {
  const props: SessionPopoverProps = {
    segment: 'session-timer',
    onClose: vi.fn(),
    session: session(),
    readOnly: false,
    ...overrides,
  };
  render(<SessionPopover {...props} />);
  return props;
}

const paused: TabTimer = {
  mode: 'countdown',
  running: false,
  durationMs: 300_000,
  frozenMs: 125_000,
};

describe('SessionPopover', () => {
  it('opens the Timer set-up while no timer runs', () => {
    const p = popover();
    fireEvent.click(screen.getByRole('button', { name: /Start 5 min countdown/ }));
    expect(p.session.onStartTimer).toHaveBeenCalledWith('countdown', 300_000);
  });

  it('opens the live Timer with its controls while one runs', () => {
    const p = popover({ session: session({ timer: paused }) });
    expect(screen.getByText('2:05')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(p.session.onResumeTimer).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '+1 min' }));
    expect(p.session.onExtendTimer).toHaveBeenCalledWith(60_000);
  });

  it('gives a view-role visitor the dial and no controls', () => {
    popover({ readOnly: true, session: session({ timer: paused }) });
    expect(screen.getByText('2:05')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+1 min' })).toBeNull();
  });

  it('locks the set-up under the facilitator note while somebody else runs the session', () => {
    popover({ session: session({ facilitatedBy: 'Sam' }) });
    expect(screen.getByText('Sam')).toBeTruthy();
    const start = screen.getByRole('button', { name: /Start 5 min countdown/ });
    expect(start.closest('fieldset')?.disabled).toBe(true);
  });

  it('offers a view-role visitor nothing while no timer runs', () => {
    const { container } = render(
      <SessionPopover segment="session-timer" onClose={() => {}} session={session()} readOnly />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('closes a running timer on an outside press, even while holding', () => {
    const p = popover({ session: session({ timer: paused }) });
    fireEvent.pointerDown(document.body);
    expect(p.onClose).toHaveBeenCalled();
  });
});
