'use client';

import { EmptyState } from '@livediagram/ui';
import { categoryColor } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import type { Riser } from './page-insights';

// The Pages tab's small insight cards (spec/150): a single derived number,
// and the list of pages gaining views week on week.

const CARD =
  'flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';

export function PageInsightTile({
  title,
  value,
  unit,
  detail,
}: {
  title: string;
  value: number | null;
  unit?: string;
  detail: string;
}) {
  return (
    <div className={CARD}>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value === null ? 'n/a' : value.toLocaleString()}
        </span>
        {value !== null && unit ? <span className="text-xs text-slate-400">{unit}</span> : null}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export function RisingPagesCard({ risers }: { risers: Riser[] }) {
  const color = categoryColor('Page');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rising pages</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Biggest gain in views, last 7 days against the 7 before
      </p>
      {risers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ActivityGlyph />}
            title="Nothing rising"
            description="No page gained views on the week before."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {risers.map((r) => (
            <li key={r.path} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-700 dark:text-slate-200">{r.path}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold" style={{ color }}>
                  +{(r.last7 - r.prev7).toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {r.prev7.toLocaleString()} → {r.last7.toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
