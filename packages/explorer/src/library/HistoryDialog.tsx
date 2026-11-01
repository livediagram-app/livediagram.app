'use client';

// History (livediagram's DocumentHistoryDialog; livediagram/docs/specs/013-workspace/timeline.md "Beyond the feed"):
// one item's own Timeline, from its menu. A dialog rather than a page, because "what happened to this?" is asked
// while looking at the row. The header shows whose history it is; a strip sums it up; chips narrow it to one kind;
// the events run newest first down a rail under sticky day headings, a run of one kind by one person folded into
// one entry. One `GET /timeline?item=` page of 30, and Show older events for the next; nothing else is asked for
// but people's names, from the Explorer's shared people store.

import { memo, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { Item, TimelineEvent } from '@liveworkspace/index-client';
import { EmptyState, PictureDisc } from '@liveworkspace/ui';
import { usePersonPicture } from '../data/usePeople';
import { useExtras } from '../explorer/extras';
import { useExplorer, type ExplorerContextValue } from '../explorer/context';
import { actorWords, renderTimelineEvent } from '../explorer/TimelinePane';
import { AppMark } from '../explorer/badges';
import { useOwnerLabel } from '../explorer/rows';
import { Dialog, DialogCloseButton } from '../ui/Dialog';
import { HistoryIcon } from '../ui/library-icons';
import { ChevronDownIcon, Glyph, ItemIcon } from '../ui/icons';
import { avatarFill } from '../ui/avatar-fill';
import { FOCUS_RING } from '../ui/classes';
import { eventIcon } from '../timeline/icons';
import {
  CATEGORY_LABELS,
  eventLabel,
  eventTone,
  timeLabel,
  TONE_INKS,
  toneColor,
  toneSoftColor,
  type TimelineCategory,
} from '../timeline/model';
import { initials, personName } from '../timeline/whatHappened';
import { isAbort } from '../data/errors';
import { useNamedEvents } from '../data/names';
import { relativeSince } from '../time';
import { kindWords } from '../words';
import {
  HISTORY_PAGE,
  buildHistory,
  eventCountLabel,
  filterHistory,
  historyCategories,
  personColour,
  summariseHistory,
  type HistoryRun,
} from './history';

export { HISTORY_PAGE };

type State = { events: TimelineEvent[]; cursor: string | null; loading: boolean; failed: boolean };

type RenderCtx = Parameters<typeof renderTimelineEvent>[1];

const MUTED = 'text-slate-500 dark:text-slate-400';
const BUTTON = `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition duration-micro hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300 ${FOCUS_RING}`;

const fullDate = (at: number) =>
  new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const iso = (at: number) => new Date(at).toISOString();

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
        .timeline({ item: item.id, limit: HISTORY_PAGE, ...(cursor ? { cursor } : {}) }, { signal })
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
  const [category, setCategory] = useState<TimelineCategory | null>(null);
  const chips = useMemo(() => historyCategories(events), [events]);
  const summary = useMemo(() => summariseHistory(events), [events]);
  // A chip whose kind has gone (never, with paging only adding) would leave the list empty: fall back to All.
  const active = category && chips.some((c) => c.category === category) ? category : null;
  const days = useMemo(
    () => buildHistory(filterHistory(events, active), now),
    [events, active, now],
  );

  const { renderThumbnail, openItem, navigate, teamName } = ctx;
  // What each event says, as the Timeline's cards say it; no app mark (it is all one item's) and no picture.
  const renderCtx: RenderCtx = useMemo(
    () => ({ viewerId, filter: 'app', renderThumbnail: undefined, openItem, navigate, teamName }),
    [viewerId, openItem, navigate, teamName],
  );

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
            <button
              type="button"
              disabled={state.loading}
              aria-busy={state.loading || undefined}
              onClick={() => read(state.cursor)}
              className={BUTTON}
            >
              {state.loading ? 'Loading…' : state.failed ? 'Try again' : 'Show older events'}
            </button>
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
      <HistoryHeader
        item={item}
        titleId={titleId}
        renderThumbnail={renderThumbnail}
        onClose={onClose}
      />
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

function HistoryHeader({
  item,
  titleId,
  renderThumbnail,
  onClose,
}: {
  item: Item;
  titleId: string;
  renderThumbnail: ExplorerContextValue['renderThumbnail'];
  onClose: () => void;
}) {
  const owner = useOwnerLabel(item, true);
  const thumb = renderThumbnail?.(item, 'row');
  const title = item.title || 'Untitled';
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 dark:border-slate-800">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 [&>*]:max-h-full [&>*]:max-w-full [&_svg]:h-6 [&_svg]:w-6">
        {thumb ?? <ItemIcon size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
          History
        </p>
        <h2
          id={titleId}
          className="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
          title={title}
        >
          {title}
        </h2>
        <p className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}`}>
          <AppMark app={item.app} size={14} />
          <span aria-hidden>{kindWords(item.app).one}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            <span className="sr-only">Owner: </span>
            {owner}
          </span>
        </p>
      </div>
      <DialogCloseButton onClick={onClose} />
    </div>
  );
}

function SummaryStrip({
  item,
  now,
  count,
  more,
  people,
  viewerId,
}: {
  item: Item;
  now: number;
  count: number;
  more: boolean;
  people: TimelineEvent[];
  viewerId: string | null;
}) {
  const stat = 'flex min-w-0 flex-col gap-0.5';
  const term = `text-[10px] font-semibold uppercase tracking-wider ${MUTED}`;
  const value = 'truncate text-sm font-medium text-slate-800 dark:text-slate-100';
  return (
    <dl
      data-history-summary=""
      className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:grid-cols-4 sm:px-6 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <div className={stat}>
        <dt className={term}>Created</dt>
        <dd className={value}>
          <time dateTime={iso(item.createdAt)} title={fullDate(item.createdAt)}>
            {fullDate(item.createdAt)}
          </time>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>Last changed</dt>
        <dd className={value}>
          <time dateTime={iso(item.updatedAt)} title={fullDate(item.updatedAt)}>
            {relativeSince(item.updatedAt, now)}
          </time>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>People</dt>
        <dd className={`flex items-center gap-1.5 ${value}`}>
          <span className="flex -space-x-1" aria-hidden>
            {people.slice(0, 3).map((e) => (
              <PersonAvatar key={e.actorId} event={e} viewerId={viewerId} size={22} ring />
            ))}
          </span>
          <span>
            {people.length}
            {more ? '+' : ''}
          </span>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>Events</dt>
        <dd className={value}>{eventCountLabel(count, more)}</dd>
      </div>
    </dl>
  );
}

function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition duration-micro ${FOCUS_RING} ${
        on
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'
      }`}
    >
      {label}
      <span className={`tabular-nums ${on ? 'text-white/80' : MUTED}`}>{count}</span>
    </button>
  );
}

/** A person's initials on a disc in their colour; the reader is "You", and someone unnamed wears the person glyph. */
function PersonAvatar({
  event,
  viewerId,
  size,
  ring = false,
}: {
  event: TimelineEvent;
  viewerId: string | null;
  size: number;
  ring?: boolean;
}) {
  const mine = Boolean(viewerId && event.actorId === viewerId);
  const letters = mine ? null : initials(personName(event));
  // The reader wears the brand; someone unnamed or a closed account stays grey. Anyone else with a Google picture
  // shows it over their disc (the one people store, which names them too).
  const fill = !mine && letters && event.actorId ? avatarFill(personColour(event.actorId)) : null;
  const { people } = useExtras();
  const picture = usePersonPicture(
    people,
    !mine && event.actorId && event.actorId !== 'deleted' ? event.actorId : null,
  );
  return (
    <PictureDisc
      aria-hidden
      pictureUrl={picture}
      name={personName(event)}
      size={size}
      className={`font-semibold text-white [&_svg]:h-[60%] [&_svg]:w-[60%] ${
        fill ? '' : mine ? 'bg-brand-700 dark:bg-brand-600' : 'bg-slate-400 dark:bg-slate-600'
      } ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''}`}
      style={{
        fontSize: Math.round(size * 0.42),
        ...(fill ? { backgroundColor: fill } : null),
      }}
    >
      {letters ?? <PersonGlyph />}
    </PictureDisc>
  );
}

function PersonGlyph() {
  return (
    <Glyph size={24} units={24}>
      <path d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" />
    </Glyph>
  );
}

/** The detail after the reason, without the "by …" the avatar line already says. */
function detailOf(meta: ReactNode): string | null {
  if (typeof meta !== 'string') return null;
  const parts = meta.split(' · ').filter((p) => !p.startsWith('by '));
  return parts.length ? parts.join(' · ') : null;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const HistoryEntry = memo(function HistoryEntry({
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
  const card = renderTimelineEvent(event, ctx);
  const tone = eventTone(event.type);
  const many = run.events.length;
  const who = cap(actorWords(event, ctx.viewerId ?? null));
  const detail = many > 1 ? null : detailOf(card.meta);
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
          <PersonAvatar event={event} viewerId={ctx.viewerId ?? null} size={16} />
          <span className="truncate">
            <span className="font-medium text-slate-700 dark:text-slate-200">{who}</span>
            {detail ? ` · ${detail}` : ''}
          </span>
        </p>
        {card.description && many === 1 ? (
          <blockquote className="mt-1.5 line-clamp-3 rounded-lg border-l-2 border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {card.description}
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
                  const d = detailOf(renderTimelineEvent(e, ctx).meta);
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

function HistorySkeleton() {
  const bar = 'rounded bg-slate-200/80 motion-safe:animate-pulse dark:bg-slate-700/70';
  return (
    <div aria-busy="true" aria-label="Loading history" className="px-5 py-4 sm:px-6">
      <span className={`mb-4 block h-3 w-20 ${bar}`} />
      {[0.7, 0.5, 0.6, 0.4].map((w, i) => (
        <div key={i} className="flex gap-3 pb-5">
          <span className={`h-8 w-8 shrink-0 rounded-full ${bar}`} />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className={`h-3.5 ${bar}`} style={{ width: `${w * 100}%` }} />
            <span className={`h-3 w-1/3 ${bar}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
