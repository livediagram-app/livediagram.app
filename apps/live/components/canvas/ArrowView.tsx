import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  BORDER_DASH_ARRAY,
  DEFAULT_BORDER_STYLE,
  defaultArrowLabelColor,
  defaultArrowStrokeColor,
  KNOCKOUT_RADIUS_PX,
  routeBehindHoles,
  ROUTE_BEHIND_MARGIN,
  type ArrowElement,
  type ArrowLabelLayout,
  type Element,
  type ElementIndex,
} from '@livediagram/document';
import { sameLabelRender, type ArrowLabelRender } from '@/hooks/canvas/useArrowLabelLayouts';
import type { ArrowEnd } from '@/lib/canvas';
import { deriveArrowViewFrame } from './arrow-view-frame';
import { useRightClickRelease } from '@/hooks/canvas/useRightClickRelease';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { elementAriaLabel } from '@/lib/element-names';
import { ArrowHeadMarker, arrowheadMarkerId } from './arrow-defs';
import { ArrowLabel } from './ArrowLabel';
import { SelectedArrowHandles } from './SelectedArrowHandles';
import { ArrowFlowOverlays, useArrowFlow } from './arrow-flow';
import { BRAND_600 } from './arrow-handle-style';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { pressLedger } from '@/lib/double-press';

// The mask region + backdrop for route-behind (docs/specs/008-canvas/arrow-route-behind.md) and label
// knockouts (docs/specs/008-canvas/arrow-labels.md). Deliberately vast
// rather than fitted to the arrow: a curve can bow well outside its chord,
// and a region that ends where the geometry does clips the drawing instead
// of the boxes.
const MASK_SPAN = { origin: -100000, size: 200000 } as const;

type ArrowViewProps = {
  arrow: ArrowElement;
  // Prebuilt id -> element index (one per Canvas render) so each
  // arrow resolves its endpoints / label collisions with O(1) lookups
  // instead of scanning the whole element array twice per arrow.
  elementIndex: ElementIndex;
  // The boxes the canvas is drawing (hidden layers left out), the only ones
  // the line may pass behind: a box on a hidden layer must not leave a gap
  // around nothing (docs/specs/008-canvas/arrow-route-behind.md). Stable per render of the layer.
  occluders: readonly Element[];
  // This arrow's label layout + the knockouts its line takes, from the
  // layer's one label pass (docs/specs/008-canvas/arrow-labels.md).
  labelRender: ArrowLabelRender;
  // Lays the label out for text being typed, so the editor sits and wraps
  // where the label will land.
  draftLayout: (arrow: ArrowElement, text: string) => ArrowLabelLayout | null;
  isSelected: boolean;
  isPaintMode: boolean;
  isEditing: boolean;
  // Type-to-edit (docs/specs/008-canvas/canvas-and-palette.md): caret at end instead of select-all when the
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
  // Begin the curve drag gesture, when the arrow is curved and the
  // selected user grabs the curve handle. Receives the original
  // pointer event so the caller can hook up move/up listeners.
  onBeginCurveDrag?: (id: string, e: ReactPointerEvent) => void;
  // Drag one control point of a multi-bend curve (curvePoints[index]).
  onBeginCurvePointDrag?: (id: string, index: number, e: ReactPointerEvent) => void;
  // Press on the line: bend the arrow where it was grabbed once the pointer
  // travels (docs/specs/008-canvas/arrow-bending.md).
  onBeginArrowBend?: (id: string, e: ReactPointerEvent<SVGElement>) => void;
  // Remove the control point at `index` (right-click a point handle).
  onDeleteCurvePoint?: (id: string, index: number) => void;
  // Same shape as curve drag, but for angled arrows: the elbow
  // handle lets the user drag the bend to a new position. Fires
  // only when the arrow is angled and the user grabs the elbow.
  onBeginElbowDrag?: (id: string, e: ReactPointerEvent) => void;
  // Begin dragging the label along the line / to either side. Fires
  // when the arrow is selected and the user grabs the label box.
  onBeginLabelDrag?: (id: string, e: ReactPointerEvent) => void;
  // Resolved CSS font-family for the arrow's label (docs/specs/004-interface-design/fonts.md). Arrows
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
  occluders,
  labelRender,
  draftLayout,
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
  onBeginCurveDrag,
  onBeginCurvePointDrag,
  onBeginArrowBend,
  onDeleteCurvePoint,
  onBeginElbowDrag,
  onBeginLabelDrag,
  fontFamily,
}: ArrowViewProps) {
  // An arrow with no stroke of its own takes the canvas's ink (docs/specs/007-editor/live-app.md).
  const surface = useCanvasSurface();
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
  // Right-click opens on release, like every other element (docs/specs/008-canvas/canvas-and-palette.md).
  const arrowRightClick = useRightClickRelease((e) => contextSelectBeside(e.clientX, e.clientY));
  // Touch long-press opens the arrow's context menu (touch has no
  // right-click); a press that moves becomes a select / drag instead.
  const longPress = useLongPress(contextSelectBeside);
  // An arrow whose heads are a different colour from its line carries its
  // OWN marker, because the shared ones paint with `context-stroke`, which is
  // by definition the line's colour. Unset (the usual case) keeps using the
  // shared defs, so nothing changes for arrows that never asked.
  const headShape = arrowheadShapeOf(arrow);
  const headSize = arrowheadSizeOf(arrow);
  const ownHeadColor = arrow.arrowheadColor;
  const ownMarkerId = ownHeadColor ? `arrowhead-${arrow.id}` : null;
  const markerUrl = `url(#${ownMarkerId ?? arrowheadMarkerId(headShape, headSize)})`;
  // Endpoints / path / midpoint / handle points / label placement — the
  // pure per-render frame, resolved in arrow-view-frame.ts.
  const { from, to, pathD, curveAnchors, curveControl, elbowPoint } = deriveArrowViewFrame(
    arrow,
    elementIndex,
  );
  // While editing, the label follows the draft text: laid out live so the
  // editor, its wrap and the knockout move as you type.
  const [draft, setDraft] = useState<string | null>(null);
  const [draftSession, setDraftSession] = useState(isEditing);
  if (draftSession !== isEditing) {
    setDraftSession(isEditing);
    setDraft(null);
  }
  const draftText = draft ?? arrow.label ?? '';
  // An empty draft still needs a box to type into; size it for the placeholder.
  const editLayout = isEditing ? draftLayout(arrow, draftText.trim() ? draftText : 'Label') : null;
  const labelLayout = isEditing ? editLayout : labelRender.layout;
  const knockouts = isEditing
    ? [
        ...labelRender.knockouts.filter((k) => k !== labelRender.layout?.knockout),
        ...(editLayout?.knockout ? [editLayout.knockout] : []),
      ]
    : labelRender.knockouts;
  // Route behind boxes (docs/specs/008-canvas/arrow-route-behind.md). Where the line would cross an unrelated
  // box it breaks a little before it and resumes past it, so a fan of
  // arrows to nearby children doesn't draw over the children in between.
  //
  // Done as a MASK rather than by splitting the path into segments: the one
  // path keeps its dash pattern, its flow animation class, and its markers,
  // and N holes cost the same as one. Memoised on the element map identity
  // so a pan / selection re-render doesn't rescan every element per arrow.
  const behindHoles = useMemo(
    () => routeBehindHoles(arrow, from, to, occluders),
    [arrow, from, to, occluders],
  );
  // Only mint a mask when something actually cuts this arrow — the common
  // case is nothing in the way, and an empty mask is pure overhead.
  const maskHoles = [
    ...behindHoles.map((h) => ({ ...h, rx: ROUTE_BEHIND_MARGIN })),
    ...knockouts.map((k) => ({ ...k, rx: KNOCKOUT_RADIUS_PX })),
  ];
  const behindMaskId = maskHoles.length > 0 ? `lvd-behind-${arrow.id}` : null;
  const behindMask = behindMaskId ? `url(#${behindMaskId})` : undefined;
  // Flow derivations + the phase-sync pinning (docs/specs/008-canvas/canvas-and-palette.md) live in
  // useArrowFlow; the visible path below mounts flowPathRef and the
  // travelling overlays render via ArrowFlowOverlays.
  const { flowFactor, flowPathClass, flowPathDash, flowPathRef, flowDotRef, flowCometRef } =
    useArrowFlow(arrow);
  // The label box is draggable (and shows its dashed selection box)
  // when the arrow is selected and editable.
  const labelDraggable = isSelected && !isPaintMode && !readOnly && !isLocked && !isEditing;

  // Per-arrow stroke colour overrides the default; selection ring sits
  // on top in brand-600 regardless so the user can still tell what's
  // selected on a coloured arrow.
  const baseStroke = arrow.strokeColor ?? defaultArrowStrokeColor(surface);
  // Per-arrow thickness with a small selected-state bump so the user
  // can tell the difference between "selected" and "thicker stroke".
  const baseStrokeWidth = arrow.strokeWidth ?? 2;
  const strokeWidth = isSelected ? baseStrokeWidth + 0.5 : baseStrokeWidth;
  const hitCursor = isPaintMode ? 'copy' : 'pointer';
  // The line bends where it is grabbed, so an editable line says so.
  const bendCursor = isPaintMode || isLocked || readOnly ? hitCursor : 'grab';
  // Every press on this arrow (line, label, handles, move frame) passes the
  // double-press rule (docs/specs/008-canvas/arrow-bending.md): a press that pairs with the one
  // before never drags, and opens the label editor instead.
  const pairsWithLast = (e: ReactPointerEvent): boolean =>
    pressLedger.press({
      id: arrow.id,
      t: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      wasSelected: isSelected,
    }).pairs;
  // Opened on the RELEASE of the second press, not its pointerdown: the
  // browser moves focus as that press's default action, which would blur (and
  // so commit) an editor opened a moment earlier.
  const openEditor = () => {
    if (isLocked || isPaintMode) return;
    const done = () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', done);
    };
    // A cancelled press (a pinch, a lost pointer) opens nothing.
    const onUp = () => {
      done();
      onBeginEdit(arrow.id);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', done);
  };
  // For presses that do not select (label, handles, frame): true when it was
  // the second of a double, which then opens the editor.
  const guardPress = (e: ReactPointerEvent): boolean => {
    if (!pairsWithLast(e)) return false;
    openEditor();
    return true;
  };
  const opacity = arrow.opacity ?? 1;

  // The shared marker def uses `fill="context-stroke"` which resolves to
  // the *concrete* stroke paint of the referencing element. Setting
  // `stroke={baseStroke}` directly on the line (rather than via
  // currentColor) means context-stroke gets the real colour rather
  // than a chained `currentColor` keyword that ends up resolving on
  // the marker's own colour property.
  return (
    // Screen-reader name (docs/specs/004-interface-design/canvas-accessibility.md): arrows are SVG, so the group carries
    // the same kind-plus-label name a boxed element's wrapper does.
    <g style={{ opacity }} role="img" aria-label={elementAriaLabel(arrow)}>
      {ownMarkerId && ownHeadColor ? (
        <ArrowHeadMarker id={ownMarkerId} shape={headShape} size={headSize} color={ownHeadColor} />
      ) : null}
      {behindMaskId ? (
        // White paints, black cuts. The backdrop is deliberately vast
        // rather than the arrow's bbox: a curve can bow well outside the
        // chord, and a mask that ends where the chord does would clip the
        // bow instead of the boxes.
        <mask
          id={behindMaskId}
          maskUnits="userSpaceOnUse"
          // The mask REGION, stated explicitly. Without x/y/width/height a
          // mask defaults to -10%/120% of the referencing element's bounding
          // box, and anything outside that region is masked away. A straight
          // horizontal (or vertical) arrow has a zero-height bbox, so the
          // default region collapsed to a hairline and swallowed the
          // arrowhead — which sticks out above and below the line — along
          // with part of the stroke. Same vast box as the backdrop below.
          x={MASK_SPAN.origin}
          y={MASK_SPAN.origin}
          width={MASK_SPAN.size}
          height={MASK_SPAN.size}
        >
          <rect
            x={MASK_SPAN.origin}
            y={MASK_SPAN.origin}
            width={MASK_SPAN.size}
            height={MASK_SPAN.size}
            fill="white"
          />
          {maskHoles.map((h, i) => (
            <rect
              key={i}
              x={h.x}
              y={h.y}
              width={h.width}
              height={h.height}
              fill="black"
              rx={h.rx}
            />
          ))}
        </mask>
      ) : null}
      {isSelected ? (
        <path
          d={pathD}
          mask={behindMask}
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
        // The break itself. The hit band below is deliberately NOT masked:
        // the arrow stays clickable across the gap, so selecting one that
        // runs behind a box doesn't require finding a visible stub.
        mask={behindMask}
        fill="none"
        stroke={baseStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // 'draw' normalises the path length to 1 so its reveal dash maths is
        // length-independent (see FLOW_PATH_DASH + lvd-arrow-draw).
        pathLength={arrow.flow === 'draw' ? 1 : undefined}
        // Flowing arrow (docs/specs/008-canvas/canvas-and-palette.md): dashes / beads march a fixed pattern along
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
            // below, not animation-delay. The width-breathing flows (grow /
            // heartbeat / breathe) need the base stroke width to swell relative
            // to it; the halo flows (glow / shimmer) need the stroke colour to
            // tint it.
            ...(flowPathClass ? { '--lvd-flow-speed': flowFactor } : {}),
            ...(arrow.flow === 'grow' || arrow.flow === 'heartbeat' || arrow.flow === 'breathe'
              ? { '--lvd-flow-w': `${strokeWidth}px` }
              : {}),
            ...(arrow.flow === 'glow' || arrow.flow === 'shimmer'
              ? { '--lvd-flow-color': baseStroke }
              : {}),
            // Repeat off = the flow plays once and holds (docs/specs/008-canvas/canvas-and-palette.md).
            ...(arrow.flowRepeat === false ? { '--lvd-flow-iter': 1 } : {}),
          } as React.CSSProperties
        }
      />

      <path
        // The wide transparent hit band. Carries data-element-id so DOM
        // hit-testing (the eraser's elementsFromPoint, docs/specs/008-canvas/canvas-and-palette.md) resolves an
        // arrow the same way it resolves a boxed element's wrapper.
        data-element-id={arrow.id}
        ref={hitBandRef}
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onContextMenu={arrowRightClick.onContextMenu}
        onPointerUp={arrowRightClick.onPointerUp}
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
          const doubled = pairsWithLast(e);
          onSelect(arrow.id, e);
          // Select first: selecting resets the edit state, so the editor opens after.
          if (doubled) openEditor();
          // Pressing the line bends it once the pointer travels
          // (docs/specs/008-canvas/arrow-bending.md); a plain click only selects, and the second
          // press of a double-click never drags.
          if (!doubled && !isLocked && !isPaintMode && onBeginArrowBend) {
            onBeginArrowBend(arrow.id, e);
          }
        }}
        // Double-press is detected from presses (guardPress), which works for
        // touch too; the DOM dblclick only has to stay off the canvas.
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'stroke', cursor: bendCursor }}
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

      {labelLayout ? (
        <ArrowLabel
          layout={labelLayout}
          text={arrow.label ?? ''}
          fill={arrow.labelFill}
          color={defaultArrowLabelColor(arrow, surface)}
          isEditing={isEditing}
          cursorAtEnd={editCursorAtEnd}
          fontFamily={fontFamily}
          textBold={arrow.textBold}
          textItalic={arrow.textItalic}
          textUnderline={arrow.textUnderline}
          textStrikethrough={arrow.textStrikethrough}
          draggable={labelDraggable && !!onBeginLabelDrag}
          onStartDrag={(e) => onBeginLabelDrag?.(arrow.id, e)}
          onDraft={setDraft}
          onCommit={(next) => onCommitLabel(arrow.id, next)}
          onCancel={onCancelEdit}
          guardPress={guardPress}
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
          guardPress={guardPress}
          onBeginEndpointDrag={onBeginEndpointDrag}
          onBeginCurveDrag={onBeginCurveDrag}
          onBeginCurvePointDrag={onBeginCurvePointDrag}
          onDeleteCurvePoint={onDeleteCurvePoint}
          onBeginElbowDrag={onBeginElbowDrag}
        />
      ) : null}
    </g>
  );
}

// `arrow` and `elementIndex` are reference-stable across renders that don't
// touch them, and every other prop but the label render is a primitive or a
// stable id-bearing callback, so a shallow compare suffices for those.
export const ArrowView = memo(ArrowViewImpl, arrowViewPropsEqual);

// The label render is compared by value: the layer lays every label out
// afresh on each element change (docs/specs/008-canvas/arrow-labels.md).
export function arrowViewPropsEqual(a: ArrowViewProps, b: ArrowViewProps): boolean {
  const keys = Object.keys(a) as (keyof ArrowViewProps)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) =>
    k === 'labelRender' ? sameLabelRender(a.labelRender, b.labelRender) : Object.is(a[k], b[k]),
  );
}
