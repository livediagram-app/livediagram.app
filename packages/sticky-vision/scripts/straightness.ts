import type { ImageBuffer } from '../src/colour';

// How STRAIGHT the edge is along each side of a box (a probe for the junk
// experiments, C1): per scan line across a band either side of the side, the
// strongest brightness step is found, a straight line is fitted through
// those positions, and the side scores the share of scan lines lying within
// STRAIGHT_TOLERANCE_PX of it. Paper ends in a straight cut edge; a patch of
// wall or a crumpled surface has its strongest step anywhere.
//
// Returns the four side scores, weakest first (sides whose band leaves the
// frame are left out).

const BAND = 0.2;
const STRAIGHT_TOLERANCE_PX = 1.5;

const luma = (image: ImageBuffer, x: number, y: number) => {
  const i = (y * image.width + x) * 4;
  return 0.299 * image.data[i]! + 0.587 * image.data[i + 1]! + 0.114 * image.data[i + 2]!;
};

function fitShare(points: { t: number; p: number }[]): number {
  if (points.length < 4) return 0;
  const n = points.length;
  const mt = points.reduce((a, q) => a + q.t, 0) / n;
  const mp = points.reduce((a, q) => a + q.p, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const q of points) {
    sxy += (q.t - mt) * (q.p - mp);
    sxx += (q.t - mt) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  // One refit on the inliers, so a few scan lines through handwriting or a
  // neighbour's edge do not tilt the line.
  const near = points.filter(
    (q) => Math.abs(mp + slope * (q.t - mt) - q.p) <= STRAIGHT_TOLERANCE_PX * 2,
  );
  if (near.length < 4) return near.length / n;
  const mt2 = near.reduce((a, q) => a + q.t, 0) / near.length;
  const mp2 = near.reduce((a, q) => a + q.p, 0) / near.length;
  let sxy2 = 0;
  let sxx2 = 0;
  for (const q of near) {
    sxy2 += (q.t - mt2) * (q.p - mp2);
    sxx2 += (q.t - mt2) ** 2;
  }
  const slope2 = sxx2 === 0 ? 0 : sxy2 / sxx2;
  return (
    points.filter((q) => Math.abs(mp2 + slope2 * (q.t - mt2) - q.p) <= STRAIGHT_TOLERANCE_PX)
      .length / n
  );
}

export function straightSidesOf(
  image: ImageBuffer,
  box: { x: number; y: number; w: number; h: number },
): number[] {
  const band = Math.max(3, Math.round(Math.min(box.w, box.h) * BAND));
  const out: number[] = [];
  // Horizontal sides: scan columns, step along y.
  for (const edgeY of [box.y, box.y + box.h]) {
    if (edgeY - band < 1 || edgeY + band >= image.height - 1) continue;
    const pts: { t: number; p: number }[] = [];
    for (let x = box.x + 2; x < box.x + box.w - 2; x += 1) {
      if (x < 0 || x >= image.width) continue;
      let best = 0;
      let at = 0;
      for (let y = edgeY - band; y <= edgeY + band; y += 1) {
        const g = Math.abs(luma(image, x, y + 1) - luma(image, x, y - 1));
        if (g > best) {
          best = g;
          at = y;
        }
      }
      pts.push({ t: x, p: at });
    }
    out.push(fitShare(pts));
  }
  for (const edgeX of [box.x, box.x + box.w]) {
    if (edgeX - band < 1 || edgeX + band >= image.width - 1) continue;
    const pts: { t: number; p: number }[] = [];
    for (let y = box.y + 2; y < box.y + box.h - 2; y += 1) {
      if (y < 0 || y >= image.height) continue;
      let best = 0;
      let at = 0;
      for (let x = edgeX - band; x <= edgeX + band; x += 1) {
        const g = Math.abs(luma(image, x + 1, y) - luma(image, x - 1, y));
        if (g > best) {
          best = g;
          at = x;
        }
      }
      pts.push({ t: y, p: at });
    }
    out.push(fitShare(pts));
  }
  return out.sort((a, b) => a - b);
}
