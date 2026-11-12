'use client';

// One entry on the History dialog's rail (HistoryDialog.tsx; livediagram/docs/specs/013-workspace/history.md "The
// dialog"): an event, or a run of one kind by one person folded into one entry that opens to list them.

import { memo, useId, useState } from 'react';
import { ChevronDownIcon } from '../ui/icons';
import { FOCUS_RING } from '../ui/classes';
import { eventIcon } from './event-icons';
import {
  eventLabel,
  eventTone,
  timeLabel,
  TONE_INKS,
  toneColor,
  toneSoftColor,
} from './history-model';
import { actorWords, eventWords } from './history-render';
import type { HistoryRun } from './history';
import { MUTED, PersonAvatar, iso } from './HistoryParts';

// What each entry needs to word itself: who is reading, and the reader's team names.
export type RenderCtx = {
  viewerId: string | null;
  teamName: (id: string | null) => string | null;
};

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const HistoryEntry = memo(function HistoryEntry({
  run,
  ctx,
  last,
}: {
  run: HistoryRun;
  ctx: RenderCtx;
  last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const event = run.events[0]!;
  const words = eventWords(event, ctx.viewerId, ctx.teamName);
  const tone = eventTone(event.type);
  const many = run.events.length;
  const who = cap(actorWords(event, ctx.viewerId));
  const detail = many > 1 ? null : words.detail;
  return (
    <li
      data-history-event={event.type}
      data-history-run={many > 1 ? many : undefined}
      className="relative flex gap-3 pb-4"
    >
      {/* The rail: from this disc down to the next. */}
      {last ? null : (
        <span
          aria-hidden
          className="absolute bottom-0 left-4 top-8 w-px bg-slate-200 dark:bg-slate-700/70"
        />
      )}
      <span
        aria-hidden
        className="relative z-[1] h-8 w-8 shrink-0 rounded-full bg-white ring-4 ring-white dark:bg-slate-900 dark:ring-slate-900"
      >
        <span
          className={`flex h-full w-full items-center justify-center rounded-full ${TONE_INKS}`}
          style={{ background: toneSoftColor(tone), color: toneColor(tone) }}
        >
          {eventIcon(event.type, event.detail?.source)}
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {eventLabel(event)}
            {many > 1 ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-px align-[1px] text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {many} times
              </span>
            ) : null}
          </p>
          <span className={`shrink-0 text-xs tabular-nums ${MUTED}`}>
            {many > 1 ? (
              <>
                <time dateTime={iso(run.events[many - 1]!.occurredAt)}>
                  {timeLabel(run.events[many - 1]!.occurredAt)}
                </time>
                {'–'}
                <time dateTime={iso(event.occurredAt)}>{timeLabel(event.occurredAt)}</time>
              </>
            ) : (
              <time dateTime={iso(event.occurredAt)}>{timeLabel(event.occurredAt)}</time>
            )}
          </span>
        </div>
        <p className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}`}>
          <PersonAvatar event={event} viewerId={ctx.viewerId} size={16} />
          <span className="truncate">
            <span className="font-medium text-slate-700 dark:text-slate-200">{who}</span>
            {detail ? ` · ${detail}` : ''}
          </span>
        </p>
        {words.quote && many === 1 ? (
          <blockquote className="mt-1.5 line-clamp-3 rounded-lg border-l-2 border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {words.quote}
          </blockquote>
        ) : null}
        {many > 1 ? (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((o) => !o)}
              className={`mt-1 inline-flex items-center gap-1 rounded text-xs font-medium text-brand-700 transition duration-micro hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 ${FOCUS_RING}`}
            >
              {open ? 'Hide' : `Show all ${many}`}
              <span className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}`}>
                <ChevronDownIcon />
              </span>
            </button>
            {open ? (
              <ol
                id={listId}
                aria-label={`${eventLabel(event)}, ${many} times`}
                className="mt-1.5 flex flex-col gap-1 border-l border-slate-200 pl-3 motion-safe:animate-fade-in dark:border-slate-700"
              >
                {run.events.map((e) => {
                  const d = eventWords(e, ctx.viewerId, ctx.teamName).detail;
                  return (
                    <li
                      key={e.id}
                      data-history-event={e.type}
                      className="flex items-baseline gap-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                        {d ?? eventLabel(e)}
                      </span>
                      <time
                        dateTime={iso(e.occurredAt)}
                        className={`shrink-0 tabular-nums ${MUTED}`}
                      >
                        {timeLabel(e.occurredAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
});
