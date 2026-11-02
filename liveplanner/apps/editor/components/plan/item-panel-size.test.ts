// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PANEL_RESIZE_TRANSITION, panelSizeClass } from './item-panel-size';
import { useAnimatedMaximise } from './useAnimatedMaximise';

const motion = vi.hoisted(() => ({ reduced: false, types: [] as string[] }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => motion.reduced,
}));
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return {
    ...real,
    addTransitionType: (type: string) => {
      motion.types.push(type);
    },
  };
});

afterEach(() => {
  motion.reduced = false;
  motion.types = [];
});

// docs/specs/026-plan/plan-board.md "Maximised": the window less 1 rem on every side from sm up, the usual size
// otherwise, a phone's sheet either way; the change between them a View Transition, at once under reduced motion.
describe('panelSizeClass', () => {
  it('fills the window less a margin from sm up when maximised', () => {
    const c = panelSizeClass(true);
    expect(c).toContain('sm:w-[calc(100vw-2rem)]');
    expect(c).toContain('sm:h-[calc(100dvh-2rem)]');
    expect(c).toContain('sm:max-w-none');
    expect(c).toContain('max-sm:h-[85dvh]');
  });

  it('keeps the usual size otherwise', () => {
    const c = panelSizeClass(false);
    expect(c).toContain('h-[min(46rem,calc(100dvh-2rem))]');
    expect(c).not.toContain('sm:w-[calc(100vw-2rem)]');
  });

  it('animates no layout property: the View Transition morphs it', () => {
    for (const c of [panelSizeClass(true), panelSizeClass(false)]) {
      expect(c).not.toMatch(/transition-\[/);
      expect(c).toContain('overflow-hidden');
    }
  });
});

describe('useAnimatedMaximise', () => {
  it('changes the size in a View Transition of its type, and saves the preference', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAnimatedMaximise(false, save));
    act(() => result.current[1]!(true));
    expect(result.current[0]).toBe(true);
    expect(save).toHaveBeenCalledWith(true);
    expect(motion.types).toEqual([PANEL_RESIZE_TRANSITION]);
  });

  it('under reduced motion changes it at once, with no View Transition', () => {
    motion.reduced = true;
    const save = vi.fn();
    const { result } = renderHook(() => useAnimatedMaximise(false, save));
    act(() => result.current[1]!(true));
    expect(result.current[0]).toBe(true);
    expect(motion.types).toEqual([]);
  });

  it('follows the stored preference when it changes elsewhere, and offers no toggle without a way to save', () => {
    const { result, rerender } = renderHook(
      ({ stored }) => useAnimatedMaximise(stored, undefined),
      {
        initialProps: { stored: false },
      },
    );
    expect(result.current[1]).toBeUndefined();
    rerender({ stored: true });
    expect(result.current[0]).toBe(true);
  });

  it('keeps the size it asked for when its own save comes back', () => {
    let stored = false;
    const save = (on: boolean) => {
      stored = on;
    };
    const { result, rerender } = renderHook(() => useAnimatedMaximise(stored, save));
    act(() => result.current[1]!(true));
    rerender();
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]!(false));
    rerender();
    expect(result.current[0]).toBe(false);
  });
});
