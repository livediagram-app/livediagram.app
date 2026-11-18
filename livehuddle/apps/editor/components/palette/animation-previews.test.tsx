// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ICON_ANIMATIONS } from '@livehuddle/document';
import { IconAnimationPreview } from './animation-previews-existing';
import { useFrozenAnimations } from '@liveworkspace/workbench/components/palette/useFrozenAnimations';
import { renderHook } from '@testing-library/react';

describe('animation tile miniatures', () => {
  it('render the icon set on its real renderer', () => {
    for (const a of ICON_ANIMATIONS)
      expect(renderToStaticMarkup(<IconAnimationPreview animation={a} />)).toContain('lvd-icon-');
  });
});

describe('useFrozenAnimations', () => {
  it('pauses every animation on the frame, plays on hover and freezes again', () => {
    const anim = {
      effect: { getComputedTiming: () => ({ duration: 2000 }) },
      pause: vi.fn(),
      play: vi.fn(),
      currentTime: 0 as number | null,
    };
    const el = { getAnimations: () => [anim] } as unknown as Element;
    const { result } = renderHook(() => useFrozenAnimations({ current: el }, 0.25));
    expect(anim.pause).toHaveBeenCalled();
    expect(anim.currentTime).toBe(500);
    result.current.play();
    expect(anim.play).toHaveBeenCalled();
    anim.currentTime = 1700;
    result.current.rest();
    expect(anim.currentTime).toBe(500);
  });

  it('does nothing where the browser has no Web Animations', () => {
    const { result } = renderHook(() => useFrozenAnimations({ current: {} as Element }, 0.5));
    expect(() => result.current.play()).not.toThrow();
  });
});
