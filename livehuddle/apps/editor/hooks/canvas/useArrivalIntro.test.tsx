// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';
import { arrivalIntroPlaying, INTRO_HOLD_MS, INTRO_ZOOM_MS } from '@/lib/space-3d/arrival-intro';
import { useArrivalIntro } from './useArrivalIntro';
import { useAvatarCamera } from './useAvatarCamera';

// docs/specs/008-canvas/3d-view.md "Arriving": the overview holds, zooms in and lands; input stops it where it is;
// reduced motion and a tab that already fits land at once.

let canvas: HTMLElement;
const TARGET = { x: 1200, y: 900 };
const TO: ViewPose = { zoom: 1.8, offset: { x: 500 - TARGET.x, y: 400 - TARGET.y } };
const OVERVIEW: ViewPose = { zoom: 0.25, offset: { x: -400, y: -300 } };

beforeEach(() => {
  vi.useFakeTimers();
  canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: 1000 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  document.body.append(canvas);
});

afterEach(() => {
  vi.useRealTimers();
  canvas.remove();
  document.documentElement.classList.remove('reduce-motion');
  arrivalIntroPlaying.set(false);
});

function setup(overview: ViewPose | null = OVERVIEW) {
  const viewport = createViewportStore(1);
  const hook = renderHook(() =>
    useArrivalIntro({ viewport, canvasMainRef: { current: canvas }, overview: () => overview }),
  );
  return { ...hook, viewport };
}

describe('useArrivalIntro', () => {
  it('shows the whole tab, holds, then zooms in and lands on the arrival', () => {
    const { result, viewport } = setup();
    let played = false;
    act(() => {
      played = result.current.play(TO, TARGET);
    });
    expect(played).toBe(true);
    expect(viewport.get()).toEqual(OVERVIEW);
    expect(arrivalIntroPlaying.get()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(INTRO_HOLD_MS - 20);
    });
    expect(viewport.get()).toEqual(OVERVIEW);
    act(() => {
      vi.advanceTimersByTime(20 + INTRO_ZOOM_MS / 2);
    });
    const mid = viewport.get().zoom;
    expect(mid).toBeGreaterThan(OVERVIEW.zoom);
    expect(mid).toBeLessThan(TO.zoom);
    act(() => {
      vi.advanceTimersByTime(INTRO_ZOOM_MS);
    });
    expect(viewport.get()).toEqual(TO);
    expect(arrivalIntroPlaying.get()).toBe(false);
  });

  it.each(['pointerdown', 'wheel', 'keydown', 'touchstart'])(
    'a %s stops it where it is',
    (type) => {
      const { result, viewport } = setup();
      act(() => {
        result.current.play(TO, TARGET);
      });
      act(() => {
        vi.advanceTimersByTime(INTRO_HOLD_MS + INTRO_ZOOM_MS / 3);
      });
      window.dispatchEvent(new Event(type));
      const stopped = viewport.get();
      expect(stopped.zoom).toBeGreaterThan(OVERVIEW.zoom);
      expect(stopped.zoom).toBeLessThan(TO.zoom);
      expect(arrivalIntroPlaying.get()).toBe(false);
      act(() => {
        vi.advanceTimersByTime(INTRO_ZOOM_MS * 2);
      });
      expect(viewport.get()).toBe(stopped);
    },
  );

  it('does not play under reduced motion', () => {
    document.documentElement.classList.add('reduce-motion');
    const { result, viewport } = setup();
    expect(result.current.play(TO, TARGET)).toBe(false);
    expect(viewport.get().zoom).toBe(1);
    expect(arrivalIntroPlaying.get()).toBe(false);
  });

  it('does not play on a tab whose content already fits at the walking zoom', () => {
    const { result } = setup({ zoom: 1.6, offset: { x: 0, y: 0 } });
    expect(result.current.play(TO, TARGET)).toBe(false);
  });

  it('does not play with nothing to frame', () => {
    const { result } = setup(null);
    expect(result.current.play(TO, TARGET)).toBe(false);
  });
});

describe('useAvatarCamera arrival', () => {
  function camera(overview: ViewPose | null, reduce = false) {
    if (reduce) document.documentElement.classList.add('reduce-motion');
    const viewport = createViewportStore(1);
    const hook = renderHook(
      ({ walking }) =>
        useAvatarCamera({
          walking,
          viewport,
          canvasMainRef: { current: canvas },
          fitToScreen: vi.fn(),
          overview: () => overview,
        }),
      { initialProps: { walking: false } },
    );
    hook.result.current.avatarAtRef.current = () => TARGET;
    hook.rerender({ walking: true });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    return viewport;
  }

  it('opening walking starts from the overview and ends centred on the character', () => {
    const viewport = camera(OVERVIEW);
    expect(viewport.get()).toEqual(OVERVIEW);
    act(() => {
      vi.advanceTimersByTime(INTRO_HOLD_MS + INTRO_ZOOM_MS + 50);
    });
    expect(viewport.get()).toEqual(TO);
  });

  it('reduced motion lands on the character at once', () => {
    expect(camera(OVERVIEW, true).get()).toEqual(TO);
  });

  it('a small tab lands on the character at once', () => {
    expect(camera({ zoom: 1.7, offset: { x: 0, y: 0 } }).get()).toEqual(TO);
  });
});
