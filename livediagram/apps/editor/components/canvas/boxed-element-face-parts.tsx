import type { ComponentProps } from 'react';
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  defaultStrokeColor,
  finishBorderStroke,
  type ownColours,
  withTagAccent,
} from '@livediagram/document';
import { LaneGutter } from '@/components/canvas/LaneGutter';
import { EntityView } from '@/components/canvas/entity/EntityView';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { PageCornerFold } from '@liveworkspace/workbench/components/canvas/PageCornerFold';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import type { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import type { useSketchPaint } from '@/components/canvas/SketchOverlay';
import { AccentEdgeOverlay } from '@/components/canvas/AccentEdgeOverlay';
import { PointerNoteOverlay } from '@/components/canvas/PointerNoteOverlay';
import type { useTagColours } from '@/components/canvas/TagColoursContext';
import type { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { ShapeContentRouter } from '@/components/canvas/ShapeContentRouter';
import { BrowserChrome } from '@/components/canvas/boxed-element-overlays';
import type { BoxedElementViewProps } from './BoxedElementView.types';

type Animation = ReturnType<typeof useBoxedElementAnimation>;

// What BoxedElementView works out for its face, handed down as it is.
export type BoxedFaceLocals = {
  tagColours: ReturnType<typeof useTagColours>;
  own: ReturnType<typeof ownColours>;
  surface: ReturnType<typeof useCanvasSurface>;
  isLocked: boolean;
  remotelyLocked: boolean;
  artAnimClass: Animation['artAnimClass'];
  svgAnim: Animation['svgAnim'];
  accent: string;
  textColor: string;
  remoteBorderColor: string | null;
  sketch: ReturnType<typeof useSketchPaint>;
  finish: ReturnType<typeof useElementFinish>;
  cornerPx: number;
  rotation: number;
  alignX: ComponentProps<typeof LaneGutter>['alignX'];
  alignY: ComponentProps<typeof LaneGutter>['alignY'];
};

// The parts a boxed element draws over its body and under its face (BoxedElementView): the accent edge, a
// pointer note's tail, the shape's own content, a dashed border, and the entity, lane, page and browser
// overlays. A hook, so the React Compiler memoises each part on what it reads, as it did inline.
export function useBoxedFaceParts(
  {
    element,
    isSelected,
    readOnly,
    onSetPointerTip,
    isEditing,
    onToggleChecklistItem,
    chartPalette,
    fontFamily,
    onSetEntityFields,
    onStartFieldArrow,
    onCommitHeaderSize,
    onSnapSeam,
  }: BoxedElementViewProps,
  {
    tagColours,
    own,
    surface,
    isLocked,
    remotelyLocked,
    artAnimClass,
    svgAnim,
    accent,
    textColor,
    remoteBorderColor,
    sketch,
    finish,
    cornerPx,
    rotation,
    alignX,
    alignY,
  }: BoxedFaceLocals,
) {
  return (
    <>
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
      {/* A Record's rows (docs/specs/009-elements/entity.md), under its title label. */}
      {element.type === 'shape' && element.shape === 'entity' ? (
        <EntityView
          element={element}
          textColor={textColor}
          fontFamily={fontFamily}
          stroke={own.stroke ?? defaultStrokeColor(element, surface)}
          actions={
            // An Editor's selected, unlocked, upright entity edits in place (docs/specs/009-elements/entity.md).
            isSelected &&
            !readOnly &&
            !isLocked &&
            !remotelyLocked &&
            !element.rotation &&
            onSetEntityFields &&
            onStartFieldArrow
              ? { setFields: onSetEntityFields, startFieldArrow: onStartFieldArrow }
              : undefined
          }
        />
      ) : null}
      {/* A Lane's title gutter (docs/specs/009-elements/lane.md), behind the label. */}
      {element.type === 'shape' && element.shape === 'lane' ? (
        <LaneGutter
          stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
          headerFill={element.headerFill}
          headerSize={element.headerSize}
          titleOrientation={element.titleOrientation}
          width={element.width}
          height={element.height}
          onCommitSize={onCommitHeaderSize ? (px) => onCommitHeaderSize(element.id, px) : undefined}
          onSnapSeam={onSnapSeam}
          elementId={element.id}
          elementX={element.x}
          elementY={element.y}
          rotation={rotation}
          alignX={alignX}
          alignY={alignY}
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
      {/* Browser-only HTML chrome overlay. SVG handles only the
          outer frame + divider so the user's border style applies;
          the dots / nav / URL bar render here so their geometry is
          fixed-pixel and doesn't deform with the box's aspect
          ratio. */}
      {element.type === 'shape' && element.shape === 'browser' ? (
        <BrowserChrome
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)}
        />
      ) : null}
    </>
  );
}
