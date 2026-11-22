'use client';

import { useEditorChrome } from '@/app/document/[id]/EditorContext';

/** Whether this session is offered the three views (docs/specs/030-knowledgebase/search-and-ask.md "The three
 *  views"): an opened knowledgebase in the full editor. Not in an embed or zen mode, behind the welcome flow, for a
 *  Community visitor, or through a link confined to one page (which reaches that page's routes and nothing else). */
export function useKnowledgeViewsOffered(): boolean {
  return useEditorChrome(
    (s) =>
      s.hydrated &&
      !!s.documentId &&
      s.appChrome &&
      !s.embedMode &&
      !s.zenMode &&
      !s.anyWelcomeOpen &&
      s.workbench === null &&
      s.sessionCommunity === null &&
      s.sessionTabScope === null,
  );
}
