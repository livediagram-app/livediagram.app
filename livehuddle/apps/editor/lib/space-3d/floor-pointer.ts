// Editing in the 3D view (docs/specs/008-canvas/3d-view.md "Editing in 3D"): while the view is tilted, a pointer's
// canvas point is where it meets the floor through the camera, not its flat screen offset. The canvas sets the
// unprojection while the view stands; every editing gesture reads it through `pointerToCanvas` and `pointerDelta`.

type Unproject = (clientX: number, clientY: number) => { x: number; y: number } | null;

let unproject: Unproject | null = null;

/** Sets (or, with null, clears) the tilted view's pointer-to-floor unprojection. */
export function setFloorPointer(next: Unproject | null): void {
  unproject = next;
}

/** The floor point under a pointer while the view is tilted; undefined while it is flat, null above the horizon. */
export function floorPointer(
  clientX: number,
  clientY: number,
): { x: number; y: number } | null | undefined {
  return unproject ? unproject(clientX, clientY) : undefined;
}
