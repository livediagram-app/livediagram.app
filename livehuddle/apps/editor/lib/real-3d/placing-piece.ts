// The piece being placed from the palette (docs/specs/008-canvas/3d-view.md "Editing in 3D"): PlacementPreview
// publishes where it would land, and the Real 3D layer draws its model there, as it will stand once dropped. The layer
// says back whether it drew it, so the flat preview steps aside only for a piece the 3D view really shows.

import { useSyncExternalStore } from 'react';
import type { Element } from '@livehuddle/document';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';

/** Where the piece being placed would land, or null when nothing is being placed. */
export const placingPiece = createStateStore<Element | null>(null);
/** Whether the 3D view draws the piece being placed (its model, not the flat preview). */
export const placingDrawn = createStateStore<boolean>(false);

export function usePlacingPiece(): Element | null {
  return useSyncExternalStore(placingPiece.subscribe, placingPiece.get, () => null);
}

export function usePlacingDrawn(): boolean {
  return useSyncExternalStore(placingDrawn.subscribe, placingDrawn.get, () => false);
}
