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
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  isEventStormingNote,
  isLegacyModeButtonSkin,
  isOpenAction,
  isSelfDrawingShape,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';
import { clearDockHoveredId, setDockHoveredId } from '@/lib/dock-preview';
import { renderLabel } from '@/components/canvas/element-labels';
import { ElementFaceRouter } from '@/components/canvas/ElementFaceRouter';
import { LaneGutter } from '@/components/canvas/LaneGutter';
import { EntityView } from '@/components/canvas/EntityView';
import { elementAriaLabel } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { PageCornerFold } from '@/components/canvas/PageCornerFold';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import { ChairView } from '@/components/canvas/collab/ChairView';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { BadgeStrip, RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { IconDropPreview, useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import { ElementVoteOverlay } from '@/components/canvas/ElementVoteOverlay';
import { describeLink } from '@/lib/link-label';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { BrowserChrome } from '@/components/canvas/boxed-element-overlays';

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
  photoDraft = false,
  photoMatched = false,
  photoReadAs,
  votableInVote,
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onCommitTable,
  onCommitHeaderSize,
  onSnapSeam,
  onSetRailLabel,
  onToggleChecklistItem,
  onSetPageHeading,
  onSetWebRows,
  onSetHeroCaptionLine,
  isoDepth,
  insertShiftX,
  insertShiftAnimates,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onPressModeButton,
  onPressFocusButton,
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
  // Which paper this element sits on, for every colour it doesn't carry
  // itself (spec/07): a Default tab stores no element colours at all, so on
  // a dark canvas this is where the greys come from.
  const surface = useCanvasSurface();
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
    : (element.textColor ?? defaultTextColor(element, surface));

  // Annotation marker (spec/38): a fixed-size note circle. Hovering it
  // floats its note above everything; clicking it (handled in the drag
  // engine's click-vs-drag test) opens the editable note popover.
  const isAnnotation = element.type === 'annotation';
  const [hovering, setHovering] = useState(false);
  // A workshop note (spec/139) reports the pointer being over it, so its host
  // can offer its free docking faces on hover as well as on selection. It is
  // published rather than held here because the affordances are drawn by the
  // elements layer, beside the note rather than inside it — docking is board
  // grammar, and this view is every board's.
  const isEsNote = isEventStormingNote(element);
  const reportsHover = isAnnotation || isEsNote;

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
  const { handleShapeDown, handleDoubleClick, handleContextMenu, handlePointerUp, longPress } =
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
  const accent = remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface);
  const variant = describeVariant(element, isSelected, isMultiSelected, remoteBorderColor, surface);

  // A comment pin (spec/136) shows its own count on its face, so the generic
  // badge is suppressed: the pin IS the badge, and two counts on one 40px
  // marker is one too many.
  const isCommentPin = element.type === 'shape' && element.shape === 'comment-pin';
  const commentCount = isCommentPin ? 0 : activeCommentCount(element.commentThread);
  // Assigned action (spec/68): the badge shows only while the action is
  // open; a done action stays on the element but stops shouting. An action
  // panel (spec/146) shows its action on its face, so it is the badge.
  const isActionPanel = element.type === 'shape' && element.shape === 'action-card';
  const hasOpenAction = !isActionPanel && isOpenAction(element.action);
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
  const { labelAnimClass, artAnimClass, svgAnim, wrapperAnimClass, animStyle } =
    useBoxedElementAnimation(element, textColor);

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

  // Insert-between preview (spec/139). A CSS translate rather than a moved
  // `x`: it is GPU-composited, it cannot desync from the model because the
  // model never changed, and it unwinds by dropping a style. It composes
  // ahead of the tilt below so the note slides and stays hand-placed.
  const insertShift = insertShiftX ? `translateX(${insertShiftX}px) ` : '';

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      // Carries the slot's easing (globals.css) for as long as a slot COULD
      // be open, so the board eases shut as well as open.
      data-insert-shift={insertShiftAnimates ? '' : undefined}
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
      onPointerUp={handlePointerUp}
      onPointerEnter={
        reportsHover
          ? () => {
              if (isAnnotation) setHovering(true);
              if (isEsNote) setDockHoveredId(element.id);
            }
          : undefined
      }
      onPointerLeave={
        reportsHover
          ? () => {
              if (isAnnotation) setHovering(false);
              if (isEsNote) clearDockHoveredId(element.id);
            }
          : undefined
      }
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
              transform: `${insertShift}rotate(${rotation}deg)`,
              '--lvd-enter-rot': `${rotation}deg`,
            } as React.CSSProperties)
          : insertShift
            ? { transform: insertShift.trim() }
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
        artAnimClass={artAnimClass}
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
          stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
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
        <ChairView
          element={element}
          sitters={chairSitters?.(element.id) ?? []}
          animClass={artAnimClass}
        />
      ) : null}
      {/* A Lane's title gutter (spec/119), behind the label. */}
      {element.type === 'shape' && element.shape === 'lane' ? (
        <LaneGutter
          stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
          headerFill={element.headerFill}
          headerSize={element.headerSize}
          width={element.width}
          height={element.height}
          zoom={zoom}
          onCommitSize={onCommitHeaderSize ? (px) => onCommitHeaderSize(element.id, px) : undefined}
          onSnapSeam={onSnapSeam}
          elementId={element.id}
          elementX={element.x}
          elementY={element.y}
          alignX={alignX}
          alignY={alignY}
        />
      ) : null}
      {/* A Page's turned-back bottom-right corner (spec/100). */}
      {element.type === 'shape' && element.shape === 'page' ? (
        <PageCornerFold
          width={element.width}
          height={element.height}
          fill={element.fillColor ?? '#ffffff'}
          stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
        />
      ) : null}
      {/* Browser-only HTML chrome overlay. SVG handles only the
          outer frame + divider so the user's border style applies;
          the dots / nav / URL bar render here so their geometry is
          fixed-pixel and doesn't deform with the box's aspect
          ratio. */}
      {element.type === 'shape' && element.shape === 'browser' ? (
        <BrowserChrome
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)}
          zoom={zoom}
        />
      ) : null}

      {/* Whatever this element shows in place of a plain label: a pressable
          face, a drawn body, or the label itself. See ElementFaceRouter. */}
      <ElementFaceRouter
        element={element}
        isEditing={isEditing}
        isSelected={isSelected}
        readOnly={readOnly}
        zoom={zoom}
        fontFamily={fontFamily}
        activeMode={activeMode}
        collab={collab}
        commentActions={commentActions}
        actionSelfId={actionSelfId}
        actionActions={actionActions}
        commentSelfId={commentSelfId}
        imageContext={imageContext}
        tabSummaries={tabSummaries}
        tabTimer={tabTimer}
        timerControls={timerControls}
        timerState={timerState}
        sessionStartBlocked={sessionStartBlocked}
        revealedForMe={revealedForMe}
        onCommitTable={onCommitTable}
        onEnterPortal={onEnterPortal}
        onFireReaction={onFireReaction}
        onFollowLink={onFollowLink}
        onLinkCell={onLinkCell}
        onPressModeButton={onPressModeButton}
        onPressFocusButton={onPressFocusButton}
        onPressSessionButton={onPressSessionButton}
        onRollPicker={onRollPicker}
        onSetPageHeading={onSetPageHeading}
        onSetWebRows={onSetWebRows}
        onSetHeroCaptionLine={onSetHeroCaptionLine}
        onSetSessionConfig={onSetSessionConfig}
        onOpenElementSettings={onOpenElementSettings}
        onToggleReveal={onToggleReveal}
        label={label}
        labelNode={labelNode}
        textColor={textColor}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        isLocked={isLocked}
        remoteBorderColor={remoteBorderColor}
        inlineIcon={inlineIcon}
        marker={marker}
        iconCaptionBand={iconCaptionBand}
      />

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? <IconDropPreview side={dropSide} /> : null}

      {/* The burst (spec/135), a sibling of the label stack rather than a
          child of it: the particles leave the pad's box on purpose, and the
          face above clips to its own rounded corners. */}
      {reactionBurst ? (
        <ReactionBurst
          reaction={reactionBurst.reaction}
          seed={reactionBurst.seed}
          width={element.width}
          height={element.height}
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

      {/* Photo draft (spec/139 Phase 8): a dashed accent frame just outside
          the paper, in the alignment guides' own language, saying "this one
          came from the photo and has not been accepted yet". Drawn rather
          than tinted, because a workshop note's FILL is its meaning. */}
      {photoDraft ? (
        <span
          aria-hidden
          data-photo-draft=""
          className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-brand-500 dark:border-brand-300"
          style={{ inset: -6 / zoom, borderWidth: Math.max(1, 2 / zoom) }}
        />
      ) : null}
      {/* …and the counterpart on a note the photo matched: it is already here,
          so nothing is being added for it. */}
      {photoMatched ? (
        <span
          data-photo-matched=""
          title={photoReadAs ? `Already here. Read as: ${photoReadAs}` : 'Already here'}
          aria-label={photoReadAs ? `Already here, read as ${photoReadAs}` : 'Already here'}
          className="pointer-events-auto absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-slate-700 text-white shadow dark:bg-slate-200 dark:text-slate-900"
          style={{ width: 18 / zoom, height: 18 / zoom }}
        >
          <svg
            width={12 / zoom}
            height={12 / zoom}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : null}

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
