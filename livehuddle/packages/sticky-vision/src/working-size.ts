// The size the detector sees a photograph at: the long edge shrunk to the
// working edge (never enlarged — a small photo holds only the detail it has),
// the shape kept. One rule, shared by the editor and the calibration sweep,
// so that the sweep scores the very image the product detects on.
export function workingSizeOf(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; scale: number } {
  const longest = Math.max(width, height);
  // Exact, not derived from the rounded sides: crops are cut from the full
  // photograph by dividing by it.
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}
