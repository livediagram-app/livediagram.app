import { memo, useRef } from 'react';
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
  ownColours,
  isRetiredElement,
  isSelfDrawingShape,
  type ShapeMarker,
  type TextSize,
  rotationOf,
  finishSplitsFace,
  faceFinishOf,
} from '@livehuddle/document';
import { renderLabel } from '@/components/canvas/element-labels';
import { ElementFaceRouter } from '@/components/canvas/ElementFaceRouter';
import { elementAriaLabel, elementRole } from '@/lib/element-names';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { SelectionChromeLayer } from '@/components/canvas/element-parts';
import { isSvgRenderedShape } from '@/components/canvas/shape-paint-path';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { useTextHug } from '@/components/canvas/useTextHug';
import { PieceArt, hasPieceArt } from '@/components/canvas/PieceArt';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { describeVariant, editingLook } from '@/components/canvas/element-variant';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { SketchOverlay, useSketchPaint } from '@/components/canvas/SketchOverlay';
import { SketchFace } from '@liveworkspace/workbench/components/canvas/SketchFace';
import { FaceFinishProvider } from '@/components/canvas/CanvasFinishContext';
import { useFaceFinishPass } from '@/components/canvas/useFaceFinishPass';
import { liveFiltersRedrawOnRepaint } from '@liveworkspace/workbench/lib/live-filter-cost';
import { useIsSketchBackdrop } from '@/lib/sketch-backdrop-store';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { useBoxedElementGestures } from '@/components/canvas/useBoxedElementGestures';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { useLabelTextAnimation } from '@/components/canvas/useTextAnimation';
import { AnimationLayer } from '@liveworkspace/workbench/components/canvas/AnimationLayer';

import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { clearingInset } from '@liveworkspace/workbench/components/canvas/InsetContent';

import type { BoxedElementViewProps } from './BoxedElementView.types';
import { isPanThrough } from '@liveworkspace/workbench/hooks/canvas/pan-through';
import { elementClickKind } from '@/lib/avatar-click-intent';

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
  onDeleteRetired,
  onCancelEdit,
  onFollowLink,
  onPressModeButton,
  onPressFocusButton,
  onOpenElementSettings,
  chairSitters,
  onEnterPortal,
  onPressAvatarPad,
  activeMode,
  onEditLink,
  imageContext,
  onContextSelect,
  remoteSelectors,
  tabSummaries,
  readOnly,
  movable = true,
  fontFamily,
}: BoxedElementViewProps) {
  // Which paper this element sits on, for every colour it doesn't carry
  // itself (docs/specs/007-editor/editor-app.md): a Default tab stores no element colours at all, so on
  // a dark canvas this is where the greys come from.
  const surface = useCanvasSurface();
  // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): another participant has this
  // element selected (remoteSelectors already excludes our own
  // selection) and holds it: a Viewer's selection only shows its badge. We block select / drag / edit and show a not-allowed
  // cursor so two people don't fight over the same element.
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
  // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") draws its placeholder
  // card and nothing of the kind it was: no hand-drawn body, accent edge or border overlay over it.
  const retired = isRetiredElement(element);
  const sketchOverlay = () =>
    sketch && !retired ? (
      <SketchOverlay
        paint={sketch}
        width={element.width}
        height={element.height}
        fill={own.fill ?? defaultFillColor(element, surface)}
        stroke={remoteBorderColor ?? own.stroke ?? defaultStrokeColor(element, surface)}
      />
    ) : null;

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
      imageContext,
      onContextSelect,
    });

  // A label being typed wears the text cursor and rises; a path in its edit mode does neither.
  const editLook = editingLook(isEditing);
  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
      : editLook.textCursor
        ? 'cursor-text'
        : !movable
          ? 'cursor-default'
          : 'cursor-move';

  // When at least one remote participant has selected this element, the
  // border / stroke colour is overridden with the first remote selector's
  // colour so the realtime "X is here" signal is glanceable from anywhere
  // on the canvas — not just from the small initial-badge.
  const remoteBorderColor = remoteSelectors.length > 0 ? remoteSelectors[0]!.color : null;
  const ringed = isSelected;
  const variant = describeVariant(
    element,
    ringed,
    isMultiSelected,
    remoteBorderColor,
    surface,
    finish,
  );

  // The element's drawn corner, which its border overlay and its animation layer follow.
  const cornerPx = cornerRadiusPx(
    element.type === 'shape' ? finishOwnCorner(element, finish) : undefined,
    element.width,
    element.height,
    // The default corner, sharper under Professional (docs/specs/008-canvas/finish.md).
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
  const { labelAnimClass, artAnimClass, wrapperAnimClass, animStyle, layer, layerAnim } =
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

  return (
    <div
      ref={wrapperRef}
      data-element-id={element.id}
      // What a click on it means in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Clicking a piece";
      // lib/avatar-click-intent ELEMENT_KIND_ATTR).
      data-element-kind={elementClickKind(element)}
      // Where a move's offset rides (docs/specs/008-canvas/drag-preview.md "Moves ride an offset").
      data-ride-id={element.id}
      // Screen-reader name (docs/specs/004-interface-design/canvas-accessibility.md): same naming the change log uses,
      // so 'Square "Login"' reads consistently across both surfaces. A face with controls of its own is a named group,
      // so its buttons stay reachable.
      role={elementRole(element)}
      aria-label={elementAriaLabel(element)}
      // What the face's own parts are drawn in (docs/specs/008-canvas/finish.md "Faces"; app/face-finish.css).
      data-face-finish={faceFinish}
      onPointerDown={(e) => {
        // A finger on an element too big for the screen pans the canvas instead (@liveworkspace/workbench/hooks/canvas/pan-through.ts).
        if (isPanThrough(e)) return;
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={(e) => {
        handleDoubleClick(e);
      }}
      onContextMenu={handleContextMenu}
      onPointerUp={handlePointerUp}
      className={`group group/el absolute origin-center touch-none select-none ${
        // A looping animation (docs/specs/008-canvas/canvas-and-palette.md) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
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
        // The drag preview's fade (`layerOpacity`) over the element's own opacity.
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
        ...(editLook.raise ? { zIndex: 10 } : {}),
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
          <ShapeContentRouter
            element={element}
            isEditing={isEditing}
            artAnimClass={artAnimClass}
            remoteBorderColor={remoteBorderColor}
            isSelected={isSelected}
          />
          {/* Box-path shapes (a mode button, a portal) paint
          their border via the wrapper's CSS `border`, which can't draw the
          composite dash patterns. When one of those is picked, stroke the
          outline here instead (element-variant drops the CSS border to
          match). Solid / dashed / dotted stay on the cheaper CSS path. */}
          {element.type === 'shape' &&
          !sketch &&
          !retired &&
          !isSvgRenderedShape(element.shape) &&
          !remoteBorderColor &&
          !isCssNativeBorderStyle(element.strokeStyle ?? DEFAULT_BORDER_STYLE) ? (
            <BoxBorderOverlay
              width={element.width}
              height={element.height}
              stroke={own.stroke ?? defaultStrokeColor(element, surface)}
              strokeWidth={BORDER_STROKE_PX[finishBorderStroke(element.strokeWidth, finish)]}
              dasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? ''}
              radiusPx={cornerPx}
            />
          ) : null}
          {/* A Space's pieces drawn as art (chairs, rooms, doors, the garden, the Avatar Pad): PieceArt says which. */}
          {element.type === 'shape' && hasPieceArt(element.shape) ? (
            <PieceArt
              element={element}
              stroke={own.stroke ?? defaultStrokeColor(element, surface)}
              fill={own.fill ?? defaultFillColor(element, surface)}
              sitters={chairSitters?.(element.id)}
              animClass={artAnimClass}
              // While walking a pad is walked onto, not pressed, and a reading piece opens large
              // (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
              walking={activeMode === 'avatar'}
              onPressAvatarPad={activeMode === 'avatar' ? undefined : onPressAvatarPad}
              live
            />
          ) : null}

          {/* Whatever this element shows in place of a plain label: a pressable
          face, a drawn body, or the label itself. See ElementFaceRouter. */}
          <ElementFaceRouter
            element={element}
            isEditing={isEditing}
            isSelected={isSelected}
            readOnly={readOnly}
            fontFamily={fontFamily}
            activeMode={activeMode}
            imageContext={imageContext}
            tabSummaries={tabSummaries}
            onEnterPortal={onEnterPortal}
            onFollowLink={onFollowLink}
            onPressModeButton={onPressModeButton}
            onPressFocusButton={onPressFocusButton}
            onOpenElementSettings={onOpenElementSettings}
            onDeleteRetired={onDeleteRetired}
            label={label}
            labelNode={labelNode}
            contentInset={clearingInset()}
            textColor={textColor}
            textSize={textSize}
            alignX={alignX}
            alignY={alignY}
            remoteBorderColor={remoteBorderColor}
            inlineIcon={inlineIcon}
            marker={marker}
            iconCaptionBand={iconCaptionBand}
          />
        </SketchFace>
      </FaceFinishProvider>
      {element.type === 'image' ? sketchOverlay() : null}

      {/* The Shape set's ring / halo / trace / gradient layer (AnimationLayer): over the face. */}
      {layer && layerAnim ? (
        <AnimationLayer
          animation={layerAnim}
          width={element.width}
          height={element.height}
          radius={cornerPx}
        />
      ) : null}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}

      {remoteSelectors.length > 0 ? <RemoteSelectorsStrip selectors={remoteSelectors} /> : null}

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
