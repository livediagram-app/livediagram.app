'use client';

// The open knowledgebase's page bound (lib/knowledge-import/import-trim.ts `pagesBound`), with the owner's own usage
// where it is theirs to see (docs/specs/030-knowledgebase/tiers.md "Knowledgebase Pages").
import { isOwnerScope } from '@liveworkspace/subscription';
import { tierUsage, useItemTier } from '@liveworkspace/subscription-ui/item-tier';
import { useCallback, useEffect } from 'react';
import { pagesBound, type PagesBound } from './knowledge-import/import-trim';
import { openKnowledgebase, setOpenPagesBound } from './knowledge-tier';
import { useOpenKnowledgeTier } from './use-knowledge-tier';

/** The bound for the open knowledgebase, for a count of `existing` pages; it answers null with Pro off. */
export function usePagesBoundOf(): (existing: number) => PagesBound | null {
  const info = useOpenKnowledgeTier();
  const tier = useItemTier(isOwnerScope(info?.owner) ? info.owner : null);
  const usage = tierUsage(tier, 'pages');
  const whose = tier.voice.whose;
  const used = usage?.used ?? null;
  const limit = usage?.limit ?? null;
  const pagesMax = info?.pagesMax ?? null;
  return useCallback(
    (existing: number) =>
      pagesMax === null
        ? null
        : pagesBound(
            existing,
            pagesMax,
            used !== null && limit !== null && whose !== 'owner' ? { used, limit, whose } : null,
          ),
    [pagesMax, used, limit, whose],
  );
}

/** The bound for the open knowledgebase holding `existing` pages; null with Pro off. */
export function usePagesBound(existing: number): PagesBound | null {
  return usePagesBoundOf()(existing);
}

/** Keeps the open knowledgebase's bound where every page add reads it (`openPagesMax`), once it is known: with the
 *  owner's usage when it is theirs to see, as soon as their subscription has answered. */
export function useFeedOpenPagesBound(existing: number): void {
  const info = useOpenKnowledgeTier();
  const tier = useItemTier(isOwnerScope(info?.owner) ? info.owner : null);
  const usage = tierUsage(tier, 'pages');
  const whose = tier.voice.whose;
  const bound = usePagesBound(existing);
  // The owner's own knowledgebase, with their usage still on its way: not known yet.
  const waiting =
    info?.pagesLimit !== undefined && (!tier.settled || (whose !== 'owner' && !usage));
  const max = bound?.max ?? null;
  const limit = bound?.account?.limit ?? null;
  const boundWhose = bound?.account?.whose ?? null;
  useEffect(() => {
    if (max === null || waiting) return;
    setOpenPagesBound(
      openKnowledgebase(),
      boundWhose && limit !== null
        ? { max, account: { limit, whose: boundWhose } }
        : { max, account: null },
    );
  }, [max, limit, boundWhose, waiting]);
}
