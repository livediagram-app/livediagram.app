// @vitest-environment jsdom

// The chip row the layout gallery and livedesign's display library share: one chip pressed at a time, each with its
// count, a press choosing its category.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryChips } from './CategoryChips';

afterEach(cleanup);

const chips = [
  { id: 'all', label: 'All', count: 90 },
  { id: 'script', label: 'Script', count: 21 },
];

describe('CategoryChips', () => {
  it('marks the chosen chip pressed and shows each count', () => {
    render(
      <CategoryChips chips={chips} value="script" onChoose={() => {}} ariaLabel="Categories" />,
    );
    expect(screen.getByRole('group', { name: 'Categories' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Script\s*21$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /^All\s*90$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('scrolls sideways by default and wraps when asked', () => {
    const { rerender } = render(
      <CategoryChips chips={chips} value="all" onChoose={() => {}} ariaLabel="Categories" />,
    );
    const row = screen.getByRole('group', { name: 'Categories' });
    expect(row.className).toContain('overflow-x-auto');
    rerender(
      <CategoryChips chips={chips} value="all" onChoose={() => {}} ariaLabel="Categories" wrap />,
    );
    expect(row.className).toContain('flex-wrap');
    expect(row.className).not.toContain('overflow-x-auto');
  });

  it('takes a mouse wheel sideways while it has chips past the edge, and passes it on at the end', () => {
    const { rerender } = render(
      <CategoryChips chips={chips} value="all" onChoose={() => {}} ariaLabel="Categories" />,
    );
    const row = screen.getByRole('group', { name: 'Categories' });
    expect(row.className).toContain('scroll-edge-fade');
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 560 });
    const wheel = (init: WheelEventInit) => {
      const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
      row.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(wheel({ deltaY: 120 })).toBe(true);
    expect(row.scrollLeft).toBe(120);
    expect(wheel({ deltaY: 3, deltaMode: 1 })).toBe(true);
    expect(row.scrollLeft).toBe(168);
    expect(wheel({ deltaY: 1000 })).toBe(true);
    expect(row.scrollLeft).toBe(340);
    // At the end, a pinch and a sideways swipe are not the row's to take.
    expect(wheel({ deltaY: 50 })).toBe(false);
    expect(wheel({ deltaY: -50, ctrlKey: true })).toBe(false);
    expect(wheel({ deltaX: 80, deltaY: 10 })).toBe(false);
    expect(wheel({ deltaY: -400 })).toBe(true);
    expect(row.scrollLeft).toBe(0);
    // Nothing past the edge, or a wrapped row: the wheel is left alone.
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 560 });
    expect(wheel({ deltaY: 120 })).toBe(false);
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 900 });
    rerender(
      <CategoryChips chips={chips} value="all" onChoose={() => {}} ariaLabel="Categories" wrap />,
    );
    expect(wheel({ deltaY: 120 })).toBe(false);
  });

  it('chooses a category on a press', () => {
    const onChoose = vi.fn();
    render(<CategoryChips chips={chips} value="all" onChoose={onChoose} ariaLabel="Categories" />);
    fireEvent.click(screen.getByRole('button', { name: /^Script\s*21$/ }));
    expect(onChoose).toHaveBeenCalledWith('script');
  });
});
