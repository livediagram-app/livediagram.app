'use client';

import { useMemo } from 'react';
import { EmptyState } from '@livediagram/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { groupByCategory } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { CategoryDonut } from './CategoryDonut';
import { TopEvents } from './TopEvents';
import { EventsTable } from './EventsTable';

// The Raw view: the full aggregate dashboard (spec/22). The window is the
// global one selected in the timeframe panel above the tabs and arrives
// as a prop. Up top, two summaries side by side — the category-share
// donut and the top-events leaderboard — then every event in the window
// as a sortable table.

export function RawView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const window = summary.windows[active];
  const groups = useMemo(() => groupByCategory(window.rows), [window]);

  if (window.total === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={<ActivityGlyph />}
          title="No events in this window yet"
          description="Nothing was recorded for the selected timeframe. Try a wider window, or check back once there’s more activity."
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CategoryDonut groups={groups} total={window.total} />
        <TopEvents rows={window.rows} total={window.total} />
      </div>

      <EventsTable rows={window.rows} total={window.total} daily={summary.daily} />
    </>
  );
}
