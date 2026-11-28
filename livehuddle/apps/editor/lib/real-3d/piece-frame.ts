// Real 3D's pieces (docs/specs/008-canvas/3d-engine.md "Block models"): where a piece's model stands. A model is
// built facing the default camera ('n': its front, where a sitter faces, toward +y) in a box `W` across and `D`
// deep, centred on the origin; the frame turns it to the piece's facing and its turn on the plan and stands it on
// the piece's box. Built only from the board, never from a camera, so every viewer sees it in the same place.
// Pure: no three.js, no DOM.

import { footprintFractions } from '@livehuddle/avatar/office-geometry';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import { pieceFacing } from '@livehuddle/document';

const QUARTER: Record<SeatFacing, number> = { n: 0, e: 1, s: 2, w: 3 };

export type PieceBox = {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  chairFacing?: SeatFacing;
};

export type PieceFrame = {
  /** The box's middle on the canvas. */
  cx: number;
  cy: number;
  /** Clockwise turn on the screen, in radians, from the model's frame to the canvas. */
  yaw: number;
  /** The model's box: across its front and front to back, in canvas px. */
  W: number;
  D: number;
  /** Its footprint (what stops a walk) in the model's frame: x across, y front to back (+y the front). */
  foot: { x0: number; y0: number; x1: number; y1: number };
  facing: SeatFacing;
};

export function pieceFrame(el: PieceBox): PieceFrame {
  const facing = pieceFacing(el);
  const q = QUARTER[facing];
  const across = q % 2 === 1;
  const W = across ? el.height : el.width;
  const D = across ? el.width : el.height;
  const fr = footprintFractions(el.shape, 'n');
  let foot = { x0: -W / 2, y0: -D / 2, x1: W / 2, y1: D / 2 };
  if (fr.length > 0) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of fr) {
      x0 = Math.min(x0, f.x0);
      y0 = Math.min(y0, f.y0);
      x1 = Math.max(x1, f.x1);
      y1 = Math.max(y1, f.y1);
    }
    foot = { x0: (x0 - 0.5) * W, y0: (y0 - 0.5) * D, x1: (x1 - 0.5) * W, y1: (y1 - 0.5) * D };
  }
  const turn = (((el.rotation ?? 0) % 360) + 360) % 360;
  return {
    cx: el.x + el.width / 2,
    cy: el.y + el.height / 2,
    yaw: ((q * 90 + turn) * Math.PI) / 180,
    W,
    D,
    foot,
    facing,
  };
}

/** A point of the model's frame on the canvas. */
export function frameToCanvas(f: PieceFrame, x: number, y: number): { x: number; y: number } {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.cx + x * c - y * s, y: f.cy + x * s + y * c };
}

/** A canvas point in the model's frame. */
export function canvasToFrame(
  f: PieceFrame,
  p: { x: number; y: number },
): { x: number; y: number } {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
