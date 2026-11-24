'use client';

// Send to Knowledge Base in this editor (docs/specs/013-workspace/send-to-knowledge.md): sets the open tab as the
// selection's source while a canvas shows, and answers the summariser SendToPlanHost hands the picker. Null while the
// session may not send (the host's own `enabled` decides that too), so no entry is offered.
import { useEffect, useMemo, useRef } from 'react';
import type { Tab } from '@livediagram/document';
import type { KnowledgeSummariser } from '@liveworkspace/workbench/components/send-to-knowledge/send-to-knowledge-entry';
import { loadTabImages } from '@/lib/export-tab';
import { knowledgeSummariser, setKnowledgeTabSource } from '@/lib/knowledge-send';

type ImageContext = { ownerId: string; documentId: string; shareCode: string | null } | undefined;

export function useKnowledgeSend({
  documentId,
  teamId,
  activeTab,
  imageContext,
  enabled,
}: {
  documentId: string;
  teamId: string | null;
  activeTab: Tab;
  imageContext: ImageContext;
  enabled: boolean;
}): KnowledgeSummariser | null {
  // Read on press: the latest tab and image context, without re-registering on every edit.
  const tabRef = useRef(activeTab);
  const imagesRef = useRef(imageContext);
  useEffect(() => {
    tabRef.current = activeTab;
    imagesRef.current = imageContext;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    setKnowledgeTabSource({
      tab: () => tabRef.current,
      images: async (tab) => {
        const context = imagesRef.current;
        return context ? await loadTabImages(tab, context) : undefined;
      },
    });
    return () => setKnowledgeTabSource(null);
  }, [enabled]);
  return useMemo(
    () => (enabled ? knowledgeSummariser(documentId, teamId) : null),
    [enabled, documentId, teamId],
  );
}
