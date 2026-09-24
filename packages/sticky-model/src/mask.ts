// The three classes a boundary model predicts per pixel (the cell-biology
// formulation of Ronneberger's U-Net): the CORE of a note, the SEAM ring round
// its edge, and everything else. Two notes lapped or flush against each other
// share no background, but their cores are always two seams apart, so the
// cores come out as separate blobs where a colour mask welds them.

export const CLASS = { background: 0, core: 1, seam: 2 } as const;
export const CLASS_COUNT = 3;

// An id for paper that belongs to more than one note (two labelled boxes
// overlap): which note is on top is unknown, so it can only ever be seam.
export const AMBIGUOUS_ID = -1;

// The seam is a tenth of the note's short side, and never under two pixels:
// thin enough that the core still says where the note is, wide enough that
// two touching cores are at least four pixels apart after downsampling.
export const SEAM_FRACTION = 0.1;
export const MIN_SEAM_PX = 2;

export function seamRadiusFor(w: number, h: number): number {
  return Math.max(MIN_SEAM_PX, Math.round(SEAM_FRACTION * Math.min(w, h)));
}

export type Rect = { x: number; y: number; w: number; h: number };

// The note a core belongs to: the inverse of `seamRadiusFor`, so a core found
// by the model grows back to the size of the paper it came from.
export function noteFromCore(core: Rect): Rect {
  const side = Math.min(core.w, core.h);
  const r = Math.max(MIN_SEAM_PX, Math.round((SEAM_FRACTION * side) / (1 - 2 * SEAM_FRACTION)));
  return { x: core.x - r, y: core.y - r, w: core.w + 2 * r, h: core.h + 2 * r };
}

// Labelled boxes painted into an id map: box i gets id i+1, and paper claimed
// by two boxes is ambiguous.
export function idsFromBoxes(boxes: readonly Rect[], width: number, height: number): Int32Array {
  const ids = new Int32Array(width * height);
  boxes.forEach((box, i) => {
    const x0 = Math.max(0, Math.round(box.x));
    const y0 = Math.max(0, Math.round(box.y));
    const x1 = Math.min(width, Math.round(box.x + box.w));
    const y1 = Math.min(height, Math.round(box.y + box.h));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = y * width + x;
        ids[p] = ids[p] === 0 ? i + 1 : AMBIGUOUS_ID;
      }
    }
  });
  return ids;
}

// Chessboard distance from every pixel to the nearest pixel of a DIFFERENT id
// (a pixel touching another id is at 1). The frame's edge is not a boundary: a
// note cut off by the photograph keeps its core up to the edge.
function distanceToOtherId(ids: Int32Array, width: number, height: number): Int32Array {
  const far = width + height;
  const d = new Int32Array(ids.length).fill(far);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const id = ids[p]!;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (ids[yy * width + xx] !== id) {
            edge = true;
            break;
          }
        }
      }
      if (edge) d[p] = 1;
    }
  }
  // Two chamfer passes with unit steps in all eight directions.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      let v = d[p]!;
      if (x > 0) v = Math.min(v, d[p - 1]! + 1);
      if (y > 0) {
        v = Math.min(v, d[p - width]! + 1);
        if (x > 0) v = Math.min(v, d[p - width - 1]! + 1);
        if (x < width - 1) v = Math.min(v, d[p - width + 1]! + 1);
      }
      d[p] = v;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const p = y * width + x;
      let v = d[p]!;
      if (x < width - 1) v = Math.min(v, d[p + 1]! + 1);
      if (y < height - 1) {
        v = Math.min(v, d[p + width]! + 1);
        if (x < width - 1) v = Math.min(v, d[p + width + 1]! + 1);
        if (x > 0) v = Math.min(v, d[p + width - 1]! + 1);
      }
      d[p] = v;
    }
  }
  return d;
}

// Note ids (0 = not a note) to classes: a note pixel further than its note's
// seam radius from any other id is core, the rest of the note is seam.
export function threeClassMask(
  ids: Int32Array,
  width: number,
  height: number,
  radiusOf: (id: number) => number,
): Uint8Array {
  const d = distanceToOtherId(ids, width, height);
  const mask = new Uint8Array(ids.length);
  const radii = new Map<number, number>();
  for (let p = 0; p < ids.length; p += 1) {
    const id = ids[p]!;
    if (id === 0) continue;
    if (id === AMBIGUOUS_ID) {
      mask[p] = CLASS.seam;
      continue;
    }
    let r = radii.get(id);
    if (r === undefined) {
      r = radiusOf(id);
      radii.set(id, r);
    }
    mask[p] = d[p]! > r ? CLASS.core : CLASS.seam;
  }
  return mask;
}
