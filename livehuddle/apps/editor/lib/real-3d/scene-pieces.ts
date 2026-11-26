// Real 3D's pieces (docs/specs/008-canvas/3d-engine.md "The scene"): every piece that stands, built from its model
// and laid on the canvas at its frame, all into one geometry (one draw for the lot), rebuilt only when the board
// changes. Built from the board alone, so every viewer's scene is the same. Pure: no three.js, no DOM.

import type { Element } from '@livehuddle/document';
import { pieceArt, pieceMaterial } from '@livehuddle/document';
import { seatFabric } from '@livehuddle/avatar/furniture-art';
import { isSeatingShape, seatsACharacter } from '@livehuddle/avatar/office-geometry';
import { seatPoints } from '@livehuddle/avatar/seats';
import { standsIn3D } from '@/lib/space-3d/space-3d-pieces';
import { canvasToFrame, frameToCanvas, pieceFrame, type PieceBox } from './piece-frame';
import { pieceTones } from './piece-tones';
import { buildModel } from './models';
import { MeshBuilder } from './mesh-builder';
import { modelBounds, type PieceBounds } from './piece-pick';

const DEFAULT_STROKE = '#94a3b8';

const FORWARD: Record<string, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  right: [1, 0],
  left: [-1, 0],
};

/** A seat's facing (the way its sitter faces on the canvas) as the model's frame sees it, turned back by its yaw. */
export function facingInFrame(f: { yaw: number }, facing: string): string {
  const [dx, dy] = FORWARD[facing] ?? [0, 1];
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const x = dx * c + dy * s;
  const y = -dx * s + dy * c;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
}

/** The kinds that lie flat but have parts that stand: an Office Pod's furniture, a Car Park's cars. */
const FLAT_WITH_STANDING = new Set(['office-pod', 'car-park']);

/** Whether a piece is drawn by real 3D: one that stands, and a flat one's standing parts. */
export function modelled(el: Element): el is Extract<Element, { type: 'shape' }> {
  return el.type === 'shape' && (FLAT_WITH_STANDING.has(el.shape) || standsIn3D(el));
}

/** The pieces' one geometry, and each piece's box for presses (piece-pick.ts). */
export class PiecesMesh extends MeshBuilder {
  bounds: PieceBounds[] = [];
  /** Where each piece's corners sit in `positions` (in corners, from and to), so one can be lifted out to move. */
  ranges = new Map<string, { from: number; to: number }>();
}

/** Every modelled piece, laid on the canvas, as one geometry. */
export function piecesMesh(elements: readonly Element[]): PiecesMesh {
  const out = new PiecesMesh();
  for (const el of elements) {
    if (!modelled(el)) continue;
    const from = out.positions.length / 3;
    try {
      addPiece(out, el);
      out.ranges.set(el.id, { from, to: out.positions.length / 3 });
    } catch {
      // A piece whose model cannot be built is left out rather than taking the scene down.
    }
  }
  return out;
}

function addPiece(out: PiecesMesh, el: Extract<Element, { type: 'shape' }>): void {
  const box = el as unknown as PieceBox & { fillColor?: string; strokeColor?: string };
  const f = pieceFrame(box);
  const kind = el.shape;
  const seat = isSeatingShape(kind)
    ? seatFabric(kind, box.fillColor)
    : pieceMaterial(kind, box.fillColor);
  const art = pieceArt(kind);
  const t = pieceTones(art, seat, box.strokeColor ?? DEFAULT_STROKE);
  let seats: { x: number; y: number; facing: string }[] = [];
  if (seatsACharacter(kind)) {
    try {
      seats = seatPoints(el as never).map((s) => ({
        ...canvasToFrame(f, s),
        facing: facingInFrame(f, s.facing),
      }));
    } catch {
      seats = [];
    }
  }
  const m = buildModel(kind, { f, t, seats });
  const extent = modelBounds([...m.positions, ...m.glassPositions]);
  if (extent)
    out.bounds.push({
      id: el.id,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      f,
      ...extent,
    });
  const lay = (src: number[], dst: number[]) => {
    for (let i = 0; i < src.length; i += 3) {
      const p = frameToCanvas(f, src[i]!, src[i + 1]!);
      dst.push(p.x, p.y, src[i + 2]!);
    }
  };
  // Normals turn with the piece (no move: a direction).
  const turn = (src: number[], dst: number[]) => {
    const c = Math.cos(f.yaw);
    const s = Math.sin(f.yaw);
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i]!;
      const y = src[i + 1]!;
      dst.push(x * c - y * s, x * s + y * c, src[i + 2]!);
    }
  };
  lay(m.positions, out.positions);
  turn(m.normals, out.normals);
  turn(m.glassNormals, out.glassNormals);
  out.colours.push(...m.colours);
  lay(m.lines, out.lines);
  lay(m.glassPositions, out.glassPositions);
  out.glassColours.push(...m.glassColours);
}
