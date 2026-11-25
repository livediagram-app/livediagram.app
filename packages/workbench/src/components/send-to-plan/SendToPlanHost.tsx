'use client';

// The editor's one Send to Plan host (liveworkspace/docs/specs/004-index/send-to-plan.md): mounted beside the editor,
// it names the open item to the chips' store (read once, then on the room's word only) and opens the picker when a
// menu asks (send-to-plan-entry.ts). Nothing at all for a session that cannot send (Offline, an embed, Community, a
// guest): no read, no chips, no picker. The picker's code loads on its first open.
import { lazy, Suspense, useEffect, useState } from 'react';
import type { App, ShareAccess } from '@liveworkspace/index-client';
import { setSendSource } from './send-store';
import { onSendToPlan, setSendHere, type SendRequest } from './send-to-plan-entry';
import {
  onSendToDiagram,
  setDiagramDrafter,
  type DiagramDrafter,
  type DiagramSendRequest,
} from '../send-to-diagram/send-to-diagram-entry';
import { elementDiagramSends, setDiagramSendSource } from '../send-to-diagram/diagram-send-store';
import {
  onSendToKnowledge,
  onSendWordsToKnowledge,
  setKnowledgeSummariser,
  type KnowledgeCapture,
  type KnowledgeSummariser,
  type KnowledgeWords,
} from '../send-to-knowledge/send-to-knowledge-entry';
import { setKnowledgeSendSource } from '../send-to-knowledge/knowledge-send-store';
import { setKnowledgeReceivedSource } from '../send-to-knowledge/knowledge-received-store';

const SendToKnowledgeDialog = lazy(() =>
  import('../send-to-knowledge/SendToKnowledgeDialog').then((m) => ({
    default: m.SendToKnowledgeDialog,
  })),
);

const SendToDiagramDialog = lazy(() =>
  import('../send-to-diagram/SendToDiagramDialog').then((m) => ({
    default: m.SendToDiagramDialog,
  })),
);

const SendToPlanDialog = lazy(() =>
  import('./SendToPlanDialog').then((m) => ({ default: m.SendToPlanDialog })),
);

export function SendToPlanHost({
  app,
  itemId,
  tabId = null,
  title,
  share = null,
  enabled,
  diagram = null,
  tabTitle = '',
  knowledge = null,
}: {
  // The app this editor is, and the open item, the source of every send from here.
  app: App;
  itemId: string | null;
  // The tab shown, the one a menu's element sits on.
  tabId?: string | null;
  title: string;
  // The link it was opened through, so the chips read with the same access the editor holds.
  share?: ShareAccess | null;
  // canSendToPlan(...) for this session.
  enabled: boolean;
  // Send to Diagram's draft on the app's own AI (send-to-diagram.md); without it no entry offers Send to Diagram.
  diagram?: DiagramDrafter | null;
  // The shown tab's name (a page's title): what a diagram from it is named after and its caption says.
  tabTitle?: string;
  // Send to Knowledge Base's summary on the app's own AI (send-to-knowledge.md); without it no entry offers it.
  knowledge?: KnowledgeSummariser | null;
}) {
  const [request, setRequest] = useState<SendRequest | null>(null);
  const [diagramRequest, setDiagramRequest] = useState<DiagramSendRequest | null>(null);
  const [knowledgeRequest, setKnowledgeRequest] = useState<KnowledgeCapture | null>(null);
  const [wordsRequest, setWordsRequest] = useState<KnowledgeWords | null>(null);
  const live = enabled && itemId ? itemId : null;
  const code = share?.code ?? null;

  useEffect(() => {
    setSendSource(live, code ? { code } : null);
    return () => setSendSource(null);
  }, [live, code]);

  useEffect(() => {
    if (!live) return undefined;
    setSendHere({ app, tabId });
    return () => setSendHere(null);
  }, [live, app, tabId]);

  useEffect(() => (live ? onSendToPlan(setRequest) : undefined), [live]);

  // The diagram chips' read, only for an app that drafts diagrams.
  const diagramLive = live && diagram ? live : null;
  useEffect(() => {
    setDiagramSendSource(diagramLive, code ? { code } : null);
    return () => setDiagramSendSource(null);
  }, [diagramLive, code]);

  useEffect(() => {
    if (!live || !diagram) return undefined;
    setDiagramDrafter(diagram);
    const off = onSendToDiagram(setDiagramRequest);
    return () => {
      off();
      setDiagramDrafter(null);
    };
  }, [live, diagram]);

  // Send to Knowledge Base's sends from here, for the chips, and the picker's entries, for an app that summarises.
  const knowledgeLive = live && knowledge ? live : null;
  useEffect(() => {
    setKnowledgeSendSource(knowledgeLive, code ? { code } : null);
    return () => setKnowledgeSendSource(null);
  }, [knowledgeLive, code]);

  useEffect(() => {
    if (!live || !knowledge) return undefined;
    setKnowledgeSummariser(knowledge);
    const off = onSendToKnowledge(setKnowledgeRequest);
    return () => {
      off();
      setKnowledgeSummariser(null);
    };
  }, [live, knowledge]);

  // Words sent as written (an Ask AI answer): every app, no summariser needed.
  useEffect(() => (live ? onSendWordsToKnowledge(setWordsRequest) : undefined), [live]);

  // A knowledgebase's pages show the Sent From chips of what other apps sent to it.
  const receivedLive = live && app === 'liveknowledge' ? live : null;
  useEffect(() => {
    setKnowledgeReceivedSource(receivedLive, code ? { code } : null);
    return () => setKnowledgeReceivedSource(null);
  }, [receivedLive, code]);

  if (live && wordsRequest)
    return (
      <Suspense fallback={null}>
        <SendToKnowledgeDialog
          words={wordsRequest}
          source={{ app, itemId: live }}
          sourceTitle={title}
          onClose={() => setWordsRequest(null)}
        />
      </Suspense>
    );
  if (live && knowledge && knowledgeRequest)
    return (
      <Suspense fallback={null}>
        <SendToKnowledgeDialog
          capture={knowledgeRequest}
          source={{ app, itemId: live }}
          sourceTitle={title}
          summarise={knowledge}
          onClose={() => setKnowledgeRequest(null)}
        />
      </Suspense>
    );
  if (live && diagram && diagramRequest)
    return (
      <Suspense fallback={null}>
        <SendToDiagramDialog
          request={
            diagramRequest.label ? diagramRequest : { ...diagramRequest, label: tabTitle.trim() }
          }
          source={{ app, itemId: live }}
          sourceTitle={title}
          drafter={diagram}
          earlier={
            diagramRequest.elementId
              ? (elementDiagramSends(diagramRequest.elementId)[0] ?? null)
              : null
          }
          onClose={() => setDiagramRequest(null)}
        />
      </Suspense>
    );
  if (!live || !request) return null;
  return (
    <Suspense fallback={null}>
      <SendToPlanDialog
        request={request}
        sourceId={live}
        sourceTitle={title}
        onClose={() => setRequest(null)}
      />
    </Suspense>
  );
}
