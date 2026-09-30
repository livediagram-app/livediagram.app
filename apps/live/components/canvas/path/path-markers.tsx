import type { PathAnchor } from '@livediagram/document';

type Point = { x: number; y: number };

// Screen px (blueprint path-tool P13): a node's circle and a handle's dot. Drawn in canvas px
// divided by the zoom, so they keep their size at any zoom.
export const PATH_NODE_RADIUS_PX = 4;
export const PATH_HANDLE_RADIUS_PX = 3.5;

// An svg at the canvas origin that draws in canvas px and never takes a pointer.
export const OVERLAY_SVG_CLASS =
  'pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible';

// Brand on the board, rimmed in the board's own colour, 3:1 or better on both boards.
const MARK = 'stroke-brand-600 dark:stroke-brand-300';
const RIM = 'fill-white dark:fill-[#0d121a]';
const SOLID = 'fill-brand-600 dark:fill-brand-300';

/** A node: a circle (the first node of a path being drawn, a square), filled when selected. */
export function NodeMarker({
  at,
  zoom,
  first = false,
  selected = false,
}: {
  at: Point;
  zoom: number;
  first?: boolean;
  selected?: boolean;
}) {
  const r = PATH_NODE_RADIUS_PX / zoom;
  const cls = `${selected ? SOLID : RIM} ${MARK}`;
  return first ? (
    <rect
      data-path-node=""
      x={at.x - r}
      y={at.y - r}
      width={2 * r}
      height={2 * r}
      strokeWidth={1.5 / zoom}
      className={cls}
    />
  ) : (
    <circle data-path-node="" cx={at.x} cy={at.y} r={r} strokeWidth={1.5 / zoom} className={cls} />
  );
}

/** A node's handles, or just the sides named: a thin line from the node and a dot at the end. */
export function HandleMarker({
  anchor,
  zoom,
  sides = ['in', 'out'],
}: {
  anchor: PathAnchor;
  zoom: number;
  sides?: readonly ('in' | 'out')[];
}) {
  const handles = sides
    .map((s) => (s === 'in' ? anchor.handleIn : anchor.handleOut))
    .filter((h): h is Point => !!h);
  return (
    <>
      {handles.map((h, i) => (
        <g key={i} data-path-handle="">
          <line
            x1={anchor.x}
            y1={anchor.y}
            x2={h.x}
            y2={h.y}
            strokeWidth={1 / zoom}
            className={MARK}
          />
          <circle
            cx={h.x}
            cy={h.y}
            r={PATH_HANDLE_RADIUS_PX / zoom}
            strokeWidth={1.5 / zoom}
            className={`${SOLID} ${MARK}`}
          />
        </g>
      ))}
    </>
  );
}
