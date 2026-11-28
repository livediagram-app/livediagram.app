// The tilt the 3D view has right now (docs/specs/008-canvas/3d-view.md), for a walking press traced back to the floor.
// The view is always 3D (the owner, 2026-11-27: "remove the 2d mode entirely, 3d always"); there is no switch and
// nothing remembered.

// The tilt the view has right now, in degrees: 0 only while it first rises. Written by the view, read when a walking
// press is traced back to the floor.
let tiltNow = 0;
export function space3DTiltNow(): number {
  return tiltNow;
}
export function setSpace3DTiltNow(deg: number): void {
  tiltNow = deg;
}
