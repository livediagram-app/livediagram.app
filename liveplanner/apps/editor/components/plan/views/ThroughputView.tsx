'use client';

// Throughput (docs/specs/026-plan/plan-views.md "Flow charts"): a bar per Monday-started week (per day over 14 days)
// of the cards finished in it, the one still running lighter, a dashed line at the average of the whole ones, named in
// the summary line. Hovering a bar names its period and count.
import { useMemo, useState } from 'react';
import { plural } from '@liveplanner/project';
import { cycleTimesOf, flowPeriodOf, throughputOf, type Throughput } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { PHASE_COLOURS } from './view-frame';
import { FlowAxes, FlowFrame, FlowTip, plotPoint, useFlowChart } from './flow-frame';
import {
  FLOW_BAR_LABEL_MIN_PX,
  FLOW_DAY_LABEL_PX,
  flowDayLabel,
  niceTicks,
  periodLabel,
  throughputSummary,
  type PlotBox,
} from './flow-chart-model';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
// The gap between bars, as a share of a period's width, and the most a bar may be.
const BAR_GAP_SHARE = 0.28;
const BAR_MAX_PX = 56;

export function ThroughputView(props: PlanViewProps) {
  const { plan, palette, fontFamily, width, height } = props;
  const { days, flow, types } = useFlowChart(props);
  const phases = plan?.statusPhases ?? NO_PHASES;
  const data = flow.data;
  const model = useMemo(() => {
    if (!data) return null;
    const finished = cycleTimesOf(data.cards, phases, data.fromDay, data.toDay, types).cards;
    return {
      finished: finished.length,
      throughput: throughputOf(finished, data.fromDay, data.toDay, flowPeriodOf(days)),
    };
  }, [data, phases, types, days]);
  const finished = model?.finished ?? 0;
  return (
    <FlowFrame
      view="throughput"
      days={days}
      flow={flow}
      plan={plan}
      palette={palette}
      fontFamily={fontFamily}
      width={width}
      height={height}
      count={finished}
      countLabel={`${plural(finished, 'card')} finished`}
      hasData={finished > 0}
      empty="No cards finished in this range"
      summary={
        model ? (
          <strong className="font-semibold">{throughputSummary(model.throughput)}</strong>
        ) : null
      }
    >
      {(box, size) =>
        model && data ? (
          <ThroughputPlot
            box={box}
            size={size}
            t={model.throughput}
            fromDay={data.fromDay}
            toDay={data.toDay}
            palette={palette}
          />
        ) : null
      }
    </FlowFrame>
  );
}

function ThroughputPlot({
  box,
  size,
  t,
  fromDay,
  toDay,
  palette,
}: {
  box: PlotBox;
  size: { width: number; height: number };
  t: Throughput;
  fromDay: number;
  toDay: number;
  palette: PlanPalette;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { top, ticks } = niceTicks(Math.max(...t.periods.map((p) => p.cards), t.average ?? 0));
  const foot = box.y + box.height;
  const slot = box.width / t.periods.length;
  const bar = Math.min(BAR_MAX_PX, slot * (1 - BAR_GAP_SHARE));
  // The foot names each bar's period by its first day ("3 Nov"), thinned to fit, the last always.
  const fit = Math.max(1, Math.floor(box.width / FLOW_DAY_LABEL_PX));
  const step = Math.max(1, Math.ceil(t.periods.length / fit));
  const xLabels = t.periods
    .map((p, i) => ({ i, x: box.x + (i + 0.5) * slot, text: flowDayLabel(p.start) }))
    .filter(({ i }) => (t.periods.length - 1 - i) % step === 0);
  const label = t.period === 'week' ? 'week' : 'day';
  const avgY = t.average === null ? null : foot - (t.average / top) * box.height;
  const hovered = active !== null ? t.periods[active] : undefined;
  const summary = `Throughput: ${throughputSummary(t)}. ${t.periods
    .map(
      (p) =>
        `${periodLabel(p.start, t.period)}: ${plural(p.cards, 'card')}${p.running ? ', still running' : ''}`,
    )
    .join('; ')}.`;
  return (
    <>
      <svg
        role="img"
        aria-label={summary}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="absolute inset-0"
        onPointerMove={(e) => {
          const p = plotPoint(e, size);
          const i = Math.floor((p.x - box.x) / slot);
          setActive(i >= 0 && i < t.periods.length && p.y <= foot + 4 ? i : null);
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
          xLabels={xLabels}
        />
        {t.periods.map((p, i) => {
          const h = (p.cards / top) * box.height;
          const x = box.x + i * slot + (slot - bar) / 2;
          return (
            <g key={p.start} aria-hidden>
              {i === active ? (
                <rect
                  x={box.x + i * slot}
                  y={box.y}
                  width={slot}
                  height={box.height}
                  fill={palette.text}
                  fillOpacity={0.05}
                />
              ) : null}
              {h > 0 ? (
                <path
                  d={roundedTop(x, foot - h, bar, h, Math.min(4, bar / 2, h))}
                  fill={PHASE_COLOURS.doing}
                  fillOpacity={p.running ? 0.4 : 1}
                />
              ) : null}
              {bar >= FLOW_BAR_LABEL_MIN_PX && p.cards > 0 ? (
                <text
                  x={x + bar / 2}
                  y={foot - h - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={palette.text}
                  className="tabular-nums"
                >
                  {p.cards}
                </text>
              ) : null}
            </g>
          );
        })}
        {avgY !== null ? (
          <g aria-hidden>
            <line
              x1={box.x}
              x2={box.x + box.width}
              y1={avgY}
              y2={avgY}
              stroke={palette.text}
              strokeOpacity={0.7}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={box.x + box.width}
              y={avgY - 4}
              textAnchor="end"
              fontSize={10}
              fontWeight={600}
              fill={palette.text}
              stroke={palette.surface}
              strokeWidth={3}
              paintOrder="stroke"
            >
              Avg {t.average}
            </text>
          </g>
        ) : null}
      </svg>
      {hovered ? (
        <FlowTip
          x={box.x + (active! + 0.5) * slot}
          y={foot - (hovered.cards / top) * box.height}
          width={size.width}
          palette={palette}
        >
          <div className="font-semibold">{periodLabel(hovered.start, t.period)}</div>
          <div style={{ color: palette.muted }}>
            {plural(hovered.cards, 'card')} finished
            {hovered.running ? `, this ${label} still running` : ''}
          </div>
        </FlowTip>
      ) : null}
    </>
  );
}

// A bar from (x, y) of `w` × `h` with its top corners rounded by `r`, square on the baseline.
export function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}
