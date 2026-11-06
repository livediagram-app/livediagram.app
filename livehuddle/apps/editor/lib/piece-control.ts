import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

// A control drawn inside a piece on the canvas (docs/specs/009-elements/social-pieces.md: the Notice Board's Notes
// button, the Jukebox's Play button): its press is the control's alone. Never a selection, a drag, a label edit, a
// walk in Avatar mode, an erase or a draw beginning over the piece. The canvas's capture handlers run before the
// control, so they read the marker; the element's own handlers sit above it, so the control stops its press there.

export const PIECE_CONTROL_ATTR = 'data-piece-control';

/** Whether a press landed on a piece's own control. */
export function isPieceControlPress(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest(`[${PIECE_CONTROL_ATTR}]`) !== null
  );
}

const stop = (e: ReactPointerEvent | ReactMouseEvent) => e.stopPropagation();

/** Spread on a piece's control: the marker, and its press and double-click kept from the element around it. */
export const pieceControlProps = {
  [PIECE_CONTROL_ATTR]: '',
  onPointerDown: stop,
  onDoubleClick: stop,
} as const;
