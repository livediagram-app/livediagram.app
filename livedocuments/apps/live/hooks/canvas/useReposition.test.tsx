// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReposition } from './useReposition';

// A floating element stays on its anchor: measured once before paint, then on every resize and every
// scroll (captured, so nested scrollers count), re-attached when the measure changes, detached on unmount.
describe('useReposition', () => {
  it('measures on mount, on resize and on a nested scroll', () => {
    const measure = vi.fn();
    renderHook(() => useReposition(measure));
    expect(measure).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    expect(measure).toHaveBeenCalledTimes(2);
    const nested = document.body.appendChild(document.createElement('div'));
    nested.dispatchEvent(new Event('scroll'));
    expect(measure).toHaveBeenCalledTimes(3);
  });

  it('re-measures with a new measure and drops the old one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ m }) => useReposition(m), { initialProps: { m: first } });
    rerender({ m: second });
    expect(second).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('keeps one subscription while the measure is the same', () => {
    const measure = vi.fn();
    const { rerender } = renderHook(() => useReposition(measure));
    rerender();
    rerender();
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('stops measuring on unmount', () => {
    const measure = vi.fn();
    const { unmount } = renderHook(() => useReposition(measure));
    unmount();
    window.dispatchEvent(new Event('resize'));
    expect(measure).toHaveBeenCalledTimes(1);
  });
});
