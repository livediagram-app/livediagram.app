'use client';

// Column and Bar charts (docs/specs/009-elements/pie-chart.md "Chart types"): the one view every product draws, from
// @liveworkspace/workbench, bound to this editor's chart animation.

import { BarChartView as SharedBarChartView } from '@liveworkspace/workbench/components/canvas/charts/BarChartView';
import type { ChartViewProps } from '@liveworkspace/workbench/components/canvas/charts/chart-view-props';
import type { ShapeElement } from '@livedesign/design';
import { useChartAnimOf } from '@/lib/chart';

export function BarChartView(props: ChartViewProps & { element: ShapeElement }) {
  return <SharedBarChartView {...props} anim={useChartAnimOf(props.element)} />;
}
