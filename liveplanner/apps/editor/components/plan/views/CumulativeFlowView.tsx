'use client';

// Cumulative Flow (docs/specs/026-plan/plan-views.md "Flow charts"): a band per status, stacked Done at the bottom to
// the first column on top, for each day of the range from the plan's daily flow counts, each in its phase's colour
// family. Before the first counted day nothing is drawn, and the summary line says when counting began. Hovering drops
// a line on a day and names each status's count, top band first.
import { useMemo, useState } from 'react';
import { plural } from '@liveplanner/project';
import { flowCountsOf } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { FlowAxes, FlowFrame, FlowKeyEntry, FlowTip, plotPoint, useFlowChart } from './flow-frame';
import {
  cumulativeFlowModel,
  flowKeyLines,
  flowDayLabel,
  niceTicks,
  type CumulativeFlowModel,
  type PlotBox,
} from './flow-chart-model';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
const NO_NAMES = new Map<string, string>();
// The most statuses the hover card lists before "and N more".
const TIP_ROWS_MAX = 8;
// The key row's side padding and the frame's border, taken from the element's width.
const KEY_INSET_PX = 26;

export function CumulativeFlowView(props: PlanViewProps) {
  const { plan, palette, fontFamily, width, height } = props;
  const { days, flow, types } = useFlowChart(props);
  const phases = plan?.statusPhases ?? NO_PHASES;
  const names = plan?.statusNames ?? NO_NAMES;
  const data = flow.data;
  const model = useMemo(() => {
    if (!data) return null;
    const counts = flowCountsOf(data.counts, data.fromDay, data.toDay, types);
    return { counts, chart: cumulativeFlowModel(counts, phases, names, palette.surface) };
  }, [data, types, phases, names, palette.surface]);
  const chart = model?.chart;
  const counted = chart ? chart.countedFrom !== null && chart.bands.length > 0 : false;
  const last = chart ? (chart.totals[chart.totals.length - 1] ?? 0) : 0;
  const since =
    chart && model && chart.countedFrom !== null && chart.countedFrom > 0
      ? flowDayLabel(model.counts.fromDay + chart.countedFrom)
      : null;
  return (
    <FlowFrame
      view="cumulative-flow"
      days={days}
      flow={flow}
      plan={plan}
      palette={palette}
      fontFamily={fontFamily}
      width={width}
      height={height}
      count={last}
      countLabel={plural(last, 'card')}
      hasData={counted}
      empty="No flow counted yet"
      summary={
        chart ? (
          <>
            <strong className="font-semibold">{chart.inProgress}</strong> in progress
            <span className="opacity-60"> · </span>
            <strong className="font-semibold">{chart.done}</strong> done
            {since ? (
              <span style={{ color: palette.muted }}>
                <span className="opacity-60"> · </span>Counting since {since}
              </span>
            ) : null}
          </>
        ) : null
      }
      legendLines={
        chart
          ? flowKeyLines(
              chart.bands.map((b) => b.label),
              width - KEY_INSET_PX,
            )
          : 1
      }
      legend={
        chart ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3">
            {[...chart.bands].reverse().map((b) => (
              <FlowKeyEntry key={b.status} colour={b.colour} label={b.label} palette={palette} />
            ))}
          </span>
        ) : null
      }
    >
      {(box, size) =>
        chart && model && counted ? (
          <FlowPlot
            box={box}
            size={size}
            chart={chart}
            fromDay={model.counts.fromDay}
            days={model.counts.days}
            palette={palette}
          />
        ) : null
      }
    </FlowFrame>
  );
}

function FlowPlot({
  box,
  size,
  chart,
  fromDay,
  days,
  palette,
}: {
  box: PlotBox;
  size: { width: number; height: number };
  chart: CumulativeFlowModel;
  fromDay: number;
  days: number;
  palette: PlanPalette;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { top, ticks } = niceTicks(chart.max);
  const foot = box.y + box.height;
  const first = chart.countedFrom ?? 0;
  const dayW = box.width / days;
  const paths = useMemo(
    () => bandPaths(chart, box, top, days, first),
    [chart, box, top, days, first],
  );
  const toDay = fromDay + days - 1;
  const hover = active !== null && active >= first ? active : null;
  const x = hover !== null ? box.x + (hover + 0.5) * dayW : 0;
  const lastDay = chart.totals.length - 1;
  const spoken = `Cumulative Flow on ${flowDayLabel(toDay)}: ${[...chart.bands]
    .reverse()
    .map((b) => `${b.label} ${b.values[lastDay] ?? 0}`)
    .join(', ')}.`;
  return (
    <>
      <svg
        role="img"
        aria-label={spoken}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="absolute inset-0"
        onPointerMove={(e) => {
          const p = plotPoint(e, size);
          const i = Math.floor((p.x - box.x) / dayW);
          setActive(i >= 0 && i < days ? i : null);
        }}
        onPointerLeave={() => setActive(null)}
      >
        <FlowAxes
          box={box}
          top={top}
          ticks={ticks}
          fromDay={fromDay}
          toDay={toDay}
          palette={palette}
        />
        <g aria-hidden stroke={palette.surface} strokeWidth={1} strokeLinejoin="round">
          {chart.bands.map((b, i) => (
            <path key={b.status} d={paths[i]} fill={b.colour} />
          ))}
        </g>
        {hover !== null ? (
          <line
            aria-hidden
            x1={x}
            x2={x}
            y1={box.y}
            y2={foot}
            stroke={palette.text}
            strokeOpacity={0.6}
            strokeWidth={1}
          />
        ) : null}
      </svg>
      {hover !== null ? (
        <FlowTip x={x} y={box.y + 8} width={size.width} height={size.height} palette={palette}>
          <div className="mb-0.5 font-semibold">{flowDayLabel(fromDay + hover)}</div>
          {[...chart.bands]
            .reverse()
            .slice(0, TIP_ROWS_MAX)
            .map((b) => (
              <div key={b.status} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: b.colour }}
                />
                <span className="min-w-0 flex-1 truncate" style={{ color: palette.muted }}>
                  {b.label}
                </span>
                <span className="pl-3 font-semibold tabular-nums">{b.values[hover] ?? 0}</span>
              </div>
            ))}
          {chart.bands.length > TIP_ROWS_MAX ? (
            <div style={{ color: palette.muted }}>and {chart.bands.length - TIP_ROWS_MAX} more</div>
          ) : null}
        </FlowTip>
      ) : null}
    </>
  );
}

// Each band's area, bottom band first: along its top day by day and back along the top of the band under it. Days
// before `first` are not drawn; the first and last counted days reach their days' outer edges, so one counted day is
// a block, not a line. Linear in bands times days.
export function bandPaths(
  chart: CumulativeFlowModel,
  box: PlotBox,
  top: number,
  days: number,
  first: number,
): string[] {
  const dayW = box.width / days;
  const foot = box.y + box.height;
  const y = (v: number) => (foot - (v / top) * box.height).toFixed(1);
  const xs: number[] = [];
  const at: number[] = [];
  xs.push(box.x + first * dayW);
  at.push(first);
  for (let i = first; i < days; i++) {
    xs.push(box.x + (i + 0.5) * dayW);
    at.push(i);
  }
  xs.push(box.x + days * dayW);
  at.push(days - 1);
  const out: string[] = [];
  let under: number[] | null = null;
  for (const band of chart.bands) {
    const upper = at.map((d) => band.tops[d] ?? 0);
    const lower = under ?? at.map(() => 0);
    let d = `M${xs[0]!.toFixed(1)} ${y(upper[0]!)}`;
    for (let k = 1; k < xs.length; k++) d += `L${xs[k]!.toFixed(1)} ${y(upper[k]!)}`;
    for (let k = xs.length - 1; k >= 0; k--) d += `L${xs[k]!.toFixed(1)} ${y(lower[k]!)}`;
    out.push(`${d}Z`);
    under = upper;
  }
  return out;
}
