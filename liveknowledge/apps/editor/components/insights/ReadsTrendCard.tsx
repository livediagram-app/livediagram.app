// Reads Over 14 Days (docs/specs/030-knowledgebase/insights.md "A topic's page"): the head of Reading's page, the
// week's reads as a large figure, people and agents apart, over the 14 days' sparkline drawn tall.
import type { KnowledgeReadsDay } from '@liveknowledge/api-schema';
import { ReadsIcon } from './insights-icons';
import { INSIGHTS_MUTED, InsightsSection } from './InsightsSection';
import { ReadsSparkline, ReadsSplit } from './ReadsSparkline';

export function ReadsTrendCard({
  days,
  week,
}: {
  days: readonly KnowledgeReadsDay[];
  week: { people: number; agents: number; total: number };
}) {
  return (
    <InsightsSection
      id="ai-trend"
      title="Reads Over 14 Days"
      icon={<ReadsIcon />}
      about="Pages opened by people and read by agents, a bar a day, today at the right."
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
            {week.total.toLocaleString('en')}
          </span>
          <span className={`text-[13px] ${INSIGHTS_MUTED}`}>reads this week</span>
        </p>
        <span className={`pb-1 text-xs ${INSIGHTS_MUTED}`}>
          <ReadsSplit people={week.people} agents={week.agents} />
        </span>
      </div>
      <div className="mt-4">
        <ReadsSparkline days={days} tall />
      </div>
      <div className={`mt-1.5 flex justify-between text-[11px] ${INSIGHTS_MUTED}`} aria-hidden>
        <span>{days.length} days ago</span>
        <span>Today</span>
      </div>
    </InsightsSection>
  );
}
