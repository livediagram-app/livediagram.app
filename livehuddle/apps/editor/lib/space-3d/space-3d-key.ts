// The 3D view's keys (docs/specs/008-canvas/3d-view.md "Turning the camera"): `[` and `]` turn the camera. Pure.

/** Turn Left (`[`) or Turn Right (`]`) while walking in the 3D view (3d-view.md "Turning the camera"), else null. */
export function space3DTurnKey(e: {
  code: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): -1 | 1 | null {
  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.code === 'BracketLeft') return -1;
  if (e.code === 'BracketRight') return 1;
  return null;
}
