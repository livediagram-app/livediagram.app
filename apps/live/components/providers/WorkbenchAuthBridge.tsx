'use client';

// Signs the editor in as the workbench session's person (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "The editor in a workbench"): a nested DeferredAuthContext with the session's
// identity, the session itself in WorkbenchSessionContext, and the `lvw_` secret as the api client's
// token. The provider and the confinement are in place before any child's layout effect runs, so the
// editor's first request already presents the session (and is judged by the allow-list).
import { useLayoutEffect, useMemo, type ReactNode, type RefObject } from 'react';
import { registerTokenProvider, setWorkbenchConfinement } from '@/lib/api/core';
import { useLatest } from '@/hooks/ui/useLatest';
import { DeferredAuthContext, type DeferredAuthState } from './deferred-auth';
import { WorkbenchSessionContext, type WorkbenchSession } from './workbench-session-context';

export function WorkbenchAuthBridge({
  session,
  children,
}: {
  session: WorkbenchSession;
  children: ReactNode;
}) {
  // Renewal swaps the secret; the provider and the published getter read the newest one.
  const secretRef = useLatest(session.secret);
  const { person, documentId } = session;

  const auth = useMemo<DeferredAuthState>(
    () => ({
      authLoaded: true,
      isSignedIn: true,
      userId: person.id,
      user: {
        id: person.id,
        firstName: person.name,
        lastName: null,
        fullName: person.name,
        username: null,
        email: null,
        createdAt: null,
        pictureUrl: person.pictureUrl,
      },
      getToken: async () => secretRef.current,
      signOut: async () => {},
      deleteAccount: null,
    }),
    [person, secretRef],
  );

  return (
    <DeferredAuthContext.Provider value={auth}>
      <WorkbenchSessionContext.Provider value={session}>
        {/* First: siblings' layout effects run in order, and a child's before its parent's, so this
            leaf's run before any in the editor (its bootstrap fetches from one). */}
        <SessionCredentials
          secretRef={secretRef}
          secret={session.secret}
          documentId={documentId}
          ownerId={person.id}
        />
        {children}
      </WorkbenchSessionContext.Provider>
    </DeferredAuthContext.Provider>
  );
}

function SessionCredentials({
  secretRef,
  secret,
  documentId,
  ownerId,
}: {
  secretRef: RefObject<string>;
  secret: string;
  documentId: string;
  ownerId: string;
}) {
  useLayoutEffect(() => registerTokenProvider(async () => secretRef.current), [secretRef]);
  // Set on mount and on every renewal; never cleared, so a dead bearer keeps refusing locally.
  useLayoutEffect(() => {
    setWorkbenchConfinement({ documentId, ownerId });
  }, [documentId, ownerId, secret]);
  return null;
}
