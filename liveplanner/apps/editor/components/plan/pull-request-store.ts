'use client';

// The plan's pull request states as a card reads them (docs/specs/026-plan/github-pull-requests.md "Pull request state
// on cards"; blueprint "Part 3" "The editor"): kept in PlanProvider as a store, so a delivery redraws only the cards
// whose linked pull requests changed, never every card on the board.
import {
  NO_PULL_REQUEST_STATUSES,
  cardFieldPullRequests,
  cardLinkedPullRequests,
  pullRequestKey,
  sameCardPullRequests,
  type CardFieldPullRequest,
  type CardPullRequest,
  type Item,
  type ItemTypeDef,
  type PullRequestRef,
  type PullRequestStatus,
  type PullRequestStatuses,
} from '@liveplanner/items';
import { createContext, use, useRef, useSyncExternalStore } from 'react';
import { noSubscribe, type ValueStore } from './value-store';

export const PullRequestStoreContext = createContext<ValueStore<PullRequestStatuses> | null>(null);

const NONE: readonly CardPullRequest[] = [];

/** A card's linked pull requests with their states, the same array while they are unchanged. */
export function useCardPullRequests(
  item: Pick<Item, 'id' | 'fields'>,
  type: Pick<ItemTypeDef, 'custom'> | undefined,
): readonly CardPullRequest[] {
  // Kept from the React Compiler: the last pick lives in a ref read while drawing, which it may not cache around.
  'use no memo';
  const store = use(PullRequestStoreContext);
  const last = useRef<{
    statuses: PullRequestStatuses;
    item: unknown;
    type: unknown;
    // The card's fields' pull requests, parsed once while the card and its type are unchanged.
    fields: readonly CardFieldPullRequest[];
    value: readonly CardPullRequest[];
  } | null>(null);
  const snapshot = () => {
    const statuses = store?.get() ?? NO_PULL_REQUEST_STATUSES;
    const had = last.current;
    const sameCard = !!had && had.item === item && had.type === type;
    if (had && sameCard && had.statuses === statuses) return had.value;
    const fields = had && sameCard ? had.fields : cardFieldPullRequests(item, type);
    const next = cardLinkedPullRequests(item, type, statuses, fields);
    const value =
      had && sameCardPullRequests(had.value, next) ? had.value : next.length ? next : NONE;
    last.current = { statuses, item, type, fields, value };
    return value;
  };
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, snapshot);
}

/** One pull request's state, for a field holding its address; undefined while the plan has none. */
export function usePullRequestStatus(
  ref: PullRequestRef | undefined,
): PullRequestStatus | undefined {
  const store = use(PullRequestStoreContext);
  const key = ref ? pullRequestKey(ref) : undefined;
  const snapshot = () => (key ? store?.get().byKey.get(key) : undefined);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, snapshot);
}
