'use client';

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page"):
// runs the page machine through the handshake and renewal, and renders a status screen until the
// workbench answers; then the editor, signed in as the session's person (WorkbenchAuthBridge), with the
// workbench surface. The editor chunk starts loading on mount, while redeem and binding run, so
// mounting never waits on it.
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { subscribeWorkbenchSessionRefused } from '@/lib/api/core';
import { WorkbenchAuthBridge } from '@/components/providers/WorkbenchAuthBridge';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import { useLatest } from '@/hooks/ui/useLatest';
import { useWorkbenchHandshake } from './useWorkbenchHandshake';
import { useWorkbenchRenewal } from './useWorkbenchRenewal';
import { endReasonOfInvalidSession } from './workbench-machine';
import { WorkbenchStatus } from './WorkbenchStatus';

const loadEditor = () => import('../../document/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <WorkbenchStatus phase={{ phase: 'reading' }} />,
});

export function WorkbenchPage() {
  const { phase, port, dispatch } = useWorkbenchHandshake();
  useWorkbenchRenewal({ phase, port, dispatch });

  useEffect(() => {
    void loadEditor();
  }, []);

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
      secret: s.session,
      documentId: s.documentId,
      tabId: s.tabId,
      origin: s.origin,
      level: s.role,
      expiresAt: s.expiresAt,
      person: s.person,
      workbenchName: phase.name,
      port,
      ended: phase.phase === 'ended' ? phase.reason : null,
      end: (reason) => dispatch({ type: 'ended', reason }),
    };
  }, [phase, port, dispatch]);

  if (session === null) {
    // Bound a moment before the port lands: still opening.
    const status = phase.phase === 'mounted' || phase.phase === 'ended' ? null : phase;
    return <WorkbenchStatus phase={status ?? { phase: 'reading' }} />;
  }
  return (
    <WorkbenchAuthBridge session={session}>
      <EditorPage surface="workbench" />
    </WorkbenchAuthBridge>
  );
}
