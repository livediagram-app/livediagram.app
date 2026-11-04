'use client';

// A Board or Sheet tab's preview (docs/specs/026-plan/plan-overview.md "Tabs"): the tab's own board or Sheet, the very
// view its tab draws (PlanBoardView, PlanSheetView, as a Dashboard slot draws one), laid out at the preview window's
// size in the tab's theme and backdrop, then scaled into the tile. TabPreview keeps it inert: no pointer, no focus,
// nothing read out, so nothing in it can be pressed, dragged or typed into.
import { useMemo } from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  canvasSurface,
  elementFontId,
  resolveFontStack,
  type ShapeElement,
  type Tab,
} from '@liveplanner/project';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { PlanBoardView } from '@/components/plan/PlanBoardView';
import { PlanSheetView } from '@/components/sheets/PlanSheetView';
import { SheetChartsContext, useSheetCharts } from '@/components/sheets/sheet-charts-context';
import { SheetHomeTabContext } from '@/components/sheets/sheet-home-tab';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { tabAsSeen } from '@/lib/export-as-seen';
import { LIVE_PREVIEW_H, LIVE_PREVIEW_W, previewFit } from './tab-preview-svg';

// The most cards a cell of a previewed board draws: more than a 600 px window ever shows of one cell, so the picture
// is the board's, at the cost of a screen of cards rather than every card (blueprint PREVIEW_CELL_CARDS_MAX).
export const PREVIEW_CELL_CARDS_MAX = 10;

// Marks a preview's copy of a tab's element.
const PREVIEW_ID_SUFFIX = ':overview-preview';

// The element that fills a Board or Sheet tab, or undefined for any other tab.
export function fillingElementOf(tab: Tab): ShapeElement | undefined {
  const shape = tab.kind === 'board' ? 'plan-board' : tab.kind === 'sheet' ? 'plan-sheet' : null;
  if (!shape) return undefined;
  return tab.elements.find((e) => e.type === 'shape' && e.shape === shape) as
    ShapeElement | undefined;
}

export function LivePlanPreview({ tab, box }: { tab: Tab; box: { w: number; h: number } }) {
  const { appearance } = useAppearance();
  // The tab as its canvas draws it: its backdrop and theme colours in the viewer's appearance.
  const seen = useMemo(() => tabAsSeen(tab, appearance), [tab, appearance]);
  const own = fillingElementOf(seen);
  const element = useMemo(
    () =>
      own
        ? {
            ...own,
            // An id of its own: the board keyed by its tab's id fills that tab (a portal over the canvas area) and
            // publishes its tab's CSV actions; the preview must do neither, and never take them from the tab.
            id: `${own.id}${PREVIEW_ID_SUFFIX}`,
            x: 0,
            y: 0,
            width: LIVE_PREVIEW_W,
            height: LIVE_PREVIEW_H,
          }
        : null,
    [own],
  );
  const renderChart = useSheetCharts()?.renderChart;
  if (!element) return null;
  const paper = seen.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const fit = previewFit({ w: LIVE_PREVIEW_W, h: LIVE_PREVIEW_H }, box, false);
  const font = resolveFontStack(elementFontId(element, seen.font, seen.finish));
  return (
    <span
      data-tab-preview-live={element.shape}
      className="absolute inset-0"
      style={{ backgroundColor: paper }}
    >
      <span
        className="absolute left-0 top-0 block origin-top-left"
        style={{
          width: LIVE_PREVIEW_W,
          height: LIVE_PREVIEW_H,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
      >
        <CanvasSurfaceProvider surface={canvasSurface(paper)}>
          {element.shape === 'plan-sheet' ? (
            <SheetChartsContext.Provider
              value={{ elements: seen.elements, editable: false, renderChart }}
            >
              <SheetHomeTabContext.Provider value={tab.id}>
                <PlanSheetView element={element} />
              </SheetHomeTabContext.Provider>
            </SheetChartsContext.Provider>
          ) : (
            <PlanBoardView
              element={element}
              cellCardsMax={PREVIEW_CELL_CARDS_MAX}
              {...(font ? { fontFamily: font } : {})}
            />
          )}
        </CanvasSurfaceProvider>
      </span>
    </span>
  );
}
