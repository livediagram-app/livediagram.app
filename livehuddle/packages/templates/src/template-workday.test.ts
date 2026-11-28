import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildCoworkingSpace } from './template-builders-spaces';
import { buildHotelLobby, buildHotelRooftop } from './template-builders-hotel';
import { buildStartupHq } from './template-builders-campus-more';
import { buildTowerGround, buildTowerLevel2 } from './template-builders-tower';
import { buildVirtualOffice } from './template-builders-office';

import { modelFloorBox } from './template-model-box';
type Shape = Extract<Element, { type: 'shape' }>;
const shapesOf = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');
const count = (els: Shape[], shape: string) => els.filter((e) => e.shape === shape).length;
// In a room when the middle of where it stands in 3D is: a wall piece stands back on its wall, its drawn box poking over
// the wall line (template-model-box.ts, docs/specs/007-editor/templates-by-mode.md "Made for 3D").
const inside = (p: Shape, r: Shape) => {
  const m = modelFloorBox(p);
  const x = m.x + m.width / 2;
  const y = m.y + m.height / 2;
  return p !== r && x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;
};
// The innermost room a piece stands in (a booth room lies inside the Coworking floor).
const roomOf = (els: Shape[], p: Shape) =>
  els
    .filter((r) => r.shape === 'room' && inside(p, r))
    .sort((a, b) => a.width * a.height - b.width * b.height)[0]?.label ?? null;
const where = (els: Shape[], shape: string) =>
  els.filter((e) => e.shape === shape).map((p) => roomOf(els, p));

// docs/specs/009-elements/workday-pieces.md "In the templates".
describe('the workday pieces in the templates', () => {
  it('stands a Reception Desk in the Virtual Office reception and a Nap Pod in its Focus Room', () => {
    const els = shapesOf(buildVirtualOffice(0, 0));
    expect(where(els, 'reception-desk')).toEqual(['Reception']);
    expect(where(els, 'nap-pod')).toEqual(['Focus Room']);
  });

  it('gives each Coworking Space booth a Phone Booth in place of its chair', () => {
    const els = shapesOf(buildCoworkingSpace(0, 0));
    expect(where(els, 'phone-booth')).toEqual(['Booth 1', 'Booth 2']);
    expect(els.filter((e) => e.shape === 'chair').map((c) => roomOf(els, c))).not.toContain(
      'Booth 1',
    );
  });

  it('greets the Hotel lobby with one Reception Desk and gives its Spa Room a treadmill', () => {
    const lobby = shapesOf(buildHotelLobby(0, 0));
    expect(count(lobby, 'reception-desk')).toBe(1);
    const roof = shapesOf(buildHotelRooftop(0, 0));
    expect(where(roof, 'treadmill')).toEqual(['Spa Room']);
  });

  it('makes one Co-working Tower island hot desks and rests a Nap Pod in the Quiet Room', () => {
    const ground = shapesOf(buildTowerGround(0, 0));
    expect(where(ground, 'hot-desk')).toEqual(Array(4).fill('Hot Desks'));
    expect(where(shapesOf(buildTowerLevel2(0, 0)), 'nap-pod')).toEqual(['Quiet Room']);
  });

  it('stands two Standing Desks and a Pet Bed in the Startup HQ Studio', () => {
    const els = shapesOf(buildStartupHq(0, 0));
    expect(where(els, 'standing-desk')).toEqual(['Studio', 'Studio']);
    expect(where(els, 'pet-bed')).toEqual(['Studio']);
  });
});
