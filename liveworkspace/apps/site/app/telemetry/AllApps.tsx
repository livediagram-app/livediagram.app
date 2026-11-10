'use client';

import { useMemo } from 'react';
import type { TelemetryApp, TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { WindowPanel } from './_shared/WindowPanel';
import { previousSpanLabel, windowLabel } from './_shared/windows';
import { compareApps } from './_all/apps-compared';
import { EventsByApp } from './_all/EventsByApp';
import { VisitorsAndAccounts } from './_all/VisitorsAndAccounts';

// How many of the busiest events the overview lists.
const TOP_EVENTS = 12;

// "All apps" (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): every app's events summed. Each app's
// own tabs read its own vocabulary, so the overview keeps to what every app shares: how much happens, how the apps
// compare on it and on their visitors and sign-ups (Apps Compared), and the busiest events. Picking an app opens its
// full dashboard. The window is the page's, so it stays when an app is picked.
export function AllApps({
  summary,
  onPickApp,
  active,
  onSelect,
}: {
  summary: TelemetrySummary;
  onPickApp: (app: TelemetryApp) => void;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
}) {
  const window = summary.windows[active];
  const comparison = useMemo(() => compareApps(summary, active), [summary, active]);
  const against = previousSpanLabel(summary, active);

  return (
    <>
      <div className="mt-10">
        <WindowPanel
          totals={{
            today: summary.windows.today.total,
            last7: summary.windows.last7.total,
            last30: summary.windows.last30.total,
          }}
          daily={summary.daily}
          active={active}
          onSelect={onSelect}
        />
      </div>

      <section aria-labelledby="apps-compared">
        <h2
          id="apps-compared"
          className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Apps Compared
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Each app in the {windowLabel(active).toLowerCase()}
          {against ? `, against ${against}` : ''}. The window above sets the span.
        </p>
        <EventsByApp
          summary={summary}
          comparison={comparison}
          active={active}
          onPickApp={onPickApp}
        />
        <VisitorsAndAccounts summary={summary} comparison={comparison} active={active} />
      </section>

      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Busiest Events
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        The same event from several apps counts once here, added up.
      </p>
      {window.rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No events in this window yet.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {window.rows.slice(0, TOP_EVENTS).map((row) => (
            <li
              key={`${row.category}|${row.action}|${row.type ?? ''}`}
              className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm"
            >
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                {row.category} · {row.action}
                {row.type ? (
                  <span className="text-slate-500 dark:text-slate-400"> · {row.type}</span>
                ) : null}
              </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {row.count.toLocaleString('en-GB')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
