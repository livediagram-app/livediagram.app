// A touch-first device (docs/specs/031-photo/blueprints/photo-engine.md "Constants and configuration"), which gets the smaller
// budgets: the pixel cap (image-ops.ts), the tile cache (pixels-store.ts) and the GPU textures (gl/gl-compositor.ts).
export function coarsePointer(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}
