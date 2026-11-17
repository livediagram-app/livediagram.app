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
