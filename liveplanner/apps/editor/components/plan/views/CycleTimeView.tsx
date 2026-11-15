'use client';

// Cycle Time (docs/specs/026-plan/plan-views.md "Flow charts"): a dot per card finished in the range, at the day it
// finished and the days it took, crossed by the 50th and 85th percentile, each named at its right end and in the
// summary line. Hovering names a dot's card; pressing it opens the card; on the keyboard ← and → step the dots and
// Enter opens one.
import { memo, useMemo, useState, type KeyboardEvent } from 'react';
import { plural } from '@liveplanner/project';
import { cycleTimesOf, itemTitle, type CycleTime } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import type { PlanContextValue } from '../PlanContext';
import { PHASE_COLOURS } from './view-frame';
import { FlowAxes, FlowFrame, FlowTip, plotPoint, useFlowChart } from './flow-frame';
import {
  cycleTimeSummary,
  daysText,
  flowDayLabel,
  flowX,
  niceTicks,
  type PlotBox,
} from './flow-chart-model';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
// A pointer within this many px of a dot hovers it (a target larger than the 4 px mark).
export const CYCLE_HIT_PX = 12;
const DOT_R = 4;

export function CycleTimeView(props: PlanViewProps) {
  const { plan, palette, fontFamily, width, height } = props;
  const { days, flow, types } = useFlowChart(props);
  const phases = plan?.statusPhases ?? NO_PHASES;
  const data = flow.data;
  const model = useMemo(
    () => (data ? cycleTimesOf(data.cards, phases, data.fromDay, data.toDay, types) : null),
    [data, phases, types],
  );
  const cards = model?.cards ?? [];
  return (
    <FlowFrame
      view="cycle-time"
      days={days}
      flow={flow}
      plan={plan}
      palette={palette}
      fontFamily={fontFamily}
      width={width}
      height={height}
      count={cards.length}
      countLabel={`${plural(cards.length, 'card')} finished`}
      hasData={cards.length > 0}
      empty="No cards finished in this range"
      summary={<CycleSummary p50={model?.p50 ?? null} p85={model?.p85 ?? null} />}
    >
      {(box, size) =>
        model && data ? (
          <CyclePlot
            box={box}
            size={size}
            cards={cards}
            p50={model.p50!}
            p85={model.p85!}
            fromDay={data.fromDay}
            toDay={data.toDay}
            palette={palette}
            plan={plan}
          />
        ) : null
      }
    </FlowFrame>
  );
}

function CycleSummary({ p50, p85 }: { p50: number | null; p85: number | null }) {
  if (p50 === null || p85 === null) return null;
  return (
    <span data-flow-summary>
      <strong className="font-semibold">85%</strong> in {daysText(p85)} or less
      <span className="opacity-60"> · </span>
      <strong className="font-semibold">50%</strong> in {p50}
    </span>
  );
}

type Dot = { x: number; y: number };

function CyclePlot({
  box,
  size,
  cards,
  p50,
  p85,
  fromDay,
  toDay,
  palette,
  plan,
}: {
  box: PlotBox;
  size: { width: number; height: number };
  cards: readonly CycleTime[];
  p50: number;
  p85: number;
  fromDay: number;
  toDay: number;
  palette: PlanPalette;
  plan: PlanContextValue | undefined;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = cards.reduce((m, c) => Math.max(m, c.days), p85);
  const { top, ticks } = niceTicks(max);
  const foot = box.y + box.height;
  const yOf = (days: number) => foot - (days / top) * box.height;
  const dots = useMemo<Dot[]>(
    () =>
      cards.map((c) => ({
        x: box.x + flowX(c.at, fromDay, toDay) * box.width,
        y: foot - (c.days / top) * box.height,
      })),
    [cards, box.x, box.width, box.height, foot, top, fromDay, toDay],
  );
  const interactive = !!plan;
  const describe = (i: number) => {
    const c = cards[i]!;
    const item = plan?.items.get(c.itemId);
    const name = item ? `#${item.key} ${itemTitle(item) || 'Untitled'}` : 'A card no longer here';
    return `${name}, ${daysText(c.days)}, finished ${flowDayLabel(c.day)}`;
  };
  const open = (i: number | null) => {
    if (i === null || !plan) return;
    const id = cards[i]!.itemId;
    if (plan.items.has(id)) plan.openItem(id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (cards.length === 0) return;
    let next: number;
    if (e.key === 'ArrowRight') next = active === null ? 0 : Math.min(cards.length - 1, active + 1);
    else if (e.key === 'ArrowLeft')
      next = active === null ? cards.length - 1 : Math.max(0, active - 1);
    else if (e.key === 'Enter' && active !== null) {
      e.preventDefault();
      e.stopPropagation();
      open(active);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    setActive(next);
    plan?.announce(describe(next));
  };
  const hit = active !== null ? dots[active] : undefined;
  const activeCard = active !== null ? cards[active] : undefined;
  const activeItem = activeCard ? plan?.items.get(activeCard.itemId) : undefined;
  return (
    <>
      <div
        role="group"
        aria-roledescription="chart"
        aria-label={`Cycle Time: ${plural(cards.length, 'card')} finished, ${cycleTimeSummary(p50, p85)}. Use the arrow keys to step through the cards and Enter to open one.`}
        tabIndex={interactive ? 0 : undefined}
        className="absolute inset-0 rounded-b-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        onKeyDown={interactive ? onKeyDown : undefined}
        onBlur={() => setActive(null)}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-hidden
          className={active !== null && interactive ? 'cursor-pointer' : undefined}
          onPointerMove={
            interactive
              ? (e) => {
                  const p = plotPoint(e, size);
                  setActive(nearestDot(dots, p.x, p.y, CYCLE_HIT_PX));
                }
              : undefined
          }
          onPointerLeave={() => setActive(null)}
          onPointerDown={(e) => {
            if (interactive && active !== null) e.stopPropagation();
          }}
          onClick={(e) => {
            if (!interactive || active === null) return;
            e.stopPropagation();
            open(active);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            open(active);
          }}
        >
          <FlowAxes
            box={box}
            top={top}
            ticks={ticks}
            fromDay={fromDay}
            toDay={toDay}
            palette={palette}
          />
          <CycleDots dots={dots} surface={palette.surface} />
          <PercentileLine box={box} y={yOf(p85)} label="85%" palette={palette} dashed />
          <PercentileLine box={box} y={yOf(p50)} label="50%" palette={palette} />
          {hit ? (
            <circle
              cx={hit.x}
              cy={hit.y}
              r={DOT_R + 2.5}
              fill={PHASE_COLOURS.doing}
              stroke={palette.text}
              strokeWidth={2}
            />
          ) : null}
        </svg>
      </div>
      {hit && activeCard ? (
        <FlowTip x={hit.x} y={hit.y} width={size.width} palette={palette}>
          <div className="max-w-[200px] truncate font-semibold">
            {activeItem
              ? `#${activeItem.key} ${itemTitle(activeItem) || 'Untitled'}`
              : 'A card no longer here'}
          </div>
          <div style={{ color: palette.muted }}>
            {daysText(activeCard.days)} · finished {flowDayLabel(activeCard.day)}
          </div>
        </FlowTip>
      ) : null}
    </>
  );
}

// Every dot in one memoised layer, so hovering redraws only the ring on the hovered one. Each is ringed in the
// surface so piled dots stay countable.
const CycleDots = memo(function CycleDots({
  dots,
  surface,
}: {
  dots: readonly Dot[];
  surface: string;
}) {
  return (
    <g fill={PHASE_COLOURS.doing} stroke={surface} strokeWidth={1.5} fillOpacity={0.85}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={DOT_R} />
      ))}
    </g>
  );
});

function PercentileLine({
  box,
  y,
  label,
  palette,
  dashed = false,
}: {
  box: PlotBox;
  y: number;
  label: string;
  palette: PlanPalette;
  dashed?: boolean;
}) {
  return (
    <g aria-hidden>
      <line
        x1={box.x}
        x2={box.x + box.width}
        y1={y}
        y2={y}
        stroke={palette.text}
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      <text
        x={box.x + box.width}
        y={y - 4}
        textAnchor="end"
        fontSize={10}
        fontWeight={600}
        fill={palette.text}
        stroke={palette.surface}
        strokeWidth={3}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

// The dot nearest (x, y) within `reach` px, or null. Linear in the dots: a 2,000-card plan's finishes in a pass.
export function nearestDot(
  dots: readonly Dot[],
  x: number,
  y: number,
  reach: number,
): number | null {
  let best: number | null = null;
  let bestD = reach * reach;
  for (let i = 0; i < dots.length; i++) {
    const dx = dots[i]!.x - x;
    const dy = dots[i]!.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
