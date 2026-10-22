'use client';

// Freeing an element somebody else is holding through the concurrent-selection lock
// (docs/specs/007-editor/live-app.md), so the room can get on with it. Any Editor may: the room
// tells the holder alone, and their selection falls away through the ordinary `select` op.

import { useCallback } from 'react';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';

export function useReleaseSelectionLock(deps: {
  /** Send one frame to the room. No-op before the socket is up. */
  send: (msg: { kind: 'facilitator'; action: 'unlock'; target: string; elementId: string }) => void;
}): (presenceId: string, elementId: string) => void {
  const ref = useLatest(deps);
  return useCallback(
    (presenceId: string, elementId: string) => {
      ref.current.send({ kind: 'facilitator', action: 'unlock', target: presenceId, elementId });
      // Telemetry on the ask (docs/specs/017-telemetry/telemetry.md): the answer goes to the holder alone.
      track('Facilitator', 'Changed', 'Unlocked');
    },
    [ref],
  );
}
