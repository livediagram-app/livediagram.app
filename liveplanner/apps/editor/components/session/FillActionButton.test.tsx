// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILL_DRAIN_MS,
  FILL_HOLD_MS,
  FILL_IN_MS,
  FILL_STILL_MS,
  FillActionButton,
} from './FillActionButton';

// docs/specs/026-plan/session-tabs.md "The action bar": the fill button fills, ticks, drains, and confirms as the fill
// completes; under reduced motion it swaps to the tick at once.
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const phase = () => screen.getByRole('button').getAttribute('data-fill-phase');

describe('FillActionButton', () => {
  it('fills, confirms as the fill completes, holds the tick, drains, and ignores a press while it runs', () => {
    const onConfirm = vi.fn();
    render(<FillActionButton label="Refined" shortcut="r" onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: /Refined/ });
    expect(button.getAttribute('aria-keyshortcuts')).toBe('R');
    fireEvent.click(button);
    expect(phase()).toBe('fill');
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FILL_IN_MS));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('done');
    act(() => vi.advanceTimersByTime(FILL_HOLD_MS));
    expect(phase()).toBe('drain');
    act(() => vi.advanceTimersByTime(FILL_DRAIN_MS));
    expect(phase()).toBe('idle');
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(FILL_IN_MS));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('under reduced motion confirms at once and shows the tick briefly, with no fill', () => {
    reduced = true;
    const onConfirm = vi.fn();
    render(<FillActionButton label="Refined" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('done');
    act(() => vi.advanceTimersByTime(FILL_STILL_MS));
    expect(phase()).toBe('idle');
  });

  it('does nothing while disabled, and leaves no timer behind when it goes', () => {
    const onConfirm = vi.fn();
    const { rerender, unmount } = render(
      <FillActionButton label="Refined" disabled onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(phase()).toBe('idle');
    rerender(<FillActionButton label="Refined" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button'));
    unmount();
    act(() => vi.advanceTimersByTime(FILL_IN_MS * 4));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
