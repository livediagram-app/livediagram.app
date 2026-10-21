// Connected components over a class mask (docs/specs/021-event-storming/event-storming.md Phase 8): the pixels that
// touch each other and say the same thing become one blob.
//
// Two-pass union-find over a typed array rather than a recursive flood fill:
// a 2048px working image is four million pixels, and a recursion that deep
// does not survive a phone.

export type ComponentMask = {
  width: number;
  height: number;
  // One small integer per pixel: 0 = not paper, otherwise a class id.
  classes: Uint8Array;
};

export type Component = {
  classId: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
};

// The radius of the morphological close that re-fuses a note shattered by
// handwriting. A fraction of the working image's long side, for the same
// reason the pen-stroke gap in boxes.ts is: a real pen stroke is a few pixels
// at any sane working resolution, and nothing here may be an absolute count.
// The close DILATES by this much from each side, so it bridges a gap up to
// twice this wide.
const CLOSE_RADIUS_FRACTION = 0.006;

// Binary dilation along one axis, O(n): for each pixel, is there a set pixel
// within `radius` of it. Forward pass carries the last set position, backward
// pass the next, and a pixel is covered if either is in reach.
function dilateAxis(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): Uint8Array {
  const out = new Uint8Array(src.length);
  if (horizontal) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let last = -(radius + 1);
      for (let x = 0; x < width; x += 1) {
        if (src[row + x] !== 0) last = x;
        out[row + x] = x - last <= radius ? 1 : 0;
      }
      last = width + radius;
      for (let x = width - 1; x >= 0; x -= 1) {
        if (src[row + x] !== 0) last = x;
        if (last - x <= radius) out[row + x] = 1;
      }
    }
  } else {
    for (let x = 0; x < width; x += 1) {
      let last = -(radius + 1);
      for (let y = 0; y < height; y += 1) {
        if (src[y * width + x] !== 0) last = y;
        out[y * width + x] = y - last <= radius ? 1 : 0;
      }
      last = height + radius;
      for (let y = height - 1; y >= 0; y -= 1) {
        if (src[y * width + x] !== 0) last = y;
        if (last - y <= radius) out[y * width + x] = 1;
      }
    }
  }
  return out;
}

function dilateBinary(bin: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const h = dilateAxis(bin, width, height, radius, true);
  return dilateAxis(h, width, height, radius, false);
}

function erodeBinary(bin: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  // Erosion is dilation of the complement: a pixel survives the erode only if
  // no zero is within radius of it, which is exactly what dilating the
  // inverted mask and inverting back computes.
  const inv = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) inv[i] = bin[i] !== 0 ? 0 : 1;
  const dilated = dilateBinary(inv, width, height, radius);
  for (let i = 0; i < dilated.length; i += 1) dilated[i] = dilated[i] !== 0 ? 0 : 1;
  return dilated;
}

// Morphologically close the paper mask BEFORE labeling, per class.
//
// A real wall's handwriting cuts every note into fragments separated by class-0
// (ink) gaps, and connected components over the raw mask turns one note into a
// dozen blobs. Closing bridges those gaps. It is done PER CLASS rather than
// over the binary "is paper" mask, so a dilation can never bleed one kind into
// its neighbour: class c expands into ink/wall gaps only, and stops at any
// other class's pixels, so two overlapping notes of different colours still
// label as two notes.
//
// Each closed pixel keeps the majority of its class, which here is exact: a
// note is one colour, so the pixels a dilation reclaims from a gap belong to
// the class that reached them.
export function closePaperMask(mask: ComponentMask, opts: { radius?: number } = {}): ComponentMask {
  const { width, height, classes } = mask;
  const n = width * height;
  const longSide = Math.max(width, height);
  const radius = opts.radius ?? Math.max(2, Math.round(longSide * CLOSE_RADIUS_FRACTION));
  if (radius <= 0) return mask;

  const out = new Uint8Array(classes);
  let maxClass = 0;
  for (let i = 0; i < n; i += 1) if (classes[i]! > maxClass) maxClass = classes[i]!;

  const bin = new Uint8Array(n);
  for (let c = 1; c <= maxClass; c += 1) {
    for (let i = 0; i < n; i += 1) bin[i] = classes[i] === c ? 1 : 0;
    const dil = dilateBinary(bin, width, height, radius);
    // Never cross into another class: the dilation may only reclaim ink/wall.
    for (let i = 0; i < n; i += 1) {
      if (dil[i] !== 0 && classes[i] !== c && classes[i] !== 0) dil[i] = 0;
    }
    const closed = erodeBinary(dil, width, height, radius);
    // First class to reach a gap pixel keeps it; the notes on either side stay
    // separate either way, because the pixel takes one class and the other
    // note is a different one.
    for (let i = 0; i < n; i += 1) {
      if (closed[i] !== 0 && (out[i] === 0 || out[i] === c)) out[i] = c;
    }
  }
  return { width, height, classes: out };
}

// Erode the paper mask, per class: a pixel survives only if every pixel
// within `radius` of it says the same thing. Notes lapped over each other are
// joined by a seam a few pixels wide — a shadow, a paper edge — and eroding
// pulls them apart at exactly that seam, which is how a block of touching
// notes can be counted without guessing at its arithmetic.
export function erodePaperMask(mask: ComponentMask, radius: number): ComponentMask {
  const { width, height, classes } = mask;
  const n = width * height;
  if (radius <= 0) return mask;
  const out = new Uint8Array(n);
  let maxClass = 0;
  for (let i = 0; i < n; i += 1) if (classes[i]! > maxClass) maxClass = classes[i]!;
  const bin = new Uint8Array(n);
  for (let c = 1; c <= maxClass; c += 1) {
    for (let i = 0; i < n; i += 1) bin[i] = classes[i] === c ? 1 : 0;
    const eroded = erodeBinary(bin, width, height, radius);
    for (let i = 0; i < n; i += 1) if (eroded[i] !== 0) out[i] = c;
  }
  return { width, height, classes: out };
}

export function labelComponents(mask: ComponentMask): Component[] {
  const { width, height, classes } = mask;
  const labels = new Int32Array(width * height);
  const parent: number[] = [0];

  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root]!;
    // Path compression, or a long chain of merges costs a walk per pixel.
    let cur = x;
    while (parent[cur] !== root) {
      const next = parent[cur]!;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // First pass: provisional labels, merging with the west and north
  // neighbours when they say the same thing.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const c = classes[i]!;
      if (c === 0) continue;
      const west = x > 0 && classes[i - 1] === c ? labels[i - 1]! : 0;
      const north = y > 0 && classes[i - width] === c ? labels[i - width]! : 0;
      if (west === 0 && north === 0) {
        const next = parent.length;
        parent.push(next);
        labels[i] = next;
      } else if (west !== 0 && north !== 0) {
        labels[i] = Math.min(west, north);
        union(west, north);
      } else {
        labels[i] = west || north;
      }
    }
  }

  // Second pass: resolve to roots and accumulate each blob's extent.
  const byRoot = new Map<number, Component>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const label = labels[i]!;
      if (label === 0) continue;
      const root = find(label);
      const found = byRoot.get(root);
      if (!found) {
        byRoot.set(root, {
          classId: classes[i]!,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          pixels: 1,
        });
        continue;
      }
      if (x < found.minX) found.minX = x;
      if (x > found.maxX) found.maxX = x;
      if (y < found.minY) found.minY = y;
      if (y > found.maxY) found.maxY = y;
      found.pixels += 1;
    }
  }
  return [...byRoot.values()];
}
