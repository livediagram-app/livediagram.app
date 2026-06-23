'use client';

import { useEffect, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

// Per-device "has this banner been dismissed" state, persisted in
// localStorage and kept in sync across tabs via the native `storage`
// event. Generic over the storage key so any one-shot, permanently-
// dismissible banner can reuse it (today: the Explorer sign-in
// nudge, spec/36).
//
// `dismissed` starts false on the server and the first client paint,
// then settles to the stored value in an effect, so a static export
// (no `window` at build time) never reads localStorage during render
// and there's no hydration mismatch. The host decides what to show
// while `dismissed` is false, which is the correct default (show it).
export function useDismissibleBanner(storageKey: string): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(readLocalStorageSafe(storageKey) === '1');
    // Cross-tab: if the user dismisses (or this resets) in another
    // tab, mirror it here so the banner doesn't linger.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setDismissed(e.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    writeLocalStorageSafe(storageKey, '1');
  };

  return { dismissed, dismiss };
}
