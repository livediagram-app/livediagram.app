import { useMemo } from 'react';
import {
  hitOutlinePathData,
  pickedByOutline,
  shapeHitOutline,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { strokeHitWidth } from '@/lib/whiteboard-tool';

/**
 * Whether the element is picked by its drawn outline right now: a shape of an
 * outline kind, on a whiteboard, not selected (a selected shape drags by its box).
 */
export function outlineHit(
  element: Element,
  at: { onWhiteboard: boolean; selected: boolean },
): element is ShapeElement {
  return at.onWhiteboard && !at.selected && pickedByOutline(element);
}

// A whiteboard shape not yet selected is picked by its drawn outline, not its box
// (docs/specs/023-whiteboard/whiteboard.md "Selecting"): its wrapper lets pointers
// through, and this invisible copy of the outline (shape-hit.ts, the eraser's same
// geometry) catches them 6 screen px either side of the line, plus anywhere on a
// visible fill. It rides inside the wrapper, so it turns with the shape.
//
// `borderPx` is the wrapper's CSS border: a child's box starts inside it, so the
// svg steps back out over it to lie on the element's own box.
export function ShapeHitOutline({
  element,
  zoom,
  borderPx,
}: {
  element: ShapeElement;
  zoom: number;
  borderPx: number;
}) {
  const outline = shapeHitOutline(element);
  const { line, fills } = useMemo(
    () => ({
      line: hitOutlinePathData(outline.lines),
      fills: outline.fills.map((points) => hitOutlinePathData([{ points, closed: true }])),
    }),
    [outline],
  );
  return (
    <svg
      data-shape-hit=""
      className="pointer-events-none absolute overflow-visible"
      style={{ left: -borderPx, top: -borderPx, width: element.width, height: element.height }}
      viewBox={`0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fills.map((d, i) => (
        <path
          key={i}
          data-shape-hit="fill"
          d={d}
          fill="transparent"
          style={{ pointerEvents: 'fill' }}
        />
      ))}
      <path
        data-shape-hit="line"
        d={line}
        fill="none"
        stroke="transparent"
        strokeWidth={strokeHitWidth(outline.halfWidth * 2, zoom)}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'stroke' }}
      />
    </svg>
  );
}
