// The press-to-piece hook between Real 3D's layer and the canvas's gestures (docs/specs/008-canvas/3d-engine.md "The
// camera and the pixel look"): the layer, while it is drawing, answers which piece a press is on from its own scene;
// the gestures ask it before the 3D view's own guesses. One layer draws at a time, so one slot is enough.

type Picker = (
  clientX: number,
  clientY: number,
) => { id: string | null; point: { x: number; y: number } } | null;

let picker: Picker | null = null;

/** Sets (or, with null, clears) the drawing layer's picker. */
export function setReal3DPicker(next: Picker | null): void {
  picker = next;
}

type Projector = (x: number, y: number, z: number) => { x: number; y: number } | null;
let projector: Projector | null = null;

/** Sets (or, with null, clears) the drawing layer's projection from a canvas point to the screen. */
export function setReal3DProjector(next: Projector | null): void {
  projector = next;
}

/**
 * Where a canvas point (on the floor, or `z` above it) shows on the screen, in client px, as Real 3D draws it; null
 * when Real 3D is not drawing. What the canvas draws over the scene in screen space (the snap guides) goes through it.
 */
export function real3DScreenAt(x: number, y: number, z = 0): { x: number; y: number } | null {
  return projector ? projector(x, y, z) : null;
}

/** Whether Real 3D is drawing, so its scene, not the stood-up drawings, is what a press lands on. */
export function real3DDrawing(): boolean {
  return picker !== null;
}

/**
 * The canvas point a press on Real 3D's scene stands for: on a piece's model, or on the floor under it (traced through
 * the camera the scene drew with, so it is where the press is seen to land); null above the horizon.
 */
export function real3DPointAt(clientX: number, clientY: number): { x: number; y: number } | null {
  return picker ? (picker(clientX, clientY)?.point ?? null) : null;
}

/** The piece a press lands on in Real 3D's scene, by id, or null when it is over none. */
export function real3DPieceAt(clientX: number, clientY: number): string | null {
  return picker ? (picker(clientX, clientY)?.id ?? null) : null;
}

// Each modelled piece's model box (piece-pick.ts), so what floats over a piece (the selection toolbar,
// docs/specs/008-canvas/3d-view.md "Editing in 3D") sits over the model as drawn, not over its footprint.
type ModelBox = {
  f: { cx: number; cy: number; yaw: number };
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z1: number;
};
let models: ReadonlyMap<string, ModelBox> = new Map();
let version = 0;
const listeners = new Set<() => void>();

/** Sets (or, with an empty map, clears) the drawing layer's model boxes, and tells whoever places over them. */
export function setReal3DModels(next: ReadonlyMap<string, ModelBox>): void {
  models = next;
  version++;
  for (const fn of listeners) fn();
}

/** For useSyncExternalStore: re-place what floats over a piece when the models are rebuilt. */
export function subscribeReal3DModels(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const real3DModelsVersion = (): number => version;

/** The corners (canvas x, y and height z) of these pieces' model boxes; empty for what is not modelled. */
export function real3DCornersOf(ids: Iterable<string>): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (const id of ids) {
    const m = models.get(id);
    if (!m) continue;
    const c = Math.cos(m.f.yaw);
    const s = Math.sin(m.f.yaw);
    for (const x of [m.x0, m.x1])
      for (const y of [m.y0, m.y1])
        for (const z of [0, Math.max(0, m.z1)])
          out.push({ x: m.f.cx + x * c - y * s, y: m.f.cy + x * s + y * c, z });
  }
  return out;
}

// Aiming a wall piece (wall-aim.ts): the drawing layer answers where the sight line through a floor point first meets
// a standing wall in its scene.
type WallAim = (floor: { x: number; y: number }) => {
  at: { x: number; y: number };
  toward: { x: number; y: number };
} | null;
let wallAim: WallAim | null = null;

/** Sets (or, with null, clears) the drawing layer's wall aim. */
export function setReal3DWallAim(next: WallAim | null): void {
  wallAim = next;
}

/**
 * Where the camera's sight line to a floor point first meets a standing wall, with a point on the camera's side of
 * it (docs/specs/009-elements/wall-pieces.md "Aimed at a wall in 3D"); null when it meets none or Real 3D is not
 * drawing.
 */
export function real3DWallAim(floor: { x: number; y: number }): ReturnType<WallAim> {
  return wallAim ? wallAim(floor) : null;
}
