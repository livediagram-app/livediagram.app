// Every Space's Reception Desk leaves him room to stand behind it (docs/specs/008-canvas/receptionist.md "Answering the
// bell"): the spot he walks to when its bell rings is on the room's floor, with no wall between it and the desk and
// none just behind it, so the 3D view never stands him on the far side of a wall (the coordinator, 2026-11-18).

import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@livehuddle/templates';
import { buildTemplatedTab } from '../template-builders';
import { spaceWalls } from '../space-3d/space-3d-walls';
import { BEHIND_DESK } from './receptionist-timeline';

// How far behind his feet a wall may stand at the least, in canvas px: the 3D view draws him towards the camera there
// (ReceptionistLayer), so a wall this far back never cuts through him.
const BACK_CLEAR = 8;

describe('the spot behind every Reception Desk', () => {
  for (const { kind } of TEMPLATES) {
    const elements = buildTemplatedTab(kind, 'default', 't', 'Tab').elements;
    const desks = elements.filter((el) => el.type === 'shape' && el.shape === 'reception-desk');
    if (desks.length === 0) continue;
    it(`${kind}: on the floor in front of the wall`, () => {
      const walls = spaceWalls(elements);
      for (const desk of desks) {
        if (desk.type !== 'shape') continue;
        const at = { x: desk.x + desk.width / 4, y: desk.y - BEHIND_DESK };
        // Walls across his spot's column between the desk's top and BACK_CLEAR behind his feet.
        const between = walls.filter((w) => {
          const lo = Math.min(w.a.x, w.b.x);
          const hi = Math.max(w.a.x, w.b.x);
          if (at.x < lo || at.x > hi || hi - lo < 1) return false;
          const y = w.a.y + ((w.b.y - w.a.y) * (at.x - w.a.x)) / (w.b.x - w.a.x);
          return y >= at.y - BACK_CLEAR && y <= desk.y;
        });
        expect(
          between.map((w) => w.id),
          `${kind} desk at ${desk.x},${desk.y}`,
        ).toEqual([]);
      }
    });
  }
});
