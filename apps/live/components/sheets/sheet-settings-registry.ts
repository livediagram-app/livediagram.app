'use client';

// The Sheet Settings each drawn Sheet offers, by element id, for the element menu's Sheet flyout
// (docs/specs/029-sheets/sheet.md "Sheet Settings"): the menu draws the same panel as the header's cog, with the
// Sheet's own controller, kept current as the Sheet renders.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { SheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';

export type SheetSettingsEntry = {
  controller: SheetController;
  actions: SheetActions;
  onImportCsv: () => void;
};

const entries = new Map<string, SheetSettingsEntry>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of [...listeners]) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// A drawn Sheet publishes its settings each render, and takes them back when it goes.
export function usePublishSheetSettings(elementId: string, entry: SheetSettingsEntry): void {
  useLayoutEffect(() => {
    entries.set(elementId, entry);
    emit();
  });
  useLayoutEffect(
    () => () => {
      entries.delete(elementId);
      emit();
    },
    [elementId],
  );
}

export function useSheetSettingsEntry(elementId: string): SheetSettingsEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(elementId),
    () => undefined,
  );
}
