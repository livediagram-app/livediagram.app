// A drawn shape part's paint in the headless SVG (each product's svg-render-shapes.ts), by its role in the shared
// geometry table (shape-geometry.ts), matching the canvas overlay's props for the same role. vector-effect keeps the
// stroke weight even under the stretched viewBox, supported by browsers and resvg alike.
import { SHAPE_DETAIL_STROKE_PX, type ShapePartRole } from './shape-geometry';
import { xmlEscape } from './svg-render-primitives';

export function shapeRoleAttrs(
  role: ShapePartRole,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): string {
  const f = xmlEscape(fill);
  const s = xmlEscape(stroke);
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  switch (role) {
    case 'main':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'outline':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} vector-effect="non-scaling-stroke"`;
    case 'detail':
      return ` fill="none" stroke="${s}" stroke-width="${SHAPE_DETAIL_STROKE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'limb':
    case 'head':
      return ` fill="${role === 'head' ? f : 'none'}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  }
}
