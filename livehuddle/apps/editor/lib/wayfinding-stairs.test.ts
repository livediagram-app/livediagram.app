import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { avatarFigureHeight } from '@livehuddle/avatar/walk';
import { avatarScale } from '@livehuddle/avatar/config';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  elevatorExitPoint,
  stairsFlights,
  stairsFootPoint,
  stairsLanding,
  stairsTopPoint,
} from './wayfinding';

// docs/specs/009-elements/stairs.md "Floors", "Taking them".

const at = (kind: Parameters<typeof createShape>[0], x: number, y: number) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}` }) as ShapeElement;

const flight = { x: 100, y: 100, width: 96, height: 128 };

describe('the Stairs', () => {
  it('climbs to the top step and steps off centred below the foot, clear of the piece', () => {
    const top = stairsTopPoint(flight);
    expect(top.x).toBe(148);
    expect(top.y).toBeGreaterThan(flight.y);
    expect(top.y).toBeLessThan(flight.y + flight.height / 2);
    const foot = stairsFootPoint(flight);
    expect(foot.x).toBe(148);
    expect(foot.y - avatarFigureHeight(avatarScale('regular'))).toBeGreaterThanOrEqual(
      flight.y + flight.height,
    );
  });

  // docs/specs/009-elements/stairs.md "Turned": the flight climbs the way its facing shows.
  it('climbs toward the landing and steps off at the foot whichever way the flight is turned', () => {
    // Facing up: the landing is nearest you, so the climb ends low on the piece and the walk off ends above it.
    const up = { ...flight, chairFacing: 's' as const };
    expect(stairsTopPoint(up).y).toBeGreaterThan(flight.y + flight.height / 2);
    expect(stairsFootPoint(up)).toEqual({ x: 148, y: flight.y - 12 });
    // On its side the flight climbs to the right (facing left) and to the left (facing right); its foot is on the
    // other side, where the walk off ends, clear of the piece and level with the flight.
    const left = { x: 100, y: 100, width: 136, height: 128, chairFacing: 'e' as const };
    const right = { ...left, chairFacing: 'w' as const };
    expect(stairsTopPoint(left).x).toBeGreaterThan(left.x + left.width / 2);
    expect(stairsTopPoint(right).x).toBeLessThan(left.x + left.width / 2);
    expect(stairsTopPoint(right).x - left.x).toBeCloseTo(
      left.x + left.width - stairsTopPoint(left).x,
    );
    const offLeft = stairsFootPoint(left);
    const offRight = stairsFootPoint(right);
    expect(offLeft.x).toBeLessThan(left.x - 12);
    expect(offRight.x).toBeGreaterThan(left.x + left.width + 12);
    expect(offLeft.y).toBe(offRight.y);
    expect(offLeft.y).toBeGreaterThan(left.y + left.height / 2);
    expect(offLeft.y).toBeLessThan(left.y + left.height);
    // Unset is facing down, as before.
    expect(stairsFootPoint({ ...flight, chairFacing: 'n' })).toEqual(stairsFootPoint(flight));
  });

  it('goes up to the next tab and down to the one before, nothing past the ends', () => {
    const tabs = [
      { id: 'g', name: 'Ground', elements: [] },
      { id: 'l2', name: 'Level 2', elements: [] },
      { id: 'l3', name: 'Level 3', elements: [] },
    ];
    const mid = stairsFlights(tabs, 'l2', flight);
    expect(mid.here).toEqual({ number: 2, name: 'Level 2' });
    expect(mid.count).toBe(3);
    expect([mid.up?.tabId, mid.up?.number, mid.up?.name]).toEqual(['l3', 3, 'Level 3']);
    expect([mid.down?.tabId, mid.down?.number]).toEqual(['g', 1]);
    expect(stairsFlights(tabs, 'l3', flight).up).toBeNull();
    expect(stairsFlights(tabs, 'g', flight).down).toBeNull();
    const lost = stairsFlights(tabs, 'gone', flight);
    expect([lost.here, lost.up, lost.down]).toEqual([null, null, null]);
  });

  it('lands on the nearest Stairs on that floor, ties in reading order', () => {
    const near = at('stairs', 120, 90);
    const far = at('stairs', 900, 900);
    expect(stairsLanding({ id: 't', name: 'T', elements: [far, near] }, flight)).toEqual({
      at: 'stairs',
      id: near.id,
      top: stairsTopPoint(near),
      foot: stairsFootPoint(near),
    });
    // Two as near: the first in reading order (top to bottom) wins, whatever their order on the tab.
    const above = at('stairs', 100, 0);
    const below = at('stairs', 100, 200);
    const tie = (elements: ShapeElement[]) =>
      stairsLanding({ id: 't', name: 'T', elements }, flight).id;
    expect(tie([below, above])).toBe(above.id);
    expect(tie([above, below])).toBe(above.id);
  });

  it("lands at the floor's Elevator, else its Avatar Pad, else its middle, with no Stairs there", () => {
    const lift = at('elevator', 400, 0);
    expect(stairsLanding({ id: 'a', name: 'A', elements: [lift] }, flight)).toEqual({
      at: 'elevator',
      id: lift.id,
      top: null,
      foot: elevatorExitPoint(lift),
    });
    const pad = stairsLanding({ id: 'b', name: 'B', elements: [at('avatar-pad', 0, 0)] }, flight);
    expect(pad.at).toBe('pad');
    const middle = stairsLanding({ id: 'c', name: 'C', elements: [] }, flight);
    expect([middle.at, middle.id, middle.top, middle.foot]).toEqual([
      'middle',
      undefined,
      null,
      { x: 0, y: 0 },
    ]);
  });

  it('marks a floor not fetched yet as loading', () => {
    const tabs = [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', elements: [], loaded: false },
    ];
    expect(stairsFlights(tabs, 'a', flight).up?.loading).toBe(true);
    expect(stairsFlights(tabs, 'b', flight).down?.loading).toBe(false);
  });

  // Performance: the panel reads only the two neighbouring floors, one scan each, so a crowded building stays cheap.
  it('finds both landings across 20,000-element floors within budget', () => {
    const crowd = Array.from({ length: 20_000 }, (_, i) =>
      at('plant', (i % 200) * 60, Math.floor(i / 200) * 90),
    );
    const tabs = [
      { id: 'a', name: 'A', elements: [...crowd, at('stairs', 5000, 5000)] },
      { id: 'b', name: 'B', elements: [] },
      { id: 'c', name: 'C', elements: [...crowd, at('elevator', 300, 300)] },
    ];
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => stairsFlights(tabs, 'b', flight))));
    expect(best).toBeLessThan(cpuBudgetMs(25));
  });
});
