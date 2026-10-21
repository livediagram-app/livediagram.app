'use client';

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page", "The
// workspace frame"): runs the page machine through the handshake and renewal, and renders a status screen until
// the workbench answers; then, signed in as the session's person (WorkbenchAuthBridge), the editor with the
// workbench surface in the document scope, or the workspace frame in the workspace scope. The address names the
// scope. The chunk the scope shows starts loading on mount, while redeem and binding run, so mounting never waits.
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { subscribeWorkbenchSessionRefused } from '@/lib/api/core';
import { WorkbenchAuthBridge } from '@/components/providers/WorkbenchAuthBridge';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import { useLatest } from '@/hooks/ui/useLatest';
import { addressOf } from './workbench-fragment';
import { useWorkbenchHandshake } from './useWorkbenchHandshake';
import { useWorkbenchRenewal } from './useWorkbenchRenewal';
import { endReasonOfInvalidSession } from './workbench-machine';
import { WorkbenchStatus } from './WorkbenchStatus';

const loadEditor = () => import('../../document/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <WorkbenchStatus phase={{ phase: 'reading' }} />,
});
const loadWorkspaceFrame = () => import('./WorkspaceFrame');
const WorkspaceFrame = dynamic(() => loadWorkspaceFrame().then((m) => m.WorkspaceFrame), {
  ssr: false,
  loading: () => <WorkbenchStatus phase={{ phase: 'reading' }} scope="workspace" />,
});

export function WorkbenchPage() {
  // The page the address names is the scope it asks for; read from the route, so the prerender agrees.
  const scope = addressOf({ pathname: usePathname() ?? '', search: '' }).scope;
  const { phase, port, dispatch } = useWorkbenchHandshake();
  useWorkbenchRenewal({ phase, port, dispatch });

  useEffect(() => {
    void (scope === 'workspace' ? loadWorkspaceFrame() : loadEditor());
  }, [scope]);

  // Entering `ended`: tell the workbench why, once.
  const endedReason = phase.phase === 'ended' ? phase.reason : null;
  useEffect(() => {
    if (!endedReason || !port) return;
    port.send({ type: 'livediagram:ended', v: 1, reason: endedReason });
    console.warn('[workbench] ended', { reason: endedReason });
  }, [endedReason, port]);

  // The api refused the session (`401 invalid_session`): revoked before its expiry, expired after.
  const expiresAtRef = useLatest(phase.phase === 'mounted' ? phase.session.expiresAt : null);
  useEffect(
    () =>
      subscribeWorkbenchSessionRefused(() => {
        const expiresAt = expiresAtRef.current;
        if (expiresAt === null) return;
        dispatch({ type: 'ended', reason: endReasonOfInvalidSession(expiresAt, Date.now()) });
      }),
    [dispatch, expiresAtRef],
  );

  const session = useMemo<WorkbenchSession | null>(() => {
    if ((phase.phase !== 'mounted' && phase.phase !== 'ended') || !port) return null;
    const s = phase.session;
    return {
      scope: s.scope,
      secret: s.session,
      documentId: s.documentId,
      tabId: s.tabId,
      shareCode: null,
      origin: s.origin,
      level: s.role,
      expiresAt: s.expiresAt,
      person: s.person,
      workbenchName: phase.name,
      port,
      ended: phase.phase === 'ended' ? phase.reason : null,
      end: (reason) => dispatch({ type: 'ended', reason }),
      frame: null,
    };
  }, [phase, port, dispatch]);

  if (session === null) {
    // Bound a moment before the port lands: still opening.
    const status = phase.phase === 'mounted' || phase.phase === 'ended' ? null : phase;
    return <WorkbenchStatus phase={status ?? { phase: 'reading' }} scope={scope} />;
  }
  return (
    <WorkbenchAuthBridge session={session}>
      {session.scope === 'workspace' ? <WorkspaceFrame /> : <EditorPage surface="workbench" />}
    </WorkbenchAuthBridge>
  );
}
