'use client';

import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_REPORT_REASONS,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';
import {
  COMMUNITY_COPIES,
  COMMUNITY_FILTERS,
  COMMUNITY_LIKES,
  COMMUNITY_POSTS_OPENED,
  COMMUNITY_POSTS_SHARED,
  COMMUNITY_REPORTS,
  COMMUNITY_SEARCHES,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { CardColumns } from './CardColumns';
import { RankCard, rank } from './RankCard';
import { typeLabel } from './event-vocab';
import { rankTrend, windowLabel } from './windows';

// Community view (docs/specs/017-telemetry/telemetry.md; docs/specs/025-community/community.md
// "Telemetry"): how the public gallery is doing. Headline cards for what goes in and what people
// do with it, then rankings the Dashboard's stacks can't show: which categories people share
// into, why posts get reported, and which gallery filters people reach for. Every type here is a
// closed token (a category, a report reason, a filter kind), never post content, so a row reads
// by the label the product shows for it.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Community',
    metrics: [
      COMMUNITY_POSTS_SHARED,
      COMMUNITY_POSTS_OPENED,
      COMMUNITY_LIKES,
      COMMUNITY_COPIES,
      COMMUNITY_SEARCHES,
      COMMUNITY_FILTERS,
      COMMUNITY_REPORTS,
    ],
  },
];

// The label the product shows for a category or reason token, else the shared reading.
const labelFrom =
  (list: readonly { type: string; label: string }[]) =>
  (type: string): string =>
    list.find((item) => item.type === type)?.label ?? typeLabel(type);
const categoryLabel = labelFrom(COMMUNITY_CATEGORIES);
const reasonLabel = labelFrom(COMMUNITY_REPORT_REASONS);

// `Community·Changed` also carries the Moderation page's Hidden / Listed; the edits are the category types.
const CATEGORY_TYPES: ReadonlySet<string> = new Set(COMMUNITY_CATEGORIES.map((c) => c.type));

export function CommunityView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const community = (action: string) =>
    rank(rows, (r) => r.category === 'Community' && r.action === action);
  const shared = community('Shared');
  const edited = rank(
    rows,
    (r) =>
      r.category === 'Community' &&
      r.action === 'Changed' &&
      r.type !== null &&
      CATEGORY_TYPES.has(r.type),
  );
  const reported = community('Reported');
  const filters = community('Selected');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How the Community is doing, for <span className="font-medium">{windowLabel(active)}</span>:
        documents shared into it, what people do with them, and why posts get reported.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Shared by Category"
            subtitle="Which categories people share their documents into, most to least"
            category="Community"
            action="Shared"
            items={shared}
            label={categoryLabel}
            daily={summary.daily}
            emptyLabel="No documents were shared to the Community in this window yet."
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
            items={reported}
            label={reasonLabel}
            daily={summary.daily}
            emptyLabel="No posts were reported in this window."
          />
          <RankCard
            trend={trend}
            title="Gallery Filters"
            subtitle="Which filters people reach for in the gallery: a category, a tag or a sort order"
            category="Community"
            action="Selected"
            items={filters}
            daily={summary.daily}
            emptyLabel="No gallery filters were picked in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
