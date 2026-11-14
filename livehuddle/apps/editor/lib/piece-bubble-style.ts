// How a proximity bubble (the Arcade Machine's Insert Coin, the Reception Desk's Welcome) sits on its piece: above it,
// or beside it (or below it) when a Room Sign stands where it would rise (docs/specs/009-elements/social-pieces.md
// "Arcade Machine", Work Tracker 793; the side is @livehuddle/avatar/piece-bubble's bubbleSide). The rise it plays in
// on (social-motion.css, workday-motion.css) keeps its side's own offset: centred over or under the piece, flush beside it.
import type { CSSProperties } from 'react';
import type { PieceBubbleSide } from '@livehuddle/avatar/piece-bubble';

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
