// Which cards are too long (docs/specs/007-editor/flashcards.md "Never flows"): each card's writing
// (ArticleEditor) publishes the first block that does not fit on the card, or null when it all fits,
// as it lays out. Read by the card's page panel (Split Onto a New Card) and its split. One per
// browser tab; a card's entry goes with its writing.
import { useSyncExternalStore } from 'react';

const overflow = new Map<string, string>();
const listeners = new Set<() => void>();

/** A card's first block past its foot (null: it all fits). */
export function publishCardOverflow(flow: string, fromBlockId: string | null): void {
  if ((overflow.get(flow) ?? null) === fromBlockId) return;
  if (fromBlockId) overflow.set(flow, fromBlockId);
  else overflow.delete(flow);
  for (const l of listeners) l();
}

/** The first block of a card's writing that does not fit, read when it is needed. */
export function cardOverflowNow(flow: string): string | null {
  return overflow.get(flow) ?? null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The first block of a card's writing that does not fit (null: it fits, or no card). */
export function useCardOverflow(flow: string | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (flow ? (overflow.get(flow) ?? null) : null),
    () => null,
  );
}
