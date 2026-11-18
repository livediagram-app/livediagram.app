'use client';

// Whether the board filling its tab shows any card, after its filter (docs/specs/012-collaboration/walkthroughs.md
// "No dead control"): a Board tab's board registers it here while on screen, and the walkthroughs' Hide From Recording
// reads it (lib/walkthrough-hideable.ts), so a board filtered down to no cards offers nothing to hide.
import { useEffect, useSyncExternalStore } from 'react';

export type ShownCards = { elementId: string; any: boolean };

let current: ShownCards | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const read = () => current;

/** Registers whether the board `elementId` shows any card while `on` (it fills its tab); clears it after. */
export function useRegisterShownCards(elementId: string, any: boolean, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    // One object per change, so a reader re-renders only when the answer does.
    current = { elementId, any };
    emit();
    return () => {
      if (current?.elementId !== elementId) return;
      current = null;
      emit();
    };
  }, [elementId, any, on]);
}

/** The board filling its tab and whether it shows any card, or null when none has said. */
export function useShownCards(): ShownCards | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
