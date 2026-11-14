// How a proximity bubble (the Arcade Machine's Insert Coin, the Reception Desk's Welcome) sits on its piece: above it,
// or below it when a Room Sign stands where it would rise (docs/specs/009-elements/social-pieces.md "Arcade Machine",
// Work Tracker 793; the check is @livehuddle/avatar/piece-bubble). The rise it plays in on (social-motion.css,
// workday-motion.css) comes from the side it shows on.
import type { CSSProperties } from 'react';

/** The bubble's place against its piece's box, 6 px off it. */
export function pieceBubbleSide(below: boolean): string {
  return below ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]';
}

/** The bubble's centring and the way it rises in: up from below when above the piece, down from above when below. */
export function pieceBubbleStyle(below: boolean): CSSProperties {
  return {
    transform: 'translateX(-50%)',
    '--lh-bubble-rise': below ? '-6px' : '6px',
  } as CSSProperties;
}
