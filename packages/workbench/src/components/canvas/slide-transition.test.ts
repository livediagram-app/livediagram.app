// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SETTLE_FAILSAFE_MS,
  SLIDE_VIEW_TRANSITION_UPDATE,
  slideTransitionType,
  whenScreenSettles,
} from './slide-transition';

// docs/specs/012-collaboration/presentation-mode.md "Motion": a move runs as a transition typed by its direction,
// the surface animates for those types alone, and the first slide waits for the screen to settle.

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-slide-move');
  vi.useRealTimers();
});

describe('slideTransitionType', () => {
  it('travels the way the deck moves', () => {
    expect(slideTransitionType('slide', 2, 3)).toBe('slide-forward');
    expect(slideTransitionType('slide', 3, 2)).toBe('slide-back');
    expect(slideTransitionType('slide', 0, 5)).toBe('slide-forward');
  });

  it('crosses the two with Fade, whichever way', () => {
    expect(slideTransitionType('fade', 2, 3)).toBe('slide-fade');
    expect(slideTransitionType('fade', 3, 2)).toBe('slide-fade');
  });

  it('cuts with None, and does not animate a move that goes nowhere', () => {
    expect(slideTransitionType('none', 2, 3)).toBeNull();
    expect(slideTransitionType('slide', 2, 2)).toBeNull();
  });
});

describe('SLIDE_VIEW_TRANSITION_UPDATE', () => {
  it('animates the surface for the slide types alone', () => {
    expect(SLIDE_VIEW_TRANSITION_UPDATE).toEqual({
      'slide-in': 'slide-in',
      'slide-forward': 'slide-forward',
      'slide-back': 'slide-back',
      'slide-fade': 'slide-fade',
      default: 'none',
    });
  });
});

describe('whenScreenSettles', () => {
  it('is ready at once where there is no fullscreen to wait for', () => {
    const ready = vi.fn();
    whenScreenSettles(ready);
    expect(ready).toHaveBeenCalledOnce();
  });

  it('waits for fullscreen to land, then two frames, and can be cancelled', () => {
    vi.useFakeTimers();
    const root = document.documentElement as HTMLElement & { requestFullscreen?: unknown };
    const had = root.requestFullscreen;
    root.requestFullscreen = vi.fn();
    try {
      const ready = vi.fn();
      whenScreenSettles(ready);
      expect(ready).not.toHaveBeenCalled();
      document.dispatchEvent(new Event('fullscreenchange'));
      vi.advanceTimersByTime(50);
      expect(ready).toHaveBeenCalledOnce();

      const late = vi.fn();
      const cancel = whenScreenSettles(late);
      cancel();
      vi.advanceTimersByTime(SETTLE_FAILSAFE_MS + 100);
      expect(late).not.toHaveBeenCalled();

      // A refused or slow request still arrives, by the failsafe.
      const slow = vi.fn();
      whenScreenSettles(slow);
      vi.advanceTimersByTime(SETTLE_FAILSAFE_MS + 100);
      expect(slow).toHaveBeenCalledOnce();
    } finally {
      root.requestFullscreen = had;
    }
  });
});
