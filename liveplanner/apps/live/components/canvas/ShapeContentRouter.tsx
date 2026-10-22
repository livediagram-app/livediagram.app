import { isChartShape } from '@liveplanner/document';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useFillsTab, usePlanTabKind } from '@/hooks/plan/plan-cover-store';
import { FillTabElementContext, FillTabPending } from '@/components/plan/FillTabPending';
import { DataChartView } from '@/components/canvas/DataChartView';
import type { BoxedElementViewProps } from '@/components/canvas/BoxedElementView.types';

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
  'element' | 'chartPalette' | 'fontFamily'
> & {
  textColor: string;
};

// The per-shape-type inner content of a boxed element: Plan's boards, cards, views and Sheets, and a chart drawn
// from a sheet range. Returns null for a plain box (whose text + border render in BoxedElementView itself).
export function ShapeContentRouter({
  element,
  textColor,
  chartPalette,
  fontFamily,
}: ShapeContentRouterProps) {
  return element.type === 'shape' && element.chartSource && isChartShape(element.shape) ? (
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
  ) : null;
}
