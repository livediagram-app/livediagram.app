'use client';

import { useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/ui/useToast';
import {
  handTemplatePick,
  readTemplatePick,
  takeTemplatePick,
} from '@/lib/placement-defaults/template-pick-handoff';

// A template picked from a start screen on a document /new just made goes to the template's default folder
// (docs/specs/013-workspace/default-folders.md "A template picked after creation"). Once per document: the handoff is
// taken at the first pick, and dropped if the tab gains content any other way first. Cheap until it matters: only a
// handoff for this document loads the mover (lib/placement-defaults/move-on-template-pick.ts), at the pick.
export function useTemplatePickMove(at: {
  ownerId: string;
  documentId: string | null;
  tabId: string;
  signedIn: boolean;
  // The active tab has content: drawn by hand, the template's default no longer applies.
  tabHasContent: boolean;
}): () => void {
  const toast = useToast();
  const { ownerId, documentId, tabId, signedIn, tabHasContent } = at;
  useEffect(() => {
    if (tabHasContent && documentId && readTemplatePick()?.documentId === documentId)
      handTemplatePick(null);
  }, [tabHasContent, documentId]);
  return useCallback(() => {
    if (!documentId) return;
    // Taken now, before the template's elements land and the effect above would drop it.
    const handoff = takeTemplatePick(documentId, tabId);
    if (!handoff || handoff.placementChosen) return;
    void import('@/lib/placement-defaults/move-on-template-pick').then(async (m) => {
      const message = await m.moveOnTemplatePick({
        ownerId,
        documentId,
        handoff,
        signedIn,
      });
      if (message) toast.info(message);
    });
  }, [ownerId, documentId, tabId, signedIn, toast]);
}
