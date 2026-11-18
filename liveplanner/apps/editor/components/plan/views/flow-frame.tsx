'use client';

// What the three flow charts share (docs/specs/026-plan/plan-views.md "Flow charts"): the read of their range, the
// frame headed by name and range, every state (loading, This Browser, failed with Try Again, nothing in the range,
// outside a plan), the summary line and key above the plot, the axes, and the hover card.
import { useMemo, type ReactNode } from 'react';
import { Button, CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideChartLine } from '@liveworkspace/icons/lucide';
import {
  DAY_MS,
  flowRangeOf,
  viewShownTypes,
  type FlowView,
  PLAN_VISUALISATION_LABELS,
} from '@liveplanner/items';
import { usePlanFlow, type PlanFlow } from '@/hooks/plan/usePlanFlow';
import { flowVersionOf } from '@/hooks/plan/plan-flow-store';
import type { PlanContextValue } from '../PlanContext';
import type { PlanPalette } from '../plan-palette';
import { ViewFrame } from './view-frame';
import {
  FLOW_KEY_LINE_PX,
  FLOW_SUMMARY_PX,
  flowDayLabel,
  flowDayTicks,
  flowPlotBox,
  flowX,
  placeFootLabels,
  type PlotBox,
} from './flow-chart-model';
import type { PlanViewProps } from './PlanViewView';

const FlowGlyph = lucideGlyph(lucideChartLine, 18);

// The frame's header and border, taken from the element's height and width to leave the body.
const HEADER_PX = 41;
const BORDER_PX = 2;

// A chart's range ("Last 30 Days") and its read: one per range of the plan, every type, the chart's own types kept
// here (each chart filters the shared answer).
export function useFlowChart({ plan, settings }: Pick<PlanViewProps, 'plan' | 'settings'>) {
  const days = flowRangeOf(settings);
  // Read again only when what the charts draw changed (a status, a type, a card coming or going), not on a title edit.
  const flow = usePlanFlow(plan?.itemsScope, days, flowVersionOf(plan?.items));
  const allTypes = plan?.types;
  const view = settings.view;
  const types = useMemo(() => {
    if (!allTypes) return undefined;
    const shown = viewShownTypes(view, settings, allTypes);
    return shown.length === allTypes.length ? undefined : new Set(shown);
  }, [view, settings, allTypes]);
  return { days, flow, types };
}

export function flowTitle(view: FlowView, days: number): string {
  return `${PLAN_VISUALISATION_LABELS[view]} · Last ${days} Days`;
}

type FlowFrameProps = Pick<
  PlanViewProps,
  'plan' | 'palette' | 'fontFamily' | 'width' | 'height'
> & {
  view: FlowView;
  days: number;
  flow: PlanFlow;
  count?: number;
  countLabel?: string;
  // Whether the answer holds anything to draw, and what to say when it does not.
  hasData: boolean;
  empty: string;
  summary: ReactNode;
  legend?: ReactNode;
  // The lines the key wraps to (flowKeyLines).
  legendLines?: number;
  // The plot, given its box inside an svg of `size` (null: too small, the summary shows alone).
  children: (box: PlotBox, size: { width: number; height: number }) => ReactNode;
};

export function FlowFrame({
  view,
  days,
  flow,
  plan,
  palette,
  fontFamily,
  width,
  height,
  count,
  countLabel,
  hasData,
  empty,
  summary,
  legend,
  legendLines = 1,
  children,
}: FlowFrameProps) {
  const ink = { text: palette.text, muted: palette.muted };
  const state = flowFrameState(plan, flow, hasData);
  const emptyNode =
    flow.status === 'offline' ? (
      <CompactEmptyState
        size="small"
        ink={ink}
        icon={<FlowGlyph />}
        title="Flow Needs a Cloud Plan"
        description="Flow charts read the plan's history, which plans in This Browser don't keep."
      />
    ) : flow.status === 'error' ? (
      <CompactEmptyState
        size="small"
        ink={ink}
        icon={<FlowGlyph />}
        title="Couldn't Load Flow"
        description="Check your connection and try again."
        action={
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              flow.retry();
            }}
          >
            Try Again
          </Button>
        }
      />
    ) : flow.status === 'none' ? (
      'Open the plan to see the flow.'
    ) : (
      empty
    );
  const bodyWidth = width - BORDER_PX;
  const bodyHeight = height - HEADER_PX - BORDER_PX;
  const keyHeight = legendLines * FLOW_KEY_LINE_PX + 6;
  const above = FLOW_SUMMARY_PX + (legend ? keyHeight : 0);
  // Kept while the size holds, so a plot's memoised layers survive a hover.
  const box = useMemo(
    () => flowPlotBox(bodyWidth, bodyHeight, above),
    [bodyWidth, bodyHeight, above],
  );
  const svgHeight = bodyHeight - above;
  return (
    <ViewFrame
      title={flowTitle(view, days)}
      {...(count !== undefined ? { count } : {})}
      {...(countLabel !== undefined ? { countLabel } : {})}
      palette={palette}
      fontFamily={fontFamily}
      state={state}
      empty={emptyNode}
      loadingText="Loading flow…"
    >
      <div className="absolute inset-0 flex flex-col">
        <div
          className={`flex shrink-0 items-center gap-2 px-3 text-[12px] ${box ? '' : 'flex-1 justify-center text-center'}`}
          style={{ height: box ? FLOW_SUMMARY_PX : undefined, color: palette.text }}
        >
          <span className="min-w-0 truncate">{summary}</span>
        </div>
        {box && legend ? (
          <div
            className="flex shrink-0 items-start overflow-hidden px-3"
            style={{ height: keyHeight }}
          >
            {legend}
          </div>
        ) : null}
        {box ? (
          <div className="relative min-h-0 flex-1">
            {children(box, { width: bodyWidth, height: svgHeight })}
          </div>
        ) : null}
      </div>
    </ViewFrame>
  );
}

// What the frame shows: loading until the cards and the flow are in, the empty state for This Browser, a failed read,
// outside a plan or nothing to draw, else the chart.
export function flowFrameState(
  plan: PlanContextValue | undefined,
  flow: PlanFlow,
  hasData: boolean,
): 'loading' | 'empty' | 'ready' {
  if (!plan || flow.status === 'none') return 'empty';
  if (flow.status === 'offline' || flow.status === 'error') return 'empty';
  if (plan.status === 'loading' || flow.status === 'loading') return 'loading';
  return hasData ? 'ready' : 'empty';
}

// The y gridlines and their whole-number labels, and the day labels along the foot.
export function FlowAxes({
  box,
  top,
  ticks,
  fromDay,
  toDay,
  palette,
  xLabels,
}: {
  box: PlotBox;
  top: number;
  ticks: readonly number[];
  fromDay: number;
  toDay: number;
  palette: PlanPalette;
  // The foot's labels in place of the days (Throughput names its bars).
  xLabels?: readonly { x: number; text: string }[];
}) {
  const labels =
    xLabels ??
    flowDayTicks(fromDay, toDay, box.width).map((day) => ({
      x: box.x + flowX((day + 0.5) * DAY_MS, fromDay, toDay) * box.width,
      text: flowDayLabel(day),
    }));
  const foot = box.y + box.height;
  return (
    <g aria-hidden fontSize={10} fill={palette.muted}>
      {ticks.map((v) => {
        const y = foot - (v / top) * box.height;
        return (
          <g key={v}>
            <line
              x1={box.x}
              x2={box.x + box.width}
              y1={y}
              y2={y}
              stroke={palette.border}
              strokeWidth={v === 0 ? 1 : 0.75}
              strokeDasharray={v === 0 ? undefined : '2 3'}
            />
            <text x={box.x - 6} y={y + 3.5} textAnchor="end" className="tabular-nums">
              {v}
            </text>
          </g>
        );
      })}
      {placeFootLabels(labels, box.x, box.x + box.width).map(({ x, text }) => (
        <text key={`${x}`} x={x} y={foot + 15} textAnchor="middle">
          {text}
        </text>
      ))}
    </g>
  );
}

// The hover card beside the pointer, flipped to its left near the plot's right edge and upward in its lower half.
export function FlowTip({
  x,
  y,
  width,
  height,
  palette,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  palette: PlanPalette;
  children: ReactNode;
}) {
  const flip = x > width * 0.6;
  // In the lower part of the plot it opens upward, so it never runs past the frame or over the foot's labels.
  const up = y > height * 0.5;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 max-w-[220px] whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-md"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? width - x + 12 : undefined,
        top: up ? undefined : Math.max(4, y - 12),
        bottom: up ? Math.max(4, height - y + 12) : undefined,
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        color: palette.text,
      }}
    >
      {children}
    </div>
  );
}

// A key entry: a swatch in the series' colour, its name in the text ink, cut short only when longer than the row.
export function FlowKeyEntry({
  colour,
  label,
  palette,
}: {
  colour: string;
  label: string;
  palette: PlanPalette;
}) {
  return (
    <span
      className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1.5 text-[11px] leading-4"
      style={{ color: palette.muted }}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: colour }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

// Where a pointer is in an svg drawn at `size`, whatever the canvas zoom: its on-screen box scaled back.
export function plotPoint(
  e: { clientX: number; clientY: number; currentTarget: Element },
  size: { width: number; height: number },
): { x: number; y: number } {
  const r = e.currentTarget.getBoundingClientRect();
  return {
    x: r.width > 0 ? ((e.clientX - r.left) * size.width) / r.width : 0,
    y: r.height > 0 ? ((e.clientY - r.top) * size.height) / r.height : 0,
  };
}
