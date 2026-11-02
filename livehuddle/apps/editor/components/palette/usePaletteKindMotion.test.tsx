// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KIND_CASCADE_MS,
  KIND_ITEM_MS,
  kindStagger,
  usePaletteKindMotion,
} from './usePaletteKindMotion';

vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced,
}));
let reduced = false;

// A change of the palette's kind (a change of editor mode) cascades in (docs/specs/004-interface-design/motion.md).
describe('usePaletteKindMotion', () => {
  afterEach(() => {
    reduced = false;
    document.body.innerHTML = '';
  });

  function strip(count: number) {
    const root = document.createElement('div');
    const animate = vi.fn();
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button');
      b.setAttribute('data-category-bar-button', '');
      b.animate = animate;
      root.appendChild(b);
    }
    root.animate = vi.fn();
    document.body.appendChild(root);
    return { ref: { current: root }, animate };
  }

  it('cascades the categories in on a change of kind, never on the first render', () => {
    const { ref, animate } = strip(6);
    const { rerender } = renderHook(({ kind }) => usePaletteKindMotion(kind, ref), {
      initialProps: { kind: 'design' },
    });
    expect(animate).not.toHaveBeenCalled();
    rerender({ kind: 'logo' });
    expect(animate).toHaveBeenCalledTimes(6);
    const delays = animate.mock.calls.map((c) => (c[1] as KeyframeAnimationOptions).delay);
    expect(delays[0]).toBe(0);
    expect((delays.at(-1) as number) + KIND_ITEM_MS).toBeLessThanOrEqual(KIND_CASCADE_MS);
  });

  it('holds still under reduced motion', () => {
    reduced = true;
    const { ref, animate } = strip(3);
    const { rerender } = renderHook(({ kind }) => usePaletteKindMotion(kind, ref), {
      initialProps: { kind: 'design' },
    });
    rerender({ kind: 'slide' });
    expect(animate).not.toHaveBeenCalled();
  });

  it('keeps any number of items within the cascade', () => {
    for (const n of [1, 2, 5, 11, 40])
      expect((n - 1) * kindStagger(n) + KIND_ITEM_MS).toBeLessThanOrEqual(KIND_CASCADE_MS);
  });
});
