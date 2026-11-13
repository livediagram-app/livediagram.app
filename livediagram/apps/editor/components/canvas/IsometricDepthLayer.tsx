import { memo, useMemo, type CSSProperties } from 'react';
import {
  defaultFillColor,
  defaultStrokeColor,
  isBoxed,
  type BoxedElement,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import {
  ISO_DEPTH_PLANE_PX,
  ISO_TILT_DEG,
  isoDepthShift,
  isoExtrudes,
  isoShapeSilhouette,
  isoWallSteps,
} from '@/lib/isometric';

// Isometric extrusion (docs/specs/008-canvas/isometric-view.md). For each boxed element this renders a column of
// copies of the element's outline, one every 2px of depth from just under the element to the floor, so it reads as
// a raised 3-D block.
//
// Non-interactive and rendered INSIDE Canvas's transformed wrapper while the wrapper carries
// `transform-style: preserve-3d` and the isometric tilt. The layer itself is FLAT ("The depth layer is one flat
// picture in the scene"): it sits ISO_DEPTH_PLANE_PX under the base plane, and each copy is drawn in it shifted by
// where its depth would put it under the camera (isoDepthShift, carried as --iso-hx / --iso-hy), so the whole
// extrusion is one picture the compositor moves, rather than a translateZ layer per copy (Chromium made each one a
// compositing layer of its own: 18,000 on a 1,200-box board, which held a collaborator's drag frame for seconds).
// It paints BEHIND the real element layer, which caps each column at z=0. Arrows and freehand strokes have no box,
// so they get no column and stay on the base plane (docs/specs/008-canvas/isometric-view.md).
const WALL_STEPS = isoWallSteps();
// Deepest first, so the shallower copies of a clipped column paint over them.
const WALL_STEPS_DEEPEST_FIRST = [...WALL_STEPS].reverse();

// The colour the extruded wall paints in: the element's own accent (its
// stroke), so each block's side matches the element rather than a flat black
// slab. Falls back to the fill, then a neutral slate, skipping `transparent`
// fills/strokes (image / table) which would give an invisible wall.
function wallColor(el: BoxedElement, surface: CanvasSurface): string {
  const stroke = el.strokeColor ?? defaultStrokeColor(el, surface);
  if (stroke && stroke !== 'transparent') return stroke;
  const fill = el.fillColor ?? defaultFillColor(el, surface);
  if (fill && fill !== 'transparent') return fill;
  return '#64748b'; // slate-500
}

// A copy `depthPx` under the layer's plane, shifted to where that depth lands on screen.
const shiftBy = (depthPx: number) =>
  `calc(var(--iso-hx) * ${depthPx}px) calc(var(--iso-hy) * ${depthPx}px)`;
const shade = (color: string, brightness: number) =>
  `color-mix(in srgb, ${color} ${Math.round(brightness * 10_000) / 100}%, black)`;

// One element's column. Columns paint back to front along the depth shift: one whose centre lies further along it
// is nearer the camera, so it covers the one behind it, as depth sorting did (a `z-index` from --iso-sx / --iso-sy,
// so an orbit reorders no node).
function IsoColumn({ el, surface }: { el: BoxedElement; surface: CanvasSurface }) {
  const color = wallColor(el, surface);
  // Clip each copy to the shape's own silhouette (circle, diamond, cylinder, ...) so the column follows the outline
  // instead of the bounding rectangle. Non-shape boxed elements (sticky / image / table / ...) and shapes without a
  // silhouette entry keep the default rounded rectangle.
  const silhouette = el.type === 'shape' ? isoShapeSilhouette(el.shape) : {};
  const cx = Math.round(el.x + el.width / 2);
  const cy = Math.round(el.y + el.height / 2);
  const place = {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    zIndex: `calc(var(--iso-sx) * ${cx} + var(--iso-sy) * ${cy})`,
  };
  if (silhouette.clipPath === undefined)
    // A rectangle, a rounded box, a circle or a pill: the box is the topmost copy and its shadows the rest
    // (globals.css [data-iso-wall]); a shadow follows the box's border-radius.
    return (
      <div
        data-iso-column=""
        data-ride-id={el.id}
        data-iso-wall=""
        className={silhouette.borderRadius === undefined ? 'absolute rounded-md' : 'absolute'}
        style={
          {
            ...place,
            borderRadius: silhouette.borderRadius,
            '--iso-wall': color,
          } as CSSProperties
        }
      />
    );
  // A clipped silhouette clips its shadows away too, so its copies are children.
  return (
    <div
      data-iso-column=""
      data-ride-id={el.id}
      className="absolute"
      style={place}
    >
      {WALL_STEPS_DEEPEST_FIRST.map(({ depthPx, brightness }) => (
        <div
          key={depthPx}
          className="absolute inset-0"
          style={{
            translate: shiftBy(depthPx),
            background: shade(color, brightness),
            clipPath: silhouette.clipPath,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: color, clipPath: silhouette.clipPath }}
      />
    </div>
  );
}

// The columns, built again only when the elements or the canvas's ink change: an orbit changes the layer's
// variables alone.
const IsoColumns = memo(function IsoColumns({
  elements,
  surface,
}: {
  elements: Element[];
  surface: CanvasSurface;
}) {
  return (
    <>
      {elements
        .filter(isBoxed)
        // Frames (section backdrops), plain text, and icon shapes (line-art +
        // Technology marks) stay FLAT on the base plane: see isoExtrudes,
        // shared with both exporters so screen + export can't drift.
        .filter(isoExtrudes)
        .map((el) => (
          <IsoColumn key={el.id} el={el} surface={surface} />
        ))}
    </>
  );
});

export function IsometricDepthLayer({
  elements,
  azimuth = ISO_TILT_DEG.z,
  elevation = ISO_TILT_DEG.x,
}: {
  elements: Element[];
  // The camera (useIsometricCamera), for where depth lands on screen.
  azimuth?: number;
  elevation?: number;
}) {
  // The walls take the element's own colours, and those fall back to the
  // canvas's ink when the element carries none (docs/specs/007-editor/editor-app.md).
  const surface = useCanvasSurface();
  const vars = useMemo(() => {
    const shift = isoDepthShift(azimuth, elevation);
    // The direction columns sort along: the depth shift's, at unit length.
    const a = (azimuth * Math.PI) / 180;
    return {
      '--iso-hx': shift.x,
      '--iso-hy': shift.y,
      '--iso-sx': Math.round(Math.sin(a) * 1000) / 1000,
      '--iso-sy': Math.round(Math.cos(a) * 1000) / 1000,
    };
  }, [azimuth, elevation]);
  return (
    // A ride plane whose every child is one element's column, tagged with the element's id: a drag's offset
    // writer (workbench drag-ride-dom, through the element layer's preview store, which writes under this
    // layer's parent) shifts each column with its element, or this whole layer as one transform on a very large
    // move, so a collaborator's drag moves the side faces with the tops without rendering this layer again
    // (docs/specs/008-canvas/drag-preview.md "An element's isometric side faces ride with it"). Its depth is a
    // `translate`, which composes with that transform.
    <div
      className="pointer-events-none absolute inset-0"
      style={{ translate: `0 0 ${-ISO_DEPTH_PLANE_PX}px`, ...vars }}
      aria-hidden
      data-iso-depth=""
      data-ride-plane=""
    >
      <IsoColumns elements={elements} surface={surface} />
    </div>
  );
}
