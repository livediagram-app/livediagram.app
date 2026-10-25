'use client';

import { useEffect, useState } from 'react';
import { useRetiredPartsMove } from '@/hooks/persistence/useRetiredPartsMove';
import { countRetiredParts } from '@/lib/offline/retired-parts';
import {
  dismissRetiredPartsOffer,
  retiredPartsOfferDismissed,
} from '@/lib/offline/retired-parts-dismissal';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { RetiredPartsDialog } from './RetiredPartsDialog';

// The offer on load to move retired parts (docs/specs/006-document/offline-mode.md "Moving retired parts to the
// other apps"): once the page acts as someone (`ownerId`), and only when the set-aside store holds anything and
// this browser has not said Not Now. At most once per page load. Renders nothing until there is something to offer.

export const RETIRED_PARTS_NOT_NOW_HINT = 'You can move them later from Settings › Account.';

let offeredThisLoad = false;

export function RetiredPartsOffer({
  ownerId,
  onBusyChange,
}: {
  ownerId: string | null;
  // True until the check has answered, and while the dialog is up: the move prompt after signing in waits for it,
  // so the two are never shown at once.
  onBusyChange?: (busy: boolean) => void;
}) {
  const move = useRetiredPartsMove(ownerId);
  const { offer } = move;
  // Already answered when this page load has offered, or this browser said Not Now: nothing to check.
  const [checked, setChecked] = useState(() => offeredThisLoad || retiredPartsOfferDismissed());
  const busy = !checked || move.phase.kind !== 'idle';

  useEffect(() => {
    if (!ownerId || checked || offeredThisLoad) return;
    offeredThisLoad = true;
    void countRetiredParts()
      .then((count) => (count > 0 ? offer() : false))
      .catch((err: unknown) => debugLog(`[retired-parts] count failed: ${String(err)}`))
      .finally(() => setChecked(true));
  }, [ownerId, checked, offer]);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  return (
    <RetiredPartsDialog
      phase={move.phase}
      onMove={() => void move.move()}
      onNotNow={() => {
        dismissRetiredPartsOffer();
        move.notNow();
      }}
      onClose={move.close}
      notNowHint={RETIRED_PARTS_NOT_NOW_HINT}
    />
  );
}

// Test seam: a fresh page load.
export function __resetRetiredPartsOffer(): void {
  offeredThisLoad = false;
}
