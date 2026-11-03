// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeechBubble } from '../speech';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { AvatarSpeechLayer } from './AvatarSpeechLayer';

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
  view: { offsetX: 0, width: 390 },
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
      // Canvas x 100 is at 2 * (100 - 90) = 20 on screen.
      const { card } = placed(100, { offsetX: -90, width: 390 }, 2);
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
});
