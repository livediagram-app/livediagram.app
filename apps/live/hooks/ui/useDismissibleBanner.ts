'use client';

import { useLocalStorageValue, writeLocalStorageValue } from './useLocalStorageValue';

// Per-device "has this banner been dismissed" state, persisted in
// localStorage and kept in sync across tabs via the native `storage`
// event. Generic over the storage key so any one-shot, permanently-
// dismissible banner can reuse it (today: the Explorer sign-in
// nudge, docs/specs/014-identity/sign-in-encouragement.md).
//
// `dismissed` is false on the server and the render that hydrates, then
// settles to the stored value (useLocalStorageValue), so a static export
// never reads localStorage during render and there's no hydration
// mismatch. The host decides what to show while `dismissed` is false,
// which is the correct default (show it).
export function useDismissibleBanner(storageKey: string): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const dismissed = useLocalStorageValue(storageKey) === '1';
  const dismiss = () => writeLocalStorageValue(storageKey, '1');
  return { dismissed, dismiss };
}
