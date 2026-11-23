'use client';

// The AI credits store's hook (lib/knowledge-credits.ts). Apart from the store, so the Ask client the server layout
// reaches imports no React hook.
import { useSyncExternalStore } from 'react';
import { aiCreditsOf, subscribe, type CreditsState } from './knowledge-credits';

/** The owner's month as the last built-in answer told it. */
export function useAiCredits(documentId: string | null | undefined): CreditsState | null {
  return useSyncExternalStore(
    subscribe,
    () => aiCreditsOf(documentId),
    () => null,
  );
}
