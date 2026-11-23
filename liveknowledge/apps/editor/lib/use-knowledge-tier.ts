'use client';

// The knowledgebase tier store's hooks (lib/knowledge-tier.ts). Apart from the store, so the api client the server
// layout reaches imports no React hook.
import { useSyncExternalStore } from 'react';
import type { KnowledgeTierInfo } from '@liveknowledge/api-schema';
import { knowledgeTierOf, openKnowledgebase, subscribe } from './knowledge-tier';

/** The open knowledgebase's tier, re-read when its load says something new. */
export function useOpenKnowledgeTier(): KnowledgeTierInfo | null {
  return useSyncExternalStore(
    subscribe,
    () => knowledgeTierOf(openKnowledgebase()),
    () => null,
  );
}

/** The tier of the open knowledgebase, re-read when its load says something new. */
export function useKnowledgeTier(documentId: string | null | undefined): KnowledgeTierInfo | null {
  return useSyncExternalStore(
    subscribe,
    () => knowledgeTierOf(documentId),
    () => null,
  );
}
