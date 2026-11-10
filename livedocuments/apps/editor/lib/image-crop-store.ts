// The one image being cropped on the canvas (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the
// editor"): an id or none. A small external store so the menu that starts a crop, the image's face that draws the
// crop overlay and the element wrapper that hides its handles agree without threading a prop through the canvas.
import { useSyncExternalStore } from 'react';

let croppingId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Starts cropping an image (ending any other). */
export function startImageCrop(id: string): void {
  if (croppingId === id) return;
  croppingId = id;
  emit();
}

/** Ends cropping, whichever image it was. */
export function endImageCrop(): void {
  if (croppingId === null) return;
  croppingId = null;
  emit();
}

export function imageCropId(): string | null {
  return croppingId;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Whether this element is the one being cropped: a boolean, so only it re-renders when cropping starts or ends. */
export function useIsImageCropping(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => croppingId === id,
    () => false,
  );
}
