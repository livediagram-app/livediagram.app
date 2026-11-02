'use client';

// A card's Activity tab (docs/specs/026-plan/items.md "History" "Where it shows"): its history as a timeline, never
// mixed with the threads. Day groups (Today, Yesterday, dates); in each, runs of one person's entries hang from their
// disc on a thin rail; each entry is short lines, one per change, with a glyph and values as chips. The entries past
// the first ACTIVITY_ENTRIES_SHOWN wait under Show N More. A skeleton while it loads, and the empty, failed, This
// Browser and no-plan states. Mounted only while the tab is picked, so history is read only then.

import { useMemo, useState, type ReactNode } from 'react';
import { CompactEmptyState, Tooltip, TrashIcon, lucideGlyph } from '@liveplanner/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  lucideEraser,
  lucideFlag,
  lucideHistory,
  lucideMoveRight,
  lucidePackage,
  lucidePencil,
  lucidePlus,
  lucideShapes,
  lucideSparkles,
  lucideTextCursorInput,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { typeIn, type Item } from '@liveplanner/items';
import { useRelativeNow } from '@/lib/relative-time';
import { useCardHistory, type CardHistory } from '@/hooks/plan/useCardHistory';
import type { ItemsScope } from '@/lib/api/items';
import { usePlan } from '../PlanContext';
import { useCardThreadsContext } from './CardThreadsContext';
import {
  changeLine,
  type ActivityContext,
  type ActivityGlyph,
  type ActivityLine,
} from './activity-words';
import { aiRunWords } from './activity-ai-words';
import { activityTimeline, type TimelineEntry, type TimelineRun } from './activity-timeline';
import { TimelineDisc, TimelineTime, ValueArrow, ValueChip, railClass } from './timeline-parts';

// The entries drawn before Show N More: a tab's worth.
export const ACTIVITY_ENTRIES_SHOWN = 20;
// An entry's change lines drawn before its own Show N More Changes.
export const ACTIVITY_LINES_SHOWN = 3;

const AiIcon = lucideGlyph(lucideSparkles, 10);
const HistoryIcon = lucideGlyph(lucideHistory, 18);

const GLYPHS: Record<ActivityGlyph, (p: { 'aria-hidden'?: boolean }) => ReactNode> = {
  created: lucideGlyph(lucidePlus, 13),
  moved: lucideGlyph(lucideMoveRight, 13),
  edited: lucideGlyph(lucidePencil, 12),
  renamed: lucideGlyph(lucideTextCursorInput, 13),
  cleared: lucideGlyph(lucideEraser, 12),
  flag: lucideGlyph(lucideFlag, 12),
  archive: lucideGlyph(lucidePackage, 12),
  trash: () => <TrashIcon size={12} />,
  restore: lucideGlyph(lucideUndo2, 12),
  type: lucideGlyph(lucideShapes, 12),
};

// The card's Activity tab, keyed by the card so Show N More starts folded on each one.
export function CardActivityTab({ item }: { item: Item }) {
  const scope = useCardThreadsContext()?.threads.scope;
  if (!scope)
    return (
      <ActivityState title="No Activity Here" description="Activity shows on cards in a plan." />
    );
  return <ActivityTimelineOf key={item.id} item={item} scope={scope} />;
}

function ActivityTimelineOf({ item, scope }: { item: Item; scope: ItemsScope }) {
  const plan = usePlan();
  const now = useRelativeNow();
  const [all, setAll] = useState(false);
  const history = useCardHistory({ scope, itemId: item.id, rev: item.rev, enabled: true });
  const ctx = useMemo<ActivityContext>(
    () => ({
      statusNames: plan?.statusNames ?? new Map(),
      statusPhases: plan?.statusPhases ?? new Map(),
      types: plan?.types ?? [],
      type: plan ? typeIn(plan.types, item.type) : undefined,
      items: plan?.items ?? new Map(),
    }),
    [plan, item.type],
  );
  const limit = all ? history.entries.length : ACTIVITY_ENTRIES_SHOWN;
  // Day headings move with the clock only at midnight, so the grouping is redone with the entries or the day, not
  // on every minute's tick.
  const today = new Date(now).setHours(0, 0, 0, 0);
  const days = useMemo(
    () => activityTimeline(history.entries, today, limit),
    [history.entries, limit, today],
  );
  const hidden = history.entries.length - Math.min(limit, history.entries.length);
  if (history.entries.length === 0) return <ActivityNote history={history} />;
  return (
    <div data-card-activity="" className="flex flex-col gap-6 pb-2">
      {days.map((day) => (
        <section key={day.key} aria-label={day.heading}>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {day.heading}
          </h4>
          <ol className="flex flex-col">
            {day.runs.map((run, i) => (
              <ActivityRun
                key={run.key}
                run={run}
                ctx={ctx}
                now={now}
                clock={day.heading !== 'Today'}
                last={i === day.runs.length - 1}
              />
            ))}
          </ol>
        </section>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="-mx-1.5 inline-flex w-fit cursor-pointer items-center rounded-md px-1.5 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none pointer-coarse:py-2 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          Show {hidden} More
        </button>
      ) : null}
    </div>
  );
}

// One person's run: their disc on the rail, their name (and an agent's sparkle, worded by what it did), then each
// entry's lines.
function ActivityRun({
  run,
  ctx,
  now,
  clock,
  last,
}: {
  run: TimelineRun;
  ctx: ActivityContext;
  now: number;
  clock: boolean;
  last: boolean;
}) {
  const single = run.entries.length === 1;
  // An agent's sparkle names what the run did ("Transitioned by AI"), not "Generated by AI" (items.md "History").
  const aiWords = run.ai ? aiRunWords(run.entries.map((e) => e.entry)) : null;
  const newest = run.entries[0]!.entry.at;
  return (
    <li data-activity-run="" className={`relative flex gap-3 ${last ? '' : 'pb-5'}`}>
      {last ? null : <span aria-hidden className={railClass(24)} />}
      <TimelineDisc name={run.by.name} color={run.by.color} />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-6 items-center gap-2">
          <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900 dark:text-slate-50">
            {run.mine ? 'You' : run.by.name}
          </span>
          {aiWords ? (
            <Tooltip label={aiWords}>
              <span
                data-activity-ai=""
                role="img"
                aria-label={aiWords}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              >
                <AiIcon aria-hidden />
              </span>
            </Tooltip>
          ) : null}
          <span className="flex-1" />
          {single ? <TimelineTime at={newest} now={now} clock={clock} /> : null}
        </div>
        <div className="mt-0.5 flex flex-col gap-2">
          {run.entries.map((e, i) => (
            <ActivityEntry key={i} item={e} ctx={ctx} now={now} clock={clock} timed={!single} />
          ))}
        </div>
      </div>
    </li>
  );
}

// One entry: a line per change (the first few, then Show N More Changes), an undo's mark, its time in a longer run.
export function ActivityEntry({
  item,
  ctx,
  now,
  clock,
  timed,
}: {
  item: TimelineEntry;
  ctx: ActivityContext;
  now: number;
  clock: boolean;
  timed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { entry, previous } = item;
  const lines = entry.changes.map((c, i) => changeLine(ctx, c, entry, previous[i]));
  const shown = open ? lines : lines.slice(0, ACTIVITY_LINES_SHOWN);
  const more = lines.length - shown.length;
  return (
    <div data-activity="" className="flex items-start gap-2">
      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {shown.map((line, i) => (
          <ActivityLineRow
            key={i}
            line={line}
            undo={entry.tag === 'undo' && i === shown.length - 1}
          />
        ))}
        {more > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="ml-5 cursor-pointer rounded text-[12px] font-medium text-brand-700 underline-offset-2 hover:underline pointer-coarse:py-1.5 dark:text-brand-300"
            >
              Show {more} More {more === 1 ? 'Change' : 'Changes'}
            </button>
          </li>
        ) : null}
      </ul>
      {timed ? <TimelineTime at={entry.at} now={now} clock={clock} className="pt-px" /> : null}
    </div>
  );
}

function ActivityLineRow({ line, undo }: { line: ActivityLine; undo: boolean }) {
  const Glyph = GLYPHS[line.glyph];
  return (
    <li className="flex items-start gap-1.5 text-[13px] leading-5 text-slate-600 dark:text-slate-300">
      <span
        aria-hidden
        className="mt-[3px] flex size-3.5 shrink-0 items-center justify-center text-slate-400"
      >
        <Glyph aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-pretty">
        {line.parts.map((p, i) =>
          'arrow' in p ? (
            <ValueArrow key={i} />
          ) : 'chip' in p ? (
            <ValueChip key={i} text={p.chip} tone={p.tone} old={!!p.old} />
          ) : (
            <span
              key={i}
              className={
                p.strong
                  ? 'font-medium text-slate-800 dark:text-slate-100'
                  : p.muted
                    ? 'text-slate-500 dark:text-slate-400'
                    : undefined
              }
            >
              {p.text}
            </span>
          ),
        )}
        {undo ? <span className="text-slate-500 dark:text-slate-400"> (Undo)</span> : null}
      </p>
    </li>
  );
}

// The tab's state in place of a timeline: the shared compact empty state.
function ActivityState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div data-activity-note="">
      <CompactEmptyState
        size="small"
        icon={<HistoryIcon aria-hidden />}
        title={title}
        description={description}
        action={action}
        className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
      />
    </div>
  );
}

// A skeleton of three runs on the rail while the history loads (still with reduced motion).
function ActivitySkeleton() {
  return (
    <div
      data-activity-loading=""
      role="status"
      aria-label="Loading activity"
      className="flex flex-col"
    >
      <div className="mb-3 h-2.5 w-14 rounded bg-slate-100 dark:bg-slate-800" />
      {[0.72, 0.55, 0.64].map((w, i) => (
        <div key={i} className={`relative flex gap-3 ${i < 2 ? 'pb-5' : ''}`}>
          {i < 2 ? <span aria-hidden className={railClass(24)} /> : null}
          <span className="size-6 shrink-0 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
            <div
              className="h-2.5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
              style={{ width: `${w * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// What the tab shows with no entries to draw: loading, nothing kept yet, a failed read, or a plan that keeps none.
export function ActivityNote({ history }: { history: CardHistory }): ReactNode {
  if (history.status === 'offline')
    return (
      <ActivityState
        title="No Activity in This Browser"
        description="Plans in This Browser keep no card history."
        action={<HelpArticleLink article="planCardActivity" variant="text" />}
      />
    );
  if (history.status === 'error')
    return (
      <ActivityState
        title="Couldn’t Load Activity"
        description="Check your connection and try again."
        action={
          <button
            type="button"
            onClick={history.retry}
            className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none pointer-coarse:py-2 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            Try Again
          </button>
        }
      />
    );
  if (history.status === 'ready')
    return (
      <ActivityState
        title="No Activity Yet"
        description="Changes to this card show here: who moved it, what they set, and when."
        action={<HelpArticleLink article="planCardActivity" variant="text" />}
      />
    );
  return <ActivitySkeleton />;
}
