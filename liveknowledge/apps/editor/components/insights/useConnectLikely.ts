'use client';

// Connect, on an Unanswered question's likely item (docs/specs/030-knowledgebase/insights.md "Likely answered
// elsewhere"): the item connected as Connect File connects one (the index makes the connection, the editor adds its
// row to the sidebar's top level, taken back when that save fails), so the knowledgebase reads it from then on.
// An Editor's, in a session that may change the whole tree.
import { useCallback, useState } from 'react';
import type { KnowledgeLikelySource } from '@liveknowledge/api-schema';
import { connectFile } from '@liveworkspace/workbench/components/connect/connect-file';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';

export function useConnectLikely(manage: boolean): {
  canConnect: boolean;
  connecting: string | null;
  connect: (likely: KnowledgeLikelySource) => Promise<void>;
} {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const canConnect = useEditorChrome(
    (s) =>
      manage &&
      !!s.accountUserId &&
      !!s.documentId &&
      !s.isStructureReadOnly &&
      !s.embedMode &&
      !s.workbench,
  );
  const [connecting, setConnecting] = useState<string | null>(null);
  const connect = useCallback(
    async (likely: KnowledgeLikelySource) => {
      const state = chrome.get();
      if (!canConnect || connecting || !state.documentId) return;
      // Already in the sidebar: nothing to make.
      if (state.connectedTabs.connected.has(likely.itemId)) {
        toast.info(`${likely.title || 'It'} is already connected.`);
        return;
      }
      setConnecting(likely.itemId);
      try {
        const grant = await state.connectedTabs.grant();
        if (!grant) throw new Error('no grant');
        const tabId = crypto.randomUUID();
        await connectFile({
          client: indexClient,
          hostId: state.documentId,
          grant,
          tabId,
          targetId: likely.itemId,
          level: 'view',
          both: false,
          addTab: (made) => chrome.get().addConnectedRow(made, tabId),
        });
        track('UI', 'Used', 'ConnectLikely');
        toast.success(
          `${likely.title || 'The item'} is connected. Ask answers from it once it has been read.`,
        );
      } catch {
        toast.error(`${likely.title || 'The item'} couldn't be connected just now. Try again.`);
      } finally {
        setConnecting(null);
      }
    },
    [chrome, canConnect, connecting, toast],
  );
  return { canConnect, connecting, connect };
}
