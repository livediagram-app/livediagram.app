// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@livedesign/tailwind-config/motion';
import { QuickConnectRing } from './QuickConnectRing';

// The ring's menu (docs/specs/008-canvas/canvas-and-palette.md) unfolds out of the plus on open and folds
// back before it unmounts, so both transitions actually run.

function ring(open: boolean, extra: Partial<Parameters<typeof QuickConnectRing>[0]> = {}) {
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
      {...extra}
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

// A ring beside an element that reaches the edge of a phone fanned its menu past the edge, out of reach
// (docs/specs/008-canvas/canvas-and-palette.md "Quick add + connect").
describe('QuickConnectRing menu on a narrow screen', () => {
  const place = (plusX: number) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160);
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(plusX - 12, 400, 24, 24),
    );
  };
  afterEach(() => vi.restoreAllMocks());

  it('is nudged back inside the right edge', () => {
    place(359);
    const { container } = render(ring(true));
    // Natural left 359 + 20 = 379, so its right edge 419 overshoots 390 less the margin.
    expect(menu(container)?.style.translate).toMatch(/^-\d+(\.\d+)?px 0px$/);
    const dx = parseFloat(menu(container)!.style.translate);
    expect(379 + 40 + dx).toBeLessThanOrEqual(390);
  });

  it('is left where it is when it fits', () => {
    place(200);
    const { container } = render(ring(true));
    expect(menu(container)?.style.translate).toBe('');
  });
});
