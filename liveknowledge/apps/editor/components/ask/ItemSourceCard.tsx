'use client';

// A cited item of another app in the Sources rail (docs/specs/030-knowledgebase/search-and-ask.md "What an answer
// shows"): the app's mark and the item's name, the place it cites (a tab or a card), the passage, then "Not
// verified here" and the day it was read, amber once a week old. Pressing it opens the item at the place, in a new
// browser tab, with the Cited by Ask bar.
import { useEffect, useRef, type ReactNode } from 'react';
import type { AskSource } from '@liveknowledge/api-schema';
import { AppMark, Chip } from '@liveknowledge/ui';
import { sourceAsOf } from '@/lib/knowledge-ask/source-item';
import { NUMBER_CHIP } from './CitationChip';

const APP_NAMES = {
  livediagram: 'livediagram',
  liveplanner: 'liveplanner',
  livedocuments: 'livedocuments',
  livedesign: 'livedesign',
  livehuddle: 'livehuddle',
} as const;

export function ItemSourceCard({
  source,
  passage,
  now,
  lit,
  stale,
  card: cardClass,
  onOpen,
  children,
}: {
  source: AskSource;
  passage: ReactNode;
  now: number;
  lit: boolean;
  stale: boolean;
  card: string;
  onOpen: (source: AskSource) => void;
  children?: ReactNode;
}) {
  const card = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!lit) return;
    card.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    card.current?.focus({ preventScroll: true });
  }, [lit]);
  const item = source.source!;
  const asOf = sourceAsOf(item.readAt, now);
  const place = source.headings.filter((h) => h && h !== item.itemName).join(' › ');
  const app = APP_NAMES[item.app];
  return (
    <li>
      <button
        ref={card}
        type="button"
        data-source={source.number}
        data-source-app={item.app}
        data-lit={lit ? '' : undefined}
        aria-label={`Source ${source.number}: ${item.itemName || 'Untitled'} in ${app}${place ? `, ${place}` : ''}. Opens in ${app} in a new tab.`}
        onClick={() => onOpen(source)}
        className={`${cardClass} ${
          lit
            ? 'border-brand-500 ring-2 ring-brand-500/30'
            : stale
              ? 'border-amber-300 dark:border-amber-500/40'
              : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <span className="flex items-center gap-2">
          {stale ? null : (
            <span aria-hidden className={NUMBER_CHIP}>
              <span className="text-optical-centre">{source.number}</span>
            </span>
          )}
          <AppMark app={item.app} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.itemName || 'Untitled'}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">
          {app}
          {place ? ` · ${place}` : ''}
        </span>
        {passage}
        {children}
        <span
          data-source-trust="item"
          className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-400"
        >
          <Chip className="bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Not Verified Here
          </Chip>
          <span
            data-source-as-of={asOf.stale ? 'stale' : 'fresh'}
            className={asOf.stale ? 'font-medium text-amber-800 dark:text-amber-200' : undefined}
          >
            {asOf.words}
          </span>
          <span className="ml-auto font-medium text-brand-700 dark:text-brand-300">
            Open in {app}
          </span>
        </span>
      </button>
    </li>
  );
}
