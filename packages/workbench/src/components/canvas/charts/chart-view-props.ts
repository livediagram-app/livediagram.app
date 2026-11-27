import type { CSSProperties } from 'react';
import type { ShapeElement } from '@liveworkspace/element-model/element';

// What every product's canvas hands a chart view (each product's docs/specs/009-elements/pie-chart.md).
export type ChartViewProps = {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  // Default series colours (the tab theme's, themeChartPalette); the built-in ramp when absent.
  palette?: readonly string[];
  // What the chart sits on (chartPageGrounds): its series drawn adapted to it.
  ground?: readonly string[];
};

// The chart's animation, worked out by its product (its own animation classes and the Chart tour's preview), for a
// transform origin only the view knows (a pie's centre, a column chart's baseline).
export type ChartAnimOf = (transformOrigin: string) => {
  className: string | undefined;
  style: CSSProperties | undefined;
};
