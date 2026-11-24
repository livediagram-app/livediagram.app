// Show on the Screen's open state (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows"): which
// Screen the dialog is choosing for, and which source it opens on. A store of its own, as the dialog opens from the
// element menu and the walking reader, which both close as it opens; EditorElementDialogs draws it.
import { useSyncExternalStore } from 'react';

export type ScreenPickerTab = 'file' | 'video';
export type ScreenPickerOpen = { elementId: string; tab: ScreenPickerTab } | null;

let open: ScreenPickerOpen = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Opens Show on the Screen for one Screen, on the source it shows now (File when it shows none). */
export function openScreenPicker(elementId: string, tab: ScreenPickerTab = 'file'): void {
  open = { elementId, tab };
  emit();
}

export function closeScreenPicker(): void {
  if (!open) return;
  open = null;
  emit();
}

/** What is open now, for a test or a caller outside React. */
export const screenPickerOpen = (): ScreenPickerOpen => open;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => open;
const none = () => null;

export function useScreenPicker(): ScreenPickerOpen {
  return useSyncExternalStore(subscribe, read, none);
}
