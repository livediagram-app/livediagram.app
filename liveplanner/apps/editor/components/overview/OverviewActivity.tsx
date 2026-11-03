import { useState } from 'react';
import { CompactEmptyState, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideHistory } from '@liveworkspace/icons/lucide';
import { formatRelativeTime } from '@/lib/relative-time';
import { ACTIVITY_SHOWN, type ActivityEntry } from './overview-activity';
import { OverviewSection } from './OverviewSection';

const HistoryGlyph = lucideGlyph(lucideHistory, 18);

const exact = (at: number) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function EntryText({ entry, now }: { entry: ActivityEntry; now: number }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-[13px] leading-snug">
      <span className="text-slate-700 dark:text-slate-200">
        <strong className="font-semibold text-slate-900 dark:text-slate-100">
          {entry.by.name}
        </strong>{' '}
        {entry.text}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {entry.where} ·{' '}
        <Tooltip label={exact(entry.at)}>
          <time dateTime={new Date(entry.at).toISOString()}>
            {formatRelativeTime(Math.max(0, now - entry.at))}
          </time>
        </Tooltip>
      </span>
    </span>
  );
}

// The Overview's Recent Activity (docs/specs/026-plan/plan-overview.md "Recent Activity"): a rail of entries, newest
// first, eight until See All; an entry about a card opens it.
export function OverviewActivity({
  entries,
  now,
  onOpenCard,
}: {
  entries: readonly ActivityEntry[];
  now: number;
  onOpenCard: (itemId: string) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, ACTIVITY_SHOWN);
  const more = entries.length > ACTIVITY_SHOWN;
  return (
    <OverviewSection
      id="overview-activity"
      title="Recent Activity"
      action={
        more ? (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className="cursor-pointer rounded text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
          >
            {all ? 'Show Fewer' : 'See All'}
          </button>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <CompactEmptyState
          icon={<HistoryGlyph />}
          title="No Activity Yet"
          description="Changes to cards will show here."
        />
      ) : (
        <ol className="ml-1.5 flex flex-col border-l-2 border-slate-200 dark:border-slate-800">
          {shown.map((entry) => {
            const dot = (
              <span
                aria-hidden
                data-dot={entry.setup ? 'setup' : 'card'}
                className={`mt-[3px] h-3 w-3 shrink-0 rounded-full border-2 border-white dark:border-slate-950 ${
                  entry.setup ? 'bg-brand-500 dark:bg-brand-400' : 'bg-slate-400 dark:bg-slate-600'
                }`}
              />
            );
            return (
              <li key={entry.key} className="-ml-[7px] pb-3.5 last:pb-0">
                {entry.itemId ? (
                  <button
                    type="button"
                    onClick={() => onOpenCard(entry.itemId!)}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-md text-left hover:bg-slate-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800/60"
                  >
                    {dot}
                    <EntryText entry={entry} now={now} />
                  </button>
                ) : (
                  <div className="flex items-start gap-3">
                    {dot}
                    <EntryText entry={entry} now={now} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </OverviewSection>
  );
}
