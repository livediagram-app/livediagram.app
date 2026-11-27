import { AXIS_TICK_FONT_PX, AXIS_TICK_GAP } from '@liveworkspace/element-model/chart-axis';
import { type BarMarks, type LineMarks } from '@liveworkspace/element-model/chart-marks';
import { CHART_GRID_OPACITY } from '@liveworkspace/element-model/chart-style';

// Show Axis (docs/specs/009-elements/pie-chart.md): the value axis the marks laid out (chart-axis.ts), drawn as the
// exporter draws it, a faint gridline in the chart's own text colour (chart-style.ts) and a label at each tick.

type Ink = {
  textColor: string;
  fontFamily?: string | undefined;
  // The labels' size (chart-style.ts chartTickPx).
  fontPx?: number;
};

/** A line, area or scatter chart's ticks: the left axis with its gridlines, the right axis's labels beside an edge in
 *  its series' colour. */
export function LineChartAxis({
  marks,
  rightColor,
  textColor,
  fontFamily,
  fontPx = AXIS_TICK_FONT_PX,
}: Ink & { marks: LineMarks; rightColor: string }) {
  const { x, w } = marks.plot;
  return (
    <g aria-hidden="true">
      {marks.axis.left.map((t, i) => (
        <g key={`l${i}`}>
          <line
            x1={x}
            y1={t.y}
            x2={x + w}
            y2={t.y}
            stroke={textColor}
            strokeOpacity={CHART_GRID_OPACITY}
            strokeWidth={1}
          />
          <text
            x={x - AXIS_TICK_GAP}
            y={t.y + fontPx / 3}
            textAnchor="end"
            fontSize={fontPx}
            fill={textColor}
            fontFamily={fontFamily}
          >
            {t.text}
          </text>
        </g>
      ))}
      {marks.axis.right.length > 0 ? (
        <line
          x1={x + w}
          y1={marks.plot.y}
          x2={x + w}
          y2={marks.plot.y + marks.plot.h}
          stroke={rightColor}
          strokeWidth={2}
        />
      ) : null}
      {marks.axis.right.map((t, i) => (
        <text
          key={`r${i}`}
          x={x + w + AXIS_TICK_GAP}
          y={t.y + fontPx / 3}
          textAnchor="start"
          fontSize={fontPx}
          fill={textColor}
          fontFamily={fontFamily}
        >
          {t.text}
        </text>
      ))}
    </g>
  );
}

/** A column chart's ticks up its left side, or a bar chart's along its bottom, each with its gridline. */
export function BarChartAxis({
  marks,
  horizontal,
  textColor,
  fontFamily,
  fontPx = AXIS_TICK_FONT_PX,
}: Ink & { marks: BarMarks; horizontal: boolean }) {
  const [s0, s1] = marks.axis.span;
  return (
    <g aria-hidden="true">
      {marks.axis.ticks.map((t, i) =>
        horizontal ? (
          <g key={i}>
            <line
              x1={t.at}
              y1={s0}
              x2={t.at}
              y2={s1}
              stroke={textColor}
              strokeOpacity={CHART_GRID_OPACITY}
              strokeWidth={1}
            />
            <text
              x={t.at}
              y={s1 + AXIS_TICK_GAP + fontPx}
              textAnchor="middle"
              fontSize={fontPx}
              fill={textColor}
              fontFamily={fontFamily}
            >
              {t.text}
            </text>
          </g>
        ) : (
          <g key={i}>
            <line
              x1={s0}
              y1={t.at}
              x2={s1}
              y2={t.at}
              stroke={textColor}
              strokeOpacity={CHART_GRID_OPACITY}
              strokeWidth={1}
            />
            <text
              x={s0 - AXIS_TICK_GAP}
              y={t.at + fontPx / 3}
              textAnchor="end"
              fontSize={fontPx}
              fill={textColor}
              fontFamily={fontFamily}
            >
              {t.text}
            </text>
          </g>
        ),
      )}
    </g>
  );
}
