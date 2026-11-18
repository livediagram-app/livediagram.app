// The 3D view's key (docs/specs/008-canvas/3d-view.md "Turning it on and off"): Shift+3, matched on the key's code as
// Shift+1 (Zoom to Fit) is, so it is the same key on every layout. Pure.

export function isSpace3DKey(e: {
  code: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat?: boolean;
}): boolean {
  return e.code === 'Digit3' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat;
}

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
