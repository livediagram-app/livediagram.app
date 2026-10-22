'use client';

// Add to Slot's pictures (docs/specs/026-plan/plan-tabs.md "Filling a slot"): each metric, visualisation and note drawn
// small as it looks in a slot, in the board pictures' style (board-previews.tsx) and the tab's own colours: a metric as
// its tile (name, figure, its picture), a chart as its chart, a note as a heading over lines. Decorative: the card's
// name says what it is.
import type { ReactNode } from 'react';
import type { MetricKind, PlanVisualisation } from '@livepages/items';
import type { PlanPalette } from '../plan-palette';
import { BoardWidgetArt } from '../plan-tile-art';

export type P = { palette: PlanPalette };

export const BLUE = '#3b82f6';
export const GREEN = '#22c55e';
export const RED = '#ef4444';
export const AMBER = '#f59e0b';
const VIOLET = '#8b5cf6';
const TEAL = '#14b8a6';

export function Frame({
  palette,
  children,
  pad = true,
}: P & { children: ReactNode; pad?: boolean }) {
  return (
    <div
      aria-hidden
      className={`flex h-24 w-full flex-col overflow-hidden rounded-lg border ${pad ? 'gap-1.5 p-2' : ''}`}
      style={{ backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }}
    >
      {children}
    </div>
  );
}

export const Bar = ({ w, c, h = 4, o = 1 }: { w: string; c: string; h?: number; o?: number }) => (
  <span
    className="block shrink-0 rounded-full"
    style={{ width: w, height: h, backgroundColor: c, opacity: o }}
  />
);

// A metric's figure and the picture under it, as its tile draws them.
const METRIC_SAMPLES: Record<MetricKind, { figure: string; unit: string; tone?: string }> = {
  count: { figure: '48', unit: 'cards' },
  progress: { figure: '62', unit: '%' },
  people: { figure: '5', unit: 'people' },
  types: { figure: '3', unit: 'types' },
  priorities: { figure: '2', unit: 'urgent', tone: RED },
  due: { figure: '1', unit: 'overdue', tone: RED },
  unassigned: { figure: '7', unit: 'unassigned' },
  points: { figure: '21/34', unit: 'pts' },
  'top-voted': { figure: '9', unit: 'votes' },
  stale: { figure: '4', unit: 'stale', tone: AMBER },
};

function MetricPicture({ kind, palette }: P & { kind: MetricKind }) {
  const track = palette.column;
  if (kind === 'progress' || kind === 'points')
    return (
      <span
        className="flex h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
      >
        <span
          style={{ width: kind === 'progress' ? '62%' : '62%', backgroundColor: palette.focus }}
        />
      </span>
    );
  if (kind === 'count' || kind === 'due' || kind === 'unassigned') {
    const parts =
      kind === 'count'
        ? [
            [30, palette.muted],
            [25, BLUE],
            [45, GREEN],
          ]
        : kind === 'due'
          ? [
              [20, RED],
              [40, AMBER],
            ]
          : [
              [30, AMBER],
              [70, BLUE],
            ];
    return (
      <span
        className="flex h-1.5 w-full gap-px overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
      >
        {parts.map(([w, c], i) => (
          <span key={i} style={{ width: `${w}%`, backgroundColor: c as string }} />
        ))}
      </span>
    );
  }
  if (kind === 'types' || kind === 'priorities') {
    const rows: [number, string][] =
      kind === 'types'
        ? [
            [90, BLUE],
            [55, VIOLET],
            [30, TEAL],
          ]
        : [
            [25, RED],
            [60, AMBER],
            [85, BLUE],
          ];
    return (
      <span className="flex flex-col gap-[3px]">
        {rows.map(([w, c], i) => (
          <Bar key={i} w={`${w}%`} c={c} h={3} />
        ))}
      </span>
    );
  }
  if (kind === 'people')
    return (
      <span className="flex gap-1">
        {[BLUE, VIOLET, GREEN, AMBER].map((c) => (
          <span
            key={c}
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: c, opacity: 0.85 }}
          />
        ))}
      </span>
    );
  // Top Voted's card, or Stale Cards' oldest.
  return (
    <span
      className="flex items-center gap-1 rounded border px-1 py-0.5"
      style={{ borderColor: palette.cardBorder, backgroundColor: palette.card }}
    >
      <Bar w="60%" c={palette.muted} h={3} o={0.6} />
      <span className="ml-auto text-[7px] tabular-nums" style={{ color: palette.muted }}>
        {kind === 'stale' ? '21d' : '9'}
      </span>
    </span>
  );
}

export function MetricPreview({ kind, label, palette }: P & { kind: MetricKind; label: string }) {
  const s = METRIC_SAMPLES[kind];
  return (
    <Frame palette={palette}>
      <span className="flex items-center gap-1" style={{ color: palette.muted }}>
        <span
          className="flex h-3.5 w-3.5 items-center justify-center rounded"
          style={{ backgroundColor: palette.column, color: palette.focus }}
        >
          <BoardWidgetArt kind={kind} size={9} />
        </span>
        <span className="truncate text-[7px] font-semibold uppercase tracking-wider">{label}</span>
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className="text-[20px] font-semibold leading-none tabular-nums"
          style={{ color: s.tone ?? palette.text }}
        >
          {s.figure}
        </span>
        <span className="text-[8px]" style={{ color: palette.muted }}>
          {s.unit}
        </span>
      </span>
      <span className="mt-auto">
        <MetricPicture kind={kind} palette={palette} />
      </span>
    </Frame>
  );
}

// A chart's header, as a slot's visualisation draws it.
function ChartHead({ palette, wide = '40%' }: P & { wide?: string }) {
  return <Bar w={wide} c={palette.muted} h={4} o={0.55} />;
}

function Gantt({ palette }: P) {
  const bars: [number, number, string][] = [
    [0, 35, BLUE],
    [20, 40, VIOLET],
    [45, 30, TEAL],
    [55, 40, GREEN],
    [10, 25, AMBER],
  ];
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} />
      <div className="relative flex min-h-0 flex-1 flex-col justify-between">
        {bars.map(([from, w, c], i) => (
          <span key={i} className="flex items-center gap-1">
            <Bar w="18%" c={palette.muted} h={3} o={0.4} />
            <span className="relative h-2 flex-1">
              <span
                className="absolute inset-y-0 rounded-sm"
                style={{ left: `${from}%`, width: `${w}%`, backgroundColor: c }}
              />
            </span>
          </span>
        ))}
        <span
          className="absolute inset-y-0 w-px"
          style={{ left: '58%', backgroundColor: RED, opacity: 0.6 }}
        />
      </div>
    </Frame>
  );
}

function Calendar({ palette }: P) {
  const dots: Record<number, string> = {
    3: BLUE,
    9: RED,
    10: AMBER,
    16: GREEN,
    22: VIOLET,
    24: BLUE,
  };
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} wide="45%" />
      <div
        className="grid min-h-0 flex-1 grid-cols-7 grid-rows-4 gap-px overflow-hidden rounded"
        style={{ backgroundColor: palette.cardBorder }}
      >
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="flex items-end p-[2px]"
            style={{ backgroundColor: i === 12 ? palette.column : palette.surface }}
          >
            {dots[i] ? (
              <span className="h-1 w-full rounded-full" style={{ backgroundColor: dots[i] }} />
            ) : null}
          </span>
        ))}
      </div>
    </Frame>
  );
}

// A Start Calendar: each card a short bar leaving its start day, a dot where it begins.
function StartCalendar({ palette }: P) {
  const starts: Record<number, string> = { 1: BLUE, 8: GREEN, 11: AMBER, 17: VIOLET, 23: RED };
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} wide="45%" />
      <div
        className="grid min-h-0 flex-1 grid-cols-7 grid-rows-4 gap-px overflow-hidden rounded"
        style={{ backgroundColor: palette.cardBorder }}
      >
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="flex items-start p-[2px]"
            style={{ backgroundColor: i === 12 ? palette.column : palette.surface }}
          >
            {starts[i] ? (
              <span className="flex w-full items-center gap-[1px]">
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: starts[i] }}
                />
                <span
                  className="h-[2px] w-3/5 rounded-full"
                  style={{ backgroundColor: starts[i] }}
                />
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function Workload({ palette }: P) {
  const rows: [number, number][] = [
    [40, 30],
    [25, 15],
    [55, 20],
    [15, 10],
  ];
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} />
      <div className="flex min-h-0 flex-1 flex-col justify-around">
        {rows.map(([a, b], i) => (
          <span key={i} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: [BLUE, VIOLET, GREEN, AMBER][i] }}
            />
            <span
              className="flex h-2 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: palette.column }}
            >
              <span style={{ width: `${a}%`, backgroundColor: BLUE }} />
              <span style={{ width: `${b}%`, backgroundColor: GREEN }} />
            </span>
          </span>
        ))}
      </div>
    </Frame>
  );
}

// Status Breakdown: a donut of every card by status, its legend beside it.
function StatusMix({ palette }: P) {
  const parts: [number, string][] = [
    [0.3, palette.muted],
    [0.25, BLUE],
    [0.45, GREEN],
  ];
  let at = 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} />
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
        <svg aria-hidden viewBox="0 0 40 40" className="h-full max-h-14 w-auto -rotate-90">
          {parts.map(([share, colour], k) => {
            const dash = share * c;
            const el = (
              <circle
                key={k}
                cx={20}
                cy={20}
                r={r}
                fill="none"
                stroke={colour}
                strokeWidth={7}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-at * c}
              />
            );
            at += share;
            return el;
          })}
        </svg>
        <span className="flex flex-col gap-1">
          {parts.map(([, colour], k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
              <Bar w="28px" c={palette.muted} h={3} o={0.5} />
            </span>
          ))}
        </span>
      </div>
    </Frame>
  );
}

function PriorityMatrix({ palette }: P) {
  const heat = [0.9, 0.5, 0.2, 0.6, 0.35, 0.15, 0.3, 0.7, 0.4, 0.1, 0.2, 0.55];
  return (
    <Frame palette={palette}>
      <ChartHead palette={palette} />
      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-[3px]">
        {heat.map((o, i) => (
          <span
            key={i}
            className="rounded-sm"
            style={{ backgroundColor: [RED, AMBER, BLUE][Math.floor(i / 4)], opacity: o }}
          />
        ))}
      </div>
    </Frame>
  );
}

function Search({ palette }: P) {
  return (
    <Frame palette={palette}>
      <span
        className="flex items-center gap-1 rounded border px-1.5 py-1"
        style={{ borderColor: palette.cardBorder }}
      >
        <span className="h-2 w-2 rounded-full border" style={{ borderColor: palette.muted }} />
        <Bar w="40%" c={palette.muted} h={3} o={0.5} />
      </span>
      {[BLUE, VIOLET, GREEN].map((c, i) => (
        <span
          key={c}
          className="flex items-center gap-1 rounded border px-1 py-[3px]"
          style={{ borderColor: palette.cardBorder, backgroundColor: palette.card }}
        >
          <span className="h-2 w-[3px] rounded-full" style={{ backgroundColor: c }} />
          <Bar w={`${55 - i * 12}%`} c={palette.muted} h={3} o={0.6} />
        </span>
      ))}
    </Frame>
  );
}

const VISUALISATION_PREVIEWS: Record<PlanVisualisation, (p: P) => ReactNode> = {
  gantt: Gantt,
  calendar: Calendar,
  'start-calendar': StartCalendar,
  workload: Workload,
  'status-mix': StatusMix,
  'priority-matrix': PriorityMatrix,
  search: Search,
};

export function VisualisationPreview({ view, palette }: P & { view: PlanVisualisation }) {
  const Picture = VISUALISATION_PREVIEWS[view];
  return <Picture palette={palette} />;
}

export function NotePreview({ palette }: P) {
  return (
    <Frame palette={palette}>
      <Bar w="45%" c={palette.text} h={5} o={0.7} />
      {[92, 80, 86, 50].map((w, i) => (
        <Bar key={i} w={`${w}%`} c={palette.muted} h={3} o={0.45} />
      ))}
    </Frame>
  );
}
