'use client';

// Yours to Review on the Knowledgebase Home (docs/specs/030-knowledgebase/verification.md "Reminders"): the person's
// own due pages, read from the summaries Home already makes (no request of its own), and Still Right, which verifies
// a page. The row goes at once; if the verify is refused or fails it comes back, with a toast that says so. Once it
// lands, that knowledgebase's summary is read again past every kept copy, so its numbers follow and a reload inside
// the route's minute does not list the page again.
import { useCallback, useMemo, useState } from 'react';
import type { KnowledgeSummaryResponse } from '@liveknowledge/api-schema';
import { useToast } from '@/hooks/ui/useToast';
import { apiVerifyPage } from '@/lib/api/knowledge';
import {
  reviewKey,
  reviewPagesAcross,
  type HomeKnowledgebase,
  type HomeReviewPage,
} from '@/lib/knowledge-home/home-data';
import { track } from '@/lib/telemetry';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';

export function useStillRight(deps: {
  ownerId: string;
  knowledgebases: readonly HomeKnowledgebase[];
  summaries: ReadonlyMap<string, KnowledgeSummaryResponse>;
  refresh: (documentId: string) => Promise<void>;
}): { rows: readonly HomeReviewPage[]; stillRight: (row: HomeReviewPage) => void } {
  const { ownerId, knowledgebases, summaries, refresh } = deps;
  const toast = useToast();
  // The rows verified here: hidden from the moment Still Right is pressed, shown again only if it fails.
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(
    () => reviewPagesAcross(knowledgebases, summaries, done),
    [knowledgebases, summaries, done],
  );
  const stillRight = useCallback(
    (row: HomeReviewPage) => {
      const key = reviewKey(row);
      setDone((held) => new Set(held).add(key));
      track('UI', 'Used', 'HomeStillRight');
      void (async () => {
        try {
          await apiVerifyPage({ ownerId, shareCode: null }, row.documentId, row.tab);
        } catch {
          setDone((held) => {
            const next = new Set(held);
            next.delete(key);
            return next;
          });
          toast.error(`Could not verify ${toastName(row.title) ?? 'that page'}. Try again.`);
          return;
        }
        await refresh(row.documentId);
      })();
    },
    [ownerId, refresh, toast],
  );
  return { rows, stillRight };
}
