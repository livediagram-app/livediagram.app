import {
  finishIconWeight,
  finishWobblesArt,
  isHandDrawn,
  actorFigureRect,
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  finishBorderStroke,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultStrokeColor,
  ICON_REMOTE_HIGHLIGHT_PX,
  iconWeightPx,
  isBarShape,
  isChecklistShape,
  isLegendShape,
  isSankeyShape,
  isCodeBlockShape,
  isLineShape,
  isPieShape,
  isChartShape,
  isProgressShape,
  progressTrackColour,
  isRatingShape,
} from '@liveplanner/document';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useFillsTab, usePlanTabKind } from '@/hooks/plan/plan-cover-store';
import { FillTabElementContext, FillTabPending } from '@/components/plan/FillTabPending';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
import { isTechIconId } from '@/lib/tech-icons';
import { TechIconGlyph } from '@/components/primitives/tech-icon-glyph';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { iconMakesRoomForLabel } from '@/components/primitives/icon-band';
import { StickerView } from '@/components/canvas/StickerView';
import { SKETCH_TILE_FILTER_ID } from '@/components/palette/palette-tile-finish';
import { SketchArtPicture } from '@/components/canvas/SketchArtPicture';
import { liveFiltersRedrawOnRepaint } from '@/lib/live-filter-cost';
import { ProgressView } from '@/components/canvas/ProgressView';
import { RatingView } from '@/components/canvas/RatingView';
import { PieChartView } from '@/components/canvas/PieChartView';
import { CodeBlockView } from '@/components/canvas/CodeBlockView';
import { LegendView } from '@/components/canvas/LegendView';
import { ChecklistView } from '@/components/canvas/ChecklistView';
import { BarChartView } from '@/components/canvas/BarChartView';
import { LineChartView } from '@/components/canvas/LineChartView';
import { DataChartView } from '@/components/canvas/DataChartView';
import type { BoxedElementViewProps } from '@/components/canvas/BoxedElementView.types';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a document without
// Plan pays nothing for it.
const PlanCardView = dynamic(
  () => import('@/components/plan/PlanCardView').then((m) => m.PlanCardView),
  { ssr: false },
);
const PlanViewView = dynamic(
  () => import('@/components/plan/views/PlanViewView').then((m) => m.PlanViewView),
  { ssr: false, loading: FillTabPending },
);
// A Sankey (docs/specs/009-elements/sankey.md) loads only when one is drawn: most boards have none.
const SankeyView = dynamic(
  () => import('@/components/canvas/SankeyView').then((m) => m.SankeyView),
  { ssr: false },
);
// A chart drawn from a sheet range reads it through the sheets chunk, loaded only for such a chart.
const SheetLinkedChart = dynamic(
  () => import('@/components/sheets/SheetLinkedChart').then((m) => m.SheetLinkedChart),
  { ssr: false },
);
// The Sheet and its engine load only when one is drawn (docs/specs/029-sheets/sheet.md "Performance").
const PlanSheetView = dynamic(
  () => import('@/components/sheets/PlanSheetView').then((m) => m.PlanSheetView),
  { ssr: false, loading: FillTabPending },
);

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a document without
// Plan pays nothing for it.
// A Dashboard's boards, views and Sheets live in its slots (docs/specs/026-plan/plan-tabs.md "Slot content"): their
// copies on the canvas under the page draw nothing, so a maximised one has one header, one title and one set of
// controls, never a second from the copy underneath.
function OffDashboard({ id, children }: { id: string; children: ReactNode }) {
  // A Visualisation tab's chart fills the tab from here, as a Board tab's board does (fill-tab.ts).
  const fills = useFillsTab(id);
  // The element named for its view's loading cover (FillTabPending), so filling its tab it never shows small first.
  return usePlanTabKind() === 'dashboard' && !fills ? null : (
    <FillTabElementContext.Provider value={id}>{children}</FillTabElementContext.Provider>
  );
}

const PlanBoardView = dynamic(
  () => import('@/components/plan/PlanBoardView').then((m) => m.PlanBoardView),
  { ssr: false, loading: FillTabPending },
);

type ShapeContentRouterProps = Pick<
  BoxedElementViewProps,
  | 'element'
  | 'isSelected'
  | 'readOnly'
  | 'onToggleChecklistItem'
  | 'chartPalette'
  | 'fontFamily'
  | 'isEditing'
> & {
  accent: string;
  textColor: string;
  remoteBorderColor: string | null;
  isLocked: boolean;
};

// The per-shape-type inner content of a boxed element: stickers, tech /
// curated icons,
// progress / rail / rating data shapes, pie / bar / line charts, and the
// SVG-rendered geometric shapes. Returns null for a plain box (whose text +
// border render in BoxedElementView itself). Extracted from BoxedElementView.
export function ShapeContentRouter({
  element,
  accent,
  textColor,
  remoteBorderColor,
  isLocked,
  readOnly,
  onToggleChecklistItem,
  chartPalette,
  fontFamily,
  isEditing,
}: ShapeContentRouterProps) {
  // An icon's glyph moves aside for its caption from the moment the label is typed.
  const iconCaptioned = iconMakesRoomForLabel(element.label, !!isEditing);
  // The paper under this shape, for colours it doesn't carry (docs/specs/007-editor/live-app.md).
  const surface = useCanvasSurface();
  // A sketched silhouette is the SketchOverlay's (docs/specs/008-canvas/finish.md); Professional thins an
  // unset border.
  const finish = useElementFinish((element as { finish?: unknown }).finish);
  // Icons and stickers under Sketch draw through the shared hand-drawn wobble (SketchFilterDefs), their art kept.
  // WebKit runs that filter again on every repaint, so there the art is drawn into still pictures instead.
  const wobble = finish === 'sketch' && finishWobblesArt(element);
  const art = (node: ReactNode) =>
    !wobble ? (
      node
    ) : liveFiltersRedrawOnRepaint() ? (
      <SketchArtPicture>{node}</SketchArtPicture>
    ) : (
      <div className="h-full w-full" style={{ filter: `url(#${SKETCH_TILE_FILTER_ID})` }}>
        {node}
      </div>
    );
  return element.type === 'shape' && element.shape === 'sticker' ? (
    // Sticker (docs/specs/010-palette/stickers.md): its own die-cut art, drawn edge to edge. Takes no
    // element colours and gets no caption band — a sticker says what it says
    // in its own artwork.
    art(<StickerView stickerId={element.stickerId} />)
  ) : element.type === 'shape' && element.shape === 'icon' && isTechIconId(element.iconId) ? (
    // Technology (brand) icon: a fixed-colour tile + white glyph
    // (docs/specs/010-palette/technology-icons.md). Same shape kind as a curated icon, but the id
    // resolves in the tech catalogue, so it renders coloured rather
    // than stroke-tinted.
    art(
      <TechIconGlyph
        iconId={element.iconId}
        hasLabel={iconCaptioned}
        size={element.iconSize}
        labelAlignX={element.textAlignX ?? 'center'}
        labelAlignY={element.textAlignY ?? 'bottom'}
        animation={element.iconAnimation}
        animationSpeed={element.iconAnimationSpeed}
        animationRepeat={element.iconAnimationRepeat}
      />,
    )
  ) : element.type === 'shape' && element.shape === 'icon' ? (
    // Curated glyph: line art tinted by the element's stroke
    // colour. Rendered separately from ShapeSvgOverlay because it
    // keeps aspect ratio (the catalogue art must not warp) and is
    // data-driven by `iconId`.
    art(
      <IconGlyph
        iconId={element.iconId}
        stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)}
        // Professional draws an icon that sets no weight thin (docs/specs/008-canvas/finish.md).
        strokeWidth={
          remoteBorderColor
            ? ICON_REMOTE_HIGHLIGHT_PX
            : iconWeightPx(finishIconWeight(element.iconWeight, finish))
        }
        hasLabel={iconCaptioned}
        labelAlignX={element.textAlignX ?? 'center'}
        labelAlignY={element.textAlignY ?? 'bottom'}
        // Per-icon looping animation (docs/specs/008-canvas/canvas-and-palette.md). Picked from the icon context
        // menu; undefined = static.
        animation={element.iconAnimation}
        animationSpeed={element.iconAnimationSpeed}
        animationRepeat={element.iconAnimationRepeat}
      />,
    )
  ) : element.type === 'shape' && isProgressShape(element.shape) ? (
    // Progress elements (docs/specs/009-elements/progress.md): a bar / donut showing element.progress.
    // The fill takes the stroke accent; the track takes the fill colour, else the paper's default.
    <ProgressView
      element={element}
      accent={accent}
      track={progressTrackColour(element, surface)}
      textColor={textColor}
    />
  ) : element.type === 'shape' && isRatingShape(element.shape) ? (
    // Rating (docs/specs/009-elements/rating.md): a row of stars showing element.rating.
    <RatingView element={element} accent={accent} />
  ) : element.type === 'shape' && element.chartSource && isChartShape(element.shape) ? (
    // A chart drawn from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): its data read live. On a Dashboard
    // it is a slot's Sheet Chart, drawn there (docs/specs/026-plan/plan-tabs.md "Sheet Chart").
    <OffDashboard id={element.id}>
      <SheetLinkedChart element={element}>
        {(el) => (
          <DataChartView
            element={el}
            fontFamily={fontFamily}
            textColor={textColor}
            palette={chartPalette}
          />
        )}
      </SheetLinkedChart>
    </OffDashboard>
  ) : element.type === 'shape' && isPieShape(element.shape) ? (
    // Pie chart (docs/specs/009-elements/pie-chart.md): slices sized by value + a legend.
    <PieChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isBarShape(element.shape) ? (
    // Bar chart (docs/specs/009-elements/pie-chart.md): bars sized by value + a legend.
    <BarChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isCodeBlockShape(element.shape) ? (
    // Code block (docs/specs/009-elements/code-block.md): the fixed dark editor card. Deliberately takes
    // no theme colours — the dark card is its identity.
    <CodeBlockView element={element} />
  ) : element.type === 'shape' && isLegendShape(element.shape) ? (
    // Legend (docs/specs/009-elements/pie-chart.md): a key card of colour-coded rows, edited from the
    // menu's Legend section.
    <LegendView
      element={element}
      accent={accent}
      fill={element.fillColor ?? defaultFillColor(element, surface)}
      textColor={textColor}
      fontFamily={fontFamily}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && element.shape === 'plan-board' ? (
    // Plan board (docs/specs/026-plan/plan-board.md): columns of cards drawn from the document's
    // items, through PlanContext.
    <OffDashboard id={element.id}>
      <PlanBoardView element={element} fontFamily={fontFamily} />
    </OffDashboard>
  ) : element.type === 'shape' && element.shape === 'plan-card' ? (
    // Plan card (docs/specs/026-plan/plan-board.md "The Plan card"): one item's card face.
    <PlanCardView element={element} fontFamily={fontFamily} />
  ) : element.type === 'shape' && element.shape === 'plan-view' ? (
    // Plan view (docs/specs/026-plan/plan-views.md): a metric or a visualisation of every card.
    <OffDashboard id={element.id}>
      <PlanViewView element={element} fontFamily={fontFamily} chartPalette={chartPalette} />
    </OffDashboard>
  ) : element.type === 'shape' && element.shape === 'plan-sheet' ? (
    // Sheet (docs/specs/029-sheets/sheet.md): a spreadsheet tab of the document's sheet store.
    <OffDashboard id={element.id}>
      <PlanSheetView element={element} fontFamily={fontFamily} />
    </OffDashboard>
  ) : element.type === 'shape' && isChecklistShape(element.shape) ? (
    // Checklist (docs/specs/009-elements/checklist.md): themed card of checkbox rows; boxes toggle
    // on-canvas for anyone with edit access (no select-first required).
    <ChecklistView
      element={element}
      accent={accent}
      fill={element.fillColor ?? defaultFillColor(element, surface)}
      textColor={textColor}
      fontFamily={fontFamily}
      editable={!readOnly && !isLocked}
      onToggle={onToggleChecklistItem}
    />
  ) : element.type === 'shape' && isSankeyShape(element.shape) ? (
    // Sankey diagram (docs/specs/009-elements/sankey.md): flows between nodes, laid out in columns.
    <SankeyView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
      editable={!readOnly && !isLocked}
      onCanvas
    />
  ) : element.type === 'shape' && isLineShape(element.shape) ? (
    // Line chart (docs/specs/009-elements/pie-chart.md): multi-series lines + a legend.
    <LineChartView
      element={element}
      fontFamily={fontFamily}
      textColor={textColor}
      palette={chartPalette}
    />
  ) : element.type === 'shape' && isSvgRenderedShape(element.shape) && !isHandDrawn(finish) ? (
    <ShapeSvgOverlay
      shape={element.shape}
      fill={element.fillColor ?? defaultFillColor(element, surface)}
      stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)}
      strokeWidth={
        remoteBorderColor ? 3 : BORDER_STROKE_PX[finishBorderStroke(element.strokeWidth, finish)]
      }
      strokeDasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? undefined}
      aspect={element.height > 0 ? element.width / element.height : 1}
      figure={element.shape === 'actor' ? actorFigureRect(element) : undefined}
    />
  ) : null;
}
