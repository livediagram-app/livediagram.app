// @vitest-environment jsdom
// The page loader (docs/specs/030-knowledgebase/page-surface.md "Switching pages", Work Tracker 1465): it holds the
// page area at once but shows nothing until the wait has lasted PAGE_LOAD_VEIL_DELAY_MS.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_LOAD_VEIL_DELAY_MS, PageLoadVeil } from './PageLoadVeil';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PageLoadVeil', () => {
  it('takes presses at once but shows nothing before the delay', () => {
    vi.useFakeTimers();
    const { container } = render(<PageLoadVeil />);
    const veil = container.querySelector('[data-page-load-veil]')!;
    expect(veil.getAttribute('aria-busy')).toBe('true');
    expect(veil.className).toMatch(/\babsolute inset-0\b/);
    expect(veil.className).not.toMatch(/\bbg-white\b/);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(PAGE_LOAD_VEIL_DELAY_MS - 1);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows its spinner and "Loading page…" once the wait has lasted the delay', () => {
    vi.useFakeTimers();
    const { container } = render(<PageLoadVeil />);
    act(() => {
      vi.advanceTimersByTime(PAGE_LOAD_VEIL_DELAY_MS);
    });
    expect(screen.getByRole('status').textContent).toBe('Loading page…');
    expect(container.querySelector('[data-page-load-veil]')!.className).toMatch(/\bbg-white\b/);
  });
});
