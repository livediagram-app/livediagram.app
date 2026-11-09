import { useEffect } from 'react';

// Whether your walking status is Do Not Disturb (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Do Not
// Disturb"), for the sounds that play away from the canvas: the join and leave chimes
// (docs/specs/012-collaboration/join-and-leave-sounds.md) and the nudge (docs/specs/012-collaboration/nudge.md). The
// characters layer, which knows the status, writes it; a sound reads it when it would play. Nothing subscribes.

let doNotDisturb = false;

export function setQuietForDoNotDisturb(next: boolean): void {
  doNotDisturb = next;
}

export function quietForDoNotDisturb(): boolean {
  return doNotDisturb;
}

/** Mirror the walking status into the flag while mounted; leaving Avatar mode clears it. */
export function useQuietForDoNotDisturb(on: boolean): void {
  useEffect(() => {
    setQuietForDoNotDisturb(on);
    return () => setQuietForDoNotDisturb(false);
  }, [on]);
}
