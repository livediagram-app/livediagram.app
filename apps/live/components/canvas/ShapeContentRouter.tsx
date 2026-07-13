import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultStrokeColor,
  isBarShape,
  isLineShape,
  isPieShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
} from '@livediagram/diagram';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
import { isTechIconId } from '@/lib/tech-icons';
import { TechIconGlyph } from '@/components/primitives/tech-icon-glyph';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { ProgressView } from '@/components/canvas/ProgressView';
import { RailView } from '@/components/canvas/RailView';
import { RatingView } from '@/components/canvas/RatingView';
import { PieChartView } from '@/components/canvas/PieChartView';
import { BarChartView } from '@/components/canvas/BarChartView';
import { LineChartView } from '@/components/canvas/LineChartView';
import type { BoxedElementViewProps } from '@/components/canvas/BoxedElementView.types';

type ShapeContentRouterProps = Pick<
  BoxedElementViewProps,
  'element' | 'isSelected' | 'readOnly' | 'onSetRailLabel' | 'chartPalette' | 'fontFamily'
> & {
  accent: string;
  textColor: string;
  remoteBorderColor: string | null;
  isLocked: boolean;
  svgAnim: 'trace' | 'gradient' | 'pulse' | 'glow' | undefined;
};

// The per-shape-type inner content of a boxed element: tech / curated icons,
// progress / rail / rating data shapes, pie / bar / line charts, and the
// SVG-rendered geometric shapes. Returns null for a plain box (whose text +
// border render in BoxedElementView itself). Extracted from BoxedElementView.
export function ShapeContentRouter({
  element,
  accent,
  textColor,
  remoteBorderColor,
  isLocked,
  isSelected,
  readOnly,
  onSetRailLabel,
  chartPalette,
  fontFamily,
  svgAnim,
}: ShapeContentRouterProps) {
  return element.type === 'shape' && element.shape === 'icon' && isTechIconId(element.iconId) ? (
    // Technology (brand) icon: a fixed-colour tile + white glyph
    // (spec/41). Same shape kind as a curated icon, but the id
    // resolves in the tech catalogue, so it renders coloured rather
    // than stroke-tinted.
    <TechIconGlyph
      iconId={element.iconId}
      hasLabel={(element.label ?? '').trim().length > 0}
      size={element.iconSize}
      labelAlignX={element.textAlignX ?? 'center'}
      labelAlignY={element.textAlignY ?? 'bottom'}
      animation={element.iconAnimation}
      animationSpeed={element.iconAnimationSpeed}
      animationRepeat={element.iconAnimationRepeat}
    />
  ) : element.type === 'shape' && element.shape === 'icon' ? (
    // Curated glyph: line art tinted by the element's stroke
    // colour. Rendered separately from ShapeSvgOverlay because it
    // keeps aspect ratio (the catalogue art must not warp) and is
    // data-driven by `iconId`.
    <IconGlyph
      iconId={element.iconId}
      stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
      strokeWidth={remoteBorderColor ? 3 : 2}
      hasLabel={(element.label ?? '').trim().length > 0}
      labelAlignX={element.textAlignX ?? 'center'}
      labelAlignY={element.textAlignY ?? 'bottom'}
      // Per-icon looping animation (spec/09). Picked from the icon context
      // menu; undefined = static.
      animation={element.iconAnimation}
      animationSpeed={element.iconAnimationSpeed}
      animationRepeat={element.iconAnimationRepeat}
    />
  ) : element.type === 'shape' && isProgressShape(element.shape) ? (
    // Progress elements (spec/46): a bar / donut showing element.progress.
    // The fill takes the stroke accent; the track takes the fill colour.
    <ProgressView
      element={element}
      accent={accent}
      track={element.fillColor ?? '#e2e8f0'}
      textColor={textColor}
    />
  ) : element.type === 'shape' && isRailShape(element.shape) ? (
    // Timeline rail (spec/51): a line + evenly-spaced points, with an
    // add-point affordance at the right end when selected + editable.
    <RailView
      element={element}
      accent={accent}
      textColor={textColor}
      fontFamily={fontFamily}
      editable={isSelected && !readOnly && !isLocked}
      onSetLabel={onSetRailLabel}
    />
  ) : element.type === 'shape' && isRatingShape(element.shape) ? (
    // Rating (spec/52): a row of stars showing element.rating.
    <RatingView element={element} accent={accent} />
  ) : element.type === 'shape' && isPieShape(element.shape) ? (
    // Pie chart (spec/53): slices sized by value + a legend.
    <PieChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isBarShape(element.shape) ? (
    // Bar chart (spec/53): bars sized by value + a legend.
    <BarChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isLineShape(element.shape) ? (
    // Line chart (spec/53): multi-series lines + a legend.
    <LineChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isSvgRenderedShape(element.shape) ? (
    <ShapeSvgOverlay
      shape={element.shape}
      fill={element.fillColor ?? defaultFillColor(element)}
      stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
      strokeWidth={
        remoteBorderColor ? 3 : BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]
      }
      strokeDasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? undefined}
      aspect={element.height > 0 ? element.width / element.height : 1}
      // trace / gradient / pulse / glow render against the true SVG
      // geometry here; blink / bounce / wobble (shape-agnostic) stay on the
      // wrapper. svgHandlesAnim above suppresses the wrapper class so these
      // don't double up.
      animation={svgAnim}
    />
  ) : null;
}
