import { useMemo } from 'react';
import {
  hitOutlinePathData,
  pickedByOutline,
  shapeHitOutline,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { strokeHitWidth } from '@/lib/whiteboard-tool';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';

/**
 * How a shape is picked on a whiteboard: by its drawn outline alone, or, once selected, by its box
 * too (it drags by its box). Either way its outline catches pointers, outside the box as well, so a
 * double-click on a selected shape's line reaches the shape. Null: by its box alone (a diagram
 * tab, or a kind that is not picked by its outline).
 */
export function outlineHit(
  element: Element,
  at: { onWhiteboard: boolean; selected: boolean },
): 'outline' | 'box-and-outline' | null {
  if (!at.onWhiteboard || !pickedByOutline(element)) return null;
  return at.selected ? 'box-and-outline' : 'outline';
}

// A whiteboard shape is picked by its drawn outline (docs/specs/023-draw-mode/draw-mode.md
// "Selecting"): not yet selected, its wrapper lets pointers through; selected, its box catches them
// too. This invisible copy of the outline (shape-hit.ts, the eraser's same
// geometry) catches them 6 screen px either side of the line, plus anywhere on a
// visible fill. It rides inside the wrapper, so it turns with the shape.
//
// `borderPx` is the wrapper's CSS border: a child's box starts inside it, so the
// svg steps back out over it to lie on the element's own box.
export function ShapeHitOutline({
  element,
  borderPx,
}: {
  element: ShapeElement;
  borderPx: number;
}) {
  const zoom = useCanvasZoom();
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
