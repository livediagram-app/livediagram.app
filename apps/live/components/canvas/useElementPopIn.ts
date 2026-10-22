import { useEffect, useState } from 'react';
import { useArrivesWithBoard } from '@/components/canvas/CanvasArrivalContext';

// The one-shot pop-in entry of a newly added element (docs/specs/008-canvas/canvas-and-palette.md "Motion and
// animations"), lifted out of BoxedElementView: the class the wrapper wears and its drop-off timer.
//
// The pop-in must drop off the wrapper once it has run: CSS animations RESTART when a node is moved in the
// DOM, and layer reorders (bring to front / send to back) move every keyed sibling, so a lingering pop-in
// class made unrelated elements visibly re-enter. An element that never pops starts entered and arms
// nothing: one the board arrives with.
export function useElementPopIn(): string {
  const arrivesWithBoard = useArrivesWithBoard();
  const [entered, setEntered] = useState(() => arrivesWithBoard);
  const [pops] = useState(!entered);
  useEffect(() => {
    if (!pops) return;
    // Comfortably past the pop-in duration; a plain timeout (not
    // animationend) so reduced-motion sessions converge too.
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, [pops]);
  return entered ? '' : 'animate-element-pop-in';
}
