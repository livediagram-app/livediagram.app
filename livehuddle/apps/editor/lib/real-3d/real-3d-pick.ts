// The press-to-piece hook between Real 3D's layer and the canvas's gestures (docs/specs/008-canvas/3d-engine.md "The
// camera and the pixel look"): the layer, while it is drawing, answers which piece a press is on from its own scene;
// the gestures ask it before the 3D view's own guesses. One layer draws at a time, so one slot is enough.

type Picker = (
  clientX: number,
  clientY: number,
) => { id: string; point: { x: number; y: number } } | null;

let picker: Picker | null = null;

/** Sets (or, with null, clears) the drawing layer's picker. */
export function setReal3DPicker(next: Picker | null): void {
  picker = next;
}

/** Whether Real 3D is drawing, so its scene, not the stood-up drawings, is what a press lands on. */
export function real3DDrawing(): boolean {
  return picker !== null;
}

/** The canvas point a press on a piece of Real 3D's scene stands for, or null when it is over none. */
export function real3DPointAt(clientX: number, clientY: number): { x: number; y: number } | null {
  return picker ? (picker(clientX, clientY)?.point ?? null) : null;
}

/** The piece a press lands on in Real 3D's scene, by id, or null when it is over none. */
export function real3DPieceAt(clientX: number, clientY: number): string | null {
  return picker ? (picker(clientX, clientY)?.id ?? null) : null;
}
