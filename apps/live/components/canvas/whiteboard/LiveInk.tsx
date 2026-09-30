'use client';

import { useLayoutEffect, useRef } from 'react';
import { createStrokePathBuilder } from '@livediagram/document';
import type { ClientOrigin } from '@/hooks/canvas/useCanvasClientOrigin';
import type { LiveStroke } from '@/lib/live-stroke';

const SVG_NS = 'http://www.w3.org/2000/svg';

type LiveInkProps = {
  stroke: LiveStroke;
  colour: string;
  /** The pen's width in canvas px: the group's zoom makes it `width x zoom` on screen. */
  width: number;
  zoom: number;
  origin: ClientOrigin;
  /** Hidden (never unmounted) while a recognised shape shows in its place. */
  hidden: boolean;
};

// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Live stroke pipeline", Render). It is drawn in canvas px under the
// canvas's own translate and zoom, at the pen's width, exactly as the committed stroke renders. Its
// path is written straight to the DOM from the stroke's subscriber, inside the input handler:
// finished ink is sealed into chunk paths that are never rewritten, and only the live path's `d`
// changes per frame. React renders the frame (colour, width, transform) and nothing per sample.
export function LiveInk({ stroke, colour, width, zoom, origin, hidden }: LiveInkProps) {
  const chunksRef = useRef<SVGGElement>(null);
  const liveRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const chunks = chunksRef.current;
    const live = liveRef.current;
    if (!chunks || !live) return;
    const builder = createStrokePathBuilder();
    const draw = () => {
      const frame = builder.update(stroke.smoother.kept, stroke.smoother.tail());
      for (const d of frame.sealed) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        chunks.appendChild(path);
      }
      live.setAttribute('d', frame.live);
    };
    draw();
    const unsubscribe = stroke.subscribe(draw);
    return () => {
      unsubscribe();
      chunks.replaceChildren();
      live.removeAttribute('d');
    };
  }, [stroke]);

  return (
    <svg
      aria-hidden
      data-live-ink
      className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
      style={hidden ? { visibility: 'hidden' } : undefined}
    >
      <g
        transform={`translate(${origin.left} ${origin.top}) scale(${zoom})`}
        fill="none"
        stroke={colour}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g ref={chunksRef} />
        <path ref={liveRef} />
      </g>
    </svg>
  );
}
