'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  ARTICLE_VIEWS,
  DRY_HELP_SEARCHES,
  HELP_SEARCHES,
  MARKED_HELPFUL,
  MARKED_NOT_HELPFUL,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { CardColumns } from './CardColumns';
import { isHelpArticleType } from './opened-types';
import { RankCard, rank } from './RankCard';
import { tourStepLabel, tourStepRows } from './tour-steps';
import { rankTrend, windowLabel } from './windows';

// Help view (spec/22): how the help centre (apps/help) is doing. Article reads
// and the per-article helpful / not-really feedback. The help app emits
// `Help·View·<id>`, `Help·Helpful·<id>`, `Help·Unhelpful·<id>`, where the id
// is the registry's per-article telemetry id: the slug, or an explicit token
// where two articles share one (`tips-format-painter`, `tips-command-palette`).
// Both forms are plain tokens, so each ranks as its own row with no mapping
// here; the feature article kept its slug, so its pre-split rows and its new
// ones are one series. Headline totals as cards, then rankings: which articles
// get read, which earn a thumbs-up, and which ones leave people unsatisfied
// (the last is the useful one; those articles are the ones to rewrite). A
// vote counts the reader's final choice, not every tap.
//
// Two more read the help that lives inside the editor: the articles opened
// from it (`UI·Opened·<slug>`, the same ids), and the welcome tour's steps in
// the order it shows them, a funnel whose fall-off says where people stop.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Help engagement',
    metrics: [ARTICLE_VIEWS, MARKED_HELPFUL, MARKED_NOT_HELPFUL, HELP_SEARCHES, DRY_HELP_SEARCHES],
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
  const trend = rankTrend(summary, active);
  const viewed = rank(rows, (r) => r.category === 'Help' && r.action === 'View');
  const helpful = rank(rows, (r) => r.category === 'Help' && r.action === 'Helpful');
  const unhelpful = rank(rows, (r) => r.category === 'Help' && r.action === 'Unhelpful');
  const fromEditor = rank(
    rows,
    (r) => r.category === 'UI' && r.action === 'Opened' && isHelpArticleType(r.type),
  );
  const tourSteps = tourStepRows(rows);

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How the help centre is doing, for <span className="font-medium">{windowLabel(active)}</span>
        : reads and per-article feedback, the articles opened from inside the editor, and how far
        people get through the welcome tour.
      </p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Rows before late September 2026 for format-painter and command-palette also count the Tips
        and Tricks articles of the same name, which report on their own since then.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Most-read articles"
            subtitle="Which help articles get opened, most to least"
            category="Help"
            action="View"
            items={viewed}
            daily={summary.daily}
            emptyLabel="No articles were read in this window yet."
          />
          <RankCard
            trend={trend}
            title="Found helpful"
            subtitle="Articles readers said helped them, most to least"
            category="Help"
            action="Helpful"
            items={helpful}
            daily={summary.daily}
            emptyLabel="No helpful votes in this window yet."
          />
          <RankCard
            trend={trend}
            title="Left people stuck"
            subtitle="Articles voted not-really helpful, the ones to rewrite"
            category="Help"
            action="Unhelpful"
            items={unhelpful}
            daily={summary.daily}
            emptyLabel="No not-really votes in this window yet."
          />
          <RankCard
            trend={trend}
            title="Opened From the Editor"
            subtitle="Help articles opened from inside the editor, from a help link or the search panel"
            category="UI"
            action="Opened"
            items={fromEditor}
            daily={summary.daily}
            emptyLabel="No articles were opened from the editor in this window yet."
          />
          <RankCard
            trend={trend}
            ordered
            title="Tour Steps"
            subtitle="Each welcome tour step viewed, in the order the tour shows them: where the counts fall away is where people stop"
            category="UI"
            action="View"
            items={tourSteps}
            label={tourStepLabel}
            daily={summary.daily}
            emptyLabel="No tour steps were viewed in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
