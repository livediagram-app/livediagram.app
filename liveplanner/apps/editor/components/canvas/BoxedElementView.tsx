import { memo, useRef, useState } from 'react';
import {
  BORDER_DASH_ARRAY,
  DEFAULT_BOX_RADIUS_PX,
  MIND_NODE_RADIUS_PX,
  cornerRadiusPx,
  finishBorderStroke,
  finishCornerFallbackPx,
  finishOwnCorner,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  PADDING_PX,
  defaultPadding,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  ownColours,
  isSelfDrawingShape,
  labelBodyInset,
  voteKeyOf,
  type ShapeMarker,
  type TextSize,
  withTagAccent,
  rotationOf,
  finishSplitsFace,
  faceFinishOf,
} from '@liveplanner/project';
import { renderLabel } from '@/components/canvas/element-labels';
import { ElementFaceRouter } from '@/components/canvas/ElementFaceRouter';
import { elementAriaLabel, elementRole } from '@/lib/element-names';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { useTextHug } from '@/components/canvas/useTextHug';
import { PageCornerFold } from '@/components/canvas/PageCornerFold';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { SketchOverlay, useSketchPaint } from '@/components/canvas/SketchOverlay';
import { SketchFace } from '@/components/canvas/SketchFace';
import { FaceFinishProvider } from '@/components/canvas/CanvasFinishContext';
import { useFaceFinishPass } from '@/components/canvas/useFaceFinishPass';
import { liveFiltersRedrawOnRepaint } from '@liveworkspace/workbench/lib/live-filter-cost';
import { AccentEdgeOverlay } from '@/components/canvas/AccentEdgeOverlay';
import { useTagColours } from '@/components/canvas/TagColoursContext';
import { useIsSketchBackdrop } from '@/lib/sketch-backdrop-store';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { indicatorBacking } from '@/components/canvas/indicator-items';
import { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useElementPopIn } from '@/components/canvas/useElementPopIn';
import { ElementVoteOverlay } from '@/components/canvas/ElementVoteOverlay';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { clearingInset } from '@/components/canvas/InsetContent';

import type { BoxedElementViewProps } from './BoxedElementView.types';
import { isPanThrough } from '@liveworkspace/workbench/hooks/canvas/pan-through';

// Wrapped in React.memo at the export below: with id-bearing
// callbacks the parent passes a single stable function per kind
// (rather than recreating per-element closures every render), so
// shallow prop equality on `element` + the per-id selection flags
// + `zoom` etc. lets BoxedElementView skip the work when only an
// unrelated element changed. Defaulting parameters happen inside
// the function body (rather than the destructure) so the memo's
// shallow check sees the underlying undefined vs concrete value
// rather than the defaulted boolean.
// How far a non-votable element recedes during a layer-scoped vote.
// Enough to push it back clearly, not so far it stops being legible
// context for the elements you ARE voting on.
const VOTE_DIMMED_OPACITY = 0.35;

function BoxedElementViewImpl({
  element,
  isSelected,
  isMultiSelected = false,
  onPlainClick,
  isEditing,
  editCursorAtEnd = false,
  showHandles,
  showAnchors,
  onBeginDrag,
  onShiftSelect,
  layerOpacity,
  votableInVote,
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onSetPageHeading,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onPressSessionButton,
  sessionStartBlocked,
  timerState,
  tabTimer,
  timerControls,
  onSetSessionConfig,
  onOpenElementSettings,
  commentSelfId,
  commentActions,
  actionSelfId,
  actionActions,
  onRollPicker,
  collab,
  onOpenComments,
  onOpenAction,
  onOpenNote,
  onEditLink,
  onOpenEditDialog,
  vote,
  selfId,
  voteMax,
  voteReviewActive,
  isVoteFocus,
  onCastVote,
  onRetractVote,
  onContextSelect,
  remoteSelectors,
  tabLocked,
  tabSummaries,
  readOnly,
  movable = true,
  fontFamily,
}: BoxedElementViewProps) {
  // Which paper this element sits on, for every colour it doesn't carry
  // itself (docs/specs/007-editor/editor-app.md): a Default tab stores no element colours at all, so on
  // a dark canvas this is where the greys come from.
  const surface = useCanvasSurface();
  const isLocked = element.locked === true || tabLocked;
  // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): another participant has this
  // element selected (remoteSelectors already excludes our own
  // selection) and holds it: a Viewer's selection only shows its badge. We block select / drag / edit and show a not-allowed
  // cursor so two people don't fight over the same element. Distinct
  // from `isLocked` above, which is the persisted user-set padlock.
  const remotelyLocked = remoteSelectors.some((s) => s.holds);
  // Clockwise rotation about the element centre. The resize handles stay
  // while rotated, turned with the box: resolveBoxedResize projects the drag
  // into the element's own frame and anchors the opposite side, it just
  // skips the axis-aligned snap. `isRotated` drives the wrapper transform.
  const rotation = rotationOf(element);
  const isRotated = rotation % 360 !== 0;
  // Layer-scoped vote (docs/specs/012-collaboration/vote-layer-scope.md). Only while casting is OPEN: after End
  // vote the canvas goes back to normal so the results walkthrough reads
  // against the full canvas. `votableInVote` already folds in the kind
  // rule, so a text element on the votable layer dims too — correct, it
  // can't take a dot either.
  const voteScoped = vote?.active === true && !!vote.voteLayerId;
  const voteDimmed = voteScoped && !votableInVote;
  const voteHighlighted = voteScoped && votableInVote === true;
  const label = element.label ?? '';
  const textSize: TextSize = element.textSize ?? 'scale';
  const defaultAlign = defaultTextAlign(element);
  const alignX = element.textAlignX ?? defaultAlign.x;
  const alignY = element.textAlignY ?? defaultAlign.y;
  // A skin a Behaviour element was once created with (the old light button
  // skin, the pre-redesign blue) reads as unset, so it follows the surface
  // like the fill and border do (behaviour-skin.ts).
  const own = ownColours(element);
  const textColor = own.text ?? defaultTextColor(element, surface);
  // The drawing style (docs/specs/008-canvas/finish.md): its own, else the tab's. Under Sketch the body is
  // the SketchOverlay below, in place of the wrapper's border and background.
  const finish = useElementFinish((element as { finish?: unknown }).finish);
  const faceFinish = faceFinishOf(element, finish);
  const sketchBackdrop = useIsSketchBackdrop(element.id);
  const sketch = useSketchPaint(
    element,
    finish,
    own.fill ?? defaultFillColor(element, surface),
    sketchBackdrop,
  );
  // Rendered where it belongs below (under the content, or over an image's picture); a function, as it reads the
  // border colour worked out further down.
  const sketchOverlay = () =>
    sketch ? (
      <SketchOverlay
        paint={sketch}
        width={element.width}
        height={element.height}
        fill={own.fill ?? defaultFillColor(element, surface)}
        stroke={remoteBorderColor ?? own.stroke ?? defaultStrokeColor(element, surface)}
      />
    ) : null;

  // Annotation marker (docs/specs/009-elements/annotations.md): a fixed-size note circle. Hovering it
  // floats its note above everything; clicking it (handled in the drag
  // engine's click-vs-drag test) opens the editable note popover.
  const isAnnotation = element.type === 'annotation';
  const [hovering, setHovering] = useState(false);

  // Right-click selects the element + asks the page to open a
  // context menu at the cursor. The page also keeps showing the
  // SelectionPopover (handled by the normal selection flow), so the
  // context menu is an additional surface, not a replacement.
  // The element's wrapper node, so the context-menu handlers can read its
  // live screen rect to anchor the menu at the bottom-right corner.
  const wrapperRef = useRef<HTMLDivElement>(null);
  // The face's own parts in its finish: Marker's frames and shapes, Professional's pills (finish.md "Faces").
  useFaceFinishPass(wrapperRef, faceFinish, element.id);

  // Gesture routing (press / double-click / context menu / long-press)
  // lives in useBoxedElementGestures; the wrapper JSX mounts its
  // handlers below.
  const { handleShapeDown, handleDoubleClick, handleContextMenu, handlePointerUp, longPress } =
    useBoxedElementGestures({
      element,
      wrapperRef,
      isEditing,
      remotelyLocked,
      isAnnotation,
      isMultiSelected,
      isSelected,
      vote,
      votableInVote,
      onCastVote,
      onShiftSelect,
      onPlainClick,
      onBeginDrag,
      onBeginEdit,
      onEditLink,
      onOpenEditDialog,
      onOpenNote,
      onContextSelect,
    });

  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isEditing
      ? 'cursor-text'
      : isLocked || !movable
        ? 'cursor-default'
        : 'cursor-move';

  // When at least one remote participant has selected this element, the
  // border / stroke colour is overridden with the first remote selector's
  // colour so the realtime "X is here" signal is glanceable from anywhere
  // on the canvas — not just from the small initial-badge.
  // The tab's tag colours, for a card's accent edge (docs/specs/009-elements/tag-colours.md).
  const tagColours = useTagColours();
  const remoteBorderColor = remoteSelectors.length > 0 ? remoteSelectors[0]!.color : null;
  const variant = describeVariant(
    element,
    isSelected,
    isMultiSelected,
    remoteBorderColor,
    surface,
    finish,
  );

  // The element's drawn corner, which its border overlay and its indicators both follow.
  const shapeKind = element.type === 'shape' ? element.shape : undefined;
  const cornerPx = cornerRadiusPx(
    element.type === 'shape' ? finishOwnCorner(element, finish) : undefined,
    element.width,
    element.height,
    // A mind node's default corner (docs/specs/009-elements/mind-node.md "Round nodes"), sharper under
    // Professional (docs/specs/008-canvas/finish.md).
    finishCornerFallbackPx(
      shapeKind === 'mind-node' ? MIND_NODE_RADIUS_PX : DEFAULT_BOX_RADIUS_PX,
      finish,
    ),
  );

  // An inline icon sits beside the label on a regular shape (the
  // dedicated 'icon' shape kind has its own glyph-above-caption render
  // above and is excluded here). Computed before the label so the editor
  // can render as a flex child (keeping the icon visible while typing).
  const inlineIcon = element.type === 'shape' && element.shape !== 'icon' && element.iconId;
  // A status marker (docs/specs/009-elements/shape-markers.md) sits just left of the label (or centred when the
  // shape has no label). Progress shapes render their own centred percentage,
  // so they skip it. Shares the icon+label flex layout below.
  const marker: ShapeMarker | undefined =
    element.type === 'shape' && !isSelfDrawingShape(element.shape) ? element.marker : undefined;
  // The one-shot pop-in entry class (docs/specs/008-canvas/canvas-and-palette.md) — see useElementPopIn.
  const popInClass = useElementPopIn();

  // A whiteboard text box hugs its text, growing with it while typed (useTextHug).
  const textHug = useTextHug(element, isEditing, fontFamily);

  const labelPadding = PADDING_PX[element.padding ?? defaultPadding(element)];
  // The element's indicators, placed before the label so the content can move out of their way.
  const indicators = useElementIndicators(
    element,
    { onFollowLink, onOpenComments, onOpenAction, onOpenNote, tabSummaries },
    { text: label, textSize, padding: labelPadding, alignX, alignY, inlineIcon: !!inlineIcon },
    cornerPx,
  );

  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    alignX,
    alignY,
    labelPadding,
    isEditing,
    (next, runs) => onCommitLabel(element.id, next, runs),
    onCancelEdit,
    editCursorAtEnd,
    fontFamily,
    onSetTextAlign,
    // Inline (flex-child) editor whenever the label shares its box with a
    // sibling glyph — an inline icon OR a status marker (docs/specs/009-elements/shape-markers.md). A
    // marker-only shape still lays out through ShapeInlineIconLayout, and
    // a full-box editor there contributes no flex width, so the marker
    // centred alone on top of the text while editing.
    !!inlineIcon || !!marker,
    textHug.label,
  );

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      // Screen-reader name (docs/specs/004-interface-design/canvas-accessibility.md): same naming the change log uses,
      // so 'Square "Login"' reads consistently across both surfaces. A face with controls of its own is a named group,
      // so its buttons stay reachable.
      role={elementRole(element)}
      aria-label={elementAriaLabel(element)}
      // What the face's own parts are drawn in (docs/specs/008-canvas/finish.md "Faces"; app/face-finish.css).
      data-face-finish={faceFinish}
      onPointerDown={(e) => {
        // A finger on a board's empty space pans the canvas instead (@liveworkspace/workbench/hooks/canvas/pan-through.ts).
        if (isPanThrough(e)) return;
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={(e) => {
        handleDoubleClick(e);
      }}
      onContextMenu={handleContextMenu}
      onPointerUp={handlePointerUp}
      onPointerEnter={isAnnotation ? () => setHovering(true) : undefined}
      onPointerLeave={isAnnotation ? () => setHovering(false) : undefined}
      // `group` so the vote stepper inside can fade up on element hover
      // (docs/specs/012-collaboration/session-tools.md) without threading a hover state through props.
      className={`group group/el absolute origin-center touch-none select-none ${
        popInClass
      } ${variant.className} ${cursor}`}
      style={{
        left: element.x,
        top: element.y,
        width: textHug.box?.width ?? element.width,
        height: textHug.box?.height ?? element.height,
        color: textColor,
        // Every word on the element in its face, so a face that writes its own (a progress value, a panel's
        // rows, a button) wears the tab's font and finish like its label does (docs/specs/008-canvas/finish.md).
        // Unset when nothing picks one, so the editor default still applies.
        ...(fontFamily ? { fontFamily } : {}),
        // Layer-scoped vote (docs/specs/012-collaboration/vote-layer-scope.md): elements off the votable layer stay
        // VISIBLE — you still need the canvas's context to judge what
        // you're voting on — but drop back so the votable set reads as the
        // foreground. Only while casting is open; once the vote ends the
        // canvas returns to normal for the results walkthrough.
        opacity:
          (element.opacity ?? 1) * (layerOpacity ?? 1) * (voteDimmed ? VOTE_DIMMED_OPACITY : 1),
        ...variant.style,
        // Spin about the centre (the wrapper already has origin-center).
        // The handles' frame in the grips layer turns by the same angle.
        //
        // The angle is ALSO published as --lvd-enter-rot, which the pop-in
        // entry keyframe multiplies into its scale. A keyframe that touches
        // `transform` replaces this inline value while it runs, so without
        // that variable a tilted element (any rotated shape, and every
        // sticker) popped in flat and then snapped to its angle at the end.
        ...(isRotated
          ? ({
              transform: `rotate(${rotation}deg)`,
              '--lvd-enter-rot': `${rotation}deg`,
            } as React.CSSProperties)
          : {}),
        // Deliberately do NOT raise z-index on plain selection. Keeping
        // the element at its natural paint order means selecting a
        // container doesn't jump it above the content layered on top of
        // it — users resize containers against their visible content.
        // While EDITING the label, though, raise it so the text the user
        // is typing isn't hidden behind elements painted above it. (The
        // selection handles live in the grips layer, SelectionChromeLayer.)
        ...(isEditing ? { zIndex: 10 } : {}),
      }}
    >
      {/* The hand-drawn body under the content (docs/specs/008-canvas/finish.md "Sketch"); an image's edge goes over
          its picture, below. */}
      {element.type !== 'image' ? sketchOverlay() : null}
      {/* Under Sketch everything the element draws over its body is drawn by hand, its words crisp
          (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too"); in WebKit, which re-runs
          the face's wobble on every repaint, it is drawn as it is (finish.md "In WebKit"). */}
      <FaceFinishProvider finish={faceFinish ?? 'flexible'}>
        <SketchFace
          active={finish === 'sketch' && finishSplitsFace(element) && !liveFiltersRedrawOnRepaint()}
        >
          <AccentEdgeOverlay
            element={withTagAccent(element, tagColours)}
            stroke={own.stroke ?? defaultStrokeColor(element, surface)}
          />
          <ShapeContentRouter
            element={element}
            textColor={textColor}
            chartPalette={chartPalette}
            fontFamily={fontFamily}
          />
          {/* CSS-rendered shapes (square / circle / stadium / browser) paint
          their border via the wrapper's CSS `border`, which can't draw the
          composite dash patterns. When one of those is picked, stroke the
          outline here instead (element-variant drops the CSS border to
          match). Solid / dashed / dotted stay on the cheaper CSS path. */}
          {element.type === 'shape' &&
          !sketch &&
          !isSvgRenderedShape(element.shape) &&
          !remoteBorderColor &&
          !isCssNativeBorderStyle(element.strokeStyle ?? DEFAULT_BORDER_STYLE) ? (
            <BoxBorderOverlay
              shape={element.shape}
              width={element.width}
              height={element.height}
              stroke={own.stroke ?? defaultStrokeColor(element, surface)}
              strokeWidth={BORDER_STROKE_PX[finishBorderStroke(element.strokeWidth, finish)]}
              dasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? ''}
              radiusPx={cornerPx}
            />
          ) : null}
          {/* A Page's turned-back bottom-right corner (docs/specs/009-elements/page-element.md). */}
          {element.type === 'shape' && element.shape === 'page' ? (
            <PageCornerFold
              width={element.width}
              height={element.height}
              fill={element.fillColor ?? '#ffffff'}
              stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
            />
          ) : null}
          {/* Whatever this element shows in place of a plain label: a pressable
          face, a drawn body, or the label itself. See ElementFaceRouter. */}
          <ElementFaceRouter
            element={element}
            isEditing={isEditing}
            readOnly={readOnly}
            fontFamily={fontFamily}
            collab={collab}
            commentActions={commentActions}
            actionSelfId={actionSelfId}
            actionActions={actionActions}
            commentSelfId={commentSelfId}
            tabTimer={tabTimer}
            timerControls={timerControls}
            timerState={timerState}
            sessionStartBlocked={sessionStartBlocked}
            onPressSessionButton={onPressSessionButton}
            onRollPicker={onRollPicker}
            onSetPageHeading={onSetPageHeading}
            onSetSessionConfig={onSetSessionConfig}
            onOpenElementSettings={onOpenElementSettings}
            label={label}
            labelNode={labelNode}
            // Clear of the indicators and on the label body (a cylinder's, under its lid).
            contentInset={clearingInset(indicators.layout?.inset, labelBodyInset(element))}
            textColor={textColor}
            isLocked={isLocked}
          />
        </SketchFace>
      </FaceFinishProvider>
      {element.type === 'image' ? sketchOverlay() : null}

      {isLocked ? <LockBadge /> : null}

      {remoteSelectors.length > 0 ? <RemoteSelectorsStrip selectors={remoteSelectors} /> : null}

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
      {/* A margin note shows its count on its own face (ArticleNoteFace). */}
      {indicators.layout ? (
        <ElementIndicators
          element={element}
          cornerPx={indicators.cornerPx}
          fill={indicatorBacking(own.fill ?? defaultFillColor(element, surface))}
          selected={isSelected}
          items={indicators.items}
          placed={indicators.layout}
        />
      ) : null}

      {/* Layer-scoped vote (docs/specs/012-collaboration/vote-layer-scope.md): a soft brand ring marking what CAN
          take a dot. Paired with the dimming of everything else — the two
          together answer "where do I click" without the user having to
          work out which layer each element is on. Pointer-events-none so
          it never intercepts the cast. */}
      {voteHighlighted ? (
        <div
          className="pointer-events-none absolute -inset-0.5 ring-2 ring-brand-400/70"
          style={{ borderRadius: 'inherit' }}
          aria-hidden
        />
      ) : null}

      {/* Dot-vote tally pill + winner ring (docs/specs/012-collaboration/session-tools.md) — see
          ElementVoteOverlay. */}
      <ElementVoteOverlay
        voteKey={voteKeyOf(element)}
        name={element.label ?? 'this element'}
        vote={vote}
        selfId={selfId}
        voteMax={voteMax}
        votableInVote={votableInVote}
        voteReviewActive={voteReviewActive}
        isVoteFocus={isVoteFocus}
        onRetractVote={onRetractVote}
        onCastVote={onCastVote}
      />

      {/* Selection chrome (resize / edge-grip handles), portalled into the
          grips layer above every element — see SelectionChromeLayer for the
          stacking rationale. */}
      <SelectionChromeLayer
        elementId={element.id}
        box={element}
        rotation={rotation}
        showHandles={showHandles}
        showAnchors={showAnchors}
        onBeginDrag={onBeginDrag}
      />

      {/* Hover preview: float this annotation's note above every element
          (docs/specs/009-elements/annotations.md). Suppressed while selected — the click/edit popover owns
          that surface then — and only when there's note text to show. */}
      {isAnnotation && hovering && !isSelected && !isEditing && element.note ? (
        <AnnotationHoverNote
          elementId={element.id}
          note={element.note}
          noteRich={element.noteRich}
        />
      ) : null}
    </div>
  );
}

// Default shallow-prop comparison is good enough here: `element` is
// reference-stable across renders that don't touch it (commit /
// commitTabs return new arrays only when something actually
// changed), every other prop is a primitive or an id-bearing
// callback that the parent keeps stable.
export const BoxedElementView = memo(BoxedElementViewImpl);
