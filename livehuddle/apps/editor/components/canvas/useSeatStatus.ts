'use client';

// Your status in Avatar mode with the status a seat piece sets laid over it (docs/specs/009-elements/workday-pieces.md
// "Statuses a piece sets"): a Nap Pod shows Focusing, a Treadmill or a Weight Bench On a Break, a Phone Booth Busy,
// while you sit there. Your own status is never written over, so standing up, being stood up, the piece going and
// leaving the mode all show it again with nothing to restore; a reconnect sends what shows now. A status picked while
// sitting is remembered with the seat it was picked on, and wins over the piece's until you stand.

import { useMemo, useState } from 'react';
import { useAvatarStatus } from '@livehuddle/avatar/hooks/useAvatarStatus';
import { pieceStatusOf, shownStatus } from '@livehuddle/avatar/seat-status';
import type { AvatarStatus } from '@livehuddle/avatar/status';

type Piece = { id: string; type: string; shape?: string };

export function useSeatStatus(
  inMode: boolean,
  seatedOn: string | null,
  elements: readonly Piece[],
): [AvatarStatus | null, (next: AvatarStatus | null) => void] {
  const [own, pickOwn] = useAvatarStatus(inMode);
  // The seat you sat on when you last picked: a pick made there outranks the piece while you stay.
  const [pickedOn, setPickedOn] = useState<string | null>(null);
  // A new seat (or standing up) forgets it, adjusted during render so a stale one never shows.
  const [seat, setSeat] = useState(seatedOn);
  if (seat !== seatedOn) {
    setSeat(seatedOn);
    if (pickedOn !== null) setPickedOn(null);
  }
  const kind = useMemo(
    () => (seatedOn ? elements.find((e) => e.id === seatedOn && e.type === 'shape')?.shape : null),
    [seatedOn, elements],
  );
  const shown = shownStatus(own, pickedOn, seatedOn, pieceStatusOf(kind));
  const pick = (next: AvatarStatus | null) => {
    setPickedOn(seatedOn);
    pickOwn(next);
  };
  return [shown, pick];
}
