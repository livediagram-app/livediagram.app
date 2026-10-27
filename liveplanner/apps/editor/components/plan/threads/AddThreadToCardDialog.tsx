'use client';

// Add Thread to Card (docs/specs/026-plan/items.md "Where it shows"): puts a thread on another card, which then shows
// the same thread (one thread, stored once). A search over this plan's cards first, then the person's other plans,
// each opened to its cards. A card in this plan takes the thread at once; one in another plan asks first, in the
// dialog, saying who will be able to read it there and what they may do (#82, the owner's cross-plan rule).

import { useId, useState } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { Button, DialogCloseButton, lucideGlyph, useEscape } from '@liveplanner/ui';
import {
  lucideChevronDown,
  lucideLock,
  lucideSearch,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import type { CardThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import { usePlan } from '../PlanContext';
import { PlanTypeGlyph } from '../plan-type-glyph';
import type { CardThreadsContextValue } from './CardThreadsContext';
import { ANNOUNCE, shareWarning } from './thread-words';
import { useThreadCardPicker, type PickCard } from './useThreadCardPicker';

const SearchIcon = lucideGlyph(lucideSearch, 14);
const Chevron = lucideGlyph(lucideChevronDown, 14);
const LockIcon = lucideGlyph(lucideLock, 13);
const WarnIcon = lucideGlyph(lucideTriangleAlert, 16);

const NO_ITEMS: ReadonlyMap<string, Item> = new Map<string, Item>();

const SECTION =
  'px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

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
    ownerId: ctx.ownerId,
    localItems: plan?.items ?? NO_ITEMS,
    localTypes: plan?.types ?? [],
    projectId: ctx.projectId,
    otherPlans: ctx.otherPlans,
    offline: ctx.offline,
  });
  const [openPlans, setOpenPlans] = useState<ReadonlySet<string>>(() => new Set());
  const [confirming, setConfirming] = useState<{ card: PickCard; planName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Escape steps back from the warning before it closes the dialog.
  useEscape(() => (confirming ? setConfirming(null) : onClose()), {
    capture: true,
    stopPropagation: true,
  });

  const add = async (card: PickCard) => {
    setBusy(true);
    const made = await ctx.threads.act({
      kind: 'addToCard',
      threadId: thread.id,
      itemId: card.itemId,
      ...(card.projectId !== ctx.projectId ? { projectId: card.projectId } : {}),
    });
    setBusy(false);
    if (made === false) return;
    const where =
      card.projectId === ctx.projectId
        ? `#${card.key}`
        : `#${card.key} in ${confirming?.planName ?? 'that plan'}`;
    ctx.announce(ANNOUNCE.added(where));
    onClose();
  };
  const pick = (card: PickCard) => {
    if (card.onThread || busy) return;
    if (card.projectId === ctx.projectId) {
      void add(card);
      return;
    }
    const name = picker.plans.find((p) => p.id === card.projectId)?.name || 'Untitled plan';
    setConfirming({ card, planName: name });
  };
  const togglePlan = (id: string) => {
    setOpenPlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        picker.openPlan(id);
      }
      return next;
    });
  };
  const local = picker.shownLocal;

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
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            “{thread.title}” shows on the card you pick too: one thread, on both.
          </p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      {confirming ? (
        <ShareWarning
          card={confirming.card}
          planName={confirming.planName}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onShare={() => void add(confirming.card)}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-3">
            <label htmlFor={searchId} className="sr-only">
              Search cards and plans
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 dark:border-slate-700 dark:bg-slate-800">
              <span aria-hidden className="text-slate-400">
                <SearchIcon />
              </span>
              <input
                id={searchId}
                // Focused on open with a mouse; a phone's keyboard would cover the list.
                autoFocus={typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches}
                value={picker.query}
                onChange={(e) => picker.setQuery(e.target.value)}
                placeholder="Search by number, title, type or plan…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <p className={SECTION}>This plan</p>
            {local.length ? (
              <ul aria-label="Cards in this plan" className="flex flex-col">
                {local.map((c) => (
                  <CardRow key={c.itemId} card={c} onPick={pick} />
                ))}
              </ul>
            ) : (
              <p className="px-2 py-2 text-[13px] text-slate-500 dark:text-slate-400">
                {picker.query.trim() ? 'No cards here match.' : 'No other cards in this plan.'}
              </p>
            )}
            {ctx.offline ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                This plan is saved in this browser, so its threads stay in it.
              </p>
            ) : picker.plans.length ? (
              <>
                <p className={SECTION}>Other plans</p>
                {picker.shownPlans.length === 0 ? (
                  <p className="px-2 py-2 text-[13px] text-slate-500 dark:text-slate-400">
                    No plans match.
                  </p>
                ) : (
                  <ul aria-label="Other plans" className="flex flex-col gap-0.5">
                    {picker.shownPlans.map((p) => {
                      const open = openPlans.has(p.id) || (!!picker.query.trim() && picker.picks.has(p.id));
                      const pickState = picker.picks.get(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => togglePlan(p.id)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-100 motion-reduce:transition-none pointer-coarse:py-3 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <span
                              aria-hidden
                              className={`text-slate-400 transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
                            >
                              <Chevron />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{p.name || 'Untitled plan'}</span>
                          </button>
                          {open ? (
                            <div className="pb-1 pl-6">
                              {!pickState || pickState.status === 'loading' ? (
                                <p className="animate-pulse px-2 py-2 text-[12px] text-slate-400 motion-reduce:animate-none">
                                  Reading its cards…
                                </p>
                              ) : pickState.status === 'view' ? (
                                <p className="flex items-center gap-1.5 px-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                                  <LockIcon aria-hidden />
                                  You can only view this plan
                                </p>
                              ) : pickState.status === 'error' ? (
                                <p className="px-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                                  Couldn’t read this plan’s cards.
                                </p>
                              ) : picker.cardsOf(p.id).length === 0 ? (
                                <p className="px-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                                  {picker.query.trim() ? 'No cards here match.' : 'No cards yet.'}
                                </p>
                              ) : (
                                <ul aria-label={`Cards in ${p.name || 'Untitled plan'}`}>
                                  {picker.cardsOf(p.id).map((c) => (
                                    <CardRow key={c.itemId} card={c} onPick={pick} />
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ShareWarning({
  card,
  planName,
  busy,
  onCancel,
  onShare,
}: {
  card: PickCard;
  planName: string;
  busy: boolean;
  onCancel: () => void;
  onShare: () => void;
}) {
  const words = shareWarning(card.key, planName);
  return (
    <div role="alertdialog" aria-labelledby="share-thread-title" className="px-5 py-5">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <span aria-hidden className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300">
          <WarnIcon />
        </span>
        <div className="min-w-0">
          <p
            id="share-thread-title"
            className="text-[14px] font-semibold text-amber-950 dark:text-amber-50"
          >
            {words.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900 dark:text-amber-100">
            {words.detail}
          </p>
          <p className="mt-2 truncate text-[12px] text-amber-800 dark:text-amber-200">
            #{card.key} {card.title}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={onShare} disabled={busy} autoFocus>
          Share Thread
        </Button>
      </div>
    </div>
  );
}
