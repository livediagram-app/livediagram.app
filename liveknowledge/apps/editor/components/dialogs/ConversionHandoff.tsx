'use client';

import { useState, useSyncExternalStore } from 'react';
import { readThisBrowserConversion } from '@liveworkspace/explorer/this-browser';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useConversionHandoff } from '@/hooks/persistence/useConversionHandoff';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';

// Take Offline and Sync handed over by the Explorer page on this address (docs/specs/006-document/offline-mode.md): it can't write this browser's
// offline store, so it opens the document here with the request in the address (`?convert=…&item=…`), and the editor
// runs it as the person, asking first. Read once as the page opens: without a request nothing more mounts.
const NO_SUBSCRIBE = () => () => {};
const readAsked = () => readThisBrowserConversion(window.location.search) !== null;
const NOT_ASKED = () => false;

export function ConversionHandoff() {
  // The server's answer is no: the address is read once hydrated, never during the prerender. Once asked it stays
  // mounted, since the hand-over takes the request out of the address while its dialog is open.
  const inAddress = useSyncExternalStore(NO_SUBSCRIBE, readAsked, NOT_ASKED);
  const [asked, setAsked] = useState(false);
  if (inAddress && !asked) setAsked(true);
  return asked ? <RunHandoff /> : null;
}

function RunHandoff() {
  const { accountUserId, authLoaded } = useAccountBootstrap();
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  useConversionHandoff(accountUserId ?? guestId, !!accountUserId);
  return null;
}
