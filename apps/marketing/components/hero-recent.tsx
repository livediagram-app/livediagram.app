'use client';

import type { RecentDiagram } from '@livediagram/api-schema';
import { ChevronRightIcon, EDITOR_MODE_ICONS, relativeSince } from '@livediagram/ui';
import { useState, type MouseEvent } from 'react';
import { CANVAS } from './hero-editor-window';
import { useRecentThumb } from './useRecentDiagrams';

// Welcome back (docs/specs/019-marketing/returning-visitor.md): the hero's first window for a
// returning visitor, in place of the overview. The same bare board (no editor chrome) holds their six
// most recent diagrams, three over two on a wide window and two across on a phone, each opening it,
// and a link under them to Explorer Home for everything else.

export const EXPLORER_HOME_HREF = '/explorer/home';

export function HeroRecent({
  diagrams,
  playing,
  onCentre,
}: {
  diagrams: readonly RecentDiagram[];
  // Centred: a press opens what it presses. Peeking: a press centres the window instead.
  playing: boolean;
  onCentre: () => void;
}) {
  // Read once per mount: the window is a glance, so "2 hours ago" need not tick while it shows.
  const [now] = useState(() => Date.now());
  const guard = (e: MouseEvent) => {
    e.stopPropagation();
    if (!playing) {
      e.preventDefault();
      onCentre();
    }
  };
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`relative h-full overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 ${CANVAS}`}
      >
        {/* Placed over the board, not in its flow, so the card takes its height from the windows
            beside it, as the overview does. */}
        <div className="absolute inset-0 flex flex-col px-3 pb-2 pt-3 sm:px-6 sm:pb-3 sm:pt-4">
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 sm:mb-3 sm:text-xs dark:text-brand-300">
            Welcome back
          </p>
          <ul className="flex flex-1 flex-wrap content-start justify-center gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-4">
            {diagrams.map((d) => (
              <li
                key={d.id}
                className="w-[calc(50%-0.375rem)] sm:w-[calc((100%-3rem)/3)] sm:max-w-[13.5rem]"
              >
                <RecentTile diagram={d} now={now} onClick={guard} />
              </li>
            ))}
          </ul>
          <a
            href={EXPLORER_HOME_HREF}
            tabIndex={-1}
            onClick={guard}
            className="group/explorer mx-auto mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:text-sm dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            Open Explorer Home
            <ChevronRightIcon
              size={14}
              aria-hidden
              className="transition-transform duration-micro motion-safe:group-hover/explorer:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </div>
  );
}

function RecentTile({
  diagram,
  now,
  onClick,
}: {
  diagram: RecentDiagram;
  now: number;
  onClick: (e: MouseEvent) => void;
}) {
  const thumb = useRecentThumb(diagram.id, diagram.savedAt);
  const Icon = EDITOR_MODE_ICONS[diagram.mode ?? 'diagram'];
  return (
    <a
      href={`/document/${encodeURIComponent(diagram.id)}`}
      tabIndex={-1}
      onClick={onClick}
      className="group/tile flex flex-col text-left"
    >
      <span
        className="relative block aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition duration-micro group-hover/tile:border-brand-400 group-hover/tile:shadow-md motion-safe:group-hover/tile:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800/60 dark:group-hover/tile:border-brand-500/70"
        style={
          thumb.status === 'ready' && thumb.backgroundColor
            ? { backgroundColor: thumb.backgroundColor }
            : undefined
        }
      >
        {thumb.status === 'ready' ? (
          // A blob URL from the browser's own cache (static export: no image optimiser).
          <img
            src={thumb.url}
            alt=""
            className="hero-recent-thumb absolute inset-0 h-full w-full object-contain p-1"
          />
        ) : thumb.status === 'none' ? (
          <span className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
            <Icon size={22} />
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 truncate px-0.5 text-[11px] font-semibold text-slate-700 transition-colors group-hover/tile:text-brand-700 sm:text-xs dark:text-slate-200 dark:group-hover/tile:text-brand-300">
        {diagram.name || 'Untitled diagram'}
      </span>
      <span className="px-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {relativeSince(diagram.savedAt, now)}
      </span>
    </a>
  );
}
