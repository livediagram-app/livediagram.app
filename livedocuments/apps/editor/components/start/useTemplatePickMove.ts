'use client';

import { useCallback, useEffect } from 'react';
import {
  defaultEntries,
  kindWords,
  moveOnTemplatePick,
  readTemplatePick,
  handTemplatePick,
  takeTemplatePick,
} from '@liveworkspace/explorer';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';

// A template picked from a start screen on a document /new just made goes to the default folder for new documents
// (docs/specs/013-workspace/default-folders.md "A template picked after creation"). livedocuments has one entry, its
// own: no template family has a default of its own. Once per document: the note /new left is taken at the first
// pick, and dropped if the tab gains content any other way first. Cheap until it matters: only a pick on a noted
// document asks the index anything.
const ENTRIES = defaultEntries('livedocuments', kindWords('livedocuments'), []);
const nounOf = (key: string) => ENTRIES.find((e) => e.key === key)?.noun ?? 'documents';

export function useTemplatePickMove(at: {
  documentId: string | null;
  tabId: string;
  // The active tab has content: drawn by hand, the template's default no longer applies.
  tabHasContent: boolean;
}): () => void {
  const toast = useToast();
  const { documentId, tabId, tabHasContent } = at;
  useEffect(() => {
    if (tabHasContent && documentId && readTemplatePick()?.itemId === documentId)
      handTemplatePick(null);
  }, [tabHasContent, documentId]);
  return useCallback(() => {
    if (!documentId) return;
    // Taken now, before the template's elements land and the effect above would drop it.
    const handoff = takeTemplatePick(documentId, tabId);
    if (!handoff || handoff.placementChosen) return;
    void moveOnTemplatePick(indexClient, {
      app: 'livedocuments',
      itemId: documentId,
      handoff,
      intent: '',
      noun: nounOf,
    }).then((message) => {
      if (message) toast.info(message);
    });
  }, [documentId, tabId, toast]);
}
