// Connected components over a class mask (spec/139 Phase 8): the pixels that
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
