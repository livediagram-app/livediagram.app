'use client';

// Who is offered Describe to Set Up, and which way (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// control", "Share roles"): a signed-in Editor or Participant of the whole knowledgebase, never a Viewer, a
// page-scoped link or a knowledgebase kept Offline. While the knowledgebase is empty it is `set-up` (the sidebar's
// button); after that it is `add` (Describe to Add Pages). The answer is one short string read from the
// store, so a keystroke renders nothing here until it changes.
import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { knowledgebaseIsEmpty } from '@/lib/knowledge-setup/setup-empty';
import type { SetupMode } from '@/lib/knowledge-setup/setup-open';

// What the session is offered, before Offline is known: one short string, so a reader renders only when it changes.
function offeredOf(s: EditorContextValue): SetupMode | null {
  const editor = s.can.editPages && !s.isStructureReadOnly;
  const plain = s.hydrated && !s.embedMode && !s.workbench && !s.sessionCommunity;
  if (!s.documentId || !editor || !s.accountUserId || !plain) return null;
  return knowledgebaseIsEmpty(s.tabs, s.loadedTabIds) ? 'set-up' : 'add';
}

const noSubscribe = () => () => {};

export function useSetupOffered(): SetupMode | null {
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no knowledgebase.
  const store = useContext(EditorChromeContext);
  const offered = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? offeredOf(store.get()) : null),
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
