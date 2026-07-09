import { memo, useRef, useState } from 'react';
import {
  activeCommentCount,
  isOpenAction,
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  isSelfDrawingShape,
  PADDING_PX,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';
import { renderLabel } from '@/components/canvas/element-labels';
import { elementAriaLabel } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { BadgeStrip, RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { AnnotationGlyph, AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import { LinkCardView } from '@/components/canvas/LinkCardView';
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
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onSetPadding,
  onSetFont,
  onSetTextSize,
  onCommitTable,
  onSetRailLabel,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onOpenComments,
  onOpenAction,
  onOpenNote,
  onEditLink,
  vote,
  selfId,
  voteMax,
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
  const label = element.label ?? '';
  const textSize: TextSize = element.textSize ?? 'scale';
  const defaultAlign = defaultTextAlign(element);
  const alignX = element.textAlignX ?? defaultAlign.x;
  const alignY = element.textAlignY ?? defaultAlign.y;
  const textColor = element.textColor ?? defaultTextColor(element);

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
      vote,
      onCastVote,
      onShiftSelect,
      onBeginDrag,
      onBeginEdit,
      onEditLink,
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

  const commentCount = activeCommentCount(element.commentThread);
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
    onSetPadding,
    onSetFont,
    onSetTextSize,
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
      className={`absolute origin-center touch-none select-none ${
        // A looping animation (spec/09) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
      } ${variant.className} ${cursor}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: textColor,
        opacity: (element.opacity ?? 1) * (layerOpacity ?? 1),
        ...variant.style,
        ...animStyle,
        // Spin about the centre (the wrapper already has origin-center).
        // Handles + anchors are children, so they rotate with the box.
        ...(isRotated ? { transform: `rotate(${rotation}deg)` } : {}),
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
        accent={accent}
        textColor={textColor}
        remoteBorderColor={remoteBorderColor}
        isLocked={isLocked}
        isSelected={isSelected}
        readOnly={readOnly}
        onSetRailLabel={onSetRailLabel}
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

      {element.type === 'annotation' ? (
        <AnnotationGlyph
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
        />
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

      {/* Dot-vote tally pill + winner ring (spec/39) — see
          ElementVoteOverlay. */}
      <ElementVoteOverlay
        element={element}
        vote={vote}
        selfId={selfId}
        voteMax={voteMax}
        zoom={zoom}
        onRetractVote={onRetractVote}
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
        <AnnotationHoverNote elementId={element.id} note={element.note} />
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
