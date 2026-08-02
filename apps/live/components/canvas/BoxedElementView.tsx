import { memo, useRef, useState } from 'react';
import {
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  MODE_BUTTON_SKIN,
  PADDING_PX,
  activeCommentCount,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  isLegacyModeButtonSkin,
  isOpenAction,
  isSelfDrawingShape,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';
import { renderLabel } from '@/components/canvas/element-labels';
import { PageMasthead } from '@/components/canvas/PageMasthead';
import { MindNodeHint } from '@/components/canvas/MindNodeHint';
import { LaneGutter } from '@/components/canvas/LaneGutter';
import { EntityView } from '@/components/canvas/EntityView';
import { isMobileViewportSync } from '@/lib/responsive';
import { elementAriaLabel } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { PageCornerFold } from '@/components/canvas/PageCornerFold';
import { ModeButtonFace } from '@/components/canvas/ModeButtonFace';
import { SessionButtonFace } from '@/components/canvas/SessionButtonFace';
import { RevealFace } from '@/components/canvas/RevealFace';
import { PickerFace } from '@/components/canvas/PickerFace';
import { PortalFace } from '@/components/canvas/PortalFace';
import { ReactionPadFace } from '@/components/canvas/ReactionPadFace';
import { CommentPinFace } from '@/components/canvas/CommentPinFace';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import { CollabFaceRouter } from '@/components/canvas/collab/CollabFaceRouter';
import { ChairView } from '@/components/canvas/collab/ChairView';
import { isCollabPanelShape, REACTION_DEFAULT } from '@livediagram/diagram';
import { DEFAULT_BUTTON_MODE } from '@livediagram/diagram';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { BadgeStrip, RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { AnnotationGlyph, AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { VideoView } from '@/components/canvas/VideoView';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { IconDropPreview, useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import { ElementVoteOverlay } from '@/components/canvas/ElementVoteOverlay';
import { describeLink } from '@/lib/link-label';
import { TableView } from '@/components/canvas/TableView';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { BrowserChrome, FreehandSvg } from '@/components/canvas/boxed-element-overlays';

import type { BoxedElementViewProps } from './BoxedElementView.types';

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
  multiSelectActive = false,
  isEditing,
  editCursorAtEnd = false,
  isPaintMode,
  showHandles,
  showAnchors,
  zoom,
  onBeginDrag,
  onShiftSelect,
  layerOpacity,
  votableInVote,
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onCommitTable,
  onSetRailLabel,
  onToggleChecklistItem,
  onSetPageHeading,
  isoDepth,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onPressModeButton,
  onPressSessionButton,
  sessionStartBlocked,
  timerState,
  revealedForMe,
  onToggleReveal,
  onRollPicker,
  collab,
  chairSitters,
  onEnterPortal,
  onFireReaction,
  reactionBurst,
  onReactionBurstDone,
  activeMode,
  onOpenComments,
  onOpenAction,
  onOpenNote,
  onEditLink,
  onEditCode,
  vote,
  selfId,
  voteMax,
  voteReviewActive,
  isVoteFocus,
  onCastVote,
  onRetractVote,
  onDropIcon,
  onLinkCell,
  imageContext,
  onContextSelect,
  remoteSelectors,
  badgeColor,
  tabLocked,
  tabSummaries,
  readOnly,
  fontFamily,
}: BoxedElementViewProps) {
  const isLocked = element.locked === true || tabLocked;
  // Concurrent-selection lock (spec/07): another participant has this
  // element selected (remoteSelectors already excludes our own
  // selection). We block select / drag / edit and show a not-allowed
  // cursor so two people don't fight over the same element. Distinct
  // from `isLocked` above, which is the persisted user-set padlock.
  const remotelyLocked = remoteSelectors.length > 0;
  // Clockwise rotation about the element centre. `isRotated` gates the
  // resize handles off while rotated: the resize math runs in canvas-
  // axis space, so dragging a corner of a spun box would make it
  // "swim". Setting it back to 0° (the Rotation menu / search palette's
  // reset) restores resize.
  const rotation = element.rotation ?? 0;
  const isRotated = rotation % 360 !== 0;
  // Layer-scoped vote (spec/96). Only while casting is OPEN: after End
  // vote the board goes back to normal so the results walkthrough reads
  // against the full diagram. `votableInVote` already folds in the kind
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
  // A pre-redesign Selection Mode button (spec/103) wore white-on-blue; it now
  // renders in today's skin, text included, so the two halves can't disagree.
  const textColor = isLegacyModeButtonSkin(element)
    ? MODE_BUTTON_SKIN.text
    : (element.textColor ?? defaultTextColor(element));

  // Annotation marker (spec/38): a fixed-size note circle. Hovering it
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

  // Gesture routing (press / double-click / context menu / long-press)
  // lives in useBoxedElementGestures; the wrapper JSX mounts its
  // handlers below.
  const { handleShapeDown, handleDoubleClick, handleContextMenu, longPress } =
    useBoxedElementGestures({
      element,
      wrapperRef,
      isEditing,
      remotelyLocked,
      isAnnotation,
      multiSelectActive,
      isMultiSelected,
      isSelected,
      vote,
      votableInVote,
      onCastVote,
      onShiftSelect,
      onBeginDrag,
      onBeginEdit,
      onEditLink,
      onEditCode,
      onOpenNote,
      imageContext,
      onContextSelect,
    });

  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
      : isEditing
        ? 'cursor-text'
        : isLocked
          ? 'cursor-default'
          : 'cursor-move';

  // When at least one remote participant has selected this element, the
  // border / stroke colour is overridden with the first remote selector's
  // colour so the realtime "X is here" signal is glanceable from anywhere
  // on the canvas — not just from the small initial-badge.
  const remoteBorderColor = remoteSelectors.length > 0 ? remoteSelectors[0]!.color : null;
  // Accent for the data-element fills (progress bar / ring, rail line, rating
  // stars): a remote selector colour wins, else the element's own stroke, else
  // the theme default stroke. Shared by the ProgressView / RailView / RatingView
  // branches below so they all read the same accent.
  const accent = remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element);
  const variant = describeVariant(element, isSelected, isMultiSelected, remoteBorderColor);

  // A comment pin (spec/136) shows its own count on its face, so the generic
  // badge is suppressed: the pin IS the badge, and two counts on one 40px
  // marker is one too many.
  const isCommentPin = element.type === 'shape' && element.shape === 'comment-pin';
  const commentCount = isCommentPin ? 0 : activeCommentCount(element.commentThread);
  // Assigned action (spec/68): the badge shows only while the action is
  // open; a done action stays on the element but stops shouting.
  const hasOpenAction = isOpenAction(element.action);
  // Both 'tab' and 'diagram' kinds get the "linked" badge; the
  // follow-handler dispatches off the kind via the parent's
  // onFollowLink callback. 'element' kind is the spec'd
  // jump-and-focus that isn't surfaced in the UI yet. A link-card is
  // EXCLUDED: the card itself is the link (its bottom half follows it),
  // so the corner badge would be redundant.
  const linked =
    element.type !== 'link-card' &&
    element.link !== undefined &&
    (element.link.kind === 'tab' || element.link.kind === 'diagram' || element.link.kind === 'url');

  // An inline icon sits beside the label on a regular shape (the
  // dedicated 'icon' shape kind has its own glyph-above-caption render
  // above and is excluded here). Computed before the label so the editor
  // can render as a flex child (keeping the icon visible while typing).
  const inlineIcon = element.type === 'shape' && element.shape !== 'icon' && element.iconId;
  // A status marker (spec/49) sits just left of the label (or centred when the
  // shape has no label). Progress shapes render their own centred percentage,
  // so they skip it. Shares the icon+label flex layout below.
  const marker: ShapeMarker | undefined =
    element.type === 'shape' && !isSelfDrawingShape(element.shape) ? element.marker : undefined;
  // Which surface each looping animation rides (wrapper box vs text
  // glyphs vs SVG outline), the pop-in entry class, and the CSS custom
  // properties the keyframes read (spec/09) — see useBoxedElementAnimation.
  const { labelAnimClass, svgAnim, wrapperAnimClass, animStyle } = useBoxedElementAnimation(
    element,
    textColor,
  );

  // An icon element's caption is confined to its own band — the complement
  // of the glyph band (spec/41, iconCaptionBand) — so the text can never
  // stack over the art. The label renders with the band's INTERNAL vertical
  // anchor (side captions centre on the glyph's row) and the JSX below wraps
  // it in the band container.
  const iconCaptionBand =
    element.type === 'shape' && element.shape === 'icon' ? captionBandClass(alignX, alignY) : null;

  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    alignX,
    iconCaptionBand ? captionBandAlignY(alignX, alignY) : alignY,
    PADDING_PX[element.padding ?? defaultPadding(element)],
    isEditing,
    (next, runs) => onCommitLabel(element.id, next, runs),
    onCancelEdit,
    editCursorAtEnd,
    zoom,
    fontFamily,
    onSetTextAlign,
    // Inline (flex-child) editor whenever the label shares its box with a
    // sibling glyph — an inline icon OR a status marker (spec/49). A
    // marker-only shape still lays out through ShapeInlineIconLayout, and
    // a full-box editor there contributes no flex width, so the marker
    // centred alone on top of the text while editing.
    !!inlineIcon || !!marker,
    labelAnimClass,
  );

  // Palette-icon drop target (spec/09 inline icons) — see
  // useIconDropTarget; the wrapper mounts its handlers below and the
  // IconDropPreview band renders while dragging over.
  const { acceptsIconDrop, dropSide, handleIconDragOver, handleIconDragLeave, handleIconDrop } =
    useIconDropTarget(element, onDropIcon);

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      // Screen-reader name (spec/71): same naming the change log uses,
      // so 'Square "Login"' reads consistently across both surfaces.
      role="img"
      aria-label={elementAriaLabel(element)}
      // Frames are tagged so isometric mode can settle them just under the
      // base plane (globals.css [data-iso] rule): a frame's big surface is
      // coplanar with its contents under preserve-3d, and coplanar layers
      // z-fight (flicker) while the camera orbits.
      data-frame={element.type === 'shape' && element.shape === 'frame' ? '' : undefined}
      onPointerDown={(e) => {
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerEnter={isAnnotation ? () => setHovering(true) : undefined}
      onPointerLeave={isAnnotation ? () => setHovering(false) : undefined}
      onDragOver={acceptsIconDrop ? handleIconDragOver : undefined}
      onDragLeave={acceptsIconDrop ? handleIconDragLeave : undefined}
      onDrop={acceptsIconDrop ? handleIconDrop : undefined}
      // `group` so the vote stepper inside can fade up on element hover
      // (spec/39) without threading a hover state through props.
      className={`group absolute origin-center touch-none select-none ${
        // A looping animation (spec/09) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
      } ${variant.className} ${cursor}`}
      style={{
        // Isometric depth stagger (spec/45) — see globals.css [data-iso].
        ...({ '--iso-z': isoDepth } as React.CSSProperties),
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: textColor,
        // Layer-scoped vote (spec/96): elements off the votable layer stay
        // VISIBLE — you still need the board's context to judge what
        // you're voting on — but drop back so the votable set reads as the
        // foreground. Only while casting is open; once the vote ends the
        // board returns to normal for the results walkthrough.
        opacity:
          (element.opacity ?? 1) * (layerOpacity ?? 1) * (voteDimmed ? VOTE_DIMMED_OPACITY : 1),
        ...variant.style,
        ...animStyle,
        // Spin about the centre (the wrapper already has origin-center).
        // Handles + anchors are children, so they rotate with the box.
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
        // selection handles get lifted separately via SelectionHandles.)
        ...(isEditing ? { zIndex: 10 } : {}),
      }}
    >
      <ShapeContentRouter
        element={element}
        labelAnimClass={labelAnimClass}
        accent={accent}
        textColor={textColor}
        remoteBorderColor={remoteBorderColor}
        isLocked={isLocked}
        isSelected={isSelected}
        readOnly={readOnly}
        onSetRailLabel={onSetRailLabel}
        onToggleChecklistItem={onToggleChecklistItem}
        chartPalette={chartPalette}
        fontFamily={fontFamily}
        svgAnim={svgAnim}
      />
      {/* CSS-rendered shapes (square / circle / stadium / browser) paint
          their border via the wrapper's CSS `border`, which can't draw the
          composite dash patterns. When one of those is picked, stroke the
          outline here instead (element-variant drops the CSS border to
          match). Solid / dashed / dotted stay on the cheaper CSS path. */}
      {element.type === 'shape' &&
      !isSvgRenderedShape(element.shape) &&
      !remoteBorderColor &&
      !isCssNativeBorderStyle(element.strokeStyle ?? DEFAULT_BORDER_STYLE) ? (
        <BoxBorderOverlay
          shape={element.shape}
          width={element.width}
          height={element.height}
          stroke={element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]}
          dasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? ''}
          radiusPx={element.borderRadius !== undefined ? BORDER_RADIUS_PX[element.borderRadius] : 8}
        />
      ) : null}
      {/* A Record's rows (spec/120), under its title label. */}
      {element.type === 'shape' && element.shape === 'entity' ? (
        <EntityView element={element} textColor={textColor} fontFamily={fontFamily} />
      ) : null}
      {/* A chair (spec/130): the furniture itself, plus whoever presence says
          is sitting in it. */}
      {element.type === 'shape' && element.shape === 'chair' ? (
        <ChairView element={element} sitters={chairSitters?.(element.id) ?? []} />
      ) : null}
      {/* A Lane's title gutter (spec/119), behind the label. */}
      {element.type === 'shape' && element.shape === 'lane' ? (
        <LaneGutter stroke={element.strokeColor ?? defaultStrokeColor(element)} alignX={alignX} />
      ) : null}
      {/* A Page's turned-back bottom-right corner (spec/100). */}
      {element.type === 'shape' && element.shape === 'page' ? (
        <PageCornerFold
          width={element.width}
          height={element.height}
          fill={element.fillColor ?? '#ffffff'}
          stroke={element.strokeColor ?? defaultStrokeColor(element)}
        />
      ) : null}
      {/* Browser-only HTML chrome overlay. SVG handles only the
          outer frame + divider so the user's border style applies;
          the dots / nav / URL bar render here so their geometry is
          fixed-pixel and doesn't deform with the box's aspect
          ratio. */}
      {element.type === 'shape' && element.shape === 'browser' ? (
        <BrowserChrome
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          zoom={zoom}
        />
      ) : null}

      {/* Mode button (spec/103): a pressable face instead of a plain label —
          the mode's glyph plus the author's call to action. Mid-edit it falls
          through to the normal label editor below, so the text is retyped like
          any other shape's. */}
      {element.type === 'shape' && element.shape === 'mode-button' && !isEditing ? (
        <ModeButtonFace
          mode={element.mode ?? DEFAULT_BUTTON_MODE}
          label={label}
          activeMode={activeMode}
          textColor={textColor}
          onPress={onPressModeButton ? () => onPressModeButton(element) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'session-button' && !isEditing ? (
        /* Session button (spec/105): starts a timer / vote / poll for the room. */
        <SessionButtonFace
          config={element.session}
          label={label}
          textColor={textColor}
          canStart={!!onPressSessionButton && !sessionStartBlocked}
          timerState={timerState}
          onPress={onPressSessionButton ? () => onPressSessionButton(element) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'reveal' && !isEditing ? (
        /* Reveal zone (spec/106): a cover, off for me / off for everyone. */
        <RevealFace
          label={label}
          textColor={textColor}
          strokeColor={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          revealedForAll={element.revealed === true}
          revealedForMe={!!revealedForMe}
          onToggleForMe={onToggleReveal ? () => onToggleReveal(element.id) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'picker' && !isEditing ? (
        /* Picker (spec/107): rolls a person or an option. */
        <PickerFace
          label={label}
          result={element.pickerResult}
          candidates={onRollPicker?.(element).candidates ?? []}
          textColor={textColor}
          onRoll={onRollPicker ? () => onRollPicker(element).roll() : undefined}
        />
      ) : element.type === 'shape' && isCollabPanelShape(element.shape) && !isEditing ? (
        /* The collaboration panels (spec/123 to spec/129): an estimate card,
           a temperature check, an idea box, an agenda, or a roll call. Like
           every other face above, mid-edit it falls through to the ordinary
           label editor below, so the title is retyped like any shape's. */
        <CollabFaceRouter element={element} label={label} textColor={textColor} collab={collab} />
      ) : element.type === 'shape' && element.shape === 'comment-pin' && !isEditing ? (
        /* Comment pin (spec/136): opens the SAME thread popover an ordinary
           element's comment badge opens — the pin is just an element whose
           only job is to carry a commentThread. */
        <CommentPinFace
          element={element}
          fill={remoteBorderColor ?? element.fillColor ?? defaultStrokeColor(element)}
          onOpenComments={onOpenComments ? () => onOpenComments(element.id) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'reaction-pad' && !isEditing ? (
        /* Reaction pad (spec/135): a pressable glyph. The burst it throws is
           rendered OUTSIDE this label stack, below, so it can overflow the
           element's box — a burst confined to the pad is a burst nobody
           notices. */
        <ReactionPadFace
          label={label}
          reaction={element.reaction ?? REACTION_DEFAULT}
          textColor={textColor}
          onFire={onFireReaction ? () => onFireReaction(element) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'portal' && !isEditing ? (
        /* Portal (spec/104): the drawn portal + its label, pressable when paired. */
        <PortalFace
          label={label || 'Portal'}
          strokeColor={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          targetName={onEnterPortal?.(element).targetName ?? null}
          onEnter={onEnterPortal?.(element).travel}
        />
      ) : element.type === 'annotation' ? (
        <AnnotationGlyph
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
        />
      ) : element.type === 'video' ? (
        <VideoView element={element} />
      ) : element.type === 'link-card' ? (
        <LinkCardView
          element={element}
          tabs={tabSummaries}
          onFollow={element.link ? () => onFollowLink(element.link!) : undefined}
        />
      ) : element.type === 'image' && imageContext ? (
        <ImageElementView
          element={element}
          ownerId={imageContext.ownerId}
          diagramId={imageContext.diagramId}
          shareCode={imageContext.shareCode}
          canOpenPicker={!!imageContext.onOpenPicker}
        />
      ) : element.type === 'freehand' ? (
        <>
          <FreehandSvg
            element={element}
            fill={element.fillColor ?? defaultFillColor(element)}
            stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          />
          {/* Render the label on top of the SVG path so a freehand
              can carry text the same way a shape does (the Editor
              panel's Text accordion lights up for it). Both the SVG
              and the label use absolute inset-0 so they overlay
              cleanly inside the element's bounding box. Skipped when
              there's no label AND we're not mid-edit, to avoid the
              empty placeholder taking up space and competing with
              the drawn stroke. */}
          {isEditing || label.length > 0 ? labelNode : null}
        </>
      ) : element.type === 'table' ? (
        <TableView
          element={element}
          isSelected={isSelected}
          readOnly={isLocked || readOnly}
          tabSummaries={tabSummaries}
          onCommitTable={onCommitTable}
          onLinkCell={onLinkCell}
          onFollowLink={onFollowLink}
          fontFamily={fontFamily}
          zoom={zoom}
        />
      ) : element.type === 'shape' && (inlineIcon || marker) ? (
        <ShapeInlineIconLayout
          element={element}
          showIcon={!!inlineIcon}
          marker={marker}
          markerSize={element.markerSize ?? 'scale'}
          position={element.iconPosition ?? 'left'}
          iconStroke={textColor}
          isEditing={isEditing}
          editor={labelNode}
          label={label}
          textColor={textColor}
          textSize={textSize}
          alignX={alignX}
          alignY={alignY}
          padding={PADDING_PX[element.padding ?? defaultPadding(element)]}
          fontFamily={fontFamily}
        />
      ) : element.type === 'shape' && isSelfDrawingShape(element.shape) ? (
        // Progress / rail / rating / chart elements draw their own content, so
        // they render no standard editable label.
        <></>
      ) : element.type === 'shape' && element.shape === 'page' ? (
        // A Page stacks a fixed masthead over its body (spec/100). The body
        // node positions itself `absolute inset-0`, so it gets a `relative`
        // region of its own that starts under the rule rather than the whole
        // box — that is what stops the prose from running up into the title.
        <div
          className="absolute inset-0 flex flex-col"
          style={{ padding: PADDING_PX[element.padding ?? defaultPadding(element)] }}
        >
          <PageMasthead
            element={element}
            readOnly={isLocked || readOnly}
            onSetHeading={onSetPageHeading}
            fontFamily={fontFamily}
            zoom={zoom}
          />
          {/* The body keeps its own padding, which reads as the gap under the
              rule; only the horizontal padding would double up, so the label's
              is left to do the work and this container has none. */}
          <div
            className="relative min-h-0 flex-1"
            style={{ marginInline: -PADDING_PX[element.padding ?? defaultPadding(element)] }}
          >
            {labelNode}
          </div>
        </div>
      ) : iconCaptionBand ? (
        // Icon caption band (spec/41): the label (and the inline editor while
        // typing) fills this positioned container instead of the whole box,
        // so the caption stays clear of the glyph in every alignment combo.
        <div className={`absolute ${iconCaptionBand}`}>{labelNode}</div>
      ) : (
        labelNode
      )}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? <IconDropPreview side={dropSide} /> : null}

      {/* Mind map (spec/118): the keys are the whole feature, and a hint on a
          palette tile is read once, months before it matters. Suppressed while
          editing (the keys mean something else in a label) and on touch, where
          there is no keyboard to hint at. */}
      {element.type === 'shape' &&
      element.shape === 'mind-node' &&
      isSelected &&
      !isMultiSelected &&
      !isEditing &&
      !isLocked &&
      !readOnly &&
      !isMobileViewportSync() ? (
        <MindNodeHint zoom={zoom} />
      ) : null}

      {/* The burst (spec/135), a sibling of the label stack rather than a
          child of it: the particles leave the pad's box on purpose, and the
          face above clips to its own rounded corners. */}
      {reactionBurst ? (
        <ReactionBurst
          reaction={reactionBurst.reaction}
          seed={reactionBurst.seed}
          onDone={() => onReactionBurstDone?.(element.id)}
        />
      ) : null}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {remoteSelectors.length > 0 ? (
        <RemoteSelectorsStrip zoom={zoom} selectors={remoteSelectors} />
      ) : null}

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
      {linked ||
      commentCount > 0 ||
      hasOpenAction ||
      (element.note && onOpenNote && !isAnnotation) ? (
        <BadgeStrip
          zoom={zoom}
          linked={linked}
          linkLabel={element.link ? describeLink(element.link, tabSummaries) : undefined}
          commentCount={commentCount}
          hasNote={!!element.note && !!onOpenNote && !isAnnotation}
          hasOpenAction={hasOpenAction}
          actionLabel={
            hasOpenAction
              ? `Assigned to ${element.action?.assignee.name?.trim() || 'a teammate'}`
              : undefined
          }
          badgeColor={badgeColor}
          onFollowLink={() => {
            if (element.link) onFollowLink(element.link);
          }}
          onOpenComments={() => onOpenComments(element.id)}
          onOpenNote={onOpenNote ? () => onOpenNote(element.id) : undefined}
          onOpenAction={() => onOpenAction(element.id)}
        />
      ) : null}

      {/* Layer-scoped vote (spec/96): a soft brand ring marking what CAN
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

      {/* Dot-vote tally pill + winner ring (spec/39) — see
          ElementVoteOverlay. */}
      <ElementVoteOverlay
        element={element}
        vote={vote}
        selfId={selfId}
        voteMax={voteMax}
        votableInVote={votableInVote}
        voteReviewActive={voteReviewActive}
        isVoteFocus={isVoteFocus}
        zoom={zoom}
        onRetractVote={onRetractVote}
        onCastVote={onCastVote}
      />

      {/* Selection chrome (resize / edge-grip handles) rides in its own
          layer ABOVE the elements — see SelectionChromeLayer for the
          stacking rationale. */}
      <SelectionChromeLayer
        elementId={element.id}
        zoom={zoom}
        rotation={rotation}
        showHandles={showHandles}
        showAnchors={showAnchors}
        onBeginDrag={onBeginDrag}
      />

      {/* Hover preview: float this annotation's note above every element
          (spec/38). Suppressed while selected — the click/edit popover owns
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
