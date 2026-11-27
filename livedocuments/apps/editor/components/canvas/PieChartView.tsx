'use client';

// Pie and Doughnut charts (docs/specs/009-elements/pie-chart.md "Chart types"): the one view every product draws, from
// @liveworkspace/workbench, bound to this editor's chart animation.

import { PieChartView as SharedPieChartView } from '@liveworkspace/workbench/components/canvas/charts/PieChartView';
import type { ChartViewProps } from '@liveworkspace/workbench/components/canvas/charts/chart-view-props';
import type { ShapeElement } from '@livedocuments/document';
import { useChartAnimOf } from '@/lib/chart';

export function PieChartView(props: ChartViewProps & { element: ShapeElement }) {
  return <SharedPieChartView {...props} anim={useChartAnimOf(props.element)} />;
}
