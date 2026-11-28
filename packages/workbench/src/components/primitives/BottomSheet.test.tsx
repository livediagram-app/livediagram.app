// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';

// docs/specs/007-editor/editor-app.md "Menus are bottom sheets on a phone": a host closing the sheet from inside (a
// pick made) sets `closing`, and it slides out as a swipe would before onClose.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BottomSheet', () => {
  it('slides out once closing turns on, then calls onClose', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const sheet = (closing: boolean) => (
      <BottomSheet onClose={onClose} zClassName="z-50" closing={closing} aria-label="Sheet">
        <p>Body</p>
      </BottomSheet>
    );
    const { rerender } = render(sheet(false));
    expect(screen.getByText('Body')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).not.toHaveBeenCalled();
    rerender(sheet(true));
    const el = document.querySelector<HTMLElement>('[data-bottom-sheet]')!;
    expect(el.style.transform).toContain('translateY');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
