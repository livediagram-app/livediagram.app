// The Reads tile's sparkline (docs/specs/030-knowledgebase/blueprints/insights-ui.md "The dashboard"): a bar a
// day over the last 14 days, people under agents in two tones of the brand, scaled to the busiest day, with one
// spoken label. A day with no reads is a hairline, so the run of days still reads as time.
import type { KnowledgeReadsDay } from '@liveknowledge/api-schema';
import { readsSparkLabel } from '@/lib/knowledge-ask/dashboard-figures';

const TILE_H = 28;
const TALL_H = 40;
const BAR = 6;
const GAP = 3;

/** The two tones, shared with Most Read's bars so the key holds across the dashboard. */
export const PEOPLE_FILL = 'fill-brand-700 dark:fill-brand-300';
export const AGENT_FILL = 'fill-brand-400 dark:fill-brand-600';
export const PEOPLE_BG = 'bg-brand-700 dark:bg-brand-300';
export const AGENT_BG = 'bg-brand-400 dark:bg-brand-600';

/** `tall`: Page Insights' 40 px bars over 30 days (insights.md "Page Insights"); the tile's are 28 px. */
export function ReadsSparkline({
  days,
  tall = false,
}: {
  days: readonly KnowledgeReadsDay[];
  tall?: boolean;
}) {
  const H = tall ? TALL_H : TILE_H;
  const most = Math.max(1, ...days.map((day) => day.people + day.agents));
  const width = days.length * (BAR + GAP) - GAP;
  return (
    <svg
      role="img"
      aria-label={readsSparkLabel(days)}
      viewBox={`0 0 ${width} ${H}`}
      preserveAspectRatio="none"
      data-reads-sparkline=""
      className={`block w-full ${tall ? 'h-10' : 'h-7'}`}
    >
      {days.map((day, at) => {
        const x = at * (BAR + GAP);
        const people = (day.people / most) * H;
        const agents = (day.agents / most) * H;
        if (people + agents === 0)
          return (
            <rect
              key={day.day}
              x={x}
              y={H - 1}
              width={BAR}
              height={1}
              className="fill-slate-200 dark:fill-slate-700"
            />
          );
        return (
          <g key={day.day} data-spark-day={day.day}>
            <rect x={x} y={H - people} width={BAR} height={people} rx={1} className={PEOPLE_FILL} />
            <rect
              x={x}
              y={H - people - agents}
              width={BAR}
              height={agents}
              rx={1}
              className={AGENT_FILL}
            />
          </g>
        );
      })}
    </svg>
  );
}
