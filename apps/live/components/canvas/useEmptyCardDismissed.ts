import { useSyncExternalStore } from 'react';
import { emptyCardDismissed, subscribeEmptyCardDismissed } from './empty-card-dismissed';

// Whether a tab's empty card (a start panel) is closed, kept current as it closes or is brought back.
export function useEmptyCardDismissed(key: string): boolean {
  return useSyncExternalStore(
    subscribeEmptyCardDismissed,
    () => emptyCardDismissed(key),
    () => false,
  );
}
