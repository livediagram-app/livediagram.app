'use client';

// The board the bottom-right cluster's Configure button opens (docs/specs/026-plan/plan-board.md "Configure"): a
// Board tab's board, the one board filling its tab, registers itself here while an Editor has it on screen; the
// cluster reads it. None (an ordinary tab, a Dashboard, a viewer), and the cluster shows no Configure.
import { useEffect, useSyncExternalStore } from 'react';

let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const read = () => current;

/** Registers `elementId` as the tab's board to configure while `on`; clears it after. */
export function useRegisterConfigurableBoard(elementId: string, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    current = elementId;
    emit();
    return () => {
      if (current !== elementId) return;
      current = null;
      emit();
    };
  }, [elementId, on]);
}

/** The board Configure opens, or null. */
export function useConfigurableBoard(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
