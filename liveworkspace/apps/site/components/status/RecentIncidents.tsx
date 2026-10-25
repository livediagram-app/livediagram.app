import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideCircleCheck } from '@liveworkspace/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { type ServiceGroup, STATE_OF_LETTER, type StatusHistory } from '@liveworkspace/status';
import { useState } from 'react';
import { AppMark } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';
import { formatDuration } from '@/lib/status/history';
import { STATE_LOOK, StateBadge } from './status-ui';

const AllClearIcon = lucideGlyph(lucideCircleCheck, 18);

const ERROR_WORDS: Record<string, string> = {
  timeout: 'No answer in 10 s',
  network: 'No answer',
  status: 'Answered with the wrong status',
  not_json: 'Answered with a page, not the service',
};

const WHEN = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// The incidents of the last 90 days from the hourly checks (liveworkspace/docs/site.md "Status"), newest first: each
// under its group's logo (never a coloured dot), its worst state as an icon and a word, when it began and how long it
// lasted, or that it is ongoing. A service that only takes another's check (the realtime rooms take the API's) would
// repeat that one's incidents, so its own are left out here. The latest SHOWN show, and the rest on request.
const SHOWN = 10;

export function RecentIncidents({
  history,
  groups,
}: {
  history: StatusHistory;
  groups: readonly ServiceGroup[];
}) {
  const [all, setAll] = useState(false);
  const named = new Map(
    groups.flatMap((g) =>
      g.services
        .filter((s) => !(s.check.mode === 'derived' && s.check.rule === 'same'))
        .map((s) => [s.id, { group: g, name: s.name }] as const),
    ),
  );
  const incidents = history.incidents.filter(([id]) => named.has(id));
  const shown = all ? incidents : incidents.slice(0, SHOWN);
  return (
    <section
      aria-labelledby="status-incidents"
      className="lw-status-rise rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="status-incidents"
          className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Recent incidents
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          From liveworkspace’s hourly checks, the last {history.days} days
        </p>
      </div>
      {incidents.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span aria-hidden className="inline-flex text-emerald-600 dark:text-emerald-400">
            <AllClearIcon />
          </span>
          No incidents in the last {history.days} days.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map(([id, started, ended, worst, checks, error]) => {
            const { group, name } = named.get(id)!;
            const state = STATE_OF_LETTER[worst];
            return (
              <li
                key={`${id}:${started}`}
                data-incident={id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <GroupMark group={group} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {name}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        · {group.title}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {error ? (ERROR_WORDS[error] ?? error) : STATE_LOOK[state].meaning} · {checks}{' '}
                      {checks === 1 ? 'check' : 'checks'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-xs text-slate-600 sm:pl-0 dark:text-slate-300">
                  <StateBadge state={state} size="sm" />
                  <time dateTime={new Date(started).toISOString()} className="tabular-nums">
                    {WHEN.format(started)}
                  </time>
                  <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {ended === null ? 'Ongoing' : formatDuration(ended - started)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {incidents.length > SHOWN ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="relative touch-target-y mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:outline-white"
        >
          {all ? `Show the latest ${SHOWN}` : `Show all ${incidents.length}`}
        </button>
      ) : null}
    </section>
  );
}

function GroupMark({ group }: { group: ServiceGroup }) {
  const app = listedApps().find((a) => a.id === group.site.id);
  return app ? (
    <AppMark app={app} className="size-4" />
  ) : (
    <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4" />
  );
}
