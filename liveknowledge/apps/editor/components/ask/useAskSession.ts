'use client';

// What Ask and Insights need to know of the session (docs/specs/030-knowledgebase/search-and-ask.md "Share
// roles"): the knowledgebase, who is asking and what they may do. Read from the editor's chrome store a slice at a
// time, so a typing commit renders none of it.
import { useMemo, useSyncExternalStore } from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { aiSettingsStore, type AiSettingsState } from '@/lib/knowledge-ask/ai-settings-store';
import { askRights, type AskRights } from '@/lib/knowledge-ask/ask-rights';

export type AskSession = {
  documentId: string;
  /** The knowledgebase's name, for the words that name it. */
  name: string;
  who: KnowledgeCaller;
  rights: AskRights;
};

export function useAskSession(): AskSession | null {
  const documentId = useEditorChrome((s) => s.documentId);
  const name = useEditorChrome((s) => s.documentName?.trim() || 'Untitled Knowledgebase');
  const ownerId = useEditorChrome((s) => s.selfParticipant.id);
  const shareCode = useEditorChrome((s) => s.sessionShareCode);
  const editPages = useEditorChrome((s) => s.can.editPages);
  const manageKnowledgebase = useEditorChrome((s) => s.can.manageKnowledgebase);
  const isStructureReadOnly = useEditorChrome((s) => s.isStructureReadOnly);
  const accountUserId = useEditorChrome((s) => s.accountUserId ?? null);
  const offline = useIsOfflineDocument(documentId);
  return useMemo(
    () =>
      documentId
        ? {
            documentId,
            name,
            who: { ownerId, shareCode },
            rights: askRights({
              can: { editPages, manageKnowledgebase },
              isStructureReadOnly,
              accountUserId,
              offline,
            }),
          }
        : null,
    [
      documentId,
      name,
      ownerId,
      shareCode,
      editPages,
      manageKnowledgebase,
      isStructureReadOnly,
      accountUserId,
      offline,
    ],
  );
}

const IDLE: AiSettingsState = { status: 'idle' };

/** The knowledgebase's AI settings, as the store holds them now. */
export function useAiSettingsState(documentId: string | null): AiSettingsState {
  return useSyncExternalStore(
    aiSettingsStore.subscribe,
    () => (documentId ? aiSettingsStore.get(documentId) : IDLE),
    () => IDLE,
  );
}
