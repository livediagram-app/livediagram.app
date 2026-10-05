'use client';

// The Cards panel (docs/specs/025-plan/items.md "Finding a card"): every live card in the document, newest
// change first, searched by number, title or description; **Not on a Board** narrows it to the cards no
// column on this tab's boards holds, so strays can be found and put somewhere. Choosing one opens it. A
// popover above its button in Plan mode's bottom-right cluster, like Card Types and the Trash.
import { useMemo, useState } from 'react';
import {
  findCards,
  isOffBoard,
  statusLabel,
  typeIn,
  itemTitle,
  type CardFinderShow,
} from '@livediagram/items';
import { SearchIcon } from '@livediagram/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';
import { CountBadge } from './CountBadge';

// The most rows drawn at once; a search narrows the rest.
const CARD_FINDER_ROWS_MAX = 200;

const SHOWS: { id: CardFinderShow; label: string }[] = [
  { id: 'all', label: 'All Cards' },
  { id: 'off-board', label: 'Not on a Board' },
];

export function CardFinderPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<CardFinderShow>('all');
  // Focused on open with a mouse; on a phone the keyboard waits until the field is tapped.
  const [finePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches,
  );
  const boardStatuses = useMemo(() => new Set(plan?.statusNames.keys() ?? []), [plan?.statusNames]);
  const live = useMemo(
    () => findCards(plan?.items.values() ?? [], { query: '', show: 'all', boardStatuses }),
    [plan?.items, boardStatuses],
  );
  if (!plan) return null;
  const counts = {
    all: live.length,
    'off-board': live.filter((it) => isOffBoard(it, boardStatuses)).length,
  };
  const found = findCards(live, { query, show, boardStatuses });
  return (
    <MovablePanel
      title="Cards"
      helpArticle="planCards"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-96"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-[22rem]"
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2.5 px-3 pb-3">
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
            <SearchIcon size={14} />
          </span>
          <input
            type="search"
            autoFocus={finePointer}
            aria-label="Search cards"
            placeholder="Search by #, title or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-brand-500/30"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Which cards"
          className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
        >
          {SHOWS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={show === s.id}
              onClick={() => setShow(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition ${
                show === s.id
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {s.label}
              <CountBadge
                background={s.id === 'off-board' && counts[s.id] ? '#d9770626' : '#64748b26'}
                color={s.id === 'off-board' && counts[s.id] ? '#b45309' : '#64748b'}
              >
                {counts[s.id]}
              </CountBadge>
            </button>
          ))}
        </div>
        {found.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            {live.length === 0
              ? 'No cards yet. Add one from a board, or drag one in from the palette.'
              : query.trim()
                ? 'No cards match that search.'
                : 'Every card is on a board here.'}
          </p>
        ) : (
          <ul aria-label="Cards" className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {found.slice(0, CARD_FINDER_ROWS_MAX).map((it) => {
              const type = typeIn(plan.types, it.type);
              const status = typeof it.fields['status'] === 'string' ? it.fields['status'] : null;
              const off = isOffBoard(it, boardStatuses);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPopoverClose();
                      plan.openItem(it.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                  >
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
                      style={accentVars(type.color)}
                    >
                      <PlanTypeGlyph glyph={type.glyph} size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                        {itemTitle(it) || 'Untitled'}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {type.label} #{it.key}
                        {status ? ` · ${statusLabel(status, plan.statusNames)}` : ''}
                      </span>
                    </span>
                    {off ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        Not on a Board
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {found.length > CARD_FINDER_ROWS_MAX ? (
              <li className="px-2 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                Showing {CARD_FINDER_ROWS_MAX} of {found.length}. Search to narrow them down.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}
