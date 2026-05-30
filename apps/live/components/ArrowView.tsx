import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadSizeOf,
  arrowStyleOf,
  defaultArrowStrokeColor,
  endpointPosition,
  isBoxed,
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
  isEditing: boolean;
  onSelect: (e: ReactPointerEvent) => void;
  onBeginEndpointDrag: (end: ArrowEnd, e: ReactPointerEvent) => void;
  // Double-click on the arrow body fires this so the page can flip
  // the arrow into label-edit mode (mirrors boxed-element edit).
  onBeginEdit: () => void;
  onCommitLabel: (label: string) => void;
  onCancelEdit: () => void;
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
  isEditing,
  onSelect,
  onBeginEndpointDrag,
  onBeginEdit,
  onCommitLabel,
  onCancelEdit,
  onBeginTranslate,
}: ArrowViewProps) {
  const isLocked = arrow.locked === true;
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const markerUrl = `url(#${arrowheadMarkerId(arrowheadSizeOf(arrow))})`;
  const style = arrowStyleOf(arrow);
  const pathD = arrowPath(style, from, to, arrow.from, arrow.to);
  const midpoint = pathMidpoint(style, from, to, arrow.from, arrow.to);
  const labelText = arrow.label ?? '';
  const showLabel = isEditing || labelText.length > 0;
  const labelPos = showLabel
    ? placeLabel(midpoint, labelText, elements, arrow.id)
    : { x: midpoint.x, y: midpoint.y };

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
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isLocked || isPaintMode) return;
          onBeginEdit();
        }}
        style={{
          pointerEvents: 'stroke',
          cursor:
            arrow.from.kind === 'free' && arrow.to.kind === 'free' && !isLocked
              ? 'move'
              : hitCursor,
        }}
      />

      {showLabel ? (
        <ArrowLabel
          x={labelPos.x}
          y={labelPos.y}
          text={labelText}
          color={baseStroke}
          isEditing={isEditing}
          onCommit={onCommitLabel}
          onCancel={onCancelEdit}
        />
      ) : null}

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

// Geometric midpoint of the rendered path. Used as the anchor for
// label placement. Curves and L-elbows pick a point on the actual
// drawn geometry, not just the chord midpoint, so the label tracks
// the visible line.
function pathMidpoint(
  style: ReturnType<typeof arrowStyleOf>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
): { x: number; y: number } {
  if (style === 'angled') {
    // Elbow vertex sits on the bend, which reads as the natural
    // anchor for "this connector's middle".
    const horizontalFirst = chooseHorizontalFirst(from, to, fromEp, toEp);
    return horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  }
  if (style === 'curved') {
    // For a quadratic Bezier the t=0.5 point is the average of the
    // endpoints and the control point: 0.25*(P0 + 2*Pc + P2).
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const nx = -dy / len;
    const ny = dx / len;
    const offset = len * 0.25;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;
    return { x: 0.25 * from.x + 0.5 * cx + 0.25 * to.x, y: 0.25 * from.y + 0.5 * cy + 0.25 * to.y };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// Approximate label dimensions for collision avoidance. The rendered
// SVG <text> doesn't have a stable width until paint, so we estimate
// from the text length. The numbers are conservative — slightly
// overshooting means the placement leaves a comfortable gap rather
// than colliding.
const LABEL_HEIGHT_PX = 16;
const LABEL_CHAR_WIDTH_PX = 7;
const LABEL_GAP_PX = 8;

function labelSize(text: string): { width: number; height: number } {
  const trimmed = text || ' ';
  return {
    width: Math.max(24, trimmed.length * LABEL_CHAR_WIDTH_PX) + 8,
    height: LABEL_HEIGHT_PX + 4,
  };
}

// Choose a label position that doesn't overlap any boxed element on
// the canvas. Tries the four cardinal slots around the arrow's
// midpoint in priority order (right, below, left, above) and picks
// the first that fits. If all four collide, falls back to right
// rather than hiding the label — the user can drag the colliding
// element out of the way.
function placeLabel(
  midpoint: { x: number; y: number },
  text: string,
  elements: Element[],
  selfId: string,
): { x: number; y: number } {
  const size = labelSize(text);
  const halfH = size.height / 2;
  const halfW = size.width / 2;
  const candidates: { x: number; y: number }[] = [
    { x: midpoint.x + halfW + LABEL_GAP_PX, y: midpoint.y }, // right
    { x: midpoint.x, y: midpoint.y + halfH + LABEL_GAP_PX }, // below
    { x: midpoint.x - halfW - LABEL_GAP_PX, y: midpoint.y }, // left
    { x: midpoint.x, y: midpoint.y - halfH - LABEL_GAP_PX }, // above
  ];
  for (const c of candidates) {
    const rect = { x: c.x - halfW, y: c.y - halfH, width: size.width, height: size.height };
    if (!collidesWithBoxed(rect, elements, selfId)) return c;
  }
  return candidates[0]!;
}

function collidesWithBoxed(
  rect: { x: number; y: number; width: number; height: number },
  elements: Element[],
  selfId: string,
): boolean {
  for (const el of elements) {
    if (el.id === selfId || !isBoxed(el)) continue;
    if (
      rect.x < el.x + el.width &&
      rect.x + rect.width > el.x &&
      rect.y < el.y + el.height &&
      rect.y + rect.height > el.y
    ) {
      return true;
    }
  }
  return false;
}

type ArrowLabelProps = {
  x: number;
  y: number;
  text: string;
  color: string;
  isEditing: boolean;
  onCommit: (label: string) => void;
  onCancel: () => void;
};

// The label lives inside the per-arrow SVG so it stays in canvas
// space (and therefore inherits the zoom/pan transform). When the
// arrow is in edit mode we render an HTML input via <foreignObject>
// — that gives us native text-selection / IME / cursor behaviour
// instead of reinventing it in pure SVG.
function ArrowLabel({ x, y, text, color, isEditing, onCommit, onCancel }: ArrowLabelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  const size = labelSize(text);
  if (isEditing) {
    return (
      <foreignObject
        x={x - size.width / 2}
        y={y - size.height / 2}
        width={size.width}
        height={size.height}
        style={{ overflow: 'visible', pointerEvents: 'auto' }}
      >
        <input
          ref={inputRef}
          defaultValue={text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => onCommit(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value.trim());
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            e.stopPropagation();
          }}
          className="h-full w-full rounded bg-white px-1 text-center text-xs text-slate-800 shadow-sm outline-none ring-2 ring-sky-400"
        />
      </foreignObject>
    );
  }
  return (
    <g>
      <rect
        x={x - size.width / 2}
        y={y - size.height / 2}
        width={size.width}
        height={size.height}
        rx={4}
        fill="white"
        fillOpacity={0.85}
        style={{ pointerEvents: 'none' }}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fill={color}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {text}
      </text>
    </g>
  );
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
