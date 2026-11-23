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
}) {
  const [request, setRequest] = useState<SendRequest | null>(null);
  const [diagramRequest, setDiagramRequest] = useState<DiagramSendRequest | null>(null);
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

  useEffect(() => {
    if (!live || !diagram) return undefined;
    setDiagramDrafter(diagram);
    const off = onSendToDiagram(setDiagramRequest);
    return () => {
      off();
      setDiagramDrafter(null);
    };
  }, [live, diagram]);

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
