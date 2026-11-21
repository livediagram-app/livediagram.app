'use client';

// History (livediagram's DocumentHistoryDialog; livediagram/docs/specs/013-workspace/history.md "The dialog"):
// one item's own record of what happened to it, from its menu. A dialog rather than a page, because "what happened
// to this?" is asked while looking at the row. The header shows whose history it is; a strip sums it up; chips narrow it to one kind;
// the events run newest first down a rail under sticky day headings, a run of one kind by one person folded into
// one entry. One `itemHistory` page of 30, and Show older events for the next; nothing else is asked for
// but people's names, from the Explorer's shared people store.

import { Fragment, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { Item, ItemEvent } from '@liveworkspace/index-client';
import { Button, EmptyState } from '@liveworkspace/ui';
import { useExplorer } from '../explorer/context';
import { Dialog } from '../ui/Dialog';
import { HistoryIcon } from '../ui/library-icons';
import { FOCUS_RING } from '../ui/classes';
import { isAbort } from '../data/errors';
import { useNamedEvents } from '../data/names';
import {
  HISTORY_PAGE,
  buildHistory,
  pinHistory,
  summariseHistory,
  type HistoryPinAt,
} from './history';
import { HistoryEntry, type RenderCtx } from './HistoryEntry';
import {
  HistoryHeader,
  HistorySkeleton,
  MUTED,
  SummarySkeleton,
  SummaryStrip,
} from './HistoryParts';
import { ToolFooter } from '@liveworkspace/ui';

export { HISTORY_PAGE };

type State = { events: ItemEvent[]; cursor: string | null; loading: boolean; failed: boolean };

const BUTTON = `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition duration-micro hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300 ${FOCUS_RING}`;

/** What another tool adds to History (Snapshots, owner 2026-11-17): a block over the timeline, and entries laid on its
 *  rail by time, each drawing its own list item (`last` ends the rail). */
export type HistoryPin = HistoryPinAt & { render: (last: boolean) => ReactNode };
/** What the host lays on History: `action`, full width at its foot (Snapshots' Snapshot button); `top`, a block under
 *  the filter (Snapshots' notices); `pins`, entries on the timeline. */
export type HistoryExtras = { action?: ReactNode; top?: ReactNode; pins: readonly HistoryPin[] };

const NO_PINS: readonly HistoryPin[] = [];

export function HistoryDialog({
  item,
  onClose,
  extras,
}: {
  item: Item;
  onClose: () => void;
  extras?: HistoryExtras;
}) {
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
  const summary = useMemo(() => summariseHistory(events), [events]);
  const pins = extras?.pins ?? NO_PINS;
  const days = useMemo(() => pinHistory(buildHistory(events, now), pins, now), [events, now, pins]);

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
  else if (first && pins.length === 0)
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
        <ol aria-label="Events, newest first" className="pb-2">
          {days.map((day) => (
            <li key={day.key} aria-labelledby={`${titleId}-${day.key}`}>
              <h3
                id={`${titleId}-${day.key}`}
                className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-white/90 px-5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur sm:px-6 dark:bg-slate-900/90 dark:text-slate-400"
              >
                <time dateTime={day.key}>{day.label}</time>
                <span className={`font-normal normal-case tracking-normal ${MUTED}`}>
                  {dayCount(day.count, day.pinned)}
                </span>
              </h3>
              <ol className="relative px-5 pb-1 pt-2 sm:px-6">
                {day.entries.map((entry, i) => {
                  const last = i === day.entries.length - 1;
                  return entry.pin ? (
                    <Fragment key={entry.pin.key}>{entry.pin.render(last)}</Fragment>
                  ) : (
                    <HistoryEntry key={entry.run.key} run={entry.run} ctx={renderCtx} last={last} />
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
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
      {first && state.loading ? (
        <SummarySkeleton />
      ) : first ? null : (
        <SummaryStrip
          events={events}
          item={item}
          now={now}
          count={summary.count}
          more={more}
          people={summary.people}
          viewerId={viewerId}
        />
      )}
      {extras?.top ? (
        <div className="shrink-0 border-b border-slate-100 px-5 py-3 sm:px-6 dark:border-slate-800">
          {extras.top}
        </div>
      ) : null}
      <div
        // Never squeezed under a few rows (inside Tools, the strip and the foot share a fixed height): past that the
        // view itself scrolls.
        className="min-h-28 flex-1 overflow-y-auto overscroll-contain"
        data-history-dialog=""
        aria-busy={state.loading || undefined}
      >
        {body}
      </div>
      {/* The host's action, full width at the foot, always in reach whatever the list holds (owner, 2026-11-17). */}
      {extras?.action ? (
        <ToolFooter className="[&>*]:w-full">
          <div data-history-action="" className="flex [&>*]:flex-1">
            {extras.action}
          </div>
        </ToolFooter>
      ) : null}
    </Dialog>
  );
}

// A day's heading count: its events, and its snapshots beside them.
function dayCount(events: number, pinned: number): string {
  const e = events === 1 ? '1 event' : `${events} events`;
  if (!pinned) return e;
  const p = pinned === 1 ? '1 snapshot' : `${pinned} snapshots`;
  return events ? `${e} · ${p}` : p;
}
