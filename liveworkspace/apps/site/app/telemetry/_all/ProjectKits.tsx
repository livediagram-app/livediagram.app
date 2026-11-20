'use client';

import { useMemo } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { ActivityGlyph } from '../_shared/glyphs';
import { previousSpanLabel, windowHighlightFrom, windowLabel } from '../_shared/windows';
import { formatShare } from './apps-compared';
import { kitFigures } from './project-kits';
import { CARD } from './styles';
import { ChartBlock, SECOND, Tile } from './VisitorsAndAccounts';

// Project Kits (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): Start a Project on
// liveworkspace.app, every kit together. Each step's total in the window against the span before, then two daily
// charts: runs started against completed, and retries against removals. A run is every app's at once, so these are
// liveworkspace.app's own events and show here alone, never on an app's dashboard.
export function ProjectKits({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const figures = useMemo(() => kitFigures(summary, active), [summary, active]);
  const daily = summary.daily;
  const against = previousSpanLabel(summary, active);
  const highlight = daily ? windowHighlightFrom(daily, active) : 0;
  const { steps } = figures;
  const count = (n: number) => n.toLocaleString('en-GB');

  return (
    <section aria-labelledby="project-kits">
      <h2
        id="project-kits"
        className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        Project Kits
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Start a Project on liveworkspace.app, every kit together, in the{' '}
        {windowLabel(active).toLowerCase()}
        {against ? `, against ${against}` : ''}.
      </p>
      <div className={`${CARD} mt-4 p-5`}>
        {!figures.counted || !daily ? (
          <CompactEmptyState
            icon={<ActivityGlyph />}
            title="No project kits yet"
            description="No project kit has been started, retried or removed in the last 30 days."
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile
                label="Started"
                value={count(steps.Started.now)}
                now={steps.Started.now}
                before={steps.Started.before}
                against={against}
              />
              <Tile
                label="Completed"
                value={count(steps.Completed.now)}
                now={steps.Completed.now}
                before={steps.Completed.before}
                against={against}
                detail={
                  figures.completedShare === null
                    ? undefined
                    : `${formatShare(Math.min(figures.completedShare, 1))} of started`
                }
              />
              <Tile
                label="Retried"
                value={count(steps.Retried.now)}
                now={steps.Retried.now}
                before={steps.Retried.before}
                against={against}
                rising="bad"
              />
              <Tile
                label="Removed"
                value={count(steps.Removed.now)}
                now={steps.Removed.now}
                before={steps.Removed.before}
                against={against}
                rising="bad"
              />
            </dl>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartBlock
                title="Started and Completed per Day"
                caption="Project kits started and completed per day, last 30 days (UTC)"
                days={daily.days}
                highlight={highlight}
                series={[
                  {
                    label: 'Started',
                    color: 'var(--color-brand-500)',
                    values: figures.daily.Started,
                  },
                  {
                    label: 'Completed',
                    color: 'currentColor',
                    values: figures.daily.Completed,
                    ...SECOND,
                  },
                ]}
              />
              <ChartBlock
                title="Retried and Removed per Day"
                caption="Project kits retried and removed per day, last 30 days (UTC)"
                days={daily.days}
                highlight={highlight}
                series={[
                  {
                    label: 'Retried',
                    color: 'var(--color-brand-500)',
                    values: figures.daily.Retried,
                  },
                  {
                    label: 'Removed',
                    color: 'currentColor',
                    values: figures.daily.Removed,
                    ...SECOND,
                  },
                ]}
              />
            </div>
          </>
        )}
        <details className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          <summary className="relative cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            What These Count
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              Started is Create Project pressed. Retried is Retry or Try Again pressed after a run
              that made only part of a project, or none of it.
            </li>
            <li>
              Completed is a run, first time or after a retry, that made every file and every
              connection. Removed is Remove What Was Made, done.
            </li>
            <li>
              A browser that has turned telemetry off, or asks sites not to track, sends none of
              these.
            </li>
          </ul>
        </details>
      </div>
    </section>
  );
}
