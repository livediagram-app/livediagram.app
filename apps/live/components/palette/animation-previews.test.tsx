// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ANIMATION_SET_VALUES,
  ARROW_FLOWS,
  ICON_ANIMATIONS,
  PIE_ANIMS,
  PROGRESS_ANIMS,
  RATING_ANIMS,
  type AnimationSetId,
} from '@livediagram/document';
import { ANIMATION_CLASS_PREFIX } from '@/lib/animation-classes';
import { AnimationSetPreview, previewFrame } from './animation-set-previews';
import {
  ArrowFlowPreview,
  IconAnimationPreview,
  PieAnimPreview,
  ProgressAnimPreview,
  RatingAnimPreview,
} from './animation-previews-existing';
import { useFrozenAnimations } from './useFrozenAnimations';
import { renderHook } from '@testing-library/react';

describe('animation tile miniatures', () => {
  it('render every option of every set wearing its real class', () => {
    for (const set of Object.keys(ANIMATION_SET_VALUES) as AnimationSetId[]) {
      for (const v of ANIMATION_SET_VALUES[set]) {
        const html = renderToStaticMarkup(<AnimationSetPreview set={set} value={v} />);
        // Shared Pulse / Glow / Highlight draw with the Shape set's classes.
        expect(
          html.includes(`${ANIMATION_CLASS_PREFIX[set]}${v}`) || html.includes(`lvd-anim-${v}`),
        ).toBe(true);
      }
    }
  });

  it('render the still element for None', () => {
    expect(renderToStaticMarkup(<AnimationSetPreview set="shape" value={null} />)).not.toMatch(
      /class="[^"]*lvd-anim-/,
    );
  });

  it('render the existing sets on their real renderers', () => {
    for (const f of ARROW_FLOWS)
      expect(renderToStaticMarkup(<ArrowFlowPreview flow={f} />)).toContain('<svg');
    for (const a of ICON_ANIMATIONS)
      expect(renderToStaticMarkup(<IconAnimationPreview animation={a} />)).toContain('lvd-icon-');
    for (const a of PROGRESS_ANIMS)
      expect(renderToStaticMarkup(<ProgressAnimPreview anim={a} />)).toContain('lvd-prog-');
    for (const a of RATING_ANIMS)
      expect(renderToStaticMarkup(<RatingAnimPreview anim={a} />)).toContain('lvd-rating-');
    for (const a of PIE_ANIMS)
      expect(renderToStaticMarkup(<PieAnimPreview anim={a} />)).toContain('lvd-pie-');
  });

  it('rest None at its start and an option on its listed frame', () => {
    expect(previewFrame('shape', null)).toBe(0);
    expect(previewFrame('shape', 'pulse')).toBe(0.12);
    expect(previewFrame('text', 'nope')).toBe(0.3);
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
