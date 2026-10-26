'use client';

// The Inbox (one-explorer-contracts.md "Inbox"): what is outstanding for the person, across every app or this one
// (the header's filter), as a list and a reading pane. The list holds every row newest first under Today, Earlier
// This Week and Older, with a filter bar over it (All, My Actions, Assigned by Me, Comments, Form Responses, each
// with its count, the choice kept per viewer on this device). Choosing a row shows it in the pane beside the list;
// on a phone, and in the editor's narrow panel, the pane takes the list's place with Back (the browser's Back and
// Escape too).
//
// The list is a listbox: focus stays on it while j/k or the arrows move the choice, Enter opens the row (its app, or
// the pane where the pane stands in for the list), r replies and e resolves or marks done where the page can.
// Rows are in ./inbox/InboxRows, the pane in ./inbox/InboxReader, the model in ./inbox/sections.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@liveworkspace/ui';
import { readStored, writeStored } from '../ui/storage';
import { EMPTY_CTA, EmptyPane } from './EmptyPane';
import { useExplorer } from './context';
import { InboxRow, InboxSkeleton, type InboxDensity } from './inbox/InboxRows';
import { InboxReader, type ReaderHandle } from './inbox/InboxReader';
import {
  bucketEdges,
  bucketOf,
  filterEntries,
  inboxEntries,
  inboxFilterCounts,
  inboxSections,
  INBOX_BUCKET_LABEL,
  INBOX_FILTER_LABEL,
  INBOX_FILTER_TELEMETRY,
  INBOX_FILTERS,
  isInboxFilter,
  type InboxBucket,
  type InboxEntry,
  type InboxFilter,
} from './inbox/sections';
import { PaneHeader } from './PaneHeader';
import { useNow } from '../time';

export const INBOX_FILTER_KEY = 'liveworkspace:explorer-inbox-filter';
const filterKey = (viewerId: string | null) => `${INBOX_FILTER_KEY}:${viewerId ?? 'guest'}`;

/** Below this the page shows the list alone and the pane in its place (Tailwind's `md`). */
export const INBOX_STACKED_QUERY = '(max-width: 767px)';

function readFilter(viewerId: string | null): InboxFilter {
  const saved = readStored(filterKey(viewerId));
  return isInboxFilter(saved) ? saved : 'all';
}

// The pane's entry in the browser's history while it stands in for the list, so Back (Android's, iOS's swipe, the
// browser's) returns to the list. The history state is kept as it was (a router's own fields with it).
const PANE_STATE = 'liveworkspaceInboxPane';
const isPaneState = (state: unknown) =>
  Boolean(state && typeof state === 'object' && (state as Record<string, unknown>)[PANE_STATE]);

// `compact`: inside the editor's Explorer panel, under the pane's own header, with the small empty state.
export function InboxPane({
  onOpenNav,
  compact = false,
}: {
  onOpenNav?: () => void;
  compact?: boolean;
}) {
  const { inbox, inboxHost, viewerId, words, filter: appFilter } = useExplorer();
  const onTelemetry = inboxHost?.onTelemetry;
  // `Activity / Opened` once per visit, through the host's hook as it is when the Inbox opens: not per read
  // (returning to the tab re-reads, which is not a visit), nor when the filter or the host's props change.
  const telemetry = useRef(onTelemetry);
  telemetry.current = onTelemetry;
  useEffect(() => {
    telemetry.current?.('Opened');
  }, []);

  const narrow = useMediaQuery(INBOX_STACKED_QUERY);
  const stacked = compact || narrow;
  const density: InboxDensity = compact ? 'compact' : 'comfortable';
  const showApp = appFilter === 'all';

  // The filter bar's choice, per viewer on this device.
  const [chosen, setChosen] = useState<{ viewer: string | null; filter: InboxFilter } | null>(null);
  const filter = chosen && chosen.viewer === viewerId ? chosen.filter : readFilter(viewerId);

  // Rows whose work was done from the pane this visit: gone from the list at once, though the index may list them
  // until the app's next push.
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const entries = useMemo(() => {
    const all = inboxEntries(inboxSections(inbox.data, viewerId));
    return gone.size ? all.filter((e) => !gone.has(e.key)) : all;
  }, [inbox.data, viewerId, gone]);
  const counts = useMemo(() => inboxFilterCounts(entries), [entries]);
  const visible = useMemo(() => filterEntries(entries, filter), [entries, filter]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  const picked = selectedKey ? visible.find((e) => e.key === selectedKey) : undefined;
  // Side by side, the pane always shows something: the choice, else the first row.
  const selected = picked ?? (stacked ? undefined : visible[0]);
  const selectedIndex = selected ? visible.indexOf(selected) : -1;
  const showPane = stacked ? paneOpen && Boolean(picked) : Boolean(selected);

  const [message, setMessage] = useState('');
  const announce = useCallback((m: string) => setMessage(m), []);
  const listRef = useRef<HTMLUListElement>(null);
  const reader = useRef<ReaderHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const rowId = (i: number) => `${baseId}-row-${i}`;
  const scrollTo = useRef<number | null>(null);

  const setFilter = (next: InboxFilter) => {
    if (next === filter) return;
    setChosen({ viewer: viewerId, filter: next });
    writeStored(filterKey(viewerId), next);
    setSelectedKey(null);
    onTelemetry?.('Changed', INBOX_FILTER_TELEMETRY[next]);
    const n = next === 'all' ? counts.all : counts[next];
    announce(`${INBOX_FILTER_LABEL[next]}: ${n} ${n === 1 ? 'row' : 'rows'}`);
  };

  // The pane stands in for the list: an entry in the browser's history, so Back returns to the list.
  const pushed = useRef(false);
  const openPane = useCallback((key: string) => {
    setSelectedKey(key);
    setPaneOpen(true);
  }, []);
  const closePane = useCallback(() => {
    setPaneOpen(false);
    if (pushed.current) {
      pushed.current = false;
      try {
        window.history.back();
      } catch {
        // No history to step back through.
      }
    }
    requestAnimationFrame(() => listRef.current?.focus());
  }, []);
  const paneStands = stacked && showPane;
  useEffect(() => {
    if (!paneStands) {
      // The open row went (its work done, or gone from the index) while its entry stood: step back off it, so
      // the next Back leaves the list instead of doing nothing.
      if (pushed.current) {
        pushed.current = false;
        try {
          if (isPaneState(window.history.state)) window.history.back();
        } catch {
          // No history to step back through.
        }
      }
      return;
    }
    try {
      const state: unknown = window.history.state;
      const next = { ...(state && typeof state === 'object' ? state : {}), [PANE_STATE]: true };
      // The pane's entry is already on top (a step back still on its way): take it over rather than stack another.
      if (isPaneState(state)) window.history.replaceState(next, '');
      else window.history.pushState(next, '');
      pushed.current = true;
    } catch {
      // A sandboxed frame: Back stays the page's.
    }
    const onPop = () => {
      pushed.current = false;
      setPaneOpen(false);
    };
    window.addEventListener('popstate', onPop);
    reader.current?.focusTitle();
    return () => window.removeEventListener('popstate', onPop);
  }, [paneStands]);

  const onPick = useCallback(
    (key: string) => {
      if (stacked) openPane(key);
      else setSelectedKey(key);
    },
    [stacked, openPane],
  );

  const move = (to: number) => {
    if (visible.length === 0) return;
    const i = Math.max(0, Math.min(visible.length - 1, to));
    setSelectedKey(visible[i]!.key);
    scrollTo.current = i;
  };
  useEffect(() => {
    const i = scrollTo.current;
    if (i === null) return;
    scrollTo.current = null;
    document.getElementById(rowId(i))?.scrollIntoView?.({ block: 'nearest' });
  });

  const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const at = selectedIndex;
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        move(at < 0 ? 0 : at + 1);
        return;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        move(at < 0 ? 0 : at - 1);
        return;
      case 'Home':
        e.preventDefault();
        move(0);
        return;
      case 'End':
        e.preventDefault();
        move(visible.length - 1);
        return;
      case 'Enter':
      case ' ':
        if (!selected) return;
        e.preventDefault();
        if (stacked) openPane(selected.key);
        else if (e.key === 'Enter') reader.current?.open();
        return;
    }
  };

  // r and e anywhere in the Inbox but a field; Escape returns from the pane to the list.
  const onRootKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Escape' && paneStands) {
      e.preventDefault();
      closePane();
      return;
    }
    if (!showPane) return;
    if (e.key === 'r' && reader.current?.reply()) e.preventDefault();
    else if (e.key === 'e' && reader.current?.primary()) e.preventDefault();
  };

  const onGone = useCallback(
    (key: string) => {
      setGone((prev) => new Set(prev).add(key));
      if (stacked) closePane();
      else listRef.current?.focus();
    },
    [stacked, closePane],
  );

  const retry = () => {
    onTelemetry?.('Loaded', 'Retry');
    inbox.reload();
  };
  const help = inboxHost?.actionsHelpHref;
  const listLabel = `Inbox, ${INBOX_FILTER_LABEL[filter]}`;

  let body: React.ReactNode;
  if (inbox.error) {
    body = (
      <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Couldn’t load your Inbox
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Check your connection and try again.
        </p>
        <button type="button" onClick={retry} className={`mt-3 ${EMPTY_CTA}`}>
          Try again
        </button>
      </div>
    );
  } else if (inbox.loading) {
    body = <InboxSkeleton count={4} density={density} />;
  } else if (entries.length === 0) {
    body = (
      <EmptyPane view={{ kind: 'inbox' }} words={words} compact={compact}>
        {help ? (
          <a href={help} target="_blank" rel="noreferrer noopener" className={EMPTY_CTA}>
            How actions work
          </a>
        ) : null}
      </EmptyPane>
    );
  } else {
    const list = (
      <div className="flex min-h-0 min-w-0 flex-col" data-inbox-list="">
        <FilterBar filter={filter} counts={counts} onChange={setFilter} compact={compact} />
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Nothing in {INBOX_FILTER_LABEL[filter]}
            </p>
            <button type="button" onClick={() => setFilter('all')} className={`mt-3 ${EMPTY_CTA}`}>
              Show all
            </button>
          </div>
        ) : null}
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={listLabel}
          aria-activedescendant={selectedIndex >= 0 ? rowId(selectedIndex) : undefined}
          onKeyDown={onListKey}
          hidden={visible.length === 0}
          className="group/list min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <Rows
            visible={visible}
            selectedKey={selected?.key ?? null}
            rowId={rowId}
            showApp={showApp}
            density={density}
            viewerId={viewerId}
            onPick={onPick}
          />
        </ul>
      </div>
    );
    const pane = selected ? (
      <InboxReader
        ref={reader}
        // No key: one pane patched in place as the choice moves (it resets its draft itself), not remounted per row.
        entry={selected}
        showApp={showApp}
        onBack={stacked ? closePane : undefined}
        onGone={onGone}
        announce={announce}
      />
    ) : null;
    if (stacked) {
      body = paneStands ? (
        <div
          data-inbox-pane="standing"
          className={
            compact
              ? 'px-4 pb-6 pt-1'
              : 'fixed inset-0 z-40 overflow-y-auto bg-white px-4 pb-10 pt-3 dark:bg-slate-900'
          }
        >
          {pane}
        </div>
      ) : (
        <div
          className={
            compact
              ? ''
              : 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800'
          }
        >
          {list}
        </div>
      );
    } else {
      body = (
        <div className="grid h-[calc(100dvh-11rem)] min-h-[32rem] grid-cols-[22rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex min-h-0 flex-col border-r border-slate-200 dark:border-slate-700">
            {list}
          </div>
          <div data-inbox-pane="beside" className="min-h-0 overflow-y-auto px-8 py-6">
            {pane}
          </div>
        </div>
      );
    }
  }

  return (
    <div data-explorer-view="inbox" ref={rootRef} onKeyDown={onRootKey} className="min-w-0">
      {compact || paneStands ? null : <PaneHeader title="Inbox" onOpenNav={onOpenNav} />}
      {body}
      <p className="sr-only" aria-live="polite" data-inbox-live="">
        {message}
      </p>
    </div>
  );
}

/** The list's rows under their date dividers. Moving the choice re-renders the two rows it moved between. */
function Rows({
  visible,
  selectedKey,
  rowId,
  showApp,
  density,
  viewerId,
  onPick,
}: {
  visible: readonly InboxEntry[];
  selectedKey: string | null;
  rowId: (i: number) => string;
  showApp: boolean;
  density: InboxDensity;
  viewerId: string | null;
  onPick: (key: string) => void;
}) {
  const now = useNow();
  const edges = bucketEdges(now || Date.now());
  const out: React.ReactNode[] = [];
  let last: InboxBucket | null = null;
  visible.forEach((e, i) => {
    const b = bucketOf(e.at, edges);
    if (b !== last) {
      last = b;
      out.push(
        <li
          key={`h:${b}`}
          role="presentation"
          data-inbox-bucket={b}
          className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          {INBOX_BUCKET_LABEL[b]}
        </li>,
      );
    }
    out.push(
      <InboxRow
        key={e.key}
        entry={e}
        id={rowId(i)}
        selected={e.key === selectedKey}
        showApp={showApp}
        density={density}
        viewerId={viewerId}
        onPick={onPick}
      />,
    );
  });
  return <>{out}</>;
}

/** All, My Actions, Assigned by Me, Comments, Form Responses, each with its count. On a phone a chip row that
 *  scrolls sideways inside its own strip, so the page never does. */
function FilterBar({
  filter,
  counts,
  onChange,
  compact,
}: {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (f: InboxFilter) => void;
  compact: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Inbox filters"
      data-inbox-filters=""
      className={`flex min-w-0 shrink-0 gap-1.5 border-b border-slate-200 py-2 dark:border-slate-700 ${
        compact
          ? 'overflow-x-auto px-3 [scrollbar-width:none]'
          : 'px-3 max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] md:flex-wrap'
      }`}
    >
      {INBOX_FILTERS.map((f) => {
        const on = f === filter;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={on}
            data-inbox-filter={f}
            onClick={() => onChange(f)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 motion-reduce:transition-none ${
              compact ? 'min-h-11' : 'min-h-8 max-md:min-h-11'
            } ${
              on
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50'
            }`}
          >
            {INBOX_FILTER_LABEL[f]}
            <span
              className={`tabular-nums ${on ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {counts[f]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
