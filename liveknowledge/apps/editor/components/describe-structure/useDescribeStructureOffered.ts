'use client';

// Who is offered Describe Structure, and where (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe
// Structure on a page"): a signed-in person who may edit the page, on a page with nothing written, never in a
// knowledgebase kept Offline. `read`: beside Edit; `edit`: beside Cancel, while the draft has nothing under its Title.
// One short string read from the store, so a keystroke renders nothing here until it changes; the emptiness check is
// bounded and remembered per page object (setup-empty.ts).
import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { pageIsUntouched } from '@/lib/knowledge-setup/setup-empty';
import { pageEditLens } from '@/lib/page-edit/lens';

export type DescribeStructurePlace = 'read' | 'edit';

export function describeStructureOf(s: EditorContextValue): DescribeStructurePlace | null {
  const { editing, mayEdit } = s.pageEditing;
  const plain = s.hydrated && !s.embedMode && !s.workbench && !s.sessionCommunity;
  if (!s.documentId || !mayEdit || !s.accountUserId || !plain) return null;
  // Editing, the draft as it is edited; reading, the page with any draft beside it (a draft with words is
  // someone's writing, which Edit joins).
  const page = editing ? pageEditLens(s.pageTab) : s.pageTab;
  if (!pageIsUntouched(page)) return null;
  return editing ? 'edit' : 'read';
}

const noSubscribe = () => () => {};

export function useDescribeStructureOffered(): DescribeStructurePlace | null {
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store.
  const store = useContext(EditorChromeContext);
  const offered = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? describeStructureOf(store.get()) : null),
    () => null,
  );
  const documentId = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().documentId ?? null,
    () => null,
  );
  const offline = useIsOfflineDocument(documentId);
  return offline ? null : offered;
}
