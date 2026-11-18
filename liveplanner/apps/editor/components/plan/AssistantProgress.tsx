'use client';

// The progress line under a card's Assignee while an AI assistant has it (docs/specs/026-plan/items.md "Progress on the
// card"): where the card is and for how long, then the assistant's latest note on it, or, before it has written one,
// that it picks the card up when it is next asked. Read-only, and live: a new comment or move redraws it.
import { SparkleIcon, relativeSince } from '@liveplanner/ui';
import type { Item } from '@liveplanner/items';
import { useRelativeNow } from '@/lib/relative-time';
import { assistantProgress } from './assistant-progress';
import { useCardThreadsContext } from './threads/CardThreadsContext';

const NO_THREADS: never[] = [];

export function AssistantProgress({
  item,
  statuses,
}: {
  item: Item;
  statuses: readonly { status: string; name: string }[];
}) {
  const threads = useCardThreadsContext()?.threads;
  const now = useRelativeNow();
  const line = assistantProgress(
    item,
    threads?.threadsOf(item.id) ?? NO_THREADS,
    (status) => statuses.find((s) => s.status === status)?.name,
    now,
  );
  if (!line) return null;
  return (
    <div
      data-assistant-progress=""
      aria-live="polite"
      className="mt-1.5 rounded-md border border-brand-100 bg-brand-50/60 px-2 py-1.5 text-[12px] leading-snug text-slate-700 max-sm:text-[14px] dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-slate-200"
    >
      <p className="flex items-start gap-1.5 font-medium text-brand-800 dark:text-brand-200">
        <SparkleIcon size={12} aria-hidden className="mt-[0.2em] shrink-0" />
        {/* Wraps rather than truncates: the assistant's name is the point of the line, and the panel is narrow. */}
        <span className="min-w-0 break-words">
          {line.note ? `${line.assistant.name} is on it` : `Waiting for ${line.assistant.name}`}
        </span>
      </p>
      {line.column ? (
        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{line.column}</p>
      ) : null}
      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
        {line.note ? (
          <>
            <span className="text-slate-500 dark:text-slate-400">
              Latest note {relativeSince(line.note.at, now)}:
            </span>{' '}
            {line.note.text}
          </>
        ) : (
          'It picks the card up the next time it is asked to work its cards.'
        )}
      </p>
    </div>
  );
}
