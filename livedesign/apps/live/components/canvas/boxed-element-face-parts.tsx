import {
  BORDER_DASH_ARRAY,
  finishBorderStroke,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  defaultStrokeColor,
  withTagAccent,
} from '@livedesign/design';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';
import { BoxBorderOverlay } from '@/components/canvas/BoxBorderOverlay';
import { PageCornerFold } from '@liveworkspace/workbench/components/canvas/PageCornerFold';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import type { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
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
  own: { fill?: string; stroke?: string; text?: string };
  surface: ReturnType<typeof useElementSurface>;
  isLocked: boolean;
  artAnimClass: Animation['artAnimClass'];
  svgAnim: Animation['svgAnim'];
  accent: string;
  textColor: string;
  remoteBorderColor: string | null;
  sketch: ReturnType<typeof useSketchPaint>;
  finish: ReturnType<typeof useElementFinish>;
  cornerPx: number;
};

// What a boxed element draws over its body and under its label (BoxedElementView): a card's accent edge, a
// pointer note's tail, the shape's own content, a dashed border CSS cannot draw, a Page's folded corner and
// a browser's chrome. A plain function the view calls in its render, so the element gains no component level.
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
  }: BoxedElementViewProps,
  {
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
