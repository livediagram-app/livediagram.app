import { useDrawingAnimation } from '@/components/canvas/drawing-animation';
import {
  BORDER_DASH_ARRAY,
  DEFAULT_BORDER_STYLE,
  isCompoundPath,
  isHandDrawn,
  polygonStrokePx,
  pathElementD,
  type PathElement,
} from '@livepages/document';
import { FREEHAND_SVG_CLASS, StrokeHitPath } from '@/components/canvas/boxed-element-overlays';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';

// A path element as the canvas draws it (docs/specs/023-draw-mode/path-tool.md; blueprint path-tool
// "Rendering"): its curve in canvas px, in an svg with a viewBox the size of its box, so the canvas
// zoom scales it like every other element. The path being drawn is this same component in the same
// layer (PathDraftLayer), so a path lands without a pixel changing. The export twin is
// svgPathElementShape.
export function PathSvg({
  element,
  stroke,
  fill,
  hitPenWidth,
}: {
  element: PathElement;
  stroke: string;
  fill: string;
  // Set when only the drawn line (and a closed path's fill) picks the path: the invisible line
  // this wide, in canvas px, catches pointers.
  hitPenWidth?: number;
}) {
  const w = Math.max(element.width, 1);
  const h = Math.max(element.height, 1);
  // Every contour; a combined shape's holes show through (docs/specs/007-editor/logo-pages.md).
  const d = pathElementD(element, { x: 0, y: 0 });
  const fillRule = isCompoundPath(element) ? 'evenodd' : undefined;
  // A path follows its tab's finish (docs/specs/008-canvas/finish.md "Polygons and paths"): under Sketch and Marker
  // the element's SketchOverlay draws it (fill, shading and line) and this keeps only its hit line; under
  // Professional an unset line is Thin.
  const finish = useElementFinish(undefined);
  const handDrawn = isHandDrawn(finish);
  const width = polygonStrokePx({ strokeWidth: element.strokeWidth }, finish);
  const dash = BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const filled = element.closed && fill !== 'transparent';
  // A Drawing animation (docs/specs/028-animation/element-animations.md) on the drawn line.
  const anim = useDrawingAnimation(element, d, width, stroke);
  return (
    <>
      <svg
        className={FREEHAND_SVG_CLASS}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {anim.defs}
        <path
          {...anim.mainProps}
          d={d}
          fill={filled && !handDrawn ? fill : 'none'}
          fillRule={fillRule}
          stroke={handDrawn ? 'none' : stroke}
          strokeWidth={width}
          strokeDasharray={dash ?? undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hitPenWidth !== undefined ? (
          <StrokeHitPath
            penWidth={hitPenWidth}
            d={d}
            fill={filled ? 'transparent' : 'none'}
            fillRule={fillRule}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: filled ? 'all' : 'stroke' }}
          />
        ) : null}
      </svg>
      {anim.overlay}
    </>
  );
}
