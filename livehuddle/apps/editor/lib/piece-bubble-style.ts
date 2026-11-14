// How a proximity bubble (the Arcade Machine's Insert Coin, the Reception Desk's Welcome) sits on its piece: above it,
// or beside it (or below it) when a Room Sign stands where it would rise (docs/specs/009-elements/social-pieces.md
// "Arcade Machine", Work Tracker 793; the side is @livehuddle/avatar/piece-bubble's bubbleSide). The rise it plays in
// on (social-motion.css, workday-motion.css) keeps its side's own offset: centred over or under the piece, flush beside it.
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { sideInView, type PieceBubbleSide } from '@livehuddle/avatar/piece-bubble';

const SIDE_CLASS: Record<PieceBubbleSide, string> = {
  above: 'bottom-[calc(100%+6px)] left-1/2',
  below: 'top-[calc(100%+6px)] left-1/2',
  left: 'right-[calc(100%+6px)] top-0',
  right: 'left-[calc(100%+6px)] top-0',
};

/** The bubble's place against its piece's box, 6 px off it. */
export function pieceBubbleSide(side: PieceBubbleSide): string {
  return SIDE_CLASS[side];
}

/**
 * The bubble's offset and the way it rises in: centred on the piece above and below it, flush beside it; up from
 * below except under the piece, where it drops in from above.
 */
export function pieceBubbleStyle(side: PieceBubbleSide): CSSProperties {
  const x = side === 'above' || side === 'below' ? '-50%' : '0px';
  return {
    transform: `translateX(${x})`,
    '--lh-bubble-x': x,
    '--lh-bubble-rise': side === 'below' ? '-6px' : '6px',
  } as CSSProperties;
}

/**
 * The side a bubble shows on, kept in view: a bubble beside its piece that would leave the canvas's visible box (a
 * wide Reception Desk on a phone) shows below instead (sideInView). Measured once as the bubble shows on a side, before
 * it paints, never per frame.
 */
export function useSideInView(
  side: PieceBubbleSide,
  ref: RefObject<HTMLElement | null>,
): PieceBubbleSide {
  // The side that was found to leave the view, while it is still the side asked for.
  const [overflowed, setOverflowed] = useState<PieceBubbleSide | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (side !== 'left' && side !== 'right')) {
      setOverflowed(null);
      return;
    }
    const canvas = document.querySelector('[data-canvas-a11y-root]');
    const view = canvas
      ? canvas.getBoundingClientRect()
      : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    setOverflowed(sideInView(side, el.getBoundingClientRect(), view) === 'below' ? side : null);
  }, [side, ref]);
  return overflowed === side ? 'below' : side;
}
