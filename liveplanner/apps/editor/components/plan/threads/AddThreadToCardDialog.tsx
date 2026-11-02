'use client';

// Add Thread to Card (docs/specs/026-plan/items.md "Where it shows"): puts a thread on another card of this plan, which
// then shows the same thread (one thread, stored once). A search over this plan's cards (the shared card picker,
// ../CardPickerDialog.tsx); never another plan's (owner, 2026-10-28). A pick adds the thread at once.

import { useMemo, useState } from 'react';
import { threadTitle, type CardThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import { usePlan } from '../PlanContext';
import { CardPickerDialog, type CardPickerRow } from '../CardPickerDialog';
import type { CardThreadsContextValue } from './CardThreadsContext';
import { ANNOUNCE } from './thread-words';
import { useThreadCardPicker, type PickCard } from './useThreadCardPicker';

const NO_ITEMS: ReadonlyMap<string, Item> = new Map<string, Item>();

const rowOf = (card: PickCard): CardPickerRow & PickCard =>
  card.onThread
    ? {
        ...card,
        disabled: true,
        note: 'Already on this card',
        ariaNote: 'already on this thread',
      }
    : card;

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
  const picker = useThreadCardPicker({
    thread,
    localItems: plan?.items ?? NO_ITEMS,
    localTypes: plan?.types ?? [],
    projectId: ctx.projectId,
  });
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => picker.shown.map(rowOf), [picker.shown]);

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

  return (
    <CardPickerDialog
      title="Add Thread to Card"
      description={
        <>
          Pick a card to show “{threadTitle(thread)}” on too. It stays one thread: a reply on either
          card shows on both.
        </>
      }
      cards={rows}
      query={picker.query}
      onQuery={picker.setQuery}
      listLabel="Cards in this plan"
      emptyText="No other cards in this plan."
      onPick={(card) => void pick(card)}
      onClose={onClose}
    />
  );
}
