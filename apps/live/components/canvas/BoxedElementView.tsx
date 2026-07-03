import { useEffect, memo, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import {
  acceptsInlineIcon,
  isVotable,
  activeCommentCount,
  ANIMATION_SPEED_FACTOR,
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
  type IconPosition,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';
import { iconDropSide } from '@/lib/canvas';
import { renderLabel } from '@/components/canvas/element-labels';
import { EdgeResizeHandle, LockBadge, ResizeHandles } from '@/components/canvas/element-parts';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { BadgeStrip, RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { AnnotationGlyph, AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import { ICON_DND_MIME } from '@/lib/icons';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { describeLink } from '@/lib/link-label';
import { TableView } from '@/components/canvas/TableView';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { BrowserChrome, FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { Tooltip } from '@/components/primitives/Tooltip';

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

  // Dot-vote tally for this element (spec/39): total dots, how many are
  // mine (clicking the pill retracts one), and whether it's a revealed
  // winner. The pill only shows once at least one dot has landed.
  const voteTotal = vote ? (vote.votes[element.id]?.length ?? 0) : 0;
  const myVotes =
    vote && selfId ? (vote.votes[element.id]?.filter((id) => id === selfId).length ?? 0) : 0;
  const showVotePill = !!vote && voteTotal > 0 && isVotable(element);
  const isVoteWinner = !!vote?.revealed && voteTotal > 0 && voteTotal === (voteMax ?? 0);

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
  // A standalone text element has no fill or border, so the box-shadow / ring /
  // background animations (glow / pulse / trace / gradient) would animate an
  // invisible bounding rectangle around the words. For those, ride the rendered
  // glyphs instead: the wrapper drops the box class (see wrapperAnimClass below)
  // and the label content node gets the matching .lvd-anim-text-* class. The
  // transform animations (bounce, float, swing, …) already move the text with
  // the box, so they stay on the wrapper unchanged.
  const isTextNativeAnim =
    element.type === 'text' &&
    (element.animation === 'glow' ||
      element.animation === 'pulse' ||
      element.animation === 'trace' ||
      element.animation === 'gradient');
  const labelAnimClass = isTextNativeAnim ? `lvd-anim-text-${element.animation}` : undefined;

  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    alignX,
    alignY,
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
    !!inlineIcon,
    labelAnimClass,
  );

  // Drag a palette icon onto a regular shape to drop it inside, on the
  // side of the text nearest the cursor. `dropSide` drives the live
  // preview band so the user sees WHERE the icon will land before
  // releasing (null = not currently a drag target).
  const acceptsIconDrop = !!onDropIcon && acceptsInlineIcon(element);
  const [dropSide, setDropSide] = useState<IconPosition | null>(null);
  const handleIconDragOver = (e: ReactDragEvent) => {
    if (!acceptsIconDrop || !e.dataTransfer.types.includes(ICON_DND_MIME)) return;
    // preventDefault marks this element as a valid drop target.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const side = iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    setDropSide((prev) => (prev === side ? prev : side));
  };
  const handleIconDragLeave = () => setDropSide(null);
  const handleIconDrop = (e: ReactDragEvent) => {
    if (!acceptsIconDrop) return;
    const iconId = e.dataTransfer.getData(ICON_DND_MIME);
    setDropSide(null);
    if (!iconId) return;
    e.preventDefault();
    e.stopPropagation();
    onDropIcon!(
      element.id,
      iconId,
      iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()),
    );
  };
  // The existing inline icon is no longer draggable to reposition it: the
  // Icon section of the element context menu (Icon position) is the one way
  // to move it. Dragging an icon FROM the palette ONTO a shape (the drop
  // preview below) is unaffected.
  // Translucent band on the target side + a ring, shown while dragging an
  // icon over this shape so the drop position is obvious.
  const DROP_BAND: Record<IconPosition, string> = {
    left: 'left-0 top-0 bottom-0 w-1/3',
    right: 'right-0 top-0 bottom-0 w-1/3',
    above: 'left-0 right-0 top-0 h-1/3',
    below: 'left-0 right-0 bottom-0 h-1/3',
  };

  // trace / gradient / pulse / glow on an SVG-rendered shape (diamond,
  // triangle, hexagon, …) render against the true outline / fill / silhouette
  // inside ShapeSvgOverlay, so the wrapper must NOT also paint its
  // bounding-box version (pulse / glow as a box-shadow would ring the
  // rectangle, not the shape; trace / gradient would double up). Every other
  // animation — and these four on CSS-rendered shapes (circle / stadium /
  // square / browser, where the wrapper's border-radius already matches the
  // outline) and non-shape boxed elements — stays a wrapper class.
  const svgAnim =
    element.animation === 'trace' ||
    element.animation === 'gradient' ||
    element.animation === 'pulse' ||
    element.animation === 'glow'
      ? element.animation
      : undefined;
  const svgHandlesAnim =
    element.type === 'shape' && isSvgRenderedShape(element.shape) && svgAnim !== undefined;
  // The pop-in entry animation must drop off the wrapper once it has run:
  // CSS animations RESTART when a node is moved in the DOM, and layer
  // reorders (bring to front / send to back) move every keyed sibling — so
  // a lingering pop-in class made unrelated elements visibly re-enter.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // Comfortably past the pop-in duration; a plain timeout (not
    // animationend) so reduced-motion sessions converge too.
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, []);
  const wrapperAnimClass = element.animation
    ? svgHandlesAnim || isTextNativeAnim
      ? ''
      : `lvd-anim-${element.animation}`
    : entered
      ? ''
      : 'animate-pop-in';

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
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
        opacity: element.opacity ?? 1,
        ...variant.style,
        // Pulse / glow rings take the element's accent (its stroke, else its
        // text colour); the speed factor scales the keyframe duration. See
        // .lvd-anim-* in globals.css.
        ...(element.animation
          ? ({
              '--lvd-anim-color': element.strokeColor ?? textColor,
              '--lvd-anim-speed': ANIMATION_SPEED_FACTOR[element.animationSpeed ?? 'normal'],
              // The moving-gradient animation blends the fill into the accent;
              // expose the fill (shared by the wrapper CSS gradient and the SVG
              // <stop> cycle that ShapeSvgOverlay inherits).
              ...(element.animation === 'gradient'
                ? { '--lvd-anim-bg': element.fillColor ?? defaultFillColor(element) }
                : {}),
              // Text-native gradient blends the element's own text colour
              // toward the accent (the box version blends the fill, which a
              // text element doesn't have); see .lvd-anim-text-gradient.
              ...(isTextNativeAnim && element.animation === 'gradient'
                ? { '--lvd-anim-text': textColor }
                : {}),
            } as React.CSSProperties)
          : {}),
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
      ) : (
        labelNode
      )}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? (
        <div
          className="pointer-events-none absolute inset-0 z-[var(--z-toolbar)] ring-2 ring-brand-400"
          style={{ borderRadius: 'inherit' }}
        >
          <div className={`absolute bg-brand-400/25 ${DROP_BAND[dropSide]}`} />
        </div>
      ) : null}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {remoteSelectors.length > 0 ? (
        <RemoteSelectorsStrip zoom={zoom} selectors={remoteSelectors} />
      ) : null}

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
      {linked || commentCount > 0 || (element.note && onOpenNote && !isAnnotation) ? (
        <BadgeStrip
          zoom={zoom}
          linked={linked}
          linkLabel={element.link ? describeLink(element.link, tabSummaries) : undefined}
          commentCount={commentCount}
          hasNote={!!element.note && !!onOpenNote && !isAnnotation}
          badgeColor={badgeColor}
          onFollowLink={() => {
            if (element.link) onFollowLink(element.link);
          }}
          onOpenComments={() => onOpenComments(element.id)}
          onOpenNote={onOpenNote ? () => onOpenNote(element.id) : undefined}
        />
      ) : null}

      {/* Dot-vote tally pill (spec/39): live count, brand-filled when it
          holds your dots (click to retract one), amber-ringed if it's a
          revealed winner. */}
      {isVoteWinner ? (
        <div
          className="pointer-events-none absolute inset-0 ring-2 ring-amber-400"
          style={{ borderRadius: 'inherit' }}
        />
      ) : null}
      {showVotePill ? (
        <div
          className="absolute -bottom-1 -right-1 origin-bottom-right"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <Tooltip
            title={`${voteTotal} ${voteTotal === 1 ? 'vote' : 'votes'}`}
            description={myVotes > 0 ? 'Click to remove one of your dots.' : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (myVotes > 0) onRetractVote?.(element.id);
              }}
              aria-label={`${voteTotal} votes`}
              className={
                'pointer-events-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold shadow-sm ' +
                (myVotes > 0
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100')
              }
            >
              {voteTotal}
            </button>
          </Tooltip>
        </div>
      ) : null}

      {showHandles || showAnchors ? (
        // Selection chrome (resize / rotate / arrow-anchor handles) rides
        // in its own layer ABOVE the elements. On plain selection the
        // element wrapper is not a stacking context, so this z-index
        // resolves at the canvas-elements level: the handles paint above
        // neighbouring elements WITHOUT lifting this element's own content
        // (lifting it would re-hide a container's contents — the whole
        // point of not raising z on select). pointer-events-none keeps the
        // body draggable; every handle re-enables pointer events on itself.
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30 }}>
          {/* Annotations resize too (aspect-locked by default so the marker
              stays round); they just keep rotation off — a tilted note marker
              reads as a mistake. Corner handles show even when rotated — the
              resize math projects the drag into the element's local frame
              (useEditorDrag). */}
          {showHandles ? (
            <ResizeHandles
              elementId={element.id}
              zoom={zoom}
              rotation={rotation}
              onBeginDrag={onBeginDrag}
            />
          ) : null}

          {showAnchors ? (
            <>
              {(['n', 'e', 's', 'w'] as const).map((a) => (
                <EdgeResizeHandle
                  key={a}
                  anchor={a}
                  elementId={element.id}
                  zoom={zoom}
                  rotation={rotation}
                  onBeginDrag={onBeginDrag}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}

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
