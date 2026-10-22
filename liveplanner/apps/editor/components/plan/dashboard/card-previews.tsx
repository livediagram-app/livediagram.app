'use client';

// Add to Slot's pictures of the written cards (docs/specs/026-plan/plan-tabs.md "Cards"), in slot-previews.tsx's
// style and the tab's colours: a Title bare on the page, a Status as its light and line, a Checklist as ticked rows, a
// Key Date as its count, Links as labelled rows. Decorative: the card's name says what it is.
import type { FormMetricKind, SheetMetricKind } from '@liveplanner/project';
import type { DashboardCardKind } from '@/hooks/plan/dashboard-drop';
import { AMBER, Bar, BLUE, Frame, GREEN, RED, type P } from './slot-previews';

function TitlePreview({ palette }: P) {
  return (
    <div
      aria-hidden
      className="flex h-24 w-full flex-col justify-end gap-1.5 rounded-lg border border-dashed p-2"
      style={{ borderColor: palette.border }}
    >
      <Bar w="70%" c={palette.text} h={9} o={0.85} />
      <Bar w="88%" c={palette.muted} h={3} o={0.5} />
      <Bar w="55%" c={palette.muted} h={3} o={0.5} />
    </div>
  );
}

function StatusPreview({ palette }: P) {
  return (
    <Frame palette={palette}>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GREEN }} />
        <span className="text-[11px] font-semibold" style={{ color: GREEN }}>
          On Track
        </span>
      </span>
      <Bar w="85%" c={palette.muted} h={3} o={0.5} />
      <Bar w="60%" c={palette.muted} h={3} o={0.5} />
      <span className="mt-auto flex gap-1">
        {[GREEN, AMBER, RED].map((c, i) => (
          <span
            key={c}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: c, opacity: i ? 0.25 : 1 }}
          />
        ))}
      </span>
    </Frame>
  );
}

function ChecklistPreview({ palette }: P) {
  return (
    <Frame palette={palette}>
      <span className="flex items-center justify-between">
        <Bar w="40%" c={palette.text} h={4} o={0.7} />
        <span className="text-[8px] tabular-nums" style={{ color: palette.muted }}>
          2/3
        </span>
      </span>
      {[true, true, false].map((done, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px] border"
            style={{
              borderColor: done ? BLUE : palette.cardBorder,
              backgroundColor: done ? BLUE : 'transparent',
            }}
          />
          <Bar w={`${70 - i * 12}%`} c={palette.muted} h={3} o={done ? 0.35 : 0.6} />
        </span>
      ))}
    </Frame>
  );
}

function KeyDatePreview({ palette }: P) {
  return (
    <Frame palette={palette}>
      <Bar w="45%" c={palette.muted} h={3} o={0.6} />
      <span className="flex items-baseline gap-1">
        <span
          className="text-[22px] font-semibold leading-none tabular-nums"
          style={{ color: palette.text }}
        >
          12
        </span>
        <span className="text-[9px]" style={{ color: palette.muted }}>
          days to go
        </span>
      </span>
      <Bar w="35%" c={palette.muted} h={3} o={0.45} />
    </Frame>
  );
}

function LinksPreview({ palette }: P) {
  return (
    <Frame palette={palette}>
      <Bar w="35%" c={palette.text} h={4} o={0.7} />
      {[55, 70, 45].map((w, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: BLUE, opacity: 0.7 }}
          />
          <Bar w={`${w}%`} c={BLUE} h={3} o={0.55} />
        </span>
      ))}
    </Frame>
  );
}

// A figure from a Sheet: a figure over a bar toward its target, a summary over its sparkline, a trend with its arrow.
export function SheetMetricPreview({ palette, metric }: P & { metric: SheetMetricKind }) {
  const line =
    metric === 'figure' ? null : (
      <svg
        aria-hidden
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="mt-auto h-6 w-full"
      >
        <polyline
          points="0,20 15,16 30,18 45,10 60,12 75,6 100,3"
          fill="none"
          stroke={BLUE}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  return (
    <Frame palette={palette}>
      <Bar w="45%" c={palette.muted} h={3} o={0.6} />
      <span className="flex items-baseline gap-1">
        <span
          className="text-[20px] font-semibold leading-none tabular-nums"
          style={{ color: palette.text }}
        >
          {metric === 'figure' ? '£8,240' : metric === 'summary' ? '1,640' : '312'}
        </span>
        {metric === 'trend' ? (
          <span className="text-[9px] font-semibold" style={{ color: GREEN }}>
            ▲ 12%
          </span>
        ) : null}
      </span>
      {metric === 'figure' ? (
        <span
          className="mt-auto flex h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: palette.column }}
        >
          <span style={{ width: '68%', backgroundColor: BLUE }} />
        </span>
      ) : (
        line
      )}
    </Frame>
  );
}

// A Sheet Chart: a bar chart's columns over its axis, a sheet's tint behind its labels.
export function SheetChartPreview({ palette }: P) {
  const bars: [number, string][] = [
    [45, BLUE],
    [70, BLUE],
    [55, BLUE],
    [90, BLUE],
    [65, BLUE],
  ];
  return (
    <Frame palette={palette}>
      <Bar w="40%" c={palette.muted} h={4} o={0.55} />
      <span
        className="flex min-h-0 flex-1 items-end gap-1.5 border-b border-l px-1"
        style={{ borderColor: palette.border }}
      >
        {bars.map(([h, c], i) => (
          <span
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}%`, backgroundColor: c, opacity: 0.6 + i * 0.08 }}
          />
        ))}
      </span>
      <span className="flex gap-1.5 px-1">
        {bars.map((_, i) => (
          <Bar key={i} w="100%" c={palette.muted} h={2} o={0.4} />
        ))}
      </span>
    </Frame>
  );
}

const PREVIEWS: Record<DashboardCardKind, (p: P) => React.ReactNode> = {
  title: TitlePreview,
  status: StatusPreview,
  checklist: ChecklistPreview,
  'key-date': KeyDatePreview,
  links: LinksPreview,
};

export function CardPreview({ card, palette }: P & { card: DashboardCardKind }) {
  const Picture = PREVIEWS[card];
  return <Picture palette={palette} />;
}

// A figure from a form, as the slot will draw it (DashboardFormMetric): its figure and a line, a status pill, a bar
// toward the limit, a date, or a link with Copy.
export function FormMetricPreview({ palette, metric }: P & { metric: FormMetricKind }) {
  const big = (text: string) => (
    <span
      className="text-[20px] font-semibold leading-none tabular-nums"
      style={{ color: palette.text }}
    >
      {text}
    </span>
  );
  return (
    <Frame palette={palette}>
      <Bar w="45%" c={palette.muted} h={3} o={0.6} />
      {metric === 'status' ? (
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ backgroundColor: 'rgb(16 185 129 / 0.14)', color: GREEN }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GREEN }} />
          Accepting
        </span>
      ) : metric === 'link' ? (
        <span className="flex items-center gap-1">
          <span className="h-3 flex-1 rounded" style={{ backgroundColor: palette.column }} />
          <span className="h-3 w-7 rounded" style={{ backgroundColor: BLUE }} />
        </span>
      ) : metric === 'closes' ? (
        big('3 days')
      ) : metric === 'new' ? (
        big('5')
      ) : metric === 'limit' ? (
        big('42 / 100')
      ) : (
        big('142')
      )}
      {metric === 'limit' ? (
        <span
          className="mt-auto flex h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: palette.column }}
        >
          <span style={{ width: '42%', backgroundColor: BLUE }} />
        </span>
      ) : null}
    </Frame>
  );
}
