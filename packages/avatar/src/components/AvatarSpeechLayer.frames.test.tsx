// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeechBubble } from '../speech';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { AvatarSpeechLayer, type SpeechView } from './AvatarSpeechLayer';

// docs/specs/008-canvas/blueprints/avatar-speech.md: the flight is one loop that writes styles, no work it can skip.
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const bubble: SpeechBubble = {
  id: 'b1',
  from: 'self',
  own: true,
  text: 'hello',
  tabId: 't1',
  x: 0,
  y: 0,
  bornAt: 0,
  flightMs: 4000,
};
const props = {
  bubbles: [bubble],
  activeTabId: 't1',
  zoom: 1,
  view: { offsetX: 0, width: 390 } as SpeechView,
  peers: [],
  composer: null,
  self: { name: 'Tom', colour: '#14b8a6' },
};

describe('the speech bubbles flight', () => {
  it('reads the reduced-motion setting once per flight, not every frame', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    render(<AvatarSpeechLayer {...props} />);
    vi.advanceTimersByTime(500);
    expect(vi.mocked(prefersReducedMotion)).toHaveBeenCalledTimes(1);
  });

  describe('kept inside the view (docs/specs/008-canvas/avatar-mode.md "Kept inside the view")', () => {
    // A card laid out 100px wide; reduced motion, so no sway or pop moves it.
    const widthOf = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get');
    const placed = (x: number, view = props.view, zoom = 1) => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      widthOf.mockReturnValue(100);
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const { container } = render(
        <AvatarSpeechLayer {...props} bubbles={[{ ...bubble, x }]} view={view} zoom={zoom} />,
      );
      const card = container.querySelector<HTMLElement>('[aria-hidden].w-max')!;
      const tail = card.querySelector<HTMLElement>('span[aria-hidden]')!;
      return { card, tail };
    };

    it('pulls a bubble at the left edge back in, its tail still on the head', () => {
      const { card, tail } = placed(20);
      expect(card.style.transform).toContain('calc(-50% + 38px)');
      expect(tail.style.marginLeft).toBe('-36px');
    });

    it('pulls a bubble at the right edge back in', () => {
      const { card, tail } = placed(380);
      expect(card.style.transform).toContain('calc(-50% + -48px)');
      expect(tail.style.marginLeft).toBe('36px');
    });

    it('reads the pan and the zoom: the same canvas point is elsewhere on screen', () => {
      // Canvas x 100 is at 2 * (100 + 7.5) + 195 * (1 - 2) = 20 on screen.
      const { card } = placed(100, { offsetX: 7.5, width: 390 }, 2);
      expect(card.style.transform).toContain('calc(-50% + 38px)');
    });

    it('leaves a bubble that fits, and any bubble before the view is measured', () => {
      expect(placed(200).card.style.transform).toContain('calc(-50% + 0px)');
      cleanup();
      expect(placed(20, { offsetX: 0, width: 0 }).card.style.transform).toContain(
        'calc(-50% + 0px)',
      );
    });
  });

  describe('kept below the top of the view (Work Tracker #394)', () => {
    // A card laid out 100 x 40; reduced motion, so it holds still where it starts.
    const startAt = (y: number, view: typeof props.view = { ...props.view, height: 600 }) => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const { container } = render(
        <AvatarSpeechLayer {...props} bubbles={[{ ...bubble, x: 200, y }]} view={view} />,
      );
      return container.querySelector<HTMLElement>('[aria-hidden].w-max')!.style.transform;
    };

    it('starts a bubble over a head under the top chrome below it, 120px down', () => {
      // Its top would be at 20 - 40 = -20: dropped 140 to sit at 120.
      expect(startAt(20)).toContain(', 140px) scale');
    });

    it('leaves a bubble with room above it where it starts', () => {
      expect(startAt(300)).toContain(', 0px) scale');
    });

    it('holds a rising bubble at the top once it meets it', () => {
      vi.mocked(prefersReducedMotion).mockReturnValue(false);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const { container } = render(
        <AvatarSpeechLayer
          {...props}
          bubbles={[{ ...bubble, x: 200, y: 200 }]}
          view={{ ...props.view, height: 600 }}
        />,
      );
      const card = container.querySelector<HTMLElement>('[aria-hidden].w-max')!;
      // Starting with its top at 160, three seconds in it would have risen 54px (a top at 106); it stops at 120, so
      // it stands 40px up, not 54.
      vi.advanceTimersByTime(3000);
      const y = Number(/, (-?[\d.]+)px\) scale/.exec(card.style.transform)![1]);
      expect(y).toBeCloseTo(-40, 6);
    });

    it('keeps only the sides where the view has no height', () => {
      expect(startAt(20, props.view)).toContain(', 0px) scale');
    });
  });

  describe('clear of camera bubbles (docs/specs/012-collaboration/video-and-screen-bubbles.md "Close together")', () => {
    const sizeOf = (w: number, h: number) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(w);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(h);
    };
    const flying = (
      reduced: boolean,
      obstacles: { current: { left: number; top: number; right: number; bottom: number }[] },
      zoom = 1,
    ) => {
      vi.mocked(prefersReducedMotion).mockReturnValue(reduced);
      sizeOf(100, 40);
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const { container } = render(
        <AvatarSpeechLayer
          {...props}
          bubbles={[{ ...bubble, x: 200, y: 300 }]}
          zoom={zoom}
          obstacles={obstacles}
        />,
      );
      return container.querySelector<HTMLElement>('[aria-hidden].w-max')!;
    };
    const liftIn = (card: HTMLElement) =>
      0 - Number(/, (-?[\d.]+)px\) scale/.exec(card.style.transform)![1]);

    it('starts over a camera bubble on its path, at once on its first frame', () => {
      // A bubble from 182 to 250 straddles its path: it starts 8 over its top, 300 - 182 + 8 = 126 up.
      const card = flying(true, { current: [{ left: 150, top: 182, right: 270, bottom: 250 }] });
      expect(liftIn(card)).toBe(126);
    });

    it('works in canvas px, at any zoom', () => {
      const card = flying(true, { current: [{ left: 150, top: 182, right: 270, bottom: 250 }] }, 2);
      expect(liftIn(card)).toBe(252);
    });

    it('eases up out of the way of one that walks in, and is never pushed down', () => {
      const obstacles = {
        current: [] as { left: number; top: number; right: number; bottom: number }[],
      };
      const card = flying(false, obstacles);
      expect(liftIn(card)).toBeLessThan(1);
      obstacles.current = [{ left: 150, top: 182, right: 270, bottom: 250 }];
      vi.advanceTimersByTime(20);
      const partway = liftIn(card);
      vi.advanceTimersByTime(400);
      const settled = liftIn(card);
      expect(partway).toBeGreaterThan(0);
      expect(settled).toBeGreaterThan(partway);
      // It walks off: the bubble keeps its height.
      obstacles.current = [];
      vi.advanceTimersByTime(100);
      expect(liftIn(card)).toBeGreaterThanOrEqual(settled);
    });

    it('is not lifted by a bubble beside its path', () => {
      const card = flying(true, { current: [{ left: 400, top: 182, right: 520, bottom: 250 }] });
      expect(liftIn(card)).toBe(0);
    });
  });
});
