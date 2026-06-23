import {
  defaultFillColor,
  defaultStrokeColor,
  isBoxed,
  type BoxedElement,
  type Element,
} from '@livediagram/diagram';
import { isoDepthLayers, isoLayerBrightness, isoShapeSilhouette } from '@/lib/isometric';

// Isometric extrusion (spec/45). For each boxed element this renders a column
// of translateZ-offset copies of the element's rectangle, descending from
// just under the element to the floor, so it reads as a raised 3-D block.
//
// Non-interactive and rendered INSIDE Canvas's transformed wrapper while the
// wrapper carries `transform-style: preserve-3d` and the isometric tilt: the
// translateZ stack only becomes visible depth once that ancestor tilts the
// z-axis into screen space. It paints BEHIND the real element layer, which
// caps each column at z=0. Arrows and freehand strokes have no box, so they
// get no column and stay on the base plane (spec/45).
const DEPTH_LAYERS = isoDepthLayers();

// The colour the extruded wall paints in: the element's own accent (its
// stroke), so each block's side matches the element rather than a flat black
// slab. Falls back to the fill, then a neutral slate, skipping `transparent`
// fills/strokes (text / image / table) which would give an invisible wall.
function wallColor(el: BoxedElement): string {
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
  if (stroke && stroke !== 'transparent') return stroke;
  const fill = el.fillColor ?? defaultFillColor(el);
  if (fill && fill !== 'transparent') return fill;
  return '#64748b'; // slate-500
}

export function IsometricDepthLayer({ elements }: { elements: Element[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: 'preserve-3d' }}
      aria-hidden
    >
      {elements.filter(isBoxed).map((el) => {
        const color = wallColor(el);
        // Clip each extruded layer to the shape's own silhouette (circle,
        // diamond, cylinder, …) so the column follows the outline instead of
        // the bounding rectangle. Non-shape boxed elements (text / sticky /
        // image / table / …) and shapes without a silhouette entry keep the
        // default rounded rectangle.
        const silhouette = el.type === 'shape' ? isoShapeSilhouette(el.shape) : {};
        const layerRadius = silhouette.borderRadius;
        // Computed once per element: a clip-path or explicit border-radius
        // drives the silhouette, otherwise the default rounded rectangle.
        const layerClass =
          layerRadius === undefined ? 'absolute inset-0 rounded-md' : 'absolute inset-0';
        return (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              transformStyle: 'preserve-3d',
            }}
          >
            {DEPTH_LAYERS.map((z, i) => (
              <div
                key={i}
                className={layerClass}
                style={{
                  transform: `translateZ(${z}px)`,
                  background: color,
                  clipPath: silhouette.clipPath,
                  borderRadius: layerRadius,
                  // Dim the element's colour toward the floor so the wall
                  // reads with ambient shading instead of a flat tint.
                  filter: `brightness(${isoLayerBrightness(i, DEPTH_LAYERS.length)})`,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
