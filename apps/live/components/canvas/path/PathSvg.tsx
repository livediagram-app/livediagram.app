import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  pathAnchors,
  pathD,
  type PathElement,
} from '@livediagram/document';
import { FREEHAND_SVG_CLASS } from '@/components/canvas/boxed-element-overlays';

// A path element as the canvas draws it (docs/specs/023-whiteboard/path-tool.md; blueprint path-tool
// "Rendering"): its curve in canvas px, in an svg with a viewBox the size of its box, so the canvas
// zoom scales it like every other element. The path being drawn is this same component in the same
// layer (PathDraftLayer), so a path lands without a pixel changing. The export twin is
// svgPathElementShape.
export function PathSvg({
  element,
  stroke,
  fill,
  hitWidth,
}: {
  element: PathElement;
  stroke: string;
  fill: string;
  // Set when only the drawn line (and a closed path's fill) picks the path: the invisible line
  // this wide, in canvas px, catches pointers.
  hitWidth?: number;
}) {
  const w = Math.max(element.width, 1);
  const h = Math.max(element.height, 1);
  const d = pathD(pathAnchors(element, { x: 0, y: 0 }), element.closed);
  const width = BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE];
  const dash = BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const filled = element.closed && fill !== 'transparent';
  return (
    <svg
      className={FREEHAND_SVG_CLASS}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill={filled ? fill : 'none'}
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={dash ?? undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {hitWidth !== undefined ? (
        <path
          data-stroke-hit=""
          d={d}
          fill={filled ? 'transparent' : 'none'}
          stroke="transparent"
          strokeWidth={hitWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: filled ? 'all' : 'stroke' }}
        />
      ) : null}
    </svg>
  );
}
