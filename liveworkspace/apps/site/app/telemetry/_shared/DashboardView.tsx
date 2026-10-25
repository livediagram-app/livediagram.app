'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { useTelemetryApp } from './app';
import { MetricGroups } from './MetricCards';
import type { SectionKey } from './view-keys';
import { windowLabel } from './windows';

// The Dashboard view (docs/specs/017-telemetry/telemetry.md, default tab): the key metrics, most
// important first. At a Glance answers "is it working?" in six plain cards, then chart stacks
// grouped by the question they answer, each a combined chart that opens into its members' cards.
// Charts come from the app's catalogue, so a stack or card only references them; the list is the
// app's own (its config's `dashboard`).
//
// Groups run as a funnel: who arrives, what they make, which features carry the work, how they
// work together, how machines connect, then health. Until October 2026 this charted every event
// (63 stacks, ten of them tours); everything else now sits in the Detail tab that goes deeper,
// and every emitted event still lands in some chart there (metric-emitters.test). A stack that
// goes deeper than it can links to its section.
//
// Deliberately a FIXED list, not "top by volume": a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must always be
// on screen. A metric with no events renders as zero with a flat line rather
// than disappearing, so the layout is stable day to day.

export function DashboardView({
  summary,
  active,
  onOpenSection,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  onOpenSection: (section: SectionKey) => void;
}) {
  const { dashboard } = useTelemetryApp();
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted. Every other
        event is on the Detail tabs.
      </p>
      <MetricGroups
        groups={dashboard}
        summary={summary}
        active={active}
        onOpenSection={onOpenSection}
      />
    </div>
  );
}
