// Two people who sat on one seat at once (livediagram's docs/specs/009-elements/chair.md "Occupancy is presence"):
// whenever presence changes while we sit, the later claim stands up beside the seat. Every machine runs the same
// rule (`yieldFrom`), so exactly one of the two gets up and nothing locks the seat.

import { useEffect, useEffectEvent } from 'react';
import type { AvatarSceneElement } from '../scene';
import { yieldFrom, type SeatClaim, type SeatHolder } from '../seat-claims';
import type { AvatarPoint } from '../walk';

export function useSeatYield<E extends AvatarSceneElement>({
  seatedOn,
  claim,
  elements,
  peers,
  onYield,
}: {
  // Our own seat (useAvatarWalk's `seatedOn` and `seatClaim`).
  seatedOn: string | null;
  claim: SeatClaim | null;
  elements: readonly E[];
  // The peers on this tab, as their presence says; a stable list, rebuilt only when presence changes.
  peers: readonly SeatHolder[];
  // Stand up at this point (useAvatarWalk's `stepAside`).
  onYield: (at: AvatarPoint) => void;
}): void {
  const giveUp = useEffectEvent(onYield);
  useEffect(() => {
    const at = yieldFrom(elements, seatedOn, claim, peers);
    if (at) giveUp(at);
  }, [elements, seatedOn, claim, peers]);
}
