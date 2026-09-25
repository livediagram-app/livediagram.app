'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Help view (spec/22): how the help centre (apps/help) is doing. Article reads
// and the per-article helpful / not-really feedback. The help app emits
// `Help·View·<slug>`, `Help·Helpful·<slug>`, `Help·Unhelpful·<slug>` (type is
// the article slug). Headline totals as cards, then rankings: which articles
// get read, which earn a thumbs-up, and which ones leave people unsatisfied
// (the last is the useful one; those articles are the ones to rewrite).
export const GROUPS: MetricGroup[] = [
  {
    title: 'Help engagement',
    metrics: [
      {
        category: 'Help',
        action: 'View',
        allTypes: true,
        title: 'Article Views',
        blurb: 'Help-centre articles opened, across every article.',
      },
      {
        category: 'Help',
        action: 'Helpful',
        allTypes: true,
        title: 'Marked Helpful',
        blurb: 'Readers who tapped "yes, this helped" on an article.',
      },
      {
        category: 'Help',
        action: 'Unhelpful',
        allTypes: true,
        title: 'Marked Not Helpful',
        blurb: 'Readers who tapped "not really"; the articles worth rewriting.',
      },
    ],
  },
];

export function HelpView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const viewed = rank(rows, (r) => r.category === 'Help' && r.action === 'View');
  const helpful = rank(rows, (r) => r.category === 'Help' && r.action === 'Helpful');
  const unhelpful = rank(rows, (r) => r.category === 'Help' && r.action === 'Unhelpful');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How the help centre is doing, for <span className="font-medium">{windowLabel(active)}</span>
        : reads and per-article feedback.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="Most-read articles"
          subtitle="Which help articles get opened, most to least"
          category="Help"
          action="View"
          items={viewed}
          daily={summary.daily}
          emptyLabel="No articles were read in this window yet."
        />
        <RankCard
          title="Found helpful"
          subtitle="Articles readers said helped them, most to least"
          category="Help"
          action="Helpful"
          items={helpful}
          daily={summary.daily}
          emptyLabel="No helpful votes in this window yet."
        />
        <RankCard
          title="Left people stuck"
          subtitle="Articles voted not-really helpful, the ones to rewrite"
          category="Help"
          action="Unhelpful"
          items={unhelpful}
          daily={summary.daily}
          emptyLabel="No not-really votes in this window yet."
        />
      </div>
    </div>
  );
}
