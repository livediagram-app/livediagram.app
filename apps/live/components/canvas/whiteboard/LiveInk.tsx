'use client';

import { useLayoutEffect, useRef } from 'react';
import { freehandGeometry, penStrokeSvg } from '@livediagram/document';
import { FREEHAND_SVG_CLASS } from '@/components/canvas/boxed-element-overlays';
import type { LiveStroke } from '@/lib/live-stroke';

type LiveInkProps = {
  stroke: LiveStroke;
  colour: string;
  /** The pen's width in canvas px, as the committed stroke records it. */
  width: number;
  /** Hidden (never unmounted) while a recognised shape shows in its place. */
  hidden: boolean;
};

// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Pen ink"). It sits inside the canvas's transformed layer, beside
// the committed elements, and IS the stroke it lands as: the same geometry (`freehandGeometry`, what
// `createFreehand` gives), a box at that geometry's place, and the same svg, viewBox and filled
// perfect-freehand outline (`penStrokeSvg`) that FreehandSvg draws. So the one layer rasterises
// both alike and release changes no pixel. The box sits on whole canvas px and the outline is in
// canvas coordinates, so as the box grows the ink the smoothing has settled stays pixel-still.
// Each update rewrites the box and the path straight in the DOM, from the stroke's subscriber
// inside the input handler, with no React render; like Excalidraw, the whole outline is redrawn
// each time.
export function LiveInk({ stroke, colour, width, hidden }: LiveInkProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!frame || !svg || !path) return;
    const draw = () => {
      const geometry = freehandGeometry(stroke.points);
      frame.style.left = `${geometry.x}px`;
      frame.style.top = `${geometry.y}px`;
      frame.style.width = `${geometry.width}px`;
      frame.style.height = `${geometry.height}px`;
      const ink = penStrokeSvg({
        ...geometry,
        penWidth: width,
        pressures: stroke.pressures ? [...stroke.pressures] : undefined,
        streamline: stroke.streamline,
      });
      svg.setAttribute('viewBox', ink.viewBox);
      path.setAttribute('d', ink.d);
    };
    draw();
    const unsubscribe = stroke.subscribe(draw);
    return () => {
      unsubscribe();
      path.removeAttribute('d');
    };
  }, [stroke, width]);

  return (
    <div
      ref={frameRef}
      aria-hidden
      data-live-ink
      className="pointer-events-none absolute"
      style={hidden ? { visibility: 'hidden' } : undefined}
    >
      <svg ref={svgRef} className={FREEHAND_SVG_CLASS} preserveAspectRatio="none">
        <path ref={pathRef} fill={colour} stroke="none" />
      </svg>
    </div>
  );
}
