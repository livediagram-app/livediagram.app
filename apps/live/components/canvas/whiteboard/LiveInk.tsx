'use client';

import { useLayoutEffect, useRef } from 'react';
import { createStrokePathBuilder, freehandFrame } from '@livediagram/document';
import { FREEHAND_SVG_CLASS } from '@/components/canvas/boxed-element-overlays';
import type { LiveStroke } from '@/lib/live-stroke';

const SVG_NS = 'http://www.w3.org/2000/svg';

type LiveInkProps = {
  stroke: LiveStroke;
  colour: string;
  /** The pen's width in canvas px, as the committed stroke records it. */
  width: number;
  /** Hidden (never unmounted) while a recognised shape shows in its place. */
  hidden: boolean;
};

// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Live stroke pipeline", Render). It sits inside the canvas's
// transformed layer, beside the committed elements, and is laid out exactly as the stroke it lands
// as: a box at the stroke's freehand frame (`freehandFrame`, the box `createFreehand` gives), the
// same svg with the same viewBox, the pen's width in canvas px. So the one layer rasterises both
// with the same pixel snapping, and release changes no pixel. The path is in canvas px under a
// translate by the frame's origin (the curve does not change under a shift), written straight to
// the DOM from the stroke's subscriber, inside the input handler: finished ink is sealed into chunk
// paths that are never rewritten, and only the live path's `d` and the frame change per frame.
export function LiveInk({ stroke, colour, width, hidden }: LiveInkProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const chunksRef = useRef<SVGGElement>(null);
  const liveRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const svg = svgRef.current;
    const group = groupRef.current;
    const chunks = chunksRef.current;
    const live = liveRef.current;
    if (!frame || !svg || !group || !chunks || !live) return;
    const smoother = stroke.smoother;
    const builder = createStrokePathBuilder();
    // Bounds of the final kept points, grown incrementally; the tail is added per frame.
    let seen = 0;
    const kept = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    let box = '';
    const draw = () => {
      const tail = smoother.tail();
      for (; seen < smoother.kept.length; seen++) {
        const p = smoother.kept[seen]!;
        kept.minX = Math.min(kept.minX, p.x);
        kept.minY = Math.min(kept.minY, p.y);
        kept.maxX = Math.max(kept.maxX, p.x);
        kept.maxY = Math.max(kept.maxY, p.y);
      }
      let { minX, minY, maxX, maxY } = kept;
      for (const p of tail) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if (!Number.isFinite(minX)) return;
      const f = freehandFrame(minX, minY, maxX, maxY);
      const next = `${f.x} ${f.y} ${f.width} ${f.height}`;
      if (next !== box) {
        box = next;
        frame.style.left = `${f.x}px`;
        frame.style.top = `${f.y}px`;
        frame.style.width = `${f.width}px`;
        frame.style.height = `${f.height}px`;
        svg.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
        group.setAttribute('transform', `translate(${-f.x} ${-f.y})`);
      }
      const paths = builder.update(smoother.kept, tail);
      for (const d of paths.sealed) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        chunks.appendChild(path);
      }
      live.setAttribute('d', paths.live);
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
    <div
      ref={frameRef}
      aria-hidden
      data-live-ink
      className="pointer-events-none absolute"
      style={hidden ? { visibility: 'hidden' } : undefined}
    >
      <svg ref={svgRef} className={FREEHAND_SVG_CLASS} preserveAspectRatio="none">
        <g
          ref={groupRef}
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
    </div>
  );
}
