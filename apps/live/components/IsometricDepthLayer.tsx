import { isBoxed, type Element } from '@livediagram/diagram';
import { isoDepthLayers, isoLayerColor } from '@/lib/isometric';

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

export function IsometricDepthLayer({ elements }: { elements: Element[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: 'preserve-3d' }}
      aria-hidden
    >
      {elements.filter(isBoxed).map((el) => (
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
              className="absolute inset-0 rounded-md"
              style={{
                transform: `translateZ(${z}px)`,
                background: isoLayerColor(i, DEPTH_LAYERS.length),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
