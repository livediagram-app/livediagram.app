// The selection's edge (docs/specs/031-photo/photo-tools.md "Domain language", marching ants): the
// boundary between pixels at or past half and the rest, as closed paths along pixel edges, joined
// into as few loops as the shape has. The editor draws them dashed.
import type { Mask8 } from '../raster/mask';

export type Loop = { x: number; y: number }[];

// The most edge segments traced: a noisy selection on a large photo is drawn simplified past it.
const MAX_SEGMENTS = 400_000;

/** The selection's edge loops, in photo coordinates. */
export function maskOutline(m: Mask8, threshold = 128): Loop[] {
  const w = m.width;
  const h = m.height;
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && m.data[y * w + x]! >= threshold;
  // Directed edges keyed by their start corner, each walking with the inside on its right.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (w + 1) + x;
  let count = 0;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = key(x0, y0);
    const list = next.get(k);
    if (list) list.push(key(x1, y1));
    else next.set(k, [key(x1, y1)]);
    count++;
  };
  for (let y = 0; y < h && count < MAX_SEGMENTS; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add(x, y, x + 1, y);
      if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) add(x, y + 1, x, y);
    }
  const loops: Loop[] = [];
  const corner = (k: number) => ({ x: (k % (w + 1)) + m.x, y: Math.floor(k / (w + 1)) + m.y });
  for (const [start, ends] of next) {
    while (ends.length) {
      const loop: Loop = [corner(start)];
      let at: number;
      let to = ends.pop()!;
      while (to !== start) {
        const c = corner(to);
        const prev = loop[loop.length - 1]!;
        const before = loop[loop.length - 2];
        // Drop a corner that lies on a straight run.
        const straight =
          before &&
          ((before.x === prev.x && prev.x === c.x) || (before.y === prev.y && prev.y === c.y));
        if (straight) loop[loop.length - 1] = c;
        else loop.push(c);
        at = to;
        const outs = next.get(at);
        if (!outs || outs.length === 0) break;
        to = outs.pop()!;
      }
      // Close the loop: a corner on the straight run through the start goes.
      const onLine = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        c: { x: number; y: number },
      ) => (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
      while (loop.length > 3 && onLine(loop[loop.length - 2]!, loop[loop.length - 1]!, loop[0]!))
        loop.pop();
      while (loop.length > 3 && onLine(loop[loop.length - 1]!, loop[0]!, loop[1]!)) loop.shift();
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}
