'use client';

// The pie, bar or line chart view for a chart element (docs/specs/009-elements/pie-chart.md): the one a chart drawn
// from a sheet range draws its live data through (docs/specs/029-sheets/sheet.md "Charts"). Its axis numbers, values
// and legend are lettered in the UI face, or the chart's own Font, never the tab's (docs/specs/004-interface-design/
// fonts.md "On Sheet tabs and charts"): the views take no face and inherit this root's.
import { isBarShape, isPieShape, type ShapeElement } from '@liveplanner/project';
import { planChartFontStyle } from '@/lib/plan-font';
import { PieChartView } from './PieChartView';
import { BarChartView } from './BarChartView';
import { LineChartView } from './LineChartView';

export function DataChartView(props: {
  element: ShapeElement;
  textColor: string;
  palette?: readonly string[];
}) {
  const view = isPieShape(props.element.shape) ? (
    <PieChartView {...props} />
  ) : isBarShape(props.element.shape) ? (
    <BarChartView {...props} />
  ) : (
    <LineChartView {...props} />
  );
  return (
    <div className="absolute inset-0" style={planChartFontStyle(props.element.font)}>
      {view}
    </div>
  );
}
