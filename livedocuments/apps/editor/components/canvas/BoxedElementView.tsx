import { memo, useRef } from 'react';
import { useZoneClip, zoneClipPolygon } from '@/lib/article/zone-clip-store';
import {
  BORDER_DASH_ARRAY,
  DEFAULT_BOX_RADIUS_PX,
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
  isSelfDrawingShape,
  labelBodyInset,
  type ShapeMarker,
  type TextSize,
  withTagAccent,
  rotationOf,
  finishSplitsFace,
  faceFinishOf,
} from '@livedocuments/document';
import { renderLabel } from '@/components/canvas/element-labels';
import { ElementFaceRouter } from '@/components/canvas/ElementFaceRouter';
import { elementAriaLabel, elementRole } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { useTextHug } from '@/components/canvas/useTextHug';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant } from '@/components/canvas/element-variant';
import { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { SketchOverlay, useSketchPaint } from '@/components/canvas/SketchOverlay';
import { SketchFace } from '@/components/canvas/SketchFace';
import { useFaceFinishPass } from '@/components/canvas/useFaceFinishPass';
import { liveFiltersRedrawOnRepaint } from '@/lib/live-filter-cost';
import { AccentEdgeOverlay } from '@/components/canvas/AccentEdgeOverlay';
import { PointerNoteOverlay } from '@/components/canvas/PointerNoteOverlay';
import { useTagColours } from '@/components/canvas/TagColoursContext';
import { useIsSketchBackdrop } from '@/lib/sketch-backdrop-store';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { indicatorBacking } from '@/components/canvas/indicator-items';
import { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { useLabelTextAnimation } from '@/components/canvas/useTextAnimation';
import { AnimationLayer } from '@/components/canvas/AnimationLayer';
import { IconDropPreview, useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { clearingInset } from '@/components/canvas/InsetContent';
import { BrowserChrome } from '@/components/canvas/boxed-element-overlays';

import type { BoxedElementViewProps } from './BoxedElementView.types';
import { isPanThrough } from '@/hooks/canvas/pan-through';

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
  onPlainClick,
  onPressArmedAction,
  isEditing,
  editCursorAtEnd = false,
  isPaintMode,
  showHandles,
  showAnchors,
  onBeginDrag,
  onShiftSelect,
  layerOpacity,
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onCommitTable,
  onToggleChecklistItem,
  onSetPageHeading,
  onSetWebRows,
  onSetPointerTip,
  onSetHeroCaptionLine,
  isoDepth,
  stackGlide,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onOpenComments,
  onOpenAction,
  onOpenNote,
  onEditLink,
  onOpenEditDialog,
  onDropIcon,
  onLinkCell,
  imageContext,
  onContextSelect,
  remoteSelectors,
  tabLocked,
  tabSummaries,
  readOnly,
  movable = true,
  writable,
  fontFamily,
}: BoxedElementViewProps) {
  // Which paper this element sits on, for every colour it doesn't carry
  // itself (docs/specs/007-editor/editor-app.md): a Default tab stores no element colours at all, so on
  // a dark canvas this is where the greys come from.
  const surface = useElementSurface(element.id);
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
  // skips the axis-aligned snap. `isRotated` drives the wrapper transform and
  // the zone clip below.
  const rotation = rotationOf(element);
  const isRotated = rotation % 360 !== 0;
  // In an article's drawing zone: cut off at the zone's edge (a turned element is left whole).
  const zoneClip = useZoneClip(element.id);
  const clipPath =
    zoneClip && !isRotated ? zoneClipPolygon(zoneClip, element.x, element.y) : undefined;
  const label = element.label ?? '';
  const textSize: TextSize = element.textSize ?? 'scale';
  const defaultAlign = defaultTextAlign(element);
  const alignX = element.textAlignX ?? defaultAlign.x;
  const alignY = element.textAlignY ?? defaultAlign.y;
  // The colours the element carries itself; each missing one follows the surface.
  const own = {
    fill: 'fillColor' in element ? element.fillColor : undefined,
    stroke: 'strokeColor' in element ? element.strokeColor : undefined,
    text: 'textColor' in element ? element.textColor : undefined,
  };
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

  // An article's margin note (docs/specs/007-editor/article-pages.md "Comments and actions"): a
  // click opens what it carries, its comment thread or its action.
  const articleNote = element.type === 'article-note' ? element.articleNote : undefined;
  const noteDown = useRef<{ x: number; y: number } | null>(null);
  const openArticleNote = articleNote
    ? () => (articleNote === 'action' ? onOpenAction(element.id) : onOpenComments(element.id))
    : undefined;

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
      isMultiSelected,
      isSelected,
      isPaintMode,
      onShiftSelect,
      onPlainClick,
      onPressArmedAction,
      onBeginDrag,
      onBeginEdit,
      onEditLink,
      onOpenEditDialog,
      imageContext,
      onContextSelect,
    });

  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
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
  // Accent for the data-element fills (progress bar / ring, rating stars): a
  // remote selector colour wins, else the element's own stroke, else the theme
  // default stroke. Shared by the ProgressView / RatingView branches below so
  // they all read the same accent.
  const accent = remoteBorderColor ?? own.stroke ?? defaultStrokeColor(element, surface);
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
    // Sharper under Professional (docs/specs/008-canvas/finish.md).
    finishCornerFallbackPx(DEFAULT_BOX_RADIUS_PX, finish),
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
  // Which surface each looping animation rides (wrapper box vs text
  // glyphs vs SVG outline), the pop-in entry class, and the CSS custom
  // properties the keyframes read (docs/specs/008-canvas/canvas-and-palette.md) — see useBoxedElementAnimation.
  const { labelAnimClass, artAnimClass, svgAnim, wrapperAnimClass, animStyle, layer, layerAnim } =
    useBoxedElementAnimation(element, textColor);

  // An icon element's caption is confined to its own band — the complement
  // of the glyph band (docs/specs/010-palette/technology-icons.md, iconCaptionBand) — so the text can never
  // stack over the art. The label renders with the band's INTERNAL vertical
  // anchor (side captions centre on the glyph's row) and the JSX below wraps
  // it in the band container.
  const iconCaptionBand =
    element.type === 'shape' && element.shape === 'icon' ? captionBandClass(alignX, alignY) : null;

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

  // The Text animation on the label's words (docs/specs/028-animation/element-animations.md).
  const textAnim = useLabelTextAnimation(element, label, textColor, isEditing);

  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    alignX,
    iconCaptionBand ? captionBandAlignY(alignX, alignY) : alignY,
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
    labelAnimClass,
    textHug.label,
    textAnim,
  );

  // Palette-icon drop target (docs/specs/008-canvas/canvas-and-palette.md inline icons) — see
  // useIconDropTarget; the wrapper mounts its handlers below and the
  // IconDropPreview band renders while dragging over.
  const { acceptsIconDrop, dropSide, handleIconDragOver, handleIconDragLeave, handleIconDrop } =
    useIconDropTarget(element, onDropIcon);

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      data-stack-glide={stackGlide ? '' : undefined}
      // Screen-reader name (docs/specs/004-interface-design/canvas-accessibility.md): same naming the change log uses,
      // so 'Square "Login"' reads consistently across both surfaces. A face with controls of its own is a named group,
      // so its buttons stay reachable.
      role={elementRole(element)}
      aria-label={elementAriaLabel(element)}
      // What the face's own parts are drawn in (docs/specs/008-canvas/finish.md "Faces"; app/face-finish.css).
      data-face-finish={faceFinish}
      onPointerDown={(e) => {
        // A finger on a board's empty space pans the canvas instead (hooks/canvas/pan-through.ts).
        if (isPanThrough(e)) return;
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerUp={handlePointerUp}
      onClick={
        openArticleNote
          ? (e) => {
              // A drag of the marker ends in a click too: only a press that stayed put opens it.
              const down = noteDown.current;
              if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
              openArticleNote();
            }
          : undefined
      }
      onPointerDownCapture={
        openArticleNote
          ? (e) => {
              noteDown.current = { x: e.clientX, y: e.clientY };
            }
          : undefined
      }
      onDragOver={acceptsIconDrop ? handleIconDragOver : undefined}
      onDragLeave={acceptsIconDrop ? handleIconDragLeave : undefined}
      onDrop={acceptsIconDrop ? handleIconDrop : undefined}
      className={`group group/el absolute origin-center touch-none select-none ${
        // A looping animation (docs/specs/008-canvas/canvas-and-palette.md) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
      } ${variant.className} ${cursor}`}
      style={{
        // Isometric depth stagger (docs/specs/008-canvas/isometric-view.md) — see globals.css [data-iso].
        ...({ '--iso-z': isoDepth } as React.CSSProperties),
        left: element.x,
        top: element.y,
        width: textHug.box?.width ?? element.width,
        height: textHug.box?.height ?? element.height,
        color: textColor,
        // Every word on the element in its face, so a face that writes its own (a progress value, a panel's
        // rows, a button) wears the tab's font and finish like its label does (docs/specs/008-canvas/finish.md).
        // Unset when nothing picks one, so the editor default still applies.
        ...(fontFamily ? { fontFamily } : {}),
        opacity: (element.opacity ?? 1) * (layerOpacity ?? 1),
        ...variant.style,
        ...animStyle,
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
        ...(clipPath ? { clipPath } : {}),
      }}
    >
      {/* The hand-drawn body under the content (docs/specs/008-canvas/finish.md "Sketch"); an image's edge goes over
          its picture, below. */}
      {element.type !== 'image' ? sketchOverlay() : null}
      {/* Under Sketch everything the element draws over its body is drawn by hand, its words crisp
          (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too"); in WebKit, which re-runs
          the face's wobble on every repaint, it is drawn as it is (finish.md "In WebKit"). */}
      <SketchFace
        active={finish === 'sketch' && finishSplitsFace(element) && !liveFiltersRedrawOnRepaint()}
      >
        <AccentEdgeOverlay
          element={withTagAccent(element, tagColours)}
          stroke={own.stroke ?? defaultStrokeColor(element, surface)}
        />
        {element.type === 'shape' && element.shape === 'pointer-note' ? (
          <PointerNoteOverlay
            element={element}
            stroke={own.stroke ?? defaultStrokeColor(element, surface)}
            editable={isSelected && !readOnly && !isLocked}
            onSetTip={onSetPointerTip}
          />
        ) : null}
        <ShapeContentRouter
          element={element}
          isEditing={isEditing}
          artAnimClass={artAnimClass}
          accent={accent}
          textColor={textColor}
          remoteBorderColor={remoteBorderColor}
          isLocked={isLocked}
          isSelected={isSelected}
          readOnly={readOnly}
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
        {/* Browser-only HTML chrome overlay. SVG handles only the
          outer frame + divider so the user's border style applies;
          the dots / nav / URL bar render here so their geometry is
          fixed-pixel and doesn't deform with the box's aspect
          ratio. */}
        {element.type === 'shape' && element.shape === 'browser' ? (
          <BrowserChrome
            stroke={
              remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)
            }
          />
        ) : null}

        {/* Whatever this element shows in place of a plain label: a pressable
          face, a drawn body, or the label itself. See ElementFaceRouter. */}
        <ElementFaceRouter
          element={element}
          isEditing={isEditing}
          isSelected={isSelected}
          readOnly={readOnly}
          writable={writable}
          fontFamily={fontFamily}
          imageContext={imageContext}
          tabSummaries={tabSummaries}
          onCommitTable={onCommitTable}
          onFollowLink={onFollowLink}
          onLinkCell={onLinkCell}
          onSetPageHeading={onSetPageHeading}
          onSetWebRows={onSetWebRows}
          onSetHeroCaptionLine={onSetHeroCaptionLine}
          label={label}
          labelNode={labelNode}
          // Clear of the indicators and on the label body (a cylinder's, under its lid).
          contentInset={clearingInset(indicators.layout?.inset, labelBodyInset(element))}
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
      </SketchFace>
      {element.type === 'image' ? sketchOverlay() : null}

      {/* The Shape set's ring / halo / trace / gradient layer (AnimationLayer): over the face. */}
      {layer && layerAnim ? (
        <AnimationLayer
          animation={layerAnim}
          width={element.width}
          height={element.height}
          radius={
            shapeKind === 'circle' || shapeKind === 'stadium'
              ? Math.min(element.width, element.height) / 2
              : cornerPx
          }
        />
      ) : null}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? <IconDropPreview side={dropSide} /> : null}

      {isLocked ? <LockBadge /> : null}

      {remoteSelectors.length > 0 ? <RemoteSelectorsStrip selectors={remoteSelectors} /> : null}

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
    </div>
  );
}

// Default shallow-prop comparison is good enough here: `element` is
// reference-stable across renders that don't touch it (commit /
// commitTabs return new arrays only when something actually
// changed), every other prop is a primitive or an id-bearing
// callback that the parent keeps stable.
export const BoxedElementView = memo(BoxedElementViewImpl);
