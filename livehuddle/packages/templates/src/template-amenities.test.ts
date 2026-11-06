import { describe, expect, it } from 'vitest';
import { doorOnRoom, meetingPieceRoom, roomZones, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { buildTowerLevel2 } from './template-builders-tower';

type Shape = Extract<Element, { type: 'shape' }>;
const shapesOf = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');
const inside = (p: Shape, r: Shape) =>
  p.x >= r.x && p.y >= r.y && p.x + p.width <= r.x + r.width && p.y + p.height <= r.y + r.height;
const roomOf = (els: Shape[], label: string) =>
  els.find((e) => e.shape === 'room' && e.label === label)!;
const kindsIn = (els: Shape[], room: Shape) =>
  els.filter((e) => e !== room && e.shape !== 'rug' && inside(e, room)).map((e) => e.shape);

// docs/specs/009-elements/office-amenities.md "In the templates".
describe('the office amenities in the templates', () => {
  it('fits the Virtual Office Kitchen out as a kitchenette, a fridge, a counter run and a sink', () => {
    const els = shapesOf(buildTemplate('virtual-office', 0, 0));
    const kitchen = roomOf(els, 'Kitchen');
    expect(kindsIn(els, kitchen)).toEqual(
      expect.arrayContaining([
        'fridge',
        'kitchen-counter',
        'microwave',
        'kettle',
        'kitchen-sink',
        'coffee-machine',
        'water-cooler',
      ]),
    );
    // The counter and the sink stand in one run at one height; the microwave and kettle stand on the counter.
    const counter = els.find((e) => e.shape === 'kitchen-counter')!;
    const sink = els.find((e) => e.shape === 'kitchen-sink')!;
    expect(sink.y).toBe(counter.y);
    for (const kind of ['microwave', 'kettle']) {
      const p = els.find((e) => e.shape === kind)!;
      expect(p.x, kind).toBeGreaterThanOrEqual(counter.x);
      expect(p.x + p.width, kind).toBeLessThanOrEqual(counter.x + counter.width);
      expect(p.y + p.height, kind).toBeGreaterThan(counter.y);
      expect(p.y + p.height, kind).toBeLessThan(counter.y + 30);
    }
    expect(kindsIn(els, roomOf(els, 'Reception'))).toEqual(
      expect.arrayContaining(['coat-rack', 'umbrella-stand']),
    );
    expect(kindsIn(els, roomOf(els, 'Desks'))).toContain('printer');
  });

  it('gives the Co-working Tower a print corner, lockers, a cafe fridge and a coat rack by the door', () => {
    const els = shapesOf(buildTemplate('coworking-tower', 0, 0));
    for (const kind of ['copier', 'printer', 'lockers', 'fridge', 'coat-rack', 'umbrella-stand'])
      expect(
        els.some((e) => e.shape === kind),
        kind,
      ).toBe(true);
  });

  it('builds a Restroom on Level 2: a door, its sign, two cubicles, a hand dryer and two basins', () => {
    const els = shapesOf(buildTowerLevel2(0, 0));
    const restroom = roomOf(els, 'Restroom');
    expect(restroom).toBeDefined();
    expect(els.filter((e) => e.shape === 'door' && doorOnRoom(e, restroom))).toHaveLength(1);
    const zones = roomZones(els);
    expect(
      els.some((e) => e.shape === 'room-sign' && meetingPieceRoom(e, zones) === restroom.id),
    ).toBe(true);
    const kinds = kindsIn(els, restroom);
    expect(kinds.filter((k) => k === 'toilet-cubicle')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'washbasin')).toHaveLength(2);
    expect(kinds).toContain('hand-dryer');
  });
});
