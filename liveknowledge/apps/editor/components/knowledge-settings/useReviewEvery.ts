'use client';

// The knowledgebase's Review Period for a component (docs/specs/030-knowledgebase/verification.md "The Review
// Period"): one short value read from the settings store, so a reader renders only when the period changes.
import { useSyncExternalStore } from 'react';
import { DEFAULT_REVIEW_EVERY, type ReviewEvery } from '@liveknowledge/knowledge';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';

export function useReviewEvery(documentId: string | null | undefined): ReviewEvery {
  return useSyncExternalStore(
    knowledgeSettingsStore.subscribe,
    () => knowledgeSettingsStore.reviewEveryOf(documentId),
    () => DEFAULT_REVIEW_EVERY,
  );
}
