// Real 3D's block models (docs/specs/008-canvas/3d-engine.md "Block models"): every kind's model, by kind, and the
// block a kind without one stands as. Each group of kinds lives in a file of its own.
import { isWallPieceShape } from '@livehuddle/avatar/office-geometry';
import { Builder, kindHeight, type ModelContext, type ModelTable } from './kit';
import { FIRST_MODELS } from './first';
import { SEATING_MODELS } from './seating';
import { STORAGE_MODELS } from './storage';
import { OUTDOOR_MODELS } from './outdoor';
import { ROUNDED_MODELS } from './rounded';

export const MODELS: ModelTable = {
  ...FIRST_MODELS,
  ...SEATING_MODELS,
  ...STORAGE_MODELS,
  ...OUTDOOR_MODELS,
  ...ROUNDED_MODELS,
};

/** Builds a piece's model in its frame. */
export function buildModel(kind: string, c: ModelContext): Builder {
  const m = new Builder();
  const model = MODELS[kind];
  if (model) model(m, c);
  else if (isWallPieceShape(kind)) {
    // Hung on a wall: a panel against the wall behind it, at eye height.
    const { x0, x1 } = c.f.foot;
    const h = kindHeight(kind);
    m.b(x0, c.f.D / -2, 50, x1, c.f.D / -2 + 4, 50 + h, c.t.face, { top: c.t.top, front: c.t.top });
  } else {
    // A kind without a model of its own: a block of its footprint at its kind's height, in its drawing's colours.
    const { x0, y0, x1, y1 } = c.f.foot;
    m.b(x0, y0, 0, x1, y1, kindHeight(kind), c.t.face, { top: c.t.top });
  }
  return m;
}

export { SEAT_Z, KIND_HEIGHT } from './kit';
