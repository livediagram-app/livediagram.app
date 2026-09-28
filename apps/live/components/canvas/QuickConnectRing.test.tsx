// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@livediagram/tailwind-config/motion';
import { QuickConnectRing } from './QuickConnectRing';

// The ring's menu (docs/specs/008-canvas/canvas-and-palette.md) unfolds out of the plus on open and folds
// back before it unmounts, so both transitions actually run.

function ring(open: boolean) {
  return (
    <QuickConnectRing
      x={0}
      y={0}
      placement="right"
      zoom={1}
      open={open}
      onToggle={vi.fn()}
      onClose={vi.fn()}
      onOpen={vi.fn()}
      onSpawn={vi.fn()}
      onArrowPointerDown={vi.fn()}
      onPencil={vi.fn()}
    />
  );
}

// The menu is the element carrying the unfold transform.
const menu = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>('div')].find((d) => d.style.transformOrigin !== '');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('QuickConnectRing menu', () => {
  it('stays unmounted while closed', () => {
    const { container } = render(ring(false));
    expect(menu(container)).toBeUndefined();
  });

  it('mounts folded on open, then unfolds on the next frame', () => {
    const { container, rerender } = render(ring(false));
    rerender(ring(true));
    expect(menu(container)?.style.opacity).toBe('0');
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(menu(container)?.style.opacity).toBe('1');
  });

  it('folds at once on close, and unmounts once the fold has run', () => {
    const { container, rerender } = render(ring(true));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    rerender(ring(false));
    expect(menu(container)?.style.opacity).toBe('0');
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.short);
    });
    expect(menu(container)).toBeUndefined();
  });

  it('reopening mid-fold unfolds again instead of unmounting', () => {
    const { container, rerender } = render(ring(true));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    rerender(ring(false));
    rerender(ring(true));
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersByTime(MOTION_MS.short);
    });
    expect(menu(container)?.style.opacity).toBe('1');
  });
});
