import { describe, expect, it } from 'vitest';
import { roomWalls, type Element } from '@livediagram/document';
import { buildTemplate } from './build-template';

// docs/specs/012-collaboration/virtual-office-template.md
describe('the Virtual Office template', () => {
  const els = buildTemplate('virtual-office', 0, 0) as Element[];
  const shapes = (kind: string) =>
    els.filter(
      (e): e is Extract<Element, { type: 'shape' }> => e.type === 'shape' && e.shape === kind,
    );

  it('has six named rooms either side of a corridor, every doorway onto it', () => {
    const rooms = shapes('room');
    expect(rooms.map((r) => r.label)).toEqual([
      'Reception',
      'Desks',
      'Meeting Room',
      'Kitchen',
      'Lounge',
      'Focus Room',
    ]);
    const top = Math.min(...rooms.map((r) => r.y));
    for (const r of rooms) expect(r.roomDoor).toBe(r.y === top ? 's' : 'n');
  });

  it('lays the rooms and rugs under everything else', () => {
    const firstOther = els.findIndex(
      (e) => !(e.type === 'shape' && (e.shape === 'room' || e.shape === 'rug')),
    );
    const lastFloor = els.reduce(
      (at, e, i) => (e.type === 'shape' && (e.shape === 'room' || e.shape === 'rug') ? i : at),
      -1,
    );
    expect(lastFloor).toBeLessThan(firstOther);
  });

  it('furnishes them: seven desks, a meeting table, a cooler and a coffee machine, and a way in', () => {
    expect(shapes('desk')).toHaveLength(7);
    expect(shapes('meeting-table')).toHaveLength(1);
    expect(shapes('water-cooler')).toHaveLength(1);
    expect(shapes('coffee-machine')).toHaveLength(1);
    expect(shapes('mode-button')).toEqual([
      expect.objectContaining({ label: 'Walk In', mode: 'avatar' }),
    ]);
  });

  it('puts every piece inside a room, clear of its walls', () => {
    const rooms = shapes('room');
    for (const e of els) {
      if (e.type !== 'shape' || ['room', 'mode-button', 'sticker'].includes(e.shape)) continue;
      const room = rooms.find(
        (r) =>
          e.x >= r.x &&
          e.y >= r.y &&
          e.x + e.width <= r.x + r.width &&
          e.y + e.height <= r.y + r.height,
      );
      expect(room, `${e.shape} at ${e.x},${e.y}`).toBeDefined();
      // Nothing straddles a wall line a character could not then reach past.
      for (const w of roomWalls(room!)) {
        const vertical = w.a.x === w.b.x;
        if (vertical) expect(w.a.x <= e.x || w.a.x >= e.x + e.width).toBe(true);
      }
    }
  });
});
