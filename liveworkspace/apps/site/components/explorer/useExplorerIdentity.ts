'use client';

// Who the Explorer asks the index as (lib/explorer/token.ts), for ExplorerShell: asked once the page knows where it
// is, before the Explorer asks the index anything, and again after signing out here. The wait is bounded
// (liveworkspace/docs/specs/010-site/site.md "The Explorer"): with no answer in IDENTITY_WAIT_MS, or a failed one,
// `failed` is set and Home·Loaded·Stalled counted, so the page shows Try Again (`retry`) rather than its placeholders
// for good. An answer that lands later still opens the Explorer.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resetWorkspaceIdentity,
  workspaceIdentity,
  type WorkspaceIdentity,
} from '@/lib/explorer/token';
import { trackExplorerStalled } from '@/lib/explorer/telemetry';

// Past the token asks' own 10 s limits (APP_TOKEN_TIMEOUT_MS), so those normally answer first. 2026-11-15: a stalled
// token answer held every app's Explorer on its placeholders.
export const IDENTITY_WAIT_MS = 12_000;

export function useExplorerIdentity({
  ready,
  sessionState,
}: {
  // The page knows where it is (not while prerendered, nor while leaving).
  ready: boolean;
  // liveworkspace.app's own session state: `in` then `out` is a sign-out here.
  sessionState: string;
}) {
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by Try Again: the person is asked for again.
  const [attempt, setAttempt] = useState(0);
  const lastSession = useRef(sessionState);

  useEffect(() => {
    if (!ready) return;
    const signedOut = lastSession.current === 'in' && sessionState === 'out';
    lastSession.current = sessionState;
    if (identity && !signedOut) return;
    if (signedOut) resetWorkspaceIdentity();
    let live = true;
    let settled = false;
    const giveUp = () => {
      setFailed(true);
      trackExplorerStalled();
    };
    const wait = setTimeout(() => {
      if (!settled) giveUp();
    }, IDENTITY_WAIT_MS);
    void workspaceIdentity().then((found) => {
      settled = true;
      clearTimeout(wait);
      if (!live) return;
      if (found) {
        setFailed(false);
        setIdentity(found);
      } else giveUp();
    });
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [ready, sessionState, identity, attempt]);

  const retry = useCallback(() => {
    resetWorkspaceIdentity();
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return { identity, setIdentity, failed, retry };
}
