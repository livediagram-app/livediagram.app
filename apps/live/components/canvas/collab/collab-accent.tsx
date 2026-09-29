// The accent scope the modern collab faces share (docs/specs/012-collaboration/qa-board.md, idea-box.md
// "The look"): the tab theme's accent, taken from the element's themed stroke,
// plus the ink that reads ON it and the accent as TEXT on the card, published
// as CSS variables for everything inside (QA_ACCENT and friends in
// qa/qa-parts.tsx read them). One place decides the colour, so the Q&A board
// and the Idea box can't drift apart.

import type { CSSProperties, ReactNode } from 'react';
import { canvasSurface, defaultStrokeColor, inkOn, type ShapeElement } from '@livediagram/diagram';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { tint } from './collab-chrome';

export function CollabAccentScope({
  element,
  textColor,
  surface,
  children,
}: {
  element: ShapeElement;
  textColor: string;
  // The card's own fill: an accent on the same side of light as the card
  // vanishes as a word, so its text form is pulled toward the ink.
  surface: string;
  children: ReactNode;
}) {
  // A theme writes every element's stroke, so the element's own stroke IS the
  // theme's accent (and a user who recolours the border recolours the accent).
  const paper = useCanvasSurface();
  const accent = element.strokeColor ?? defaultStrokeColor(element, paper);
  const onAccent = inkOn(accent);
  const accentInk =
    canvasSurface(accent) === canvasSurface(surface)
      ? `color-mix(in srgb, ${accent} 40%, ${textColor})`
      : accent;
  return (
    <div
      style={
        {
          display: 'contents',
          '--qa-accent': accent,
          '--qa-on-accent': onAccent,
          '--qa-accent-ink': accentInk,
          '--qa-accent-soft': tint(accent, 0.35),
          '--qa-card': surface,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
