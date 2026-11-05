import { describe, expect, it } from 'vitest';
import { gardenPathParts, isPlazaPath, paintOrder, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

// docs/specs/009-elements/office.md "Garden Path": in every template no piece stands on a path's stones, no path's
// stones lie under a path drawn over it, and no strip of path runs under a piece (a plaza's open middle aside).

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };

const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// Floors a path may lie against: the lawn and other paths (judged by the stones rule).
const FLOOR = new Set(['grass', 'garden-path']);

/** A path's stones and setts as canvas boxes. */
function stones(p: Shape): Box[] {
  return gardenPathParts(p.width, p.height).flatMap((part) =>
    part.tag === 'ellipse' && part.role === 'panel'
      ? [
          {
            x: p.x + part.cx - part.rx,
            y: p.y + part.cy - part.ry,
            width: 2 * part.rx,
            height: 2 * part.ry,
          },
        ]
      : [],
  );
}

/** Whether a later path's paving covers any of the box: its strip's box, or its plaza's disc. */
function covers(path: Shape, b: Box): boolean {
  if (!meets(path, b)) return false;
  if (!isPlazaPath(path.width, path.height)) return true;
  const rx = path.width / 2;
  const ry = path.height / 2;
  const cx = path.x + rx;
  const cy = path.y + ry;
  // The box's nearest point to the disc's middle, inside the disc.
  const nx = Math.min(Math.max(cx, b.x), b.x + b.width);
  const ny = Math.min(Math.max(cy, b.y), b.y + b.height);
  return ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 < 1;
}

describe.each(TEMPLATES.map((t) => t.kind))('the %s paths', (kind) => {
  // In the order they paint (docs/specs/006-document/layers.md "Stacking"), so a later path is one drawn over.
  const all = paintOrder(buildTemplate(kind, 0, 0)).filter((e): e is Shape => e.type === 'shape');
  const paths = all.filter((e) => e.shape === 'garden-path');
  const solid = all.filter((e) => !FLOOR.has(e.shape));

  it('lays every path square to the canvas', () => {
    for (const p of paths) expect(p.rotation ?? 0).toBe(0);
  });

  it('keeps every stone clear of pieces and of the paths drawn over it', () => {
    for (const [i, p] of paths.entries())
      for (const s of stones(p)) {
        for (const piece of solid)
          expect(
            meets(piece, s),
            `stone at ${s.x},${s.y} under ${piece.shape} at ${piece.x},${piece.y}`,
          ).toBe(false);
        for (const later of paths.slice(i + 1))
          expect(
            covers(later, s),
            `stone at ${s.x},${s.y} under the path at ${later.x},${later.y}`,
          ).toBe(false);
      }
  });

  it('runs no strip of path under a piece', () => {
    for (const p of paths.filter((q) => !isPlazaPath(q.width, q.height)))
      for (const piece of solid.filter((e) => e.shape !== 'door'))
        expect(
          meets(piece, p),
          `path at ${p.x},${p.y} under ${piece.shape} at ${piece.x},${piece.y}`,
        ).toBe(false);
  });
});
