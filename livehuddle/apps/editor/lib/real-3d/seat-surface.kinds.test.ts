import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { seatPoints } from '@livehuddle/avatar/seats';
import { piecesMesh } from './scene-pieces';
import { seatSurface } from './seat-surface';

// 3d-engine.md "Sitting fits the figure": every seat's real model seats a Regular sitter (drawn at 1.9) on its
// cushion, never on its back or an arm (a sofa's, a bench's), and finds even a small stool (a Phone Booth's).
const YAW: Record<string, number> = {
  down: 0,
  up: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};
const KINDS = [
  'chair',
  'desk',
  'meeting-table',
  'sofa',
  'bench',
  'bar-stool',
  'phone-booth',
  'picnic-table',
];

describe('seatSurface on the real seats', () => {
  it.each(KINDS)('seats a Regular sitter on a %s at cushion height', (kind) => {
    const el = { ...createShape(kind as never, 200, 200), id: 'p' } as Element;
    const mesh = piecesMesh([el]);
    const seat = seatPoints(el as never)[0]!;
    const found = seatSurface(mesh, mesh.bounds, () => kind, seat, YAW[seat.facing] ?? 0, 1.9, 70);
    expect(found?.height).toBeGreaterThan(15);
    expect(found?.height).toBeLessThan(26);
  });
});
