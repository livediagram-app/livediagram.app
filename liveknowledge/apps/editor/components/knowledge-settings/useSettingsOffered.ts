'use client';

// Who may change the knowledgebase's settings (docs/specs/030-knowledgebase/verification.md "Share roles";
// knowledgebases-and-pages.md "Share roles"): an Editor of the whole knowledgebase. Never a Participant (an Editor
// minus the settings, the style and automations), a Viewer, a link confined to one page, an embed or a Community
// visitor. A knowledgebase kept Offline is its one person's to set. One boolean read from the store, so
// a keystroke renders nothing here until it changes.
import { useContext, useSyncExternalStore } from 'react';
import { EditorChromeContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';

export function settingsOfferedOf(
  s: Pick<
    EditorContextValue,
    | 'can'
    | 'isStructureReadOnly'
    | 'hydrated'
    | 'embedMode'
    | 'workbench'
    | 'sessionCommunity'
    | 'documentId'
  >,
): boolean {
  const editor = s.can.manageKnowledgebase && !s.isStructureReadOnly;
  const plain = s.hydrated && !s.embedMode && !s.workbench && !s.sessionCommunity;
  return !!s.documentId && editor && plain;
}

const noSubscribe = () => () => {};

export function useSettingsOffered(): boolean {
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no knowledgebase.
  const store = useContext(EditorChromeContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? settingsOfferedOf(store.get()) : false),
    () => false,
  );
}
