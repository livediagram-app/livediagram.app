import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadSizeOf,
  arrowStyleOf,
  defaultArrowStrokeColor,
  endpointPosition,
  type ArrowElement,
  type ArrowheadSize,
  type Element,
  type Endpoint,
} from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';

type ArrowViewProps = {
  arrow: ArrowElement;
  elements: Element[];
  isSelected: boolean;
  isPaintMode: boolean;
  onSelect: (e: ReactPointerEvent) => void;
  onBeginEndpointDrag: (end: ArrowEnd, e: ReactPointerEvent) => void;
  // Fires when the user drags the body of a fully-floating arrow
  // (both endpoints `kind === 'free'`). Pinned arrows are anchored
  // to their elements so the body isn't draggable. The handler is
  // responsible for the gesture's pointer-move + pointer-up plumbing.
  onBeginTranslate?: (e: ReactPointerEvent) => void;
};

const BRAND_600 = 'rgb(2 132 199)';

export function ArrowView({
  arrow,
  elements,
  isSelected,
  isPaintMode,
  onSelect,
  onBeginEndpointDrag,
  onBeginTranslate,
}: ArrowViewProps) {
  const isLocked = arrow.locked === true;
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const markerUrl = `url(#${arrowheadMarkerId(arrowheadSizeOf(arrow))})`;
  const pathD = arrowPath(arrowStyleOf(arrow), from, to, arrow.from, arrow.to);

  // Per-arrow stroke colour overrides the default; selection ring sits
  // on top in brand-600 regardless so the user can still tell what's
  // selected on a coloured arrow.
  const baseStroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  // Per-arrow thickness with a small selected-state bump so the user
  // can tell the difference between "selected" and "thicker stroke".
  const baseStrokeWidth = arrow.strokeWidth ?? 2;
  const strokeWidth = isSelected ? baseStrokeWidth + 0.5 : baseStrokeWidth;
  const hitCursor = isPaintMode ? 'copy' : 'pointer';
  const opacity = arrow.opacity ?? 1;

  // The shared marker def uses `fill="context-stroke"` which resolves to
  // the *concrete* stroke paint of the referencing element. Setting
  // `stroke={baseStroke}` directly on the line (rather than via
  // currentColor) means context-stroke gets the real colour rather
  // than a chained `currentColor` keyword that ends up resolving on
  // the marker's own colour property.
  return (
    <g style={{ opacity }}>
      {isSelected ? (
        <path
          d={pathD}
          fill="none"
          stroke={BRAND_600}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.35}
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
      <path
        d={pathD}
        fill="none"
        stroke={baseStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerStart={
          arrow.arrowEnds === 'from' || arrow.arrowEnds === 'both' ? markerUrl : undefined
        }
        markerEnd={
          arrow.arrowEnds === 'to' || arrow.arrowEnds === 'both' || arrow.arrowEnds === undefined
            ? markerUrl
            : undefined
        }
        style={{ pointerEvents: 'none' }}
      />

      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(e);
          // Translate gesture only fires when both ends are
          // unpinned — a pinned end is anchored to its element so
          // there's nothing meaningful to drag.
          const bothFree = arrow.from.kind === 'free' && arrow.to.kind === 'free';
          if (bothFree && !isLocked && onBeginTranslate) onBeginTranslate(e);
        }}
        style={{
          pointerEvents: 'stroke',
          cursor:
            arrow.from.kind === 'free' && arrow.to.kind === 'free' && !isLocked
              ? 'move'
              : hitCursor,
        }}
      />

      {isSelected && !isPaintMode ? (
        <>
          <EndpointHandle
            cx={from.x}
            cy={from.y}
            pinned={arrow.from.kind === 'pinned'}
            disabled={isLocked}
            onPointerDown={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              onBeginEndpointDrag('from', e);
            }}
          />
          <EndpointHandle
            cx={to.x}
            cy={to.y}
            pinned={arrow.to.kind === 'pinned'}
            disabled={isLocked}
            onPointerDown={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              onBeginEndpointDrag('to', e);
            }}
          />
        </>
      ) : null}
    </g>
  );
}

type EndpointHandleProps = {
  cx: number;
  cy: number;
  pinned: boolean;
  disabled: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
};

function EndpointHandle({ cx, cy, pinned, disabled, onPointerDown }: EndpointHandleProps) {
  const fill = pinned ? BRAND_600 : 'white';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      stroke={BRAND_600}
      strokeWidth={2}
      onPointerDown={onPointerDown}
      style={{
        pointerEvents: 'all',
        cursor: disabled ? 'default' : 'grab',
      }}
    />
  );
}

function arrowheadMarkerId(size: ArrowheadSize): string {
  return `arrowhead-${size}`;
}

// Build the SVG `d` attribute that fits the arrow's selected style.
// Straight is a single line. Curved bows the chord out perpendicular
// to its midpoint by a fraction of its length (quadratic Bezier).
// Angled drops a single right-angle bend; the leg that runs first
// is chosen from the from-endpoint's anchor side when available, so
// arrows pinned on a horizontal edge leave horizontally first.
function arrowPath(
  style: ReturnType<typeof arrowStyleOf>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
): string {
  if (style === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (style === 'curved') {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    // Perpendicular unit vector (rotated 90° CCW). Bow out by a
    // quarter of the chord length so the curve reads as obviously
    // curved without ballooning into adjacent elements.
    const nx = -dy / len;
    const ny = dx / len;
    const offset = len * 0.25;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  }
  // angled
  const horizontalFirst = chooseHorizontalFirst(from, to, fromEp, toEp);
  const bx = horizontalFirst ? to.x : from.x;
  const by = horizontalFirst ? from.y : to.y;
  return `M ${from.x} ${from.y} L ${bx} ${by} L ${to.x} ${to.y}`;
}

function chooseHorizontalFirst(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
): boolean {
  // Anchor-driven first when available — pinned endpoints carry an
  // intrinsic direction (an E-anchored arrow should leave horizontally).
  if (fromEp.kind === 'pinned') {
    if (fromEp.anchor === 'e' || fromEp.anchor === 'w') return true;
    if (fromEp.anchor === 'n' || fromEp.anchor === 's') return false;
  }
  if (toEp.kind === 'pinned') {
    // Mirror: if the *to* end has a vertical anchor, the second leg
    // is vertical, so the first should be horizontal.
    if (toEp.anchor === 'n' || toEp.anchor === 's') return true;
    if (toEp.anchor === 'e' || toEp.anchor === 'w') return false;
  }
  // Free endpoints: travel along the longer axis first so the elbow
  // sits visually closer to the destination side, matching how
  // diagramming tools draw L-connectors.
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
}

export function ArrowDefs() {
  // One marker per arrowhead-size preset so arrows can choose head
  // weight independent of line thickness. `fill="context-stroke"` is
  // the canonical SVG2 way to make a marker pick up the referencing
  // line's stroke colour; modern Chrome / Firefox / Safari all
  // support it. currentColor didn't reliably inherit through the
  // marker boundary in every browser, leaving arrowheads stuck on
  // the default slate.
  return (
    <defs>
      {(Object.entries(ARROWHEAD_SIZE_PX) as [ArrowheadSize, number][]).map(([name, px]) => (
        <marker
          key={name}
          id={arrowheadMarkerId(name)}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={px}
          markerHeight={px}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      ))}
    </defs>
  );
}
