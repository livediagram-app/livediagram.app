// Placed pieces and what may be resized (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview
// themselves"). Its own module so the kind lists it reads (selection-mode, office, the seating) never import each
// other.

import { isSeatingShape } from '@liveworkspace/avatar/office-geometry';
import { isGridOfficeShape, isLongTable } from './office';
import { isFixedSizeShape } from './selection-mode';

/**
 * Pieces that are PLACED, not sized (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview
 * themselves"): adding one previews the piece under the pointer and drops it at its own size, never a box to draw.
 * Every fixed-size kind, the seating, every grid-drawn office piece but the Rug, and the Space's placed controls.
 */
const PLACED_KINDS: ReadonlySet<string> = new Set([
  'avatar-pad',
  'portal',
  'door',
  'focus-button',
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md).
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
]);
export function isPlacedShape(kind: string): boolean {
  // The Rug is grid-drawn but laid out to the room it dresses, so it keeps its box to draw.
  if (kind === 'rug') return false;
  return (
    isFixedSizeShape(kind) ||
    isSeatingShape(kind) ||
    isGridOfficeShape(kind) ||
    PLACED_KINDS.has(kind)
  );
}

// The element-level answer to "can this be resized?": no for a fixed-size shape kind, a placed piece (a chair, a
// bar stool, an Avatar Pad: it has its own size, so it shows no resize handles and keeps its size through a union
// resize), or any shape stamped `fixedSize`. Structural param so leaf callers don't need the full Element union.
export function isFixedSizeElement(el: {
  type: string;
  shape?: string;
  fixedSize?: boolean;
  variant?: unknown;
}): boolean {
  if (el.fixedSize === true) return true;
  if (el.type !== 'shape' || el.shape == null) return false;
  // A Long Table is drawn to its width, so it resizes and takes more chairs (office.md "Long Table").
  if (isLongTable({ shape: el.shape, variant: el.variant })) return false;
  return isPlacedShape(el.shape);
}

// Whether adding a kind drops it at its own default size, a tap and a press-and-drag alike, with no draw-to-size box
// (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview themselves"): every placed piece, and the Room
// (docs/specs/009-elements/office.md "Room": dropped, then resized), which unlike a placed piece keeps its resize
// handles once on the canvas.
export function dropsAtOwnSize(kind: string): boolean {
  return isPlacedShape(kind) || kind === 'room' || kind === 'corridor';
}
