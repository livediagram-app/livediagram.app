'use client';

// The plan view element's body (docs/specs/026-plan/plan-views.md): a metric or a visualisation of
// every live card, in the canvas theme's board colours. Each view is its own component; this picks one. A
// visualisation can be maximised to fill the screen for this person alone (plan-views.md "Maximised view").
import { useState } from 'react';
import { PIE_PALETTE, type PlanViewRef, type ShapeElement } from '@livediagram/document';
import { planViewMetric, type Item, type PlanViewId } from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePlan, type PlanContextValue } from '../PlanContext';
import { planOwnColours, planPalette, type PlanPalette } from '../plan-palette';
import { MetricView } from './MetricView';
import { GanttView } from './GanttView';
import { CalendarView } from './CalendarView';
import { WorkloadView } from './WorkloadView';
import { StatusMixView } from './StatusMixView';
import { PriorityMatrixView } from './PriorityMatrixView';
import { ViewHeaderEnd } from './view-frame';
import { useMaximisedPlanId } from '@/hooks/plan/maximised-plan';
import {
  MaximisePlanButton,
  MaximisableSlot,
  useMaximisedPlanLifetime,
} from '../MaximisedPlanLayer';

export type PlanViewProps = {
  plan: PlanContextValue | undefined;
  items: ReadonlyMap<string, Item>;
  palette: PlanPalette;
  // The tab theme's categorical colours, as the chart elements take them (docs/specs/009-elements/pie-chart.md).
  chartPalette: readonly string[];
  fontFamily?: string;
  // The element's size, for views that fit their content to it.
  width: number;
  height: number;
  // The element and its settings (the Gantt's swimlanes and names width), for views that keep their own.
  elementId: string;
  settings: PlanViewRef;
};

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

export function PlanViewView({
  element,
  fontFamily,
  chartPalette,
}: {
  element: ShapeElement;
  fontFamily?: string;
  chartPalette?: readonly string[];
}) {
  const plan = usePlan();
  const palette = planPalette(useCanvasSurface(), planOwnColours(element));
  const view: PlanViewId = element.planView?.view ?? 'status-mix';
  // The overlay's size while this view is maximised (MaximisableSlot reports it), else null.
  const [maximisedSize, setMaximisedSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const props: PlanViewProps = {
    plan,
    items: plan?.items ?? NO_ITEMS,
    palette,
    chartPalette: chartPalette && chartPalette.length > 0 ? chartPalette : PIE_PALETTE,
    fontFamily,
    // Maximised, a view lays itself out at the overlay's size, not the element's.
    width: maximisedSize?.width ?? element.width,
    height: maximisedSize?.height ?? element.height,
    elementId: element.id,
    settings: element.planView ?? { view },
  };
  const widget = planViewMetric(view);
  // Maximised, for this person only; a metric is too small to need it.
  const maximised = useMaximisedPlanId() === element.id;
  const interactive = !!plan?.planInput;
  useMaximisedPlanLifetime(element.id, maximised, interactive);
  if (widget) return <MetricView kind={widget} {...props} />;
  const body = (
    <ViewHeaderEnd.Provider
      value={
        interactive ? (
          <MaximisePlanButton
            id={element.id}
            kind="View"
            maximised={maximised}
            palette={palette}
            small
          />
        ) : null
      }
    >
      {viewOf(view, props)}
    </ViewHeaderEnd.Provider>
  );
  // One stable tree whether maximised or not (MaximisableSlot), so the view keeps its state (a Gantt's scale,
  // window and collapsed lanes) both ways; while it fills the screen, the canvas keeps its place, empty.
  return (
    <MaximisableSlot
      id={element.id}
      maximised={maximised}
      placeholder={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 12,
      }}
      onMaximisedSize={setMaximisedSize}
    >
      {body}
    </MaximisableSlot>
  );
}

function viewOf(view: PlanViewId, props: PlanViewProps) {
  switch (view) {
    case 'gantt':
      return <GanttView {...props} />;
    case 'calendar':
      return <CalendarView {...props} />;
    case 'workload':
      return <WorkloadView {...props} />;
    case 'priority-matrix':
      return <PriorityMatrixView {...props} />;
    default:
      return <StatusMixView {...props} />;
  }
}
