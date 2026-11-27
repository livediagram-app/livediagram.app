'use client';

// Line, Area and Scatter charts (docs/specs/009-elements/pie-chart.md "Chart types"): the one view every product draws, from
// @liveworkspace/workbench, bound to this editor's chart animation.

import { LineChartView as SharedLineChartView } from '@liveworkspace/workbench/components/canvas/charts/LineChartView';
import type { ChartViewProps } from '@liveworkspace/workbench/components/canvas/charts/chart-view-props';
import type { ShapeElement } from '@liveknowledge/document';
import { chartAnimOf } from '@/lib/chart';

export function LineChartView(props: ChartViewProps & { element: ShapeElement }) {
  return <SharedLineChartView {...props} anim={chartAnimOf(props.element)} />;
}
