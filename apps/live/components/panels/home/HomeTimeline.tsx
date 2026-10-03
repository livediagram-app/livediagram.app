'use client';

// Home's Timeline column (docs/specs/013-workspace/explorer-home.md "Timeline"): the person's own
// created, updated and opened documents, one per document per day, as snapshot thumbnails on
// alternating sides of a centre line, under day markers. No panel of its own: it sits on the page.
// A reserved slot at its foot loads the next page as it nears the viewport, and holds the loading
// row or Try again in the same box, so nothing moves when a page lands.

import { useEffect, useMemo, useRef } from 'react';
import type { HomeTimelineEntry } from '@livediagram/api-schema';
import { dateKey, Tooltip } from '@livediagram/ui';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { track } from '@/lib/telemetry';
import { useNow } from '@/hooks/ui/useNow';
import { clockTime, HOME_COPY, timelineEntryLabel } from '@/app/explorer/home/home-copy';
import {
  foldTimeline,
  homeDocumentHref,
  timelineRows,
  type TimelineSide,
} from '@/app/explorer/home/home-model';
import type { HomePaging } from '@/app/explorer/home/useHome';
import { KIND_TONES, KindGlyph } from './home-icons';
import { TimelineEntrySkeleton, TimelineSkeleton } from './HomeSkeletons';
import {
  ENTRY_GRID,
  ENTRY_HEIGHT,
  ENTRY_NAME_WIDTH,
  ENTRY_THUMB,
  FOCUS_RING,
  MARKER_OFFSET,
  MUTED,
  TIME_OFFSET,
} from './home-styles';

/** A page lands before the reader reaches the end. */
const PAGING_ROOT_MARGIN = '400px';

export function HomeTimeline({
  ownerId,
  entries,
  loading,
  hasMore,
  paging,
  onLoadMore,
  onRetryMore,
  labelledBy,
}: {
  ownerId: string;
  entries: HomeTimelineEntry[];
  loading: boolean;
  hasMore: boolean;
  paging: HomePaging;
  onLoadMore: () => void;
  onRetryMore: () => void;
  labelledBy: string;
}) {
  // Today and Yesterday as of this visit: a page left open past midnight keeps its headings.
  const now = useNow(false);
  const rows = useMemo(() => timelineRows(foldTimeline(entries, dateKey), now), [entries, now]);

  if (loading) return <TimelineSkeleton />;
  if (rows.length === 0) {
    return <p className={`py-6 text-sm ${MUTED}`}>{HOME_COPY.timelineEmpty}</p>;
  }

  return (
    <ol aria-labelledby={labelledBy} className="relative flex flex-col gap-4 pb-2">
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-700"
      />
      {rows.map((row) =>
        row.type === 'day' ? (
          <li key={`day:${row.key}`} className="relative flex justify-center">
            <span className="rounded-full bg-slate-50 px-2 text-[11px] font-semibold leading-5 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              {row.label}
            </span>
          </li>
        ) : (
          <TimelineEntry key={row.entry.id} ownerId={ownerId} entry={row.entry} side={row.side} />
        ),
      )}
      {hasMore ? (
        <PagingSlot paging={paging} onLoadMore={onLoadMore} onRetry={onRetryMore} />
      ) : null}
    </ol>
  );
}

function TimelineEntry({
  ownerId,
  entry,
  side,
}: {
  ownerId: string;
  entry: HomeTimelineEntry;
  side: TimelineSide;
}) {
  const link = (
    <Tooltip label={entry.name}>
      <a
        href={homeDocumentHref(entry)}
        aria-label={timelineEntryLabel(entry)}
        onClick={() => track('Home', 'Selected', 'Timeline')}
        className={`group block rounded-md ${FOCUS_RING} ${side === 'start' ? 'justify-self-end' : 'justify-self-start'}`}
      >
        <DocumentThumbnail
          ownerId={ownerId}
          documentId={entry.documentId}
          version={entry.savedAt}
          shareCode={entry.via === 'shared' ? entry.shareCode : null}
          empty={entry.empty}
          className={`${ENTRY_THUMB} rounded-md border border-slate-200 bg-white transition group-hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-slate-500`}
        />
        <span
          className={`mt-1 block truncate text-[11px] leading-4 text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100 ${ENTRY_NAME_WIDTH} ${side === 'start' ? 'text-right' : ''}`}
        >
          {entry.name}
        </span>
      </a>
    </Tooltip>
  );
  const time = (
    <span
      aria-hidden
      className={`${TIME_OFFSET} text-[11px] leading-4 tabular-nums ${MUTED} ${side === 'start' ? 'justify-self-start' : 'justify-self-end'}`}
    >
      {clockTime(entry.occurredAt)}
    </span>
  );
  return (
    <li data-side={side} className={`relative ${ENTRY_GRID}`}>
      {side === 'start' ? link : time}
      <span
        aria-hidden
        data-kind={entry.kind}
        className={`${MARKER_OFFSET} flex h-5 w-5 items-center justify-center justify-self-center rounded-full bg-slate-50 ring-2 dark:bg-slate-900 ${KIND_TONES[entry.kind]}`}
      >
        <KindGlyph kind={entry.kind} />
      </span>
      {side === 'start' ? time : link}
    </li>
  );
}

function PagingSlot({
  paging,
  onLoadMore,
  onRetry,
}: {
  paging: HomePaging;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || paging !== 'idle' || typeof IntersectionObserver === 'undefined') return;
    // Re-observed whenever paging settles, so a short page that leaves the slot in view still
    // asks for the next one (an observer only reports changes).
    const observer = new IntersectionObserver(
      (seen) => {
        if (seen.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: PAGING_ROOT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [paging, onLoadMore]);

  return (
    <li
      ref={ref}
      data-testid="home-timeline-paging"
      aria-busy={paging === 'loading'}
      className={ENTRY_HEIGHT}
    >
      {paging === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <p className={`text-xs ${MUTED}`}>{HOME_COPY.pageFailed}</p>
          <button
            type="button"
            onClick={onRetry}
            className={`min-h-6 rounded-md px-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300 ${FOCUS_RING}`}
          >
            {HOME_COPY.tryAgain}
          </button>
        </div>
      ) : (
        <TimelineEntrySkeleton side="start" visible={paging === 'loading'} />
      )}
    </li>
  );
}
