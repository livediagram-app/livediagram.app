import { describe, expect, it } from 'vitest';
import { OFFICE_ART, type GridOfficeKind } from './office';
import { RECREATION_TONES } from './office-recreation';
import { TEAM_TONES } from './office-team';
import { VENUE_TONES } from './office-venue';
import { STAIRS_ENDS, STAIRS_TOP_SHARE, WAYFINDING_TONES } from './office-wayfinding';
import { furnitureFrame, type FurnitureDrawing, type FurniturePart } from './seating';
import { pieceFacing, turnPiece } from './furniture-facing';
import { createShape } from './shape-factory';

// docs/specs/009-elements/furniture-facing.md "The camera", "A turn": the games, the garden seats, the venue pieces,
// the Stairs and the Suggestion Box each drawn from behind and on their side.
const KINDS = [
  'pool-table',
  'foosball-table',
  'bean-bag',
  'bench',
  'picnic-table',
  'hammock',
  'car-park',
  'bike-rack',
  'podium',
  'stairs',
  'suggestion-box',
] as const satisfies readonly GridOfficeKind[];

const bounds = (p: FurniturePart) =>
  p.tag === 'rect'
    ? { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h }
    : p.tag === 'ellipse'
      ? { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry }
      : null;

const marks = (view: FurnitureDrawing, fill: string) =>
  view.parts.filter((p) => p.fill === fill && p.tag === 'ellipse') as Extract<
    FurniturePart,
    { tag: 'ellipse' }
  >[];

describe('the games, the garden seats, the venue, the stairs and the team pieces, turned', () => {
  it('draws a side of its own for every piece, and a back for all but the hammock', () => {
    for (const kind of KINDS) {
      const art = OFFICE_ART[kind];
      expect(art.side, kind).not.toBe(art.front);
      expect(art.side.parts.length, kind).toBeGreaterThan(0);
      if (kind === 'hammock') expect(art.back).toBe(art.front);
      else expect(art.back, kind).not.toBe(art.front);
    }
  });

  it('keeps every rect and ellipse of every drawing inside its grid, its shadow at the bottom', () => {
    for (const kind of KINDS)
      for (const view of ['front', 'back', 'side'] as const) {
        const { width, height, parts, ring } = OFFICE_ART[kind][view];
        for (const p of parts) {
          const b = bounds(p);
          if (!b) continue;
          expect(b.x0, `${kind} ${view}`).toBeGreaterThanOrEqual(-1);
          expect(b.y0, `${kind} ${view}`).toBeGreaterThanOrEqual(-1);
          expect(b.x1, `${kind} ${view}`).toBeLessThanOrEqual(width + 1);
          expect(b.y1, `${kind} ${view}`).toBeLessThanOrEqual(height + 1);
        }
        expect(ring.cx, `${kind} ${view}`).toBeLessThanOrEqual(width);
        // Gravity points down the screen: the contact shadow lies in the lower part of the drawing (the car park's are
        // its cars', one a bay, and the hammock's runs the length of its sling).
        const shadow = parts.find((p) => p.role === 'shadow');
        if (shadow && shadow.tag === 'ellipse' && kind !== 'hammock' && kind !== 'car-park')
          expect(shadow.cy, `${kind} ${view}`).toBeGreaterThan(height * 0.7);
      }
  });

  it('lays the long pieces along the canvas on their side, their depth across it', () => {
    for (const kind of [
      'pool-table',
      'foosball-table',
      'bench',
      'picnic-table',
      'hammock',
      'car-park',
    ] as const) {
      const { front, side } = OFFICE_ART[kind];
      expect(front.width, kind).toBeGreaterThan(front.height);
      expect(side.height, kind).toBeGreaterThan(side.width);
    }
    // A turn keeps the centre and gives the box the side's proportions.
    const table = createShape('pool-table', 100, 100);
    const turned = turnPiece(table, 'e');
    expect(pieceFacing(turned)).toBe('e');
    expect(turned.width / turned.height).toBeCloseTo(88 / 240);
    expect(turned.x + turned.width / 2).toBeCloseTo(table.x + table.width / 2);
  });

  it('turns the pool table’s cloth with it: the rack to the left from behind, nearest you on its side', () => {
    const yellow = (view: FurnitureDrawing) => marks(view, RECREATION_TONES.ballYellow)[0]!;
    const cue = (view: FurnitureDrawing) => marks(view, RECREATION_TONES.ballWhite)[0]!;
    const { front, back, side } = OFFICE_ART['pool-table'];
    expect(yellow(front).cx).toBeGreaterThan(cue(front).cx);
    expect(yellow(back).cx).toBeLessThan(cue(back).cx);
    expect(yellow(side).cy).toBeGreaterThan(cue(side).cy);
  });

  it('swaps the foosball teams’ ends from behind and runs the rods across the table on its side', () => {
    const { front, back, side } = OFFICE_ART['foosball-table'];
    const team = (view: FurnitureDrawing, fill: string) =>
      view.parts.find((p) => p.tag === 'path' && p.fill === fill && p.role === 'mark');
    expect(team(back, RECREATION_TONES.teamRed)).toEqual({
      ...team(front, RECREATION_TONES.teamBlue),
      fill: RECREATION_TONES.teamRed,
    });
    // The handles stick out to the left (the front) on its side.
    const handles = side.parts.find((p) => p.fill === RECREATION_TONES.handle);
    expect(handles?.tag === 'path' && handles.d.startsWith('M5 ')).toBe(true);
  });

  it('shows the car park’s tail lights from behind and its cars side on, nose to the left, on its side', () => {
    const { front, back, side } = OFFICE_ART['car-park'];
    const lights = (view: FurnitureDrawing) =>
      view.parts.filter((p) => p.fill === VENUE_TONES.live);
    expect(lights(front)).toHaveLength(0);
    expect(lights(back)).toHaveLength(4);
    // The kerb is nearest you from behind, and down the right on its side.
    const kerb = (view: FurnitureDrawing) =>
      view.parts.filter(
        (p) => p.fill === VENUE_TONES.kerb && p.tag === 'rect' && p.role === 'panel',
      );
    expect(Math.max(...kerb(back).map((p) => (p.tag === 'rect' ? p.y : 0)))).toBeGreaterThan(100);
    expect(kerb(side).some((p) => p.tag === 'rect' && p.x > 100 && p.h === 240)).toBe(true);
    const headlights = marks(side, VENUE_TONES.lamp);
    expect(headlights).toHaveLength(2);
    for (const h of headlights) expect(h.cx).toBeLessThan(20);
  });

  it('keeps the suggestion box’s lightbulb on its front: hidden from behind, a strip down the left on its side', () => {
    const { back, side } = OFFICE_ART['suggestion-box'];
    expect(marks(back, TEAM_TONES.bulb)).toHaveLength(0);
    const bulb = marks(side, TEAM_TONES.bulb);
    expect(bulb).toHaveLength(1);
    expect(bulb[0]!.cx).toBeLessThan(side.width / 4);
    // From behind, the door it is emptied by and its lock.
    expect(marks(back, TEAM_TONES.brass)).toHaveLength(1);
  });

  it('climbs the Stairs the other way turned: the landing nearest you from behind, on the right on its side', () => {
    const landing = (view: FurnitureDrawing) =>
      view.parts.find((p) => p.fill === WAYFINDING_TONES.display && p.role === 'panel')!;
    const { front, back, side } = OFFICE_ART.stairs;
    const frontLanding = landing(front);
    expect(frontLanding.tag === 'rect' && frontLanding.y < 30).toBe(true);
    const backLanding = landing(back);
    expect(backLanding.tag === 'path' && /M[\d.]+ 100/.test(backLanding.d)).toBe(true);
    expect(
      landing(side).tag === 'rect' && (landing(side) as { x: number }).x > side.width / 2,
    ).toBe(true);
    // Where the climb ends follows: near the top in front, near the bottom from behind, at the right on its side.
    expect(STAIRS_ENDS.front.top).toEqual({ u: 0.5, v: STAIRS_TOP_SHARE });
    expect(STAIRS_ENDS.back.top.v).toBeGreaterThan(0.5);
    expect(STAIRS_ENDS.side.top.u).toBeGreaterThan(0.5);
    expect([STAIRS_ENDS.front.foot, STAIRS_ENDS.back.foot, STAIRS_ENDS.side.foot]).toEqual([
      'below',
      'above',
      'left',
    ]);
    // Facing right is the side mirrored, so the flight climbs to the left.
    expect(furnitureFrame(OFFICE_ART.stairs, 'w').transform).toContain('scale(-1 1)');
  });
});
