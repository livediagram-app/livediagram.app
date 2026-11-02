'use client';

// The card picker (docs/specs/026-plan/items.md "Where it shows", docs/specs/026-plan/item-types.md "Link Existing"):
// one dialog for picking a card of this plan, a search over the cards it is given (card-picker.ts) and a row per
// card as the card finder draws it (type glyph and colour, number, title), with the card's type named when the
// list holds several and a quiet note under its title ("Already on this card", "Linked to #3 Website"). Add Thread to Card and Link
// Existing draw it; what to offer, and what a pick does, is theirs.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogCloseButton, lucideGlyph, useEscape } from '@liveplanner/ui';
import { lucideSearch } from '@liveworkspace/icons/lucide';
import { PlanTypeGlyph } from './plan-type-glyph';
import type { PickCard } from './card-picker';

const SearchIcon = lucideGlyph(lucideSearch, 14);

export type CardPickerRow = PickCard & {
  // A quiet note at the row's end ("Already on this card").
  note?: string | undefined;
  // Said after the row's name instead of the note, when the two differ.
  ariaNote?: string | undefined;
  // Shown but not pickable.
  disabled?: boolean | undefined;
};

function CardRow<R extends CardPickerRow>({
  card,
  showType,
  onPick,
}: {
  card: R;
  showType: boolean;
  onPick: (card: R) => void;
}) {
  const note = card.ariaNote ?? card.note;
  return (
    <li>
      <button
        type="button"
        disabled={card.disabled}
        aria-label={`${card.title}, ${card.typeLabel} #${card.key}${note ? `, ${note}` : ''}`}
        onClick={() => onPick(card)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent motion-reduce:transition-none pointer-coarse:py-3 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800"
        >
          <PlanTypeGlyph glyph={card.glyph} color={card.color} size={14} />
        </span>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
          #{card.key}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] text-slate-800 dark:text-slate-100">
            {card.title}
          </span>
          {card.note ? (
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {card.note}
            </span>
          ) : null}
        </span>
        {showType ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {card.typeLabel}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function CardPickerDialog<R extends CardPickerRow>({
  title,
  description,
  cards,
  query,
  onQuery,
  listLabel,
  emptyText,
  showType = false,
  escapeEnabled = true,
  onPick,
  onClose,
}: {
  title: string;
  description: ReactNode;
  // The rows to draw, already narrowed by the search (useCardPickerSearch).
  cards: readonly R[];
  query: string;
  onQuery: (query: string) => void;
  // The list's accessible name ("Cards in this plan").
  listLabel: string;
  // Said when there are no cards to offer at all (a search matching nothing says "No cards match.").
  emptyText: string;
  // Each row names its card's type (a list of several types).
  showType?: boolean;
  // Off while another dialog stacked on this one takes Escape.
  escapeEnabled?: boolean;
  onPick: (card: R) => void;
  onClose: () => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  // The search is focused on open with a mouse; on a touch screen the keyboard would cover the list.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) searchRef.current?.focus();
  }, []);
  useEscape(onClose, { capture: true, stopPropagation: true, enabled: escapeEnabled });

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="md"
      closeOnEscape={false}
      className="max-h-[85vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pt-3">
          <label htmlFor={searchId} className="sr-only">
            Search cards
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 dark:border-slate-700 dark:bg-slate-800">
            <span aria-hidden className="text-slate-400">
              <SearchIcon />
            </span>
            <input
              id={searchId}
              ref={searchRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search by number, title or type…"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {cards.length ? (
            <ul aria-label={listLabel} className="flex flex-col">
              {cards.map((c) => (
                <CardRow key={c.itemId} card={c} showType={showType} onPick={onPick} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-2 text-[13px] text-slate-500 dark:text-slate-400">
              {query.trim() ? 'No cards match.' : emptyText}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
