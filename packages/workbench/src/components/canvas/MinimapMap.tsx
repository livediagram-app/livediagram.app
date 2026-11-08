'use client';

// The Map's body in every editor (docs/specs/008-canvas/minimap.md in each product): the board's picture, the lit
// window over it and the dim around that, and the presses that move the view. Each app builds the picture with its
// own renderer (minimapPicture wraps it) and puts this in its own panel.
//
// The window and the dim are drawn on a layer of their own over the picture, in the same box and viewBox: a pan
// repaints that layer and not the picture, which Safari draws again in full each time anything over it repaints
// (canvas-performance.md "The Map is one image"; about 45 ms of every frame of a walk on a 100-room office).
//
// Geometry: the canvas transform is `scale(z) translate(o)` about the <main> centre, so the viewport centre in world
// coords is (W/2 - oₓ, H/2 - o_y) and the visible world rect is (W/z × H/z) around it; re-centring on a world point
// P is offset = (W/2 - Pₓ, H/2 - P_y). The SVG's viewBox IS world space, so getScreenCTM() maps a click or a scroll
// back to world coords (letterbox included).

import { useCallback, useRef } from 'react';
import { watchMapBox } from '../../lib/fit-clear-of-panel';

export type MinimapSize = 'short' | 'medium' | 'tall';
type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
export type MinimapPictureImage = Rect & { href: string };

// Padding around the content (a fraction of its size plus a floor) so elements never touch the map's edge.
const PAD_FRACTION = 0.12;
const PAD_MIN = 48;

// Panel body heights per map size, in Tailwind's 4px scale: h-24 = 96px, h-36 = 144px, h-56 = 224px.
const MAP_HEIGHT: Record<MinimapSize, string> = {
  short: 'h-24',
  medium: 'h-36',
  tall: 'h-56',
};
// The panel body's aspect ratio per map size (the w-64 panel over MAP_HEIGHT). The viewBox is grown on its short
// axis to THIS ratio so the map fills the panel edge to edge; a stale number here letterboxes.
const MAP_RATIO: Record<MinimapSize, number> = {
  short: 256 / 96,
  medium: 256 / 144,
  tall: 256 / 224,
};

const padOf = (bounds: Rect) => ({
  x: bounds.width * PAD_FRACTION + PAD_MIN,
  y: bounds.height * PAD_FRACTION + PAD_MIN,
});

// The board's picture from its drawn markup and content bounds: one image over the padded content box, so strokes
// and shadows past the corners still show. Null bounds (nothing drawn) map nothing.
export function minimapPicture(
  content: Rect | null,
  markup: string,
): { picture: MinimapPictureImage | null; bounds: Rect | null } {
  if (!content) return { picture: null, bounds: null };
  const pad = padOf(content);
  const box = {
    x: content.x - pad.x,
    y: content.y - pad.y,
    width: content.width + 2 * pad.x,
    height: content.height + 2 * pad.y,
  };
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" width="${box.width}" height="${box.height}">` +
    `${markup}</svg>`;
  return {
    // The app's own renderer's output (user text is escaped inside it), shown as an image.
    picture: { ...box, href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}` },
    bounds: content,
  };
}

export function MinimapMap({
  picture,
  bounds,
  size,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  setViewportZoom,
  zoomMin,
  zoomMax,
  mainSize,
  paperColor,
  dimOutside,
  dark,
  viewColors,
}: {
  picture: MinimapPictureImage | null;
  bounds: Rect;
  size: MinimapSize;
  viewportOffset: Point;
  viewportZoom: number;
  setViewportOffset: (offset: Point) => void;
  setViewportZoom: (zoom: number) => void;
  // The app's zoom range, which a scroll on the map keeps to.
  zoomMin: number;
  zoomMax: number;
  // The canvas <main>'s size, measured by the canvas that owns it.
  mainSize: { width: number; height: number };
  // The paper the canvas paints, behind the picture.
  paperColor: string;
  // Dim everything outside the current view (a persisted preference).
  dimOutside: boolean;
  // The canvas is dark paper: the dim is a black veil rather than a grey one.
  dark: boolean;
  // The window's colours, as the canvas marquee's (each app's selectionBoxColors).
  viewColors: { fill: string; stroke: string };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // A fit made before the Map showed may have put content under it (minimap.md "Fit leaves the Map clear"): say so
  // once its drawing has a box, a moment after it mounts (a fit then still finds none).
  const svgBox = useCallback((svg: SVGSVGElement | null) => {
    svgRef.current = svg;
    return svg ? watchMapBox(svg) : undefined;
  }, []);
  const draggingRef = useRef(false);

  const recentreToClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !mainSize.width) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const world = pt.matrixTransform(ctm.inverse());
    const nx = mainSize.width / 2 - world.x;
    const ny = mainSize.height / 2 - world.y;
    // Only write when it actually changes: setting an equal-valued new object every render would re-render forever
    // (max update depth).
    if (nx !== viewportOffset.x || ny !== viewportOffset.y) {
      setViewportOffset({ x: nx, y: ny });
    }
    return world;
  };

  const pad = padOf(bounds);
  // Padded content box, then grown on the short axis to the panel's aspect ratio so the map fills it with no
  // letterbox bars.
  let x0 = bounds.x - pad.x;
  let y0 = bounds.y - pad.y;
  let x1 = bounds.x + bounds.width + pad.x;
  let y1 = bounds.y + bounds.height + pad.y;
  const ratio = MAP_RATIO[size];
  if ((x1 - x0) / (y1 - y0) < ratio) {
    const grow = ((y1 - y0) * ratio - (x1 - x0)) / 2;
    x0 -= grow;
    x1 += grow;
  } else {
    const grow = ((x1 - x0) / ratio - (y1 - y0)) / 2;
    y0 -= grow;
    y1 += grow;
  }
  const vb = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;

  const w = mainSize.width;
  const h = mainSize.height;
  const z = viewportZoom || 1;
  const viewCx = w / 2 - viewportOffset.x;
  const viewCy = h / 2 - viewportOffset.y;
  // Visible-world rect, clamped to the padded content box so the window and the dimmed surround never spill past the
  // map's edges.
  const vx = Math.max(x0, viewCx - w / z / 2);
  const vy = Math.max(y0, viewCy - h / z / 2);
  const vx1 = Math.min(x1, viewCx + w / z / 2);
  const vy1 = Math.min(y1, viewCy + h / z / 2);
  const hasView = vx1 > vx && vy1 > vy;

  // Scroll on the map zooms the canvas in or out centred on that spot.
  const onWheel = (e: React.WheelEvent) => {
    const world = recentreToClient(e.clientX, e.clientY);
    if (!world) return;
    const factor = Math.exp(-e.deltaY / 200);
    setViewportZoom(Math.max(zoomMin, Math.min(zoomMax, viewportZoom * factor)));
  };

  return (
    // Clip the map to the panel's rounded bottom so its corners don't square off past the border.
    <div className="relative overflow-hidden rounded-b-lg">
      <svg
        ref={svgBox}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        className={`block w-full cursor-pointer touch-none text-slate-400 ${MAP_HEIGHT[size]}`}
        style={{ backgroundColor: paperColor }}
        role="img"
        aria-label="Canvas map: tap or drag to navigate, scroll to zoom"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          recentreToClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) recentreToClient(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onWheel={onWheel}
      >
        {/* The board's picture, as one image (minimapPicture). */}
        {picture ? (
          <image
            href={picture.href}
            x={picture.x}
            y={picture.y}
            width={picture.width}
            height={picture.height}
            preserveAspectRatio="none"
          />
        ) : null}
      </svg>
      {/* The window and the dim on a layer of their own: a pan repaints this layer and not the picture under it.
        Same box and viewBox as the picture's; presses fall through to it. */}
      <svg
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        data-minimap-view=""
        className="pointer-events-none absolute inset-0 block h-full w-full text-slate-400 [will-change:transform]"
      >
        {hasView ? (
          <>
            {/* Dim everything outside the current view (even-odd: outer box minus the view hole) so the lit window
              reads at a glance as where you are. Optional: on a dense board some people would rather read the whole
              map. */}
            {dimOutside ? (
              <path
                d={`M${x0} ${y0}H${x1}V${y1}H${x0}Z M${vx} ${vy}H${vx1}V${vy1}H${vx}Z`}
                fillRule="evenodd"
                className={dark ? 'fill-black/45' : 'fill-slate-500/25'}
              />
            ) : null}
            <rect
              x={vx}
              y={vy}
              width={vx1 - vx}
              height={vy1 - vy}
              rx={3}
              fill={viewColors.fill}
              stroke={viewColors.stroke}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
