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

// Whether Configure's screen is open: the cluster's Configure button toggles it, and Tab Style's Board Configure row
// opens it (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's profile").
let configuring = false;
const readConfiguring = () => configuring;

/** Opens or closes Configure over the tab's board. */
export function setBoardConfiguring(on: boolean): void {
  if (configuring === on) return;
  configuring = on;
  emit();
}

/** Whether Configure is open. */
export function useBoardConfiguring(): boolean {
  return useSyncExternalStore(subscribe, readConfiguring, () => false);
}
