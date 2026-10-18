'use client';

import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// The entity field being edited in place (docs/specs/009-elements/entity.md "Editing on the canvas"): which
// entity and which of its fields. Editor-local and never in the document, like the lane preview: the
// field's text reaches the document only when the row is saved.
//
// A module store because it has publishers outside the entity's own view (the quick-connect ring's Add
// Field, Add Related Entity) that need to open a row on an element they did not render. Only the selected,
// editable entity's controls subscribe, so a change re-renders one element.

export type EntityFieldEdit = { entityId: string; index: number };

let current: EntityFieldEdit | null = null;
const listeners = createListeners();

export function setEntityFieldEdit(next: EntityFieldEdit | null): void {
  if (current?.entityId === next?.entityId && current?.index === next?.index) return;
  current = next;
  listeners.notify();
}

export function getEntityFieldEdit(): EntityFieldEdit | null {
  return current;
}

// The field index being edited on `entityId`, or null.
export function useEntityFieldEdit(entityId: string): number | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => (current?.entityId === entityId ? current.index : null),
    () => null,
  );
}
