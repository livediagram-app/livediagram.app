'use client';

// The Sheet Settings each drawn Sheet offers, by element id, for the element menu's Sheet flyout
// (docs/specs/029-sheets/sheet.md "Sheet Settings"): the menu draws the same panel as the header's cog, with the
// Sheet's own controller, kept current as the Sheet renders.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { SheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import { createListeners } from '@/lib/listeners';

type SheetSettingsEntry = {
  controller: SheetController;
  actions: SheetActions;
  onImportCsv: () => void;
};

const entries = new Map<string, SheetSettingsEntry>();
const listeners = createListeners();
const emit = () => {
  listeners.notify();
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

// The entry now, outside React: the tab menu's Import CSV and Download CSV on a Sheet tab, at the press.
export function sheetSettingsEntryOf(elementId: string): SheetSettingsEntry | undefined {
  return entries.get(elementId);
}

export function useSheetSettingsEntry(elementId: string): SheetSettingsEntry | undefined {
  return useSyncExternalStore(
    listeners.subscribe,
    () => entries.get(elementId),
    () => undefined,
  );
}
