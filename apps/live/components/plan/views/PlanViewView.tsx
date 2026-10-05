'use client';

// The plan view element's body (docs/specs/025-plan/plan-views.md): a metric or a visualisation of
// every live card, in the canvas theme's board colours. Each view is its own component; this picks one.
import type { ShapeElement } from '@livediagram/document';
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

export type PlanViewProps = {
  plan: PlanContextValue | undefined;
  items: ReadonlyMap<string, Item>;
  palette: PlanPalette;
  fontFamily?: string;
  // The element's size, for views that fit their content to it.
  width: number;
  height: number;
};

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

export function PlanViewView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  fontFamily?: string;
}) {
  const plan = usePlan();
  const palette = planPalette(useCanvasSurface(), planOwnColours(element));
  const view: PlanViewId = element.planView?.view ?? 'status-mix';
  const props: PlanViewProps = {
    plan,
    items: plan?.items ?? NO_ITEMS,
    palette,
    fontFamily,
    width: element.width,
    height: element.height,
  };
  const widget = planViewMetric(view);
  if (widget) return <MetricView kind={widget} {...props} />;
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
