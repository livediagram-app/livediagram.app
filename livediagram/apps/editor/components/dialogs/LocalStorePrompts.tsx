'use client';

import { useState } from 'react';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useLegacyGuestClaim } from '@/hooks/persistence/useLegacyGuestClaim';
import { useSettledOwnerId } from '@/hooks/persistence/useSettledOwnerId';
import { LocalMovePrompt } from './LocalMovePrompt';
import { RetiredPartsOffer } from './RetiredPartsOffer';

// What the editor does about this browser's own store once the page knows who it is acting as: claims an old
// livediagram.app guest (docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site"),
// offers to move retired parts (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps"),
// then, never at the same time, the move prompt after signing in.
export function LocalStorePrompts() {
  const { authLoaded, accountUserId } = useAccountBootstrap();
  const ownerId = useSettledOwnerId(authLoaded, accountUserId);
  useLegacyGuestClaim(true, ownerId);
  const [offerBusy, setOfferBusy] = useState(true);
  return (
    <>
      <RetiredPartsOffer ownerId={ownerId} onBusyChange={setOfferBusy} />
      <LocalMovePrompt enabled={!offerBusy} />
    </>
  );
}
