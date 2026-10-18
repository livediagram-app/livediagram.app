import { useEffect } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { OFFER_FOLD_MS } from './coach-dock-copy';

// The coach dock's fold timer (blueprints/coach-dock.md "Behaviour and state"): while `armed` and not held (a
// pointer over the dock, focus inside it), `onFold` runs once OFFER_FOLD_MS on. Holding clears it; letting go
// starts it again from full, so someone reading slowly is never folded mid-sentence.
export function useFoldTimer(armed: boolean, hold: boolean, onFold: () => void): void {
  const onFoldRef = useLatest(onFold);
  useEffect(() => {
    if (!armed || hold) return;
    const t = setTimeout(() => onFoldRef.current(), OFFER_FOLD_MS);
    return () => clearTimeout(t);
  }, [armed, hold, onFoldRef]);
}
