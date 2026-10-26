'use client';

import { useState } from 'react';
import {
  TELEMETRY_APPS,
  type TelemetryApp,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import { WindowPanel } from './_shared/WindowPanel';
import { WINDOW_META } from './_shared/windows';

// How many of the busiest events the overview lists.
const TOP_EVENTS = 12;

// "All apps" (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): every app's events summed. Each app's
// own tabs read its own vocabulary, so the overview keeps to what every app shares: how much happens,
// how it splits between the apps, and the busiest events. Picking an app opens its full dashboard.
export function AllApps({
  summary,
  onPickApp,
}: {
  summary: TelemetrySummary;
  onPickApp: (app: TelemetryApp) => void;
}) {
  const [active, setActive] = useState<TelemetryWindowKey>('last7');
  const window = summary.windows[active];
  const previous = summary.previousWindows?.[active];
  const label = WINDOW_META.find((w) => w.key === active)?.label ?? '';

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
          onSelect={setActive}
        />
      </div>

      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100">By app</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Events each app sent in the {label.toLowerCase()}, against the same span before it.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TELEMETRY_APPS.map((app) => {
          const count = window.byApp?.[app] ?? 0;
          const before = previous?.byApp?.[app] ?? 0;
          const share = window.total > 0 ? Math.round((count / window.total) * 100) : 0;
          return (
            <li key={app}>
              <button
                type="button"
                onClick={() => onPickApp(app)}
                data-app={app}
                className="flex w-full cursor-pointer flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60"
              >
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {app}
                </span>
                <span className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {count.toLocaleString('en-GB')}
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {share}% of every app · {changeLabel(count, before)}
                </span>
                <span className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Open its dashboard →
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Busiest events
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

// "up 12%", "down 3%", "level" or "new", against the span before.
export function changeLabel(now: number, before: number): string {
  if (before === 0) return now === 0 ? 'level' : 'new';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return 'level';
  return pct > 0 ? `up ${pct}%` : `down ${-pct}%`;
}
