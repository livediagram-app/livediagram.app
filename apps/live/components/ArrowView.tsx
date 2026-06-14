import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ARROWHEAD_SHAPES,
  ARROWHEAD_SIZE_PX,
  angledElbow,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowLabelAnchor,
  arrowPathD,
  arrowPathMidpoint,
  arrowStyleOf,
  BORDER_DASH_ARRAY,
  curveControlPoint,
  DEFAULT_BORDER_STYLE,
  defaultArrowStrokeColor,
  endpointPosition,
  isBoxed,
  type ArrowElement,
  type ArrowheadShape,
  type ArrowheadSize,
  type ElementIndex,
  type TextSize,
} from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';

type ArrowViewProps = {
  arrow: ArrowElement;
  // Prebuilt id -> element index (one per Canvas render) so each
  // arrow resolves its endpoints / label collisions with O(1) lookups
  // instead of scanning the whole element array twice per arrow.
  elementIndex: ElementIndex;
  isSelected: boolean;
  isPaintMode: boolean;
  isEditing: boolean;
  // Type-to-edit (spec/09): caret at end instead of select-all when the
  // label was seeded by the first typed character.
  editCursorAtEnd?: boolean;
  // True when the whole tab is locked (toggled from the tab ellipsis
  // menu). Treated the same as a per-arrow `arrow.locked === true`
  // — endpoint handles disabled, body drag suppressed, double-click
  // edit suppressed. Mirrors how BoxedElementView handles it.
  tabLocked: boolean;
  // View-only session. Suppresses every editing affordance the
  // popover doesn't already hide: the endpoint drag handles + the
  // curve handle. Body double-click for label edit is also blocked
  // by isLocked (which the caller sets when readOnly is on).
  readOnly?: boolean;
  // Arrow-id-bearing callbacks so the parent can pass a single
  // stable function per kind (rather than recreating per-element
  // closures every render). The child has `arrow.id` in scope and
  // forwards it where needed. This is what makes the React.memo
  // wrapper around the export viable: with pre-bound callbacks,
  // every parent render would invalidate the memo via fresh
  // function identities.
  onSelect: (id: string, e: ReactPointerEvent) => void;
  // Right-click: select the arrow + open its context menu at the cursor.
  onContextSelect: (id: string, screenX: number, screenY: number) => void;
  onBeginEndpointDrag: (id: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  // Double-click on the arrow body fires this so the page can flip
  // the arrow into label-edit mode (mirrors boxed-element edit).
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCancelEdit: () => void;
  // Fires when the user drags the body of a fully-floating arrow
  // (both endpoints `kind === 'free'`). Pinned arrows are anchored
  // to their elements so the body isn't draggable. The handler is
  // responsible for the gesture's pointer-move + pointer-up plumbing.
  onBeginTranslate?: (id: string, e: ReactPointerEvent) => void;
  // Begin the curve drag gesture, when the arrow is curved and the
  // selected user grabs the curve handle. Receives the original
  // pointer event so the caller can hook up move/up listeners.
  onBeginCurveDrag?: (id: string, e: ReactPointerEvent) => void;
  // Same shape as curve drag, but for angled arrows: the elbow
  // handle lets the user drag the bend to a new position. Fires
  // only when the arrow is angled and the user grabs the elbow.
  onBeginElbowDrag?: (id: string, e: ReactPointerEvent) => void;
  // Begin dragging the label along the line / to either side. Fires
  // when the arrow is selected and the user grabs the label box.
  onBeginLabelDrag?: (id: string, e: ReactPointerEvent) => void;
  // Resolved CSS font-family for the arrow's label (spec/28). Arrows
  // have no per-element font, so this is the tab default; undefined =
  // the editor default.
  fontFamily?: string;
};

const BRAND_600 = 'rgb(2 132 199)';

// Wrapped in React.memo at the export below: with id-bearing
// callbacks the parent passes a single stable function per kind
// rather than recreating per-arrow closures every render, so
// shallow prop equality on `arrow` + `elementIndex` + the per-id
// selection flags lets ArrowView skip the work when only an
// unrelated arrow / element changed.
function ArrowViewImpl({
  arrow,
  elementIndex,
  isSelected,
  isPaintMode,
  isEditing,
  editCursorAtEnd = false,
  tabLocked,
  readOnly = false,
  onSelect,
  onContextSelect,
  onBeginEndpointDrag,
  onBeginEdit,
  onCommitLabel,
  onCancelEdit,
  onBeginTranslate,
  onBeginCurveDrag,
  onBeginElbowDrag,
  onBeginLabelDrag,
  fontFamily,
}: ArrowViewProps) {
  const isLocked = arrow.locked === true || tabLocked;
  const from = endpointPosition(arrow.from, elementIndex);
  const to = endpointPosition(arrow.to, elementIndex);
  const markerUrl = `url(#${arrowheadMarkerId(arrowheadShapeOf(arrow), arrowheadSizeOf(arrow))})`;
  const style = arrowStyleOf(arrow);
  const pathD = arrowPathD(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
  );
  const midpoint = arrowPathMidpoint(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
  );
  // Bezier control point (only meaningful for curved arrows). The
  // curve drag handle sits exactly on this point, not on the
  // visual midpoint, since dragging the control point is what
  // actually changes the curve shape (the midpoint is a derived
  // by-product of the control point at t=0.5).
  const curveControl = style === 'curved' ? curveControlPoint(from, to, arrow.curveOffset) : null;
  // Elbow point for angled arrows. Same draggable affordance as the
  // curve handle: drag to move the bend. The handle sits exactly on
  // the elbow (the midpoint helper already returns this point for
  // angled arrows, but we recompute here to keep the symmetry with
  // curveControl explicit at the call site).
  const elbowPoint =
    style === 'angled' ? angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset) : null;
  const labelText = arrow.label ?? '';
  const showLabel = isEditing || labelText.length > 0;
  // When the user has dragged the label, anchor it to their chosen
  // {t, offset} on the line; otherwise auto-place it around the
  // midpoint dodging nearby boxes.
  const labelPos = !showLabel
    ? { x: midpoint.x, y: midpoint.y }
    : arrow.labelOffset
      ? arrowLabelAnchor(
          style,
          from,
          to,
          arrow.from,
          arrow.to,
          arrow.curveOffset,
          arrow.elbowOffset,
          arrow.labelOffset,
        )
      : placeLabel(midpoint, labelText, elementIndex, arrow.id, arrowLabelFontSize(arrow.textSize));
  // The label box is draggable (and shows its dashed selection box)
  // when the arrow is selected and editable.
  const labelDraggable = isSelected && !isPaintMode && !readOnly && !isLocked && !isEditing;

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
        // Shared dasharray lookup with the shape Border accordion's
        // pattern row, so "dashed" / "dotted" arrows visually match
        // their box counterparts. Selection halo above stays solid
        // for visibility. `null` from the lookup (solid) becomes
        // undefined so the attribute is omitted.
        strokeDasharray={BORDER_DASH_ARRAY[arrow.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? undefined}
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
        // The wide transparent hit band. Carries data-element-id so DOM
        // hit-testing (the eraser's elementsFromPoint, spec/09) resolves an
        // arrow the same way it resolves a boxed element's wrapper.
        data-element-id={arrow.id}
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextSelect(arrow.id, e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(arrow.id, e);
          // Translate gesture only fires when both ends are
          // unpinned (a pinned end is anchored to its element so
          // there's nothing meaningful to drag).
          const bothFree = arrow.from.kind === 'free' && arrow.to.kind === 'free';
          if (bothFree && !isLocked && onBeginTranslate) onBeginTranslate(arrow.id, e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isLocked || isPaintMode) return;
          onBeginEdit(arrow.id);
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
          color={arrow.textColor ?? baseStroke}
          isEditing={isEditing}
          cursorAtEnd={editCursorAtEnd}
          fontFamily={fontFamily}
          textSize={arrow.textSize}
          textBold={arrow.textBold}
          textItalic={arrow.textItalic}
          textUnderline={arrow.textUnderline}
          textStrikethrough={arrow.textStrikethrough}
          draggable={labelDraggable && !!onBeginLabelDrag}
          onStartDrag={(e) => onBeginLabelDrag?.(arrow.id, e)}
          onEdit={() => onBeginEdit(arrow.id)}
          onCommit={(next) => onCommitLabel(arrow.id, next)}
          onCancel={onCancelEdit}
        />
      ) : null}

      {isSelected && !isPaintMode && !readOnly ? (
        <>
          <EndpointHandle
            cx={from.x}
            cy={from.y}
            pinned={arrow.from.kind === 'pinned'}
            disabled={isLocked}
            onPointerDown={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              onBeginEndpointDrag(arrow.id, 'from', e);
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
              onBeginEndpointDrag(arrow.id, 'to', e);
            }}
          />
          {curveControl && onBeginCurveDrag ? (
            <CurveHandle
              cx={curveControl.x}
              cy={curveControl.y}
              disabled={isLocked}
              onPointerDown={(e) => {
                if (isLocked) return;
                e.stopPropagation();
                onBeginCurveDrag(arrow.id, e);
              }}
            />
          ) : null}
          {elbowPoint && onBeginElbowDrag ? (
            // Angled-arrow elbow handle. Same affordance as the
            // curve handle (white square, brand-600 outline) so the
            // two read as siblings: each one bends its respective
            // arrow style. Sits exactly on the elbow point.
            <CurveHandle
              cx={elbowPoint.x}
              cy={elbowPoint.y}
              disabled={isLocked}
              onPointerDown={(e) => {
                if (isLocked) return;
                e.stopPropagation();
                onBeginElbowDrag(arrow.id, e);
              }}
            />
          ) : null}
        </>
      ) : null}
    </g>
  );
}

// Default shallow-prop comparison is sufficient: `arrow` is
// reference-stable across renders that don't touch it, `elements`
// is reference-stable for the same reason (commit/commitTabs only
// returns a new array when something actually changed), and every
// other prop is a primitive or a stable id-bearing callback.
export const ArrowView = memo(ArrowViewImpl);

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

// Curve drag handle. Visually distinct from the endpoint handles
// (square + smaller) so the user can tell at a glance which one
// moves an endpoint and which one bends the curve. Sits on the
// quadratic Bezier control point.
function CurveHandle({
  cx,
  cy,
  disabled,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  disabled: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const size = 10;
  return (
    <rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      fill="white"
      stroke={BRAND_600}
      strokeWidth={2}
      rx={2}
      onPointerDown={onPointerDown}
      style={{
        pointerEvents: 'all',
        cursor: disabled ? 'default' : 'grab',
      }}
    />
  );
}

function arrowheadMarkerId(shape: ArrowheadShape, size: ArrowheadSize): string {
  return `arrowhead-${shape}-${size}`;
}

// Approximate label dimensions for collision avoidance. The rendered
// SVG <text> doesn't have a stable width until paint, so we estimate
// from the text length. The numbers are conservative — slightly
// overshooting means the placement leaves a comfortable gap rather
// than colliding.
const LABEL_HEIGHT_PX = 16;
const LABEL_CHAR_WIDTH_PX = 7;
const LABEL_GAP_PX = 8;

function labelSize(text: string, fontSize = 12): { width: number; height: number } {
  const trimmed = text || ' ';
  const scale = fontSize / 12;
  return {
    width: Math.max(24, trimmed.length * LABEL_CHAR_WIDTH_PX * scale) + 8,
    height: LABEL_HEIGHT_PX * scale + 4,
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
  elements: ElementIndex,
  selfId: string,
  fontSize = 12,
): { x: number; y: number } {
  const size = labelSize(text, fontSize);
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
  elements: ElementIndex,
  selfId: string,
): boolean {
  for (const el of elements.values()) {
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

// Arrow-label font size by preset, mirroring the boxed-label scale
// (sm 12 / md 14 / lg 20 / scale 18). Default 'sm' keeps the historic
// 12px label size for arrows authored before the field existed.
function arrowLabelFontSize(size: TextSize | undefined): number {
  switch (size) {
    case 'lg':
      return 20;
    case 'md':
      return 14;
    case 'scale':
      return 18;
    default:
      return 12;
  }
}

type ArrowLabelProps = {
  x: number;
  y: number;
  text: string;
  color: string;
  isEditing: boolean;
  // Caret at end instead of select-all on focus (type-to-edit, spec/09).
  cursorAtEnd?: boolean;
  // Resolved CSS font-family for the label text + editor (spec/28).
  fontFamily?: string;
  // Label-text formatting (spec/09): size preset + inline styles, applied
  // to the rendered <text>. Absent → default small / unstyled.
  textSize?: TextSize;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // When true (arrow selected + editable) the label shows a dashed
  // box + move cursor and can be dragged along / across the line.
  draggable?: boolean;
  onStartDrag?: (e: ReactPointerEvent) => void;
  // Double-click the label to re-edit its text.
  onEdit?: () => void;
  onCommit: (label: string) => void;
  onCancel: () => void;
};

// The label lives inside the per-arrow SVG so it stays in canvas
// space (and therefore inherits the zoom/pan transform). When the
// arrow is in edit mode we render an HTML input via <foreignObject>
// — that gives us native text-selection / IME / cursor behaviour
// instead of reinventing it in pure SVG.
function ArrowLabel({
  x,
  y,
  text,
  color,
  isEditing,
  cursorAtEnd = false,
  fontFamily,
  textSize,
  textBold,
  textItalic,
  textUnderline,
  textStrikethrough,
  draggable = false,
  onStartDrag,
  onEdit,
  onCommit,
  onCancel,
}: ArrowLabelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const node = inputRef.current;
      node.focus();
      if (cursorAtEnd) {
        const end = node.value.length;
        node.setSelectionRange(end, end);
      } else {
        node.select();
      }
    }
    // cursorAtEnd is fixed for the lifetime of an edit session, so
    // reading it once when editing begins is correct; intentionally
    // not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);
  const fontSize = arrowLabelFontSize(textSize);
  const size = labelSize(text, fontSize);
  // Underline + strikethrough combine into one text-decoration value.
  const decoration =
    [textUnderline ? 'underline' : '', textStrikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ') || undefined;
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
          style={{ fontFamily }}
          className="h-full w-full rounded bg-white px-1 text-center text-xs text-slate-800 shadow-sm outline-none ring-2 ring-sky-400"
        />
      </foreignObject>
    );
  }
  // A touch of padding so the dashed box + drag area sit just outside
  // the label text.
  const pad = 2;
  return (
    <g>
      {/* The label sits directly on the canvas with a transparent
          background — no fill plate behind the text. */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={textBold ? 600 : undefined}
        fontStyle={textItalic ? 'italic' : undefined}
        textDecoration={decoration}
        fill={color}
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily }}
      >
        {text}
      </text>
      {draggable ? (
        <>
          {/* Dashed box signals the label is draggable. */}
          <rect
            x={x - size.width / 2 - pad}
            y={y - size.height / 2 - pad}
            width={size.width + pad * 2}
            height={size.height + pad * 2}
            rx={5}
            fill="none"
            stroke={BRAND_600}
            strokeWidth={1}
            strokeDasharray="3 2"
            style={{ pointerEvents: 'none' }}
          />
          {/* Transparent catcher on top: grabs the drag (slide the
              label along / across the line) and double-click to edit. */}
          <rect
            x={x - size.width / 2 - pad}
            y={y - size.height / 2 - pad}
            width={size.width + pad * 2}
            height={size.height + pad * 2}
            rx={5}
            fill="transparent"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartDrag?.(e);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            style={{ pointerEvents: 'all', cursor: 'move' }}
          />
        </>
      ) : null}
    </g>
  );
}

// Inner geometry for one arrowhead shape, drawn in the marker's
// 0..10 viewBox with the attachment point at x≈9. `context-stroke`
// is the canonical SVG2 way to inherit the referencing line's colour
// through the marker boundary (currentColor didn't inherit reliably).
// The `-hollow` variants fill white and outline with the line colour;
// `line` is an open V with no fill.
function arrowheadMarkerShape(shape: ArrowheadShape) {
  switch (shape) {
    case 'triangle':
      return <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />;
    case 'triangle-hollow':
      return (
        <path d="M 0.6 1 L 9.4 5 L 0.6 9 z" fill="white" stroke="context-stroke" strokeWidth={1} />
      );
    case 'line':
      return (
        <path
          d="M 0 0 L 10 5 L 0 10"
          fill="none"
          stroke="context-stroke"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'circle':
      return <circle cx="5" cy="5" r="4.5" fill="context-stroke" />;
    case 'circle-hollow':
      return <circle cx="5" cy="5" r="4" fill="white" stroke="context-stroke" strokeWidth={1} />;
    case 'diamond':
      return <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="context-stroke" />;
    case 'diamond-hollow':
      return (
        <path
          d="M 0.7 5 L 5 0.7 L 9.3 5 L 5 9.3 z"
          fill="white"
          stroke="context-stroke"
          strokeWidth={1}
        />
      );
  }
}

export function ArrowDefs() {
  // One marker per (head shape x size preset) so an arrow can choose
  // its head shape and weight independently of the line's stroke
  // width. Symmetric shapes (circle / diamond) read the same at either
  // end; triangle / line flip via orient="auto-start-reverse".
  return (
    <defs>
      {ARROWHEAD_SHAPES.flatMap((shape) =>
        (Object.entries(ARROWHEAD_SIZE_PX) as [ArrowheadSize, number][]).map(([size, px]) => (
          <marker
            key={`${shape}-${size}`}
            id={arrowheadMarkerId(shape, size)}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={px}
            markerHeight={px}
            orient="auto-start-reverse"
          >
            {arrowheadMarkerShape(shape)}
          </marker>
        )),
      )}
    </defs>
  );
}
