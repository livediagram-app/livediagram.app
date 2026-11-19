// Where the label editor's floating toolbar sits (liveworkspace/docs/specs/011-workbench/label-editor.md "The
// toolbar"): centred above the element, flipped below it near the top of the screen, and slid back inside the screen,
// with its "Selected Text" caption, when centring would run it off an edge (a label near the left edge of a phone,
// Work Tracker 1313).

import { useLayoutEffect, useState, type RefObject } from 'react';
import { measuredBox } from '../../hooks/canvas/useEdgeAwarePlacement';
import { clampToViewport } from '../../lib/clamp-to-viewport';

// The editor's top, in screen px, under which the toolbar has no room above it: the toolbar and its gap.
export const FLIP_BELOW_TOP = 52;

/** The screen px the toolbar is slid by from its centred spot. */
export type ToolbarShift = { x: number; y: number };

const NO_SHIFT: ToolbarShift = { x: 0, y: 0 };

/** The toolbar's side and its slide back on screen, measured after every render and on a scroll or resize. */
export function useLabelToolbarPlacement(
  editorRef: RefObject<HTMLElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
): { placeBelow: boolean; shift: ToolbarShift } {
  const [placeBelow, setPlaceBelow] = useState(false);
  const [shift, setShift] = useState(NO_SHIFT);

  // Flip on the EDITOR (a fixed reference), not the toolbar: the toolbar moves when it flips, which would otherwise
  // ping-pong. The slide is worked out from where the toolbar would sit with none (the live rect less the slide in
  // force), so it shrinks back to nothing once the label moves away from the edge, and never feeds on itself.
  useLayoutEffect(() => {
    const measure = () => {
      const editor = editorRef.current;
      if (!editor) return;
      setPlaceBelow(editor.getBoundingClientRect().top < FLIP_BELOW_TOP);
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const box = measuredBox(toolbar);
      // Not laid out (hidden, or a DOM with no layout): nothing to slide.
      if (box.width === 0 && box.height === 0) return;
      const next = clampToViewport(box, shift);
      if (next.x !== shift.x || next.y !== shift.y) setShift(next);
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  });

  return { placeBelow, shift };
}

/** The toolbar's transform: centred on the element, slid by `shift` screen px, counter-scaled against the zoom. The
 *  slide sits before the scale, in the editor's own units, each zoom screen px. */
export function labelToolbarTransform(shift: ToolbarShift, zoom: number): string {
  return `translate(calc(-50% + ${shift.x / zoom}px), ${shift.y / zoom}px) scale(${1 / zoom})`;
}
