import {
  memo,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ARROWHEAD_SHAPES,
  ARROWHEAD_SIZE_PX,
  angledElbow,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowLabelAnchor,
  arrowPathD,
  ANIMATION_SPEED_FACTOR,
  arrowPathMidpoint,
  arrowStyleOf,
  BORDER_DASH_ARRAY,
  curveAnchorPoints,
  curveControlPoint,
  DEFAULT_BORDER_STYLE,
  defaultArrowStrokeColor,
  endpointPosition,
  type ArrowElement,
  type ArrowFlow,
  type ArrowheadShape,
  type ArrowheadSize,
  type ElementIndex,
  type TextSize,
} from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';
import { arrowLabelFontSize, labelSize, placeLabel } from '@/lib/arrow-label-geometry';
import { useLongPress } from '@/hooks/ui/useLongPress';

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
  // Drag one control point of a multi-bend curve (curvePoints[index]).
  onBeginCurvePointDrag?: (id: string, index: number, e: ReactPointerEvent) => void;
  // Add a control point at a canvas position (fired by the "+" segment
  // handles shown while the arrow is selected).
  onAddCurvePoint?: (id: string, canvasX: number, canvasY: number) => void;
  // Remove the control point at `index` (right-click a point handle).
  onDeleteCurvePoint?: (id: string, index: number) => void;
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

// Per-flow path styling. Every flow except 'dots' (a travelling <circle>) and
// 'comet' (a small fleet of travelling dots) animates the line itself via a
// class; dashes / beads / draw / wind also swap in their own dash pattern,
// while pulse / grow / glow / rainbow / strobe keep the user's static stroke
// and just breathe opacity / thickness / a halo / its colour. A missing entry
// (no flow, or 'dots' / 'comet') leaves the path on its static style.
const FLOW_PATH_CLASS: Partial<Record<ArrowFlow, string>> = {
  dashes: 'lvd-arrow-flow',
  beads: 'lvd-arrow-beads',
  pulse: 'lvd-arrow-pulse',
  grow: 'lvd-arrow-grow',
  glow: 'lvd-arrow-glow',
  draw: 'lvd-arrow-draw',
  rainbow: 'lvd-arrow-rainbow',
  strobe: 'lvd-arrow-strobe',
  wind: 'lvd-arrow-wind',
};
// 'draw' normalises the path to pathLength=1, so its dash pattern is in those
// units (one full-length dash + an equal gap that the reveal slides through).
const FLOW_PATH_DASH: Partial<Record<ArrowFlow, string>> = {
  dashes: '8 6',
  beads: '0.1 12',
  draw: '1 1',
  wind: '16 10',
};
// 'comet' renders the head plus three trailing dots (decreasing size + opacity,
// staggered along the path) so it reads as a glowing dot with a fading tail.
const COMET_DOTS = [0, 1, 2, 3];

// The on-canvas arrow grips (endpoints, curve / elbow bend points) are fixed
// SVG shapes a few px across — fine for a mouse, fiddly for a fingertip. On
// coarse-pointer (touch) devices we lay an invisible larger hit circle over
// each one so there's a ~44px-diameter tap target (iOS HIG), without making
// the visible grip clunky on desktop. Evaluated once in the browser; guarded
// for the static-export build where `window` is absent. Mirrors the
// `pointer-coarse` hit pad the box resize handles use (element-parts.tsx).
const COARSE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;
const HANDLE_HIT_R = 22;

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
  onBeginCurvePointDrag,
  onAddCurvePoint,
  onDeleteCurvePoint,
  onBeginElbowDrag,
  onBeginLabelDrag,
  fontFamily,
}: ArrowViewProps) {
  const isLocked = arrow.locked === true || tabLocked;
  // Touch long-press opens the arrow's context menu (touch has no
  // right-click); a press that moves becomes a select / drag instead.
  const longPress = useLongPress((x, y) => onContextSelect(arrow.id, x, y));
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
    arrow.curvePoints,
  );
  const flowFactor = ANIMATION_SPEED_FACTOR[arrow.flowSpeed ?? 'normal'];
  const flowPathClass = arrow.flow ? FLOW_PATH_CLASS[arrow.flow] : undefined;
  const flowPathDash = arrow.flow ? FLOW_PATH_DASH[arrow.flow] : undefined;
  // Phase-sync flowing arrows (spec/09). CSS animations start counting from
  // when each element's animation is applied, so arrows whose flow was turned
  // on at different times drift apart. Pin every flow animation's startTime to
  // the shared document-timeline origin (0) via the Web Animations API, so all
  // flowing arrows are measured against ONE clock and same-speed siblings stay
  // in phase no matter when they were added or last changed. Re-runs on
  // flow / speed change (a speed change restarts the CSS animation).
  const flowPathRef = useRef<SVGPathElement>(null);
  const flowDotRef = useRef<SVGCircleElement>(null);
  // 'comet' is a group of dots; pin its whole subtree (each trailing dot keeps
  // its negative animation-delay, so they stay a phase-locked tail).
  const flowCometRef = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!arrow.flow || typeof window === 'undefined') return;
    const raf = window.requestAnimationFrame(() => {
      const pin = (a: Animation) => {
        try {
          a.startTime = 0;
        } catch {
          // Some engines disallow setting startTime on a CSS animation; the
          // arrow still flows, just not phase-locked. Best-effort.
        }
      };
      flowPathRef.current?.getAnimations().forEach(pin);
      flowDotRef.current?.getAnimations().forEach(pin);
      flowCometRef.current?.getAnimations({ subtree: true }).forEach(pin);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [arrow.flow, arrow.flowSpeed]);
  const midpoint = arrowPathMidpoint(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  // Bezier control point (only meaningful for curved arrows). The
  // curve drag handle sits exactly on this point, not on the
  // visual midpoint, since dragging the control point is what
  // actually changes the curve shape (the midpoint is a derived
  // by-product of the control point at t=0.5).
  // Multi-bend control points (absolute), for curved (smooth spline) OR
  // angled (polyline) arrows that carry explicit points. The single bow /
  // elbow handles below are used only when there are no explicit points.
  const curveAnchors =
    (style === 'curved' || style === 'angled') && arrow.curvePoints && arrow.curvePoints.length > 0
      ? curveAnchorPoints(from, to, arrow.curvePoints)
      : null;
  const curveControl =
    style === 'curved' && !curveAnchors ? curveControlPoint(from, to, arrow.curveOffset) : null;
  // Single elbow handle for an angled arrow with no explicit points; the
  // per-point handles take over once the user adds a bend.
  const elbowPoint =
    style === 'angled' && !curveAnchors
      ? angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset)
      : null;
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
          arrow.curvePoints,
        )
      : placeLabel(
          midpoint,
          labelText,
          elementIndex,
          arrow.id,
          arrowLabelFontSize(arrow.textSize),
          {
            dx: to.x - from.x,
            dy: to.y - from.y,
          },
        );
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
        ref={flowPathRef}
        d={pathD}
        fill="none"
        stroke={baseStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // 'draw' normalises the path length to 1 so its reveal dash maths is
        // length-independent (see FLOW_PATH_DASH + lvd-arrow-draw).
        pathLength={arrow.flow === 'draw' ? 1 : undefined}
        // Flowing arrow (spec/09): dashes / beads march a fixed pattern along
        // the path (the class animates stroke-dashoffset), overriding the
        // static strokeStyle dasharray; pulse / grow / glow animate the line in
        // place and keep it. Otherwise the shared dasharray lookup mirrors the
        // shape Border accordion's pattern row.
        className={flowPathClass}
        strokeDasharray={
          flowPathDash ?? BORDER_DASH_ARRAY[arrow.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? undefined
        }
        markerStart={
          arrow.arrowEnds === 'from' || arrow.arrowEnds === 'both' ? markerUrl : undefined
        }
        markerEnd={
          arrow.arrowEnds === 'to' || arrow.arrowEnds === 'both' || arrow.arrowEnds === undefined
            ? markerUrl
            : undefined
        }
        style={
          {
            pointerEvents: 'none',
            // Flow speed scales each path animation's duration; phase-sync
            // across arrows is pinned via the Web Animations API in the effect
            // below, not animation-delay. 'grow' needs the base stroke width to
            // breathe relative to it, 'glow' needs the stroke colour to tint the
            // halo.
            ...(flowPathClass ? { '--lvd-flow-speed': flowFactor } : {}),
            ...(arrow.flow === 'grow' ? { '--lvd-flow-w': `${strokeWidth}px` } : {}),
            ...(arrow.flow === 'glow' ? { '--lvd-flow-color': baseStroke } : {}),
          } as React.CSSProperties
        }
      />

      <path
        // The wide transparent hit band. Carries data-element-id so DOM
        // hit-testing (the eraser's elementsFromPoint, spec/09) resolves an
        // arrow the same way it resolves a boxed element's wrapper.
        data-element-id={arrow.id}
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextSelect(arrow.id, e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          longPress.onPointerDown(e);
          // Secondary / middle button: don't select-or-drag here. Right-click
          // is handled by onContextMenu (which preserves an active
          // multi-selection via handleElementContextSelect); collapsing the
          // selection on the right-click's pointerdown is what dropped the
          // other selected arrows. Middle-click falls through to the canvas
          // pan. Mirrors boxed elements, which never select on right-click.
          if (e.button !== 0) return;
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

      {/* Flowing arrow (spec/09), 'dots': a dot travels the path via CSS
          offset-path (reduced-motion-safe; freezes on export). Painted last so
          it rides on top of the line. */}
      {arrow.flow === 'dots' ? (
        <circle
          ref={flowDotRef}
          r={Math.max(3, strokeWidth * 1.6)}
          fill={baseStroke}
          className="lvd-arrow-dot"
          style={
            {
              offsetPath: `path('${pathD}')`,
              offsetRotate: '0deg',
              pointerEvents: 'none',
              '--lvd-flow-speed': flowFactor,
            } as React.CSSProperties
          }
          aria-hidden
        />
      ) : null}

      {/* Flowing arrow (spec/09), 'comet': a glowing dot trailing a fading tail.
          Same offset-path travel as 'dots' but a fleet of dots, each lagging
          the head by a fixed fraction of the loop (negative animation-delay)
          and shrinking / fading, so it reads as a comet. */}
      {arrow.flow === 'comet' ? (
        <g ref={flowCometRef} aria-hidden>
          {COMET_DOTS.map((i) => (
            <circle
              key={i}
              r={Math.max(1.5, strokeWidth * (1.7 - i * 0.32))}
              fill={baseStroke}
              className="lvd-arrow-dot"
              style={
                {
                  offsetPath: `path('${pathD}')`,
                  offsetRotate: '0deg',
                  pointerEvents: 'none',
                  opacity: 1 - i * 0.22,
                  // Lag scales with the speed factor so the tail length stays
                  // constant across slow / normal / fast.
                  animationDelay: `${-0.1 * i * flowFactor}s`,
                  '--lvd-flow-speed': flowFactor,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      ) : null}

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
          onSelect={(e) => onSelect(arrow.id, e)}
          onContextMenu={(e) => onContextSelect(arrow.id, e.clientX, e.clientY)}
        />
      ) : null}

      {isSelected && !isPaintMode && !readOnly ? (
        <>
          <EndpointHandle
            cx={from.x}
            cy={from.y}
            pinned={arrow.from.kind !== 'free'}
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
            pinned={arrow.to.kind !== 'free'}
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
          {curveAnchors && onBeginCurvePointDrag
            ? curveAnchors.map((a, i) => (
                <CurveHandle
                  key={i}
                  cx={a.x}
                  cy={a.y}
                  disabled={isLocked}
                  onPointerDown={(e) => {
                    // Primary button only. A right-click must fall through to
                    // onContextMenu (delete this point) WITHOUT arming a drag:
                    // arming one and then deleting the point on the same press
                    // leaves the drag pointing at a now-missing index, which
                    // crashes the snap maths on the next move.
                    if (isLocked || e.button !== 0) return;
                    e.stopPropagation();
                    onBeginCurvePointDrag(arrow.id, i, e);
                  }}
                  onContextMenu={
                    isLocked || !onDeleteCurvePoint
                      ? undefined
                      : (e) => {
                          // Right-click a control point to delete it.
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteCurvePoint(arrow.id, i);
                        }
                  }
                />
              ))
            : null}
          {/* "+" handles at each segment midpoint: a deliberate target for
              adding a control point (so points aren't added by an accidental
              line click). Hidden while locked / when no add handler. */}
          {onAddCurvePoint && !isLocked
            ? (() => {
                const poly = [from, ...(curveAnchors ?? []), to];
                return poly.slice(0, -1).map((p, i) => {
                  const q = poly[i + 1]!;
                  const mx = (p.x + q.x) / 2;
                  const my = (p.y + q.y) / 2;
                  return (
                    <AddPointHandle
                      key={`add-${i}`}
                      cx={mx}
                      cy={my}
                      onAdd={(e) => {
                        e.stopPropagation();
                        onAddCurvePoint(arrow.id, mx, my);
                      }}
                    />
                  );
                });
              })()
            : null}
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
  const grab = { pointerEvents: 'all', cursor: disabled ? 'default' : 'grab' } as const;
  return (
    <>
      {COARSE_POINTER ? (
        <circle
          cx={cx}
          cy={cy}
          r={HANDLE_HIT_R}
          fill="transparent"
          onPointerDown={onPointerDown}
          style={grab}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        stroke={BRAND_600}
        strokeWidth={2}
        onPointerDown={onPointerDown}
        style={grab}
      />
    </>
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
  onContextMenu,
}: {
  cx: number;
  cy: number;
  disabled: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  // Right-click handler (used by curve control points: right-click to delete).
  onContextMenu?: (e: ReactMouseEvent) => void;
}) {
  const size = 10;
  const grab = { pointerEvents: 'all', cursor: disabled ? 'default' : 'grab' } as const;
  return (
    <>
      {COARSE_POINTER ? (
        <circle
          cx={cx}
          cy={cy}
          r={HANDLE_HIT_R}
          fill="transparent"
          onPointerDown={onPointerDown}
          onContextMenu={onContextMenu}
          style={grab}
        />
      ) : null}
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
        onContextMenu={onContextMenu}
        style={grab}
      />
    </>
  );
}

// A small "+" handle sitting on a segment of the arrow line; clicking it adds
// a control point there. The deliberate target (vs clicking the line itself)
// is what keeps points from being added by accident on select / connect / drag.
function AddPointHandle({
  cx,
  cy,
  onAdd,
}: {
  cx: number;
  cy: number;
  onAdd: (e: ReactMouseEvent) => void;
}) {
  return (
    <g
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onAdd}
      style={{ pointerEvents: 'all', cursor: 'copy' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="white"
        stroke={BRAND_600}
        strokeWidth={1.5}
        opacity={0.9}
      />
      <path
        d={`M ${cx - 3} ${cy} h 6 M ${cx} ${cy - 3} v 6`}
        stroke={BRAND_600}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
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
  // Left-click the label to select the arrow (when it isn't draggable yet),
  // and right-click to open the arrow's context menu — without these the
  // click falls through to the canvas.
  onSelect?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
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
  onSelect,
  onContextMenu,
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
      {/* Dashed box signals the label is draggable (only when selected). */}
      {draggable ? (
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
      ) : null}
      {/* Transparent catcher, always on: when draggable it grabs the drag
          (slide the label along / across the line); otherwise a press selects
          the arrow. Double-click edits, right-click opens the arrow menu — so
          a click on the label never falls through to the canvas. */}
      <rect
        x={x - size.width / 2 - pad}
        y={y - size.height / 2 - pad}
        width={size.width + pad * 2}
        height={size.height + pad * 2}
        rx={5}
        fill="transparent"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (draggable && onStartDrag) onStartDrag(e);
          else onSelect?.(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        style={{ pointerEvents: 'all', cursor: draggable ? 'move' : 'pointer' }}
      />
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
