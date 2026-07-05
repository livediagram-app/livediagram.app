import { memo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  angledElbow,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowLabelAnchor,
  arrowPathD,
  arrowPathMidpoint,
  arrowStyleOf,
  BORDER_DASH_ARRAY,
  curveAnchorPoints,
  curveControlPoint,
  DEFAULT_BORDER_STYLE,
  defaultArrowStrokeColor,
  endpointPosition,
  type ArrowElement,
  type ElementIndex,
} from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';
import { arrowLabelFontSize, placeLabel } from '@/lib/arrow-label-geometry';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { elementAriaLabel } from '@/lib/element-names';
import { arrowheadMarkerId } from './arrow-defs';
import { ArrowLabel } from './ArrowLabel';
import { SelectedArrowHandles } from './SelectedArrowHandles';
import { ArrowFlowOverlays, useArrowFlow } from './arrow-flow';
import { BRAND_600 } from './arrow-handle-style';
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
  // Open the context menu beside the arrow rather than under the cursor /
  // finger, mirroring boxed elements: `elementMenuAnchor` owns the top-right
  // corner + flip-to-left + gap rule, applied to the arrow's on-screen
  // bounding box (the wide hit band's rect, so zoom / pan are baked in).
  // Falls back to the pointer position if the hit band can't be measured.
  const hitBandRef = useRef<SVGPathElement | null>(null);
  const contextSelectBeside = (x: number, y: number) => {
    const rect = hitBandRef.current?.getBoundingClientRect();
    const anchor = rect ? elementMenuAnchor(rect) : { x, y };
    onContextSelect(arrow.id, anchor.x, anchor.y);
  };
  // Touch long-press opens the arrow's context menu (touch has no
  // right-click); a press that moves becomes a select / drag instead.
  const longPress = useLongPress(contextSelectBeside);
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
  // Flow derivations + the phase-sync pinning (spec/09) live in
  // useArrowFlow; the visible path below mounts flowPathRef and the
  // travelling overlays render via ArrowFlowOverlays.
  const { flowFactor, flowPathClass, flowPathDash, flowPathRef, flowDotRef, flowCometRef } =
    useArrowFlow(arrow);
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
    style === 'curved' && !curveAnchors
      ? curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to)
      : null;
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
    // Screen-reader name (spec/71): arrows are SVG, so the group carries
    // the same kind-plus-label name a boxed element's wrapper does.
    <g style={{ opacity }} role="img" aria-label={elementAriaLabel(arrow)}>
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
        ref={hitBandRef}
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          contextSelectBeside(e.clientX, e.clientY);
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

      <ArrowFlowOverlays
        arrow={arrow}
        pathD={pathD}
        strokeWidth={strokeWidth}
        baseStroke={baseStroke}
        flowFactor={flowFactor}
        dotRef={flowDotRef}
        cometRef={flowCometRef}
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
          onSelect={(e) => onSelect(arrow.id, e)}
          onContextMenu={(e) => contextSelectBeside(e.clientX, e.clientY)}
        />
      ) : null}

      {isSelected && !isPaintMode && !readOnly ? (
        <SelectedArrowHandles
          arrow={arrow}
          from={from}
          to={to}
          curveControl={curveControl}
          curveAnchors={curveAnchors}
          elbowPoint={elbowPoint}
          isLocked={isLocked}
          onBeginEndpointDrag={onBeginEndpointDrag}
          onBeginCurveDrag={onBeginCurveDrag}
          onBeginCurvePointDrag={onBeginCurvePointDrag}
          onAddCurvePoint={onAddCurvePoint}
          onDeleteCurvePoint={onDeleteCurvePoint}
          onBeginElbowDrag={onBeginElbowDrag}
        />
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
