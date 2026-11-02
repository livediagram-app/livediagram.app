// How far a lane's seam drag has gone along the lane's own axis (docs/specs/009-elements/lane.md
// "Heading size"). The pointer moves on screen; a turned lane's heading grows along its own x (a side
// strip) or y (a band), so the screen travel is projected into the lane's unrotated frame, the same
// turn a rotated element's resize undoes (boxed-drag-resolve).
export function laneSeamTravel(dx: number, dy: number, rotation: number, band: boolean): number {
  if (rotation % 360 === 0) return band ? dy : dx;
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return band ? -dx * sin + dy * cos : dx * cos + dy * sin;
}
