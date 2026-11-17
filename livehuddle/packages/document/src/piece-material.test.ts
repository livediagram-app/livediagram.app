import { describe, expect, it } from 'vitest';
import { APPLIANCE_WHITE, pieceMaterial } from './piece-material';
import { SEAT_FABRIC, seatFabric } from './seating';

// docs/specs/009-elements/furniture-art-style.md "Materials".
describe('what a piece is made of', () => {
  it("upholsters seating in its kind's fabric, or the piece's own fill", () => {
    expect(seatFabric('chair', undefined)).toBe(SEAT_FABRIC.chair);
    expect(seatFabric('desk', 'transparent')).toBe(SEAT_FABRIC.desk);
    expect(seatFabric('sofa', '#123456')).toBe('#123456');
  });

  it('makes shelves wood, columns stone and machines appliance white, unless the piece has a fill', () => {
    expect(pieceMaterial('bookshelf', undefined)).toBe('#b98352');
    expect(pieceMaterial('column', undefined)).toBe('#e4ded3');
    expect(pieceMaterial('printer', undefined)).toBe(APPLIANCE_WHITE);
    expect(pieceMaterial('printer', 'transparent')).toBe(APPLIANCE_WHITE);
    expect(pieceMaterial('printer', '#abcdef')).toBe('#abcdef');
  });
});
