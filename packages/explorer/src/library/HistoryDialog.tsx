'use client';

// History (livediagram's DocumentHistoryDialog): one item's own Timeline, from its menu. A dialog rather than a page,
// because "what happened to this?" is asked while looking at the row. One `GET /timeline?item=` page of 30, and
// Show More for the next; the events are grouped by day and each says what happened, when and by whom, as the
// Timeline's cards do.

import { useCallback, useEffect, useState } from 'react';
import type { Item, TimelineEvent } from '@liveworkspace/index-client';
import { useExplorer } from '../explorer/context';
import { renderTimelineEvent } from '../explorer/TimelinePane';
import { SkeletonRows } from '../explorer/EmptyPane';
import { Dialog, DialogCloseButton, DialogHeader } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { HistoryIcon } from '../ui/library-icons';
import {
  eventLabel,
  eventTone,
  groupByDay,
  timeLabel,
  toneColor,
} from '../timeline/model';
import { isAbort } from '../data/errors';

export const HISTORY_PAGE = 30;

type State = { events: TimelineEvent[]; cursor: string | null; loading: boolean; failed: boolean };

export function HistoryDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const ctx = useExplorer();
  const { client } = ctx;
  const [state, setState] = useState<State>({
    events: [],
    cursor: null,
    loading: true,
    failed: false,
  });
  const read = useCallback(
    (cursor: string | null, signal?: AbortSignal) => {
      setState((s) => ({ ...s, loading: true, failed: false }));
      client
        .timeline(
          { item: item.id, limit: HISTORY_PAGE, ...(cursor ? { cursor } : {}) },
          { signal },
        )
        .then(
          (page) =>
            setState((s) => ({
              events: cursor ? [...s.events, ...page.events] : page.events,
              cursor: page.nextCursor,
              loading: false,
              failed: false,
            })),
          (e: unknown) => {
            if (!isAbort(e)) setState((s) => ({ ...s, loading: false, failed: true }));
          },
        );
    },
    [client, item.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    read(null, controller.signal);
    return () => controller.abort();
  }, [read]);

  const title = item.title || 'Untitled';
  const days = groupByDay(state.events);
  return (
    <Dialog onClose={onClose} ariaLabel={`History of ${title}`} size="lg">
      <DialogHeader title="History" subtitle={title}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4" data-history-dialog="">
        {state.events.length === 0 && state.loading ? (
          <SkeletonRows count={3} />
        ) : state.events.length === 0 && state.failed ? (
          <div className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
            <p>Couldn’t load its history.</p>
            <button
              type="button"
              onClick={() => read(null)}
              className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
            >
              Try again
            </button>
          </div>
        ) : state.events.length === 0 ? (
          <EmptyState
            compact
            icon={<HistoryIcon size={28} />}
            title="Nothing has happened yet"
            description="What is done to it lands here: made, renamed, moved, shared, edited."
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {days.map((day) => (
              <li key={day.key}>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {day.isToday ? 'Today' : day.label}
                </h3>
                <ul className="flex flex-col gap-1">
                  {day.events.map((event) => {
                    const card = renderTimelineEvent(event, ctx);
                    return (
                      <li
                        key={event.id}
                        data-history-event={event.type}
                        className="flex items-baseline gap-2.5 text-sm"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 self-start rounded-full"
                          style={{ background: toneColor(eventTone(event.type)) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            {eventLabel(event)}
                          </span>
                          {card.meta ? (
                            <span className="text-slate-500 dark:text-slate-400"> · {card.meta}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {timeLabel(event.occurredAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {state.cursor && state.events.length > 0 ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={state.loading}
              onClick={() => read(state.cursor)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            >
              {state.loading ? 'Loading…' : 'Show More'}
            </button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
