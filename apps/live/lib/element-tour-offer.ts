import { useSyncExternalStore } from 'react';
import type { ElementTourKind } from './element-tours';

// The element tour offer on screen (docs/specs/007-editor/element-tours.md "The tour offer"): ElementTourHost decides
// whether the selected element is offered its tour and publishes it here; the selection toolbar, which lives in the
// canvas, reads it and draws the offer beside itself. A module store, like tour-active: one editor per page.

export type ElementTourOffer = {
  elementId: string;
  kind: ElementTourKind;
  play: () => void;
  dismiss: () => void;
};

let current: ElementTourOffer | null = null;
const listeners = new Set<() => void>();

export function setElementTourOffer(next: ElementTourOffer | null): void {
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

export function elementTourOffer(): ElementTourOffer | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The offer, when it is for this element; null otherwise (so other selections never re-render for it). */
export function useElementTourOffer(elementId: string | null): ElementTourOffer | null {
  return useSyncExternalStore(
    subscribe,
    () => (elementId !== null && current?.elementId === elementId ? current : null),
    () => null,
  );
}
