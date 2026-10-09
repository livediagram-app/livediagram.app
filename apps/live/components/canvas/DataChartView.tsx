'use client';

// The pie, bar or line chart view for a chart element (docs/specs/009-elements/pie-chart.md): the one a chart drawn
// from a sheet range draws its live data through (docs/specs/029-sheets/sheet.md "Charts").
import { isBarShape, isPieShape, type ShapeElement } from '@livediagram/document';
import { PieChartView } from './PieChartView';
import { BarChartView } from './BarChartView';
import { LineChartView } from './LineChartView';

export function DataChartView(props: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  palette?: readonly string[];
}) {
  if (isPieShape(props.element.shape)) return <PieChartView {...props} />;
  if (isBarShape(props.element.shape)) return <BarChartView {...props} />;
  return <LineChartView {...props} />;
}
