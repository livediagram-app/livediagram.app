import { memo, useRef, useState } from 'react';
import {
  DEFAULT_BOX_RADIUS_PX,
  cornerRadiusPx,
  finishCornerFallbackPx,
  finishOwnCorner,
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
  rotationOf,
  finishSplitsFace,
  faceFinishOf,
} from '@livedesign/design';
import { renderLabel } from '@/components/canvas/element-labels';
import { ElementFaceRouter } from '@/components/canvas/ElementFaceRouter';
import { elementAriaLabel, elementRole } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { useTextHug } from '@/components/canvas/useTextHug';
import { describeVariant, editingLook } from '@/components/canvas/element-variant';
import { useElementSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { SketchOverlay, useSketchPaint } from '@/components/canvas/SketchOverlay';
import { SketchFace } from '@liveworkspace/workbench/components/canvas/SketchFace';
import { FaceFinishProvider } from '@/components/canvas/CanvasFinishContext';
import { useFaceFinishPass } from '@liveworkspace/workbench/components/canvas/useFaceFinishPass';
import { liveFiltersRedrawOnRepaint } from '@liveworkspace/workbench/lib/live-filter-cost';
import { useTagColours } from '@/components/canvas/TagColoursContext';
import { useIsSketchBackdrop } from '@/lib/sketch-backdrop-store';
import { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { useLabelTextAnimation } from '@/components/canvas/useTextAnimation';
import { useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import { clearingInset } from '@liveworkspace/workbench/components/canvas/InsetContent';

import type { BoxedElementViewProps } from './BoxedElementView.types';
import { useBoxedFaceParts } from './boxed-element-face-parts';
import { useBoxedElementChrome } from './boxed-element-chrome';
import { boxedElementStyle } from './boxed-element-style';
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

function BoxedElementViewImpl(props: BoxedElementViewProps) {
  const {
    element,
    isSelected,
    isMultiSelected = false,
    onPlainClick,
    onPressArmedAction,
    isEditing,
    editCursorAtEnd = false,
    isPaintMode,
    onBeginDrag,
    onShiftSelect,
    layerOpacity,
    onBeginEdit,
    onCommitLabel,
    onSetTextAlign,
    onCommitTable,
    onSetPageHeading,
    onSetWebRows,
    onSetHeroCaptionLine,
    stackGlide,
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
  } = props;
  // Which paper this element sits on, for every colour it doesn't carry
  // itself (docs/specs/007-editor/live-app.md): a Default tab stores no element colours at all, so on
  // a dark canvas this is where the greys come from.
  const surface = useElementSurface(element.id);
  const isLocked = element.locked === true || tabLocked;
  // Concurrent-selection lock (docs/specs/007-editor/live-app.md): another participant has this
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
      isPaintMode,
      onShiftSelect,
      onPlainClick,
      onPressArmedAction,
      onBeginDrag,
      onBeginEdit,
      onEditLink,
      onOpenEditDialog,
      onOpenNote,
      imageContext,
      onContextSelect,
    });

  // A label being typed wears the text cursor and rises; a path in its edit mode does neither.
  const editLook = editingLook(element, isEditing);
  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
      : editLook.textCursor
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
  // A path in its edit mode shows its nodes, not its box (docs/specs/023-draw-mode/path-tool.md).
  const ringed = isSelected && !(element.type === 'path' && isEditing);
  const variant = describeVariant(
    element,
    ringed,
    isMultiSelected,
    remoteBorderColor,
    surface,
    finish,
  );
  // A marker stroke and a path are picked by their drawn line, not their box
  // (docs/specs/023-draw-mode/drawing-tools.md "Selecting", path-tool.md "Selecting and erasing");
  // once selected, the box drags either as any element, and the line still catches pointers
  // outside the box, so a press on its outer half never falls to the board.
  const selected = isSelected || isMultiSelected;
  const hitLine =
    (element.type === 'freehand' &&
      element.penWidth !== undefined &&
      element.pen !== 'highlighter') ||
    (element.type === 'path' && !isEditing);
  // Not yet selected, only the drawn line picks it: the rest of its box lets pointers through.
  const passThrough = hitLine && !selected;

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

  // A text box that fits or wraps hugs its text, growing with it while typed (useTextHug).
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

  // What it draws over its body and under its label, and over its face: built in their own modules
  // (boxed-element-face-parts.tsx, boxed-element-chrome.tsx), from the same values.
  const faceParts = useBoxedFaceParts(props, {
    tagColours,
    own,
    surface,
    isLocked,
    artAnimClass,
    svgAnim,
    accent,
    textColor,
    remoteBorderColor,
    sketch,
    finish,
    cornerPx,
  });
  const chrome = useBoxedElementChrome(props, {
    layer,
    layerAnim,
    shapeKind,
    cornerPx,
    dropSide,
    indicators,
    own,
    surface,
    rotation,
    isAnnotation,
    hovering,
  });

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      // Where a move's offset rides (docs/specs/008-canvas/drag-preview.md "Moves ride an offset").
      data-ride-id={element.id}
      data-stack-glide={stackGlide ? '' : undefined}
      // Screen-reader name (docs/specs/004-interface-design/canvas-accessibility.md): same naming the change log uses,
      // so 'Square "Login"' reads consistently across both surfaces. A face with controls of its own is a named group,
      // so its buttons stay reachable, as is one showing indicator buttons (its link, note, action or comments) and a
      // face that edits in place while selected for editing.
      role={elementRole(element, isSelected && !readOnly, indicators.items.length > 0)}
      aria-label={elementAriaLabel(element)}
      // What the face's own parts are drawn in (docs/specs/008-canvas/finish.md "Faces"; app/face-finish.css).
      data-face-finish={faceFinish}
      onPointerDown={(e) => {
        // A finger on a board's empty space pans the canvas instead (@liveworkspace/workbench/hooks/canvas/pan-through.ts).
        if (isPanThrough(e)) return;
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerUp={handlePointerUp}
      onPointerEnter={isAnnotation ? () => setHovering(true) : undefined}
      onPointerLeave={isAnnotation ? () => setHovering(false) : undefined}
      onDragOver={acceptsIconDrop ? handleIconDragOver : undefined}
      onDragLeave={acceptsIconDrop ? handleIconDragLeave : undefined}
      onDrop={acceptsIconDrop ? handleIconDrop : undefined}
      className={`group group/el absolute origin-center touch-none select-none ${
        // A looping animation (docs/specs/008-canvas/canvas-and-palette.md) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
      } ${variant.className} ${cursor}`}
      style={boxedElementStyle({
        element,
        width: textHug.box?.width ?? element.width,
        height: textHug.box?.height ?? element.height,
        textColor,
        fontFamily,
        layerOpacity,
        variant,
        animStyle,
        isRotated,
        rotation,
        editLook,
        passThrough,
      })}
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
          {faceParts}

          {/* Whatever this element shows in place of a plain label: a pressable
          face, a drawn body, or the label itself. See ElementFaceRouter. */}
          <ElementFaceRouter
            hitLine={hitLine}
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
      </FaceFinishProvider>
      {element.type === 'image' ? sketchOverlay() : null}

      {chrome}
    </div>
  );
}

// Default shallow-prop comparison is good enough here: `element` is
// reference-stable across renders that don't touch it (commit /
// commitTabs return new arrays only when something actually
// changed), every other prop is a primitive or an id-bearing
// callback that the parent keeps stable.
export const BoxedElementView = memo(BoxedElementViewImpl);
