'use client';

import type { TelemetryDaily, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { categoryColor, eventExplanation, eventLabel } from './event-vocab';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { windowHighlightFrom, windowLabel } from './windows';

// The Highlights view (spec/22, default tab): the key product metrics we
// most want to watch, grouped into the questions they answer — Visitors,
// Creation, Collaboration, Output. Each metric is a card with the
// selected-window count and a 30-day mini trend line. Deliberately a
// FIXED list, not "top by volume" — a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must
// always be on screen. A metric with no events renders as zero with a
// flat line rather than disappearing, so the layout is stable day to day.
//
// A highlight is either a single typed event, or an AGGREGATE over every
// type of a `category·action` (`allTypes`) — used where the type split is
// arbitrary for this lens (any shape added, any export format) rather
// than meaningful (Edit vs View share links; the Dark UI toggle, which
// shares `UI·Toggled` with unrelated setting flips).

type Highlight = {
  category: string;
  action: string;
  type?: string | null; // specific type; ignored when allTypes
  allTypes?: boolean; // sum across every type of category·action
  title: string;
  blurb?: string; // overrides eventExplanation (needed for aggregates)
};

type HighlightGroup = { title: string; metrics: Highlight[] };

const GROUPS: HighlightGroup[] = [
  {
    title: 'Visitors',
    metrics: [
      { category: 'Participant', action: 'Created', type: null, title: 'New Visitors' },
      { category: 'Session', action: 'SignedUp', type: null, title: 'Sign-Ups' },
      { category: 'Session', action: 'SignedIn', type: null, title: 'Sign-Ins' },
    ],
  },
  {
    title: 'Creation',
    metrics: [
      { category: 'Diagram', action: 'Created', type: null, title: 'Diagrams Created' },
      { category: 'Tab', action: 'Created', type: null, title: 'Tabs Created' },
      {
        category: 'Element',
        action: 'Added',
        allTypes: true,
        title: 'Elements Added',
        blurb:
          'Every shape, text, sticky, arrow, or image dropped onto a canvas, across all kinds.',
      },
    ],
  },
  {
    title: 'Collaboration',
    metrics: [
      { category: 'Diagram', action: 'Shared', type: 'Edit', title: 'Edit Links Shared' },
      { category: 'Diagram', action: 'Joined', type: 'Edit', title: 'Collaborators Joined' },
      { category: 'Comment', action: 'Added', type: null, title: 'Comments Added' },
    ],
  },
  {
    title: 'Output & Preferences',
    metrics: [
      {
        category: 'Diagram',
        action: 'Exported',
        allTypes: true,
        title: 'Exports',
        blurb: 'Tabs exported to a file, across every format (PNG, SVG, JSON, …).',
      },
      { category: 'UI', action: 'Toggled', type: 'Dark', title: 'Dark-Mode Switches' },
    ],
  },
];

// Does an event (category, action, type) belong to this highlight?
function matches(h: Highlight, category: string, action: string, type: string | null): boolean {
  if (category !== h.category || action !== h.action) return false;
  return h.allTypes ? true : type === (h.type ?? null);
}

// Selected-window count: sum the window's rows that belong to the highlight
// (one row for a single typed metric, several for an aggregate).
function windowCount(summary: TelemetrySummary, active: TelemetryWindowKey, h: Highlight): number {
  return summary.windows[active].rows
    .filter((r) => matches(h, r.category, r.action, r.type))
    .reduce((sum, r) => sum + r.count, 0);
}

// Element-wise sum of the 30-day series for every metric in the highlight.
function dailySeries(daily: TelemetryDaily, h: Highlight): number[] {
  const out = new Array(daily.days.length).fill(0);
  for (const [key, series] of Object.entries(daily.byMetric)) {
    const [category = '', action = '', rawType = ''] = key.split('|');
    if (!matches(h, category, action, rawType === '' ? null : rawType)) continue;
    for (let i = 0; i < out.length; i++) out[i] += series[i] ?? 0;
  }
  return out;
}

export function HighlightsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const daily = summary.daily;

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted.
      </p>

      <div className="mt-6 flex flex-col gap-8">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group.title}
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {group.metrics.map((h) => (
                <HighlightCard
                  key={`${h.category}|${h.action}|${h.allTypes ? '*' : (h.type ?? '')}`}
                  highlight={h}
                  count={windowCount(summary, active, h)}
                  series={daily ? dailySeries(daily, h) : undefined}
                  days={daily?.days}
                  highlightFromIndex={daily ? windowHighlightFrom(daily, active) : null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function HighlightCard({
  highlight: h,
  count,
  series,
  days,
  highlightFromIndex,
}: {
  highlight: Highlight;
  count: number;
  series: number[] | undefined;
  days: number[] | undefined;
  highlightFromIndex: number | null;
}) {
  const color = categoryColor(h.category);
  // An aggregate has no single type, so the icon + label drop the type.
  const iconType = h.allTypes ? null : (h.type ?? null);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <EventIcon category={h.category} action={h.action} type={iconType} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{h.title}</p>
            <p className="text-xs text-slate-400">
              {h.category} · {eventLabel({ action: h.action, type: iconType })}
            </p>
          </div>
        </div>
        <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {count.toLocaleString()}
        </span>
      </div>
      {/* Plain-language meaning. Aggregates carry their own blurb; single
          metrics reuse the Raw view's row tooltip copy. */}
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {h.blurb ?? eventExplanation(h.category, h.action, iconType)}
      </p>
      {days ? (
        <div className="mt-4">
          <TrendChart
            days={days}
            values={series ?? new Array(days.length).fill(0)}
            color={color}
            highlightFromIndex={highlightFromIndex}
            heightClassName="h-20"
          />
        </div>
      ) : null}
    </div>
  );
}
