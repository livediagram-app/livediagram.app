'use client';

import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { PathSvg } from './PathSvg';
import { NodeMarker, HandleMarker, OVERLAY_SVG_CLASS, PATH_OVERLAY_Z } from './path-markers';
import type { PathRing } from './usePathDrawGesture';

type Point = { x: number; y: number };

export type PathDraftView = {
  // The path as it will land: dressed and inked exactly as the committed element displays.
  element: PathElement | null;
  stroke: string;
  fill: string;
  // The nodes in canvas px, for the markers.
  anchors: readonly PathAnchor[];
  // The node whose handles show: the one being placed.
  active: number | null;
  band: { p0: Point; c1: Point; c2: Point; p3: Point } | null;
  ring: PathRing | null;
  zoom: number;
};

// The path being drawn (docs/specs/023-whiteboard/path-tool.md "Drawing"; blueprint path-tool
// "Rendering"), inside the canvas's transformed layer after the elements: the path itself is a
// PathSvg laid out exactly as the element it lands as, so release changes no pixel; the rubber
// band shares its stroke; nodes, the active node's handles and the rings sit on top, sized in
// screen px, never taking a pointer.
export function PathDraftLayer({
  element,
  stroke,
  fill,
  anchors,
  active,
  band,
  ring,
  zoom,
}: PathDraftView) {
  const width = element ? BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE] : 2;
  const dash = element ? BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] : null;
  const activeAnchor = active !== null ? anchors[active] : undefined;
  return (
    <>
      {element && element.nodes.length >= 2 ? (
        <div
          data-path-draft=""
          className="pointer-events-none absolute"
          style={{
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            opacity: element.opacity ?? 1,
          }}
        >
          <PathSvg element={element} stroke={stroke} fill={fill} />
        </div>
      ) : null}
      <svg
        className={OVERLAY_SVG_CLASS}
        style={{ zIndex: PATH_OVERLAY_Z }}
        aria-hidden
        data-path-overlay=""
      >
        {band ? (
          <path
            data-path-band=""
            d={`M ${band.p0.x} ${band.p0.y} C ${band.c1.x} ${band.c1.y} ${band.c2.x} ${band.c2.y} ${band.p3.x} ${band.p3.y}`}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeDasharray={dash ?? undefined}
            strokeLinecap="round"
            opacity={0.6}
          />
        ) : null}
        {activeAnchor ? <HandleMarker anchor={activeAnchor} zoom={zoom} /> : null}
        {anchors.map((a, i) => (
          <NodeMarker
            key={i}
            at={a}
            zoom={zoom}
            corner={a.mode === 'corner'}
            selected={i === active}
          />
        ))}
        {ring ? (
          <circle
            data-path-ring={ring.kind}
            cx={ring.point.x}
            cy={ring.point.y}
            r={8 / zoom}
            strokeWidth={1.5 / zoom}
            className={
              ring.kind === 'close'
                ? 'fill-brand-500/20 stroke-brand-600 dark:stroke-brand-300'
                : 'fill-none stroke-brand-600 dark:stroke-brand-300'
            }
          />
        ) : null}
      </svg>
    </>
  );
}
