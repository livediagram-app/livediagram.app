// Which photo dialog is open (docs/specs/031-photo/photo-pages.md "The title bar"): the menus, the
// shortcuts and the command palette open them by name; PhotoDialogs draws the one open.
import { useSyncExternalStore } from 'react';
import type { AdjustmentId } from '@livedesign/photo-engine';
import type { ModifyHow } from './selection-ops';

export type PhotoDialog =
  | { kind: 'image-size' }
  | { kind: 'canvas-size' }
  | { kind: 'rotate' }
  | { kind: 'fill' }
  | { kind: 'filter'; id: string }
  | { kind: 'adjust'; id: AdjustmentId }
  | { kind: 'colour-range' }
  | { kind: 'modify'; how: ModifyHow | 'grow' }
  | { kind: 'flatten' }
  | { kind: 'place' }
  | { kind: 'select-and-mask' };

let open: PhotoDialog | null = null;
const listeners = new Set<() => void>();

export const photoDialogs = {
  get: (): PhotoDialog | null => open,
  open(next: PhotoDialog): void {
    open = next;
    for (const fn of listeners) fn();
  },
  close(): void {
    open = null;
    for (const fn of listeners) fn();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function usePhotoDialog(): PhotoDialog | null {
  return useSyncExternalStore(
    (fn) => photoDialogs.subscribe(fn),
    photoDialogs.get,
    () => null,
  );
}

// The last filter applied, for Repeat (Ctrl/Cmd+Alt+F): its id and settings.
let lastFilter: { id: string; params: Record<string, unknown> } | null = null;
export const lastPhotoFilter = {
  get: () => lastFilter,
  set: (f: { id: string; params: Record<string, unknown> }) => {
    lastFilter = f;
  },
};
