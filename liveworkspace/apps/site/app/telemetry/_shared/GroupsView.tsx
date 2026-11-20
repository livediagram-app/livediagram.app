'use client';

import type { GroupsSection, ViewProps } from './app';
import { MetricGroups } from './MetricCards';
import { windowLabel } from './windows';

// A Detail tab that is chart groups under one line of introduction (the people tools, the Explorer, Connections,
// Tours & Prompts): what the app's config lists for it, as the Dashboard's cards.
export function GroupsView({ section, summary, active }: ViewProps & { section: GroupsSection }) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {section.intro}, for <span className="font-medium">{windowLabel(active)}</span>.
      </p>
      <MetricGroups groups={section.groups} summary={summary} active={active} />
    </div>
  );
}
