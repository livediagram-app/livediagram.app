// The words a card's comment threads say (docs/specs/026-plan/items.md "Where it shows"): counts, the shared chip,
// the cards a thread is on, the delete confirmation, the cross-plan warning and what is announced. Pure, so every
// line of copy is tested once.

import type { CardRef, CardThread } from '@liveplanner/project';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 comment", "4 comments". */
export const commentCount = (n: number) => plural(n, 'comment');

/** The heading's quiet count of open threads: "2 Open"; '' with none (the resolved count is on its disclosure). */
export const openTally = (open: number): string => (open ? `${open} Open` : '');

/** The shared chip: "On 3 cards" (only for a thread on more than one). */
export const sharedLabel = (cards: number) => `On ${cards} cards`;

/** A card a thread is on, as its chip lists it: "#12 Basket" here, "#4 in Sprint 12" in another plan. */
export function cardLabel(
  card: CardRef,
  here: string,
  titleOf: (itemId: string) => string | null,
): string {
  const num = card.key !== null ? `#${card.key}` : 'A card';
  if (card.projectId === here) {
    const title = titleOf(card.itemId);
    return title ? `${num} ${title}` : num;
  }
  return `${num} in ${card.projectName || 'another plan'}`;
}

/** Whether the thread is on a card in a plan other than `here`. */
export const sharedBeyond = (thread: Pick<CardThread, 'cards'>, here: string) =>
  thread.cards.some((c) => c.projectId !== here);

/** The delete confirmation: how many cards it goes from. */
export function deleteThreadMessage(cards: number): string {
  return cards > 1
    ? `Delete this thread? It is on ${cards} cards, and goes from all of them. This can't be undone.`
    : "Delete this thread? Its comments go with it. This can't be undone.";
}

/** The live title a new thread will get, shown under the starter. */
export const titlePreview = (title: string) => `Titled “${title}”`;

/** What a write says to a screen reader. */
export const ANNOUNCE = {
  started: 'Thread started',
  replied: 'Reply posted',
  resolved: 'Thread resolved',
  repliedAndResolved: 'Reply posted, thread resolved',
  reopened: 'Thread reopened',
  renamed: 'Thread renamed',
  deleted: 'Thread deleted',
  commentDeleted: 'Comment deleted',
  commentEdited: 'Comment edited',
  added: (label: string) => `Added to ${label}`,
} as const;

/** "Resolved by Ada · 3d ago" lead, without the time (the row adds it). */
export const resolvedByLabel = (by: string | undefined) => (by ? `Resolved by ${by}` : 'Resolved');
