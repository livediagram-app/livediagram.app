import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { avatarFigureHeight } from '@liveworkspace/avatar/walk';
import { avatarScale } from '@liveworkspace/avatar/config';
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
});
