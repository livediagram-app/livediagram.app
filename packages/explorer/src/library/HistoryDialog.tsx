'use client';

// History (livediagram's DocumentHistoryDialog; livediagram/docs/specs/013-workspace/history.md "The dialog"):
// one item's own record of what happened to it, from its menu. A dialog rather than a page, because "what happened
// to this?" is asked while looking at the row. The header shows whose history it is; a strip sums it up; chips narrow it to one kind;
// the events run newest first down a rail under sticky day headings, a run of one kind by one person folded into
// one entry. One `itemHistory` page of 30, and Show older events for the next; nothing else is asked for
// but people's names, from the Explorer's shared people store.

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { Item, ItemEvent } from '@liveworkspace/index-client';
import { Button, EmptyState } from '@liveworkspace/ui';
import { useExplorer } from '../explorer/context';
import { Dialog } from '../ui/Dialog';
import { HistoryIcon } from '../ui/library-icons';
import { FOCUS_RING } from '../ui/classes';
import { CATEGORY_LABELS, type EventCategory } from './history-model';
import { isAbort } from '../data/errors';
import { useNamedEvents } from '../data/names';
import {
  HISTORY_PAGE,
  buildHistory,
  filterHistory,
  historyCategories,
  summariseHistory,
} from './history';
import { HistoryEntry, type RenderCtx } from './HistoryEntry';
import { Chip, HistoryHeader, HistorySkeleton, MUTED, SummaryStrip } from './HistoryParts';

export { HISTORY_PAGE };

type State = { events: ItemEvent[]; cursor: string | null; loading: boolean; failed: boolean };

const BUTTON = `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition duration-micro hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300 ${FOCUS_RING}`;

export function HistoryDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const ctx = useExplorer();
  const { client, viewerId } = ctx;
  const titleId = useId();
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
        .itemHistory(item.id, { limit: HISTORY_PAGE, ...(cursor ? { cursor } : {}) }, { signal })
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

  // Who did it, by name: the index keeps ids only.
  const events = useNamedEvents(state.events);
  // One clock for the dialog, so the day headings and "2 hours ago" agree and never shift while it is read.
  const [now] = useState(() => Date.now());
  const [category, setCategory] = useState<EventCategory | null>(null);
  const chips = useMemo(() => historyCategories(events), [events]);
  const summary = useMemo(() => summariseHistory(events), [events]);
  // A chip whose kind has gone (never, with paging only adding) would leave the list empty: fall back to All.
  const active = category && chips.some((c) => c.category === category) ? category : null;
  const days = useMemo(
    () => buildHistory(filterHistory(events, active), now),
    [events, active, now],
  );

  const { teamName } = ctx;
  const renderCtx: RenderCtx = useMemo(() => ({ viewerId, teamName }), [viewerId, teamName]);

  const title = item.title || 'Untitled';
  const more = Boolean(state.cursor);
  const first = state.events.length === 0;

  let body: ReactNode;
  if (first && state.loading) body = <HistorySkeleton />;
  else if (first && state.failed)
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300 [&_svg]:h-5 [&_svg]:w-5">
          <HistoryIcon size={20} />
        </span>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Couldn’t load its history
        </p>
        <p className={`-mt-2 text-xs ${MUTED}`}>Check your connection, then try again.</p>
        <button type="button" onClick={() => read(null)} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  else if (first)
    body = (
      <EmptyState
        compact
        icon={<HistoryIcon size={28} />}
        title="Nothing has happened yet"
        description="What is done to it lands here: made, renamed, moved, shared, edited."
      />
    );
  else
    body = (
      <>
        {days.length === 0 ? (
          <p className={`px-5 py-10 text-center text-sm sm:px-6 ${MUTED}`} data-history-none="">
            No {CATEGORY_LABELS[active!].toLowerCase()} in the {state.events.length} events loaded.{' '}
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`font-medium text-brand-700 underline-offset-2 transition duration-micro hover:underline dark:text-brand-300 ${FOCUS_RING}`}
            >
              Show all
            </button>
          </p>
        ) : (
          <ol aria-label="Events, newest first" className="pb-2">
            {days.map((day) => (
              <li key={day.key} aria-labelledby={`${titleId}-${day.key}`}>
                <h3
                  id={`${titleId}-${day.key}`}
                  className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-slate-100 bg-white/90 px-5 py-2 text-xs font-semibold text-slate-700 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200"
                >
                  <time dateTime={day.key}>{day.label}</time>
                  <span className={`font-normal ${MUTED}`}>
                    {day.count === 1 ? '1 event' : `${day.count} events`}
                  </span>
                </h3>
                <ol className="relative px-5 pb-1 pt-3 sm:px-6">
                  {day.runs.map((run, i) => (
                    <HistoryEntry
                      key={run.key}
                      run={run}
                      ctx={renderCtx}
                      last={i === day.runs.length - 1}
                    />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
        {more || state.failed ? (
          <div className="flex flex-col items-center gap-2 px-5 pb-6 pt-2">
            {state.failed ? (
              <p role="alert" className="text-xs text-red-700 dark:text-red-300">
                Couldn’t load older events.
              </p>
            ) : null}
            <Button
              variant="none"
              busy={state.loading}
              onClick={() => read(state.cursor)}
              className={BUTTON}
            >
              {state.loading ? 'Loading…' : state.failed ? 'Try again' : 'Show older events'}
            </Button>
            <p className={`text-[11px] ${MUTED}`} aria-live="polite">
              {state.events.length} shown
            </p>
          </div>
        ) : state.events.length > HISTORY_PAGE ? (
          <p className={`px-5 pb-6 pt-2 text-center text-[11px] ${MUTED}`}>
            The beginning of its history
          </p>
        ) : null}
      </>
    );

  return (
    <Dialog
      onClose={onClose}
      ariaLabel={`History of ${title}`}
      size="xl"
      className="sm:max-h-[min(46rem,calc(100dvh-4rem))]"
    >
      <HistoryHeader item={item} titleId={titleId} onClose={onClose} />
      {first ? null : (
        <SummaryStrip
          item={item}
          now={now}
          count={summary.count}
          more={more}
          people={summary.people}
          viewerId={viewerId}
        />
      )}
      {chips.length > 1 ? (
        <div
          role="group"
          aria-label="Filter by kind"
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 px-5 py-2.5 sm:flex-wrap sm:px-6 dark:border-slate-800"
        >
          <Chip
            label="All"
            count={state.events.length}
            on={active === null}
            onClick={() => setCategory(null)}
          />
          {chips.map((c) => (
            <Chip
              key={c.category}
              label={CATEGORY_LABELS[c.category]}
              count={c.count}
              on={active === c.category}
              onClick={() => setCategory(active === c.category ? null : c.category)}
            />
          ))}
        </div>
      ) : null}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-history-dialog=""
        aria-busy={state.loading || undefined}
      >
        {body}
      </div>
    </Dialog>
  );
}
