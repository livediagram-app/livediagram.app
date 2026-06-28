'use client';

import { Tooltip } from '@livediagram/ui';
import { pct } from './chart-utils';
import { CATEGORY_DESCRIPTIONS, categoryColor, type Group } from './event-vocab';

// "Share of events by category" as a donut (spec/22), replacing the old
// thin stacked bar where small slices were unreadable. The ring segments
// are one stroked circle per category (dash-array sized to its share,
// dash-offset to its start), the SVG rotated so the first slice begins at
// 12 o'clock. The hole holds the window total; a ranked legend beside it
// gives each category an exact count + percentage with a hover blurb.

const R = 42; // ring radius in the 100×100 viewBox
const STROKE = 16;
const CIRC = 2 * Math.PI * R;

export function CategoryDonut({ groups, total }: { groups: Group[]; total: number }) {
  if (total === 0) return null;

  // Accumulate each category's start offset around the ring.
  let offset = 0;
  const segments = groups.map((g) => {
    const len = (g.subtotal / total) * CIRC;
    const seg = { group: g, len, start: offset };
    offset += len;
    return seg;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Share of events by category
      </p>
      <div className="mt-4 flex flex-col items-center">
        <div className="relative h-44 w-44">
          <svg viewBox="0 0 100 100" className="-rotate-90">
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            {segments.map(({ group, len, start }) => (
              <circle
                key={group.category}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={categoryColor(group.category)}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-start}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {total.toLocaleString()}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">events</span>
          </div>
        </div>

        <ul className="mt-5 grid w-full grid-cols-2 gap-x-5 gap-y-1.5">
          {groups.map((g) => (
            <Tooltip
              key={g.category}
              title={g.category}
              description={
                CATEGORY_DESCRIPTIONS[g.category] ?? `${g.subtotal.toLocaleString()} events`
              }
              block
            >
              <li className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: categoryColor(g.category) }}
                />
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                  {g.category}
                </span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {pct(g.subtotal, total).toFixed(1)}%
                </span>
                <span className="w-9 shrink-0 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                  {g.subtotal.toLocaleString()}
                </span>
              </li>
            </Tooltip>
          ))}
        </ul>
      </div>
    </div>
  );
}
