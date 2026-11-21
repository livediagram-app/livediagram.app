'use client';

import { COMMUNITY_REPORT_REASONS } from '@liveworkspace/community';
import { useTelemetryApp, type ViewProps } from './app';
import { MetricGroups } from './MetricCards';
import { CardColumns } from './CardColumns';
import { RankCard, rank } from './RankCard';
import { typeLabel } from './event-vocab';
import { rankTrend, windowLabel } from './windows';

// The Community tab (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs;
// 007-community/community.md): how the app's public gallery is doing. Headline cards for what goes in and what
// people do with it, then rankings the stacks can't show: which categories people share into, why posts get
// reported, and which gallery filters people reach for. Every type here is a closed token (a category, a report
// reason, a filter kind), never post content, so a row reads by the label the product shows for it. The view is
// every app's; its charts and its categories are the app's own (its config's `community`).

// The label the product shows for a category or reason token, else the shared reading.
const labelFrom =
  (list: readonly { type: string; label: string }[]) =>
  (type: string): string =>
    list.find((item) => item.type === type)?.label ?? typeLabel(type);
const reasonLabel = labelFrom(COMMUNITY_REPORT_REASONS);

export function CommunityView({ summary, active }: ViewProps) {
  const { community, noun } = useTelemetryApp();
  const categoryLabel = labelFrom(community.categories);
  // The edits are `Community·Changed` typed by category.
  const categoryTypes = new Set(community.categories.map((c) => c.type));
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const of = (action: string) =>
    rank(rows, (r) => r.category === 'Community' && r.action === action);
  const edited = rank(
    rows,
    (r) =>
      r.category === 'Community' &&
      r.action === 'Changed' &&
      r.type !== null &&
      categoryTypes.has(r.type),
  );

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How the Community is doing, for <span className="font-medium">{windowLabel(active)}</span>:{' '}
        {noun.many} shared into it, what people do with them, and why posts get reported.
      </p>
      <MetricGroups groups={community.groups} summary={summary} active={active} />

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Shared by Category"
            subtitle={`Which categories people share their ${noun.many} into, most to least`}
            category="Community"
            action="Shared"
            items={of('Shared')}
            label={categoryLabel}
            daily={summary.daily}
            emptyLabel={`No ${noun.many} were shared to the Community in this window yet.`}
          />
          <RankCard
            trend={trend}
            title="Listings Edited by Category"
            subtitle="Posts whose title, description, category or tags were changed, by the category they ended in"
            category="Community"
            action="Changed"
            items={edited}
            label={categoryLabel}
            daily={summary.daily}
            emptyLabel="No listings were edited in this window yet."
          />
          <RankCard
            trend={trend}
            title="Reported For"
            subtitle="Why people reported posts, most to least"
            category="Community"
            action="Reported"
            items={of('Reported')}
            label={reasonLabel}
            daily={summary.daily}
            emptyLabel="No posts were reported in this window."
          />
          <RankCard
            trend={trend}
            title="Gallery Filters"
            subtitle="Which filters people reach for in the gallery: a category, a tag, a sort order or My Shares"
            category="Community"
            action="Selected"
            items={of('Selected')}
            daily={summary.daily}
            emptyLabel="No gallery filters were picked in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
