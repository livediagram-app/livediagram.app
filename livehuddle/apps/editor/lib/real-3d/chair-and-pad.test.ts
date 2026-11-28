// docs/specs/008-canvas/3d-engine.md "Block models" ("Believable chairs", "The Avatar Pad stands with depth") and
// "Sitting fits the figure": every chair (the dining chair, the desks' office chairs, the meeting table's) seats its
// sitter on its own cushion with the back behind them at every facing, and the pad's top stays where a character
// stands on it.
import { describe, expect, it } from 'vitest';
import { FURNITURE_ART, OFFICE_ART, type Element } from '@livehuddle/document';
import { seatPoints } from '@livehuddle/avatar/seats';
import { piecesMesh } from './scene-pieces';
import { seatSurface } from './seat-surface';
import { RISE, SEAT_Z } from './models/kit';
import { AVATAR_PAD_HEIGHT } from './models/pad';

const YAW: Record<string, number> = {
  down: 0,
  left: Math.PI / 2,
  up: Math.PI,
  right: -Math.PI / 2,
};
/** Real3DLayer's SEAT_CAP: no seat is looked for above this. */
const CAP = 70;

/** A piece at its drawing's size, centred on the origin, as the model sheet lays it out. */
function piece(kind: string, facing: 'n' | 'e' | 's' | 'w'): Element {
  type Art = Record<string, { front: { width: number; height: number } }>;
  const art = (FURNITURE_ART as Art)[kind] ?? (OFFICE_ART as Art)[kind];
  const { width, height } = art!.front;
  const across = facing === 'e' || facing === 'w';
  const w = across ? height : width;
  const h = across ? width : height;
  return {
    id: `${kind}-${facing}`,
    type: 'shape',
    shape: kind,
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    chairFacing: facing,
  } as unknown as Element;
}

// The dining chair, the desks' office chairs and the meeting table's chairs.
for (const kind of ['chair', 'desk', 'hot-desk', 'meeting-table'])
  describe(`the ${kind}'s chairs`, () => {
    for (const facing of ['n', 'e', 's', 'w'] as const)
      it(`seat every sitter on the cushion's top, the back behind them, facing ${facing}`, () => {
        const el = piece(kind, facing);
        const mesh = piecesMesh([el]);
        const seats = seatPoints(el as never);
        expect(seats.length).toBeGreaterThan(0);
        for (const s of seats) {
          const seat = seatSurface(mesh, mesh.bounds, () => kind, s, YAW[s.facing] ?? 0, 1, CAP);
          expect(seat?.height).toBeCloseTo(SEAT_Z * RISE, 1);
          expect(seat?.hipsBack).not.toBeNull();
          expect(seat?.lying).toBe(false);
        }
      });
  });

describe('the Avatar Pad', () => {
  it('keeps its top at the height a character stands on, with no part standing proud of it', () => {
    const mesh = piecesMesh([
      {
        id: 'pad',
        type: 'shape',
        shape: 'avatar-pad',
        x: 0,
        y: 0,
        width: 128,
        height: 80,
      } as unknown as Element,
    ]);
    let top = 0;
    for (let i = 2; i < mesh.positions.length; i += 3) top = Math.max(top, mesh.positions[i]!);
    // The rug and the inlay lie on the platform, under a px over it (risen).
    expect(top).toBeGreaterThanOrEqual(AVATAR_PAD_HEIGHT * RISE);
    expect(top).toBeLessThan((AVATAR_PAD_HEIGHT + 1) * RISE);
  });
});
