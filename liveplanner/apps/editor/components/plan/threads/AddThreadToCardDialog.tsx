'use client';

// Add Thread to Card (docs/specs/026-plan/items.md "Where it shows"): puts a thread on another card of this plan, which
// then shows the same thread (one thread, stored once). A search over this plan's cards; never another plan's (owner,
// 2026-10-28). A pick adds the thread at once.

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogCloseButton, lucideGlyph, useEscape } from '@liveplanner/ui';
import { lucideSearch } from '@liveworkspace/icons/lucide';
import { threadTitle, type CardThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import { usePlan } from '../PlanContext';
import { PlanTypeGlyph } from '../plan-type-glyph';
import type { CardThreadsContextValue } from './CardThreadsContext';
import { ANNOUNCE } from './thread-words';
import { useThreadCardPicker, type PickCard } from './useThreadCardPicker';

const SearchIcon = lucideGlyph(lucideSearch, 14);

const NO_ITEMS: ReadonlyMap<string, Item> = new Map<string, Item>();

function CardRow({ card, onPick }: { card: PickCard; onPick: (card: PickCard) => void }) {
  return (
    <li>
      <button
        type="button"
        disabled={card.onThread}
        aria-label={`${card.title}, ${card.typeLabel} #${card.key}${card.onThread ? ', already on this thread' : ''}`}
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
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-100">
          {card.title}
        </span>
        {card.onThread ? (
          <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
            Already on this card
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function AddThreadToCardDialog({
  thread,
  ctx,
  onClose,
}: {
  thread: CardThread;
  ctx: CardThreadsContextValue;
  onClose: () => void;
}) {
  const plan = usePlan();
  const searchId = useId();
  const picker = useThreadCardPicker({
    thread,
    localItems: plan?.items ?? NO_ITEMS,
    localTypes: plan?.types ?? [],
    projectId: ctx.projectId,
  });
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // The search is focused on open with a mouse; on a touch screen the keyboard would cover the list.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) searchRef.current?.focus();
  }, []);
  useEscape(onClose, { capture: true, stopPropagation: true });

  const pick = async (card: PickCard) => {
    if (card.onThread || busy) return;
    setBusy(true);
    const made = await ctx.threads.act({
      kind: 'addToCard',
      threadId: thread.id,
      itemId: card.itemId,
    });
    setBusy(false);
    if (made === false) return;
    ctx.announce(ANNOUNCE.added(`#${card.key}`));
    onClose();
  };
  const shown = picker.shown;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Add Thread to Card"
      size="md"
      closeOnEscape={false}
      className="max-h-[85vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Add Thread to Card
          </h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            Pick a card to show “{threadTitle(thread)}” on too. It stays one thread: a reply on
            either card shows on both.
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
              value={picker.query}
              onChange={(e) => picker.setQuery(e.target.value)}
              placeholder="Search by number, title or type…"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {shown.length ? (
            <ul aria-label="Cards in this plan" className="flex flex-col">
              {shown.map((c) => (
                <CardRow key={c.itemId} card={c} onPick={(card) => void pick(card)} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-2 text-[13px] text-slate-500 dark:text-slate-400">
              {picker.query.trim() ? 'No cards match.' : 'No other cards in this plan.'}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
