'use client';

// A place that is empty in this app but holds other apps' items (liveworkspace/docs/specs/004-index/one-explorer.md "A place that
// is empty here but not elsewhere"): instead of "This folder is empty", a fan of those items' own cards, each in its
// app's colour, what they are, and Show All Apps to see them. So a folder full of plans never reads as empty in
// livediagram, and nobody deletes it thinking so.

import type { CSSProperties } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { OtherApps } from '../data/useOtherApps';
import type { ExplorerView } from '../views';
import { FOCUS_RING } from '../ui/classes';
import { ItemIcon, PlusIcon } from '../ui/icons';
import { kindWords, siteOf } from '../words';
import { AppMark } from './badges';
import { useExplorer } from './context';
import { EMPTY_CTA } from './EmptyPane';

// The fan: each sheet's turn and offset, the middle one on top.
const FAN = [
  'left-1/2 -translate-x-[115%] rotate-[-9deg] group-hover/fan:-translate-x-[125%] group-hover/fan:rotate-[-13deg]',
  'left-1/2 -translate-x-[-15%] rotate-[9deg] group-hover/fan:-translate-x-[-25%] group-hover/fan:rotate-[13deg]',
  'left-1/2 -translate-x-1/2 z-10 -translate-y-1 group-hover/fan:-translate-y-3',
];

/** "3 plans", "1 document". */
function countOf(app: App, n: number): string {
  const w = kindWords(app);
  return `${n} ${n === 1 ? w.lowerOne : w.lowerMany}`;
}

/** "3 plans and 1 document", "3 plans, 2 designs and 1 document". */
export function otherAppsPhrase(counts: readonly [App, number][], more: boolean): string {
  const parts = counts.map(([app, n]) => countOf(app, n));
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
  return more ? `at least ${list}` : list;
}

function placeName(view: ExplorerView): string {
  switch (view.kind) {
    case 'folder':
      return 'This folder';
    case 'team':
      return view.folderId ? 'This folder' : 'This team';
    default:
      return 'My Work';
  }
}

export function OtherAppsHere({
  view,
  others,
  onCreate,
  compact = false,
}: {
  view: ExplorerView;
  others: OtherApps;
  onCreate?: () => void;
  // Sized for the editors' Explorer panel.
  compact?: boolean;
}) {
  const { app, kind, setFilter, renderThumbnail, renderAppLogo } = useExplorer();
  // The middle sheet is the first item, so the fan reads from its centre.
  const sheets =
    others.items.length === 3
      ? [others.items[1]!, others.items[2]!, others.items[0]!]
      : others.items;
  const fan = sheets.length === 1 ? [FAN[2]!] : sheets.length === 2 ? [FAN[0]!, FAN[1]!] : FAN;
  return (
    <div
      data-other-apps=""
      className={`relative flex flex-col items-center overflow-hidden text-center ${
        compact
          ? 'px-3 py-8'
          : 'rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-6 py-12 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/60'
      }`}
    >
      <div
        aria-hidden
        className={`group/fan relative max-w-full ${compact ? 'mb-5 h-24 w-56' : 'mb-7 h-32 w-72'}`}
      >
        {sheets.map((item, i) => {
          const site = siteOf(item.app);
          return (
            <span
              key={item.id}
              style={{ '--accent': site.accent } as CSSProperties}
              className={`absolute top-2 flex flex-col ${compact ? 'h-20 w-28' : 'h-28 w-36'} overflow-hidden rounded-xl border-2 border-[var(--accent)] bg-white shadow-lg shadow-slate-900/10 transition-transform duration-300 motion-reduce:transition-none dark:bg-slate-800 ${fan[i]}`}
            >
              <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50 text-[var(--accent)] dark:bg-slate-900 [&_svg]:h-7 [&_svg]:w-7">
                {renderThumbnail?.(item, 'card') ?? <ItemIcon />}
              </span>
              <span className="flex items-center gap-1.5 border-t border-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <AppMark app={item.app} size={12} />
                <span className="truncate">{site.name}</span>
              </span>
            </span>
          );
        })}
      </div>
      <h2
        className={`font-semibold text-slate-900 dark:text-slate-100 ${compact ? 'text-sm' : 'text-base'}`}
      >
        {placeName(view)} isn’t empty
      </h2>
      <p
        className={`mt-1.5 max-w-md leading-relaxed text-slate-500 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        It holds {otherAppsPhrase(others.counts, others.more)} from other apps, hidden while you see
        only {kind.lowerMany}.
      </p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {others.counts.map(([other, n]) => (
          <li
            key={other}
            data-other-app={other}
            style={{ '--accent': siteOf(other).accent } as CSSProperties}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <AppMark app={other} size={14} />
            {countOf(other, n)} in {siteOf(other).name}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => setFilter('all')} className={EMPTY_CTA}>
          {renderAppLogo ? <span className="[&_svg]:size-4">{renderAppLogo('all')}</span> : null}
          Show All Apps
        </button>
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${FOCUS_RING}`}
          >
            <PlusIcon size={14} />
            New {kindWords(app).one}
          </button>
        ) : null}
      </div>
    </div>
  );
}
