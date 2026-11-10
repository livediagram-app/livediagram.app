import { describe, expect, it } from 'vitest';
import { clearOfFences, fenceReachFor, fenceSegments, fenceStep } from './collision';
import { facingTurn, turnFacing, type SeatFacing } from './facing';
import {
  catchArea,
  isLecternShape,
  LECTERN_ASIDE,
  lecternArea,
  lecternAside,
  lecternSpot,
} from './lectern';
import {
  isFixedSeatShape,
  isSceneryShape,
  isStandingSeatShape,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { newSeatClaim, seatOnArrival, seatToYield } from './seat-claims';
import { seatFor, seatPoints } from './seats';
import { AVATAR_SIZE_SCALE } from './size-scale';
import { elementUnderFeet, sitsOnEntry } from './walk';

// livehuddle's docs/specs/009-elements/venue-pieces.md "Speaking from the Podium": a click stands you at its speaker
// spot, behind its front at every facing, facing its audience; one speaker at a time.

const TALL_REACH = fenceReachFor(AVATAR_SIZE_SCALE.tall);
const REGULAR_REACH = fenceReachFor(AVATAR_SIZE_SCALE.regular);

// A Podium at (100, 50), its box the drawing its facing shows (furniture-facing.md "A turn": 56 x 88 from the front
// and behind, 44 x 88 on its side).
function podium(facing: SeatFacing, extra: { rotation?: number } = {}) {
  const side = facing === 'e' || facing === 'w';
  return {
    id: 'podium-1',
    type: 'shape' as const,
    shape: 'podium' as const,
    x: 100,
    y: 50,
    width: side ? 44 : 56,
    height: 88,
    chairFacing: facing,
    ...extra,
  };
}

const centre = (el: ReturnType<typeof podium>) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

const STEP = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] } as const;

// The distance from a point to a box (0 inside it).
function distanceToBox(
  p: { x: number; y: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.width));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}

// Two points the same to rounding (a spot is a fraction of its grid times the box).
function expectNear(p: { x: number; y: number } | undefined, q: { x: number; y: number }) {
  expect(p).toBeDefined();
  expect(p!.x).toBeCloseTo(q.x, 6);
  expect(p!.y).toBeCloseTo(q.y, 6);
}

const stopOf = (arrival: ReturnType<typeof seatOnArrival>) =>
  'stopAt' in arrival ? arrival.stopAt : undefined;

// A straight walk as the walk loop takes it (13 px steps through fenceStep): where the feet stop.
function walk(
  el: ReturnType<typeof podium>,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const fences = fenceSegments([el]);
  let pos = from;
  for (let i = 0; i < 400; i++) {
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) break;
    const t = Math.min(13, d);
    const step = fenceStep(
      pos,
      { x: pos.x + (dx / d) * t, y: pos.y + (dy / d) * t },
      fences,
      REGULAR_REACH,
    );
    if (step.blocked && Math.hypot(step.pos.x - pos.x, step.pos.y - pos.y) < 0.01) break;
    pos = step.pos;
  }
  return pos;
}

describe('the podium as a place to speak from', () => {
  it('is held like a seat and stood at, and still blocks at its foot', () => {
    expect(isLecternShape('podium')).toBe(true);
    expect(isLecternShape('stage')).toBe(false);
    expect(isFixedSeatShape('podium')).toBe(true);
    expect(seatsACharacter('podium')).toBe(true);
    expect(isStandingSeatShape('podium')).toBe(true);
    expect(isSceneryShape('podium')).toBe(true);
    expect(officeFootprint(podium('n'))).not.toBeNull();
    expect(seatPoints(podium('n'))).toHaveLength(1);
  });

  it('stands the speaker behind its front at each quarter turn, facing the way its front faces', () => {
    // Rotate Right from Down: 0, 90, 180 and 270 degrees.
    const expected: Record<SeatFacing, { x: number; y: number; facing: string }> = {
      // Behind it, up the canvas, just above its top, facing down.
      n: { x: 128, y: 70, facing: 'down' },
      // At its right, at its foot's depth, facing left.
      e: { x: 158, y: 130, facing: 'left' },
      // Below its foot, nearest the camera, facing up.
      s: { x: 128, y: 154, facing: 'up' },
      // The side mirrored: at its left, facing right.
      w: { x: 86, y: 130, facing: 'right' },
    };
    for (const turns of [0, 1, 2, 3]) {
      const facing = turnFacing('n', turns);
      expect(facingTurn('n', facing)).toBe(turns * 90);
      const el = podium(facing);
      const spot = lecternSpot(el);
      expect(spot.x, facing).toBeCloseTo(expected[facing].x, 6);
      expect(spot.y, facing).toBeCloseTo(expected[facing].y, 6);
      expect(spot.facing, facing).toBe(expected[facing].facing);
      // The speaker looks across the Podium, toward its audience: a step the way they face nears its middle.
      const [sx, sy] = STEP[spot.facing];
      const c = centre(el);
      const before = Math.hypot(c.x - spot.x, c.y - spot.y);
      const after = Math.hypot(c.x - (spot.x + sx * 10), c.y - (spot.y + sy * 10));
      expect(after, facing).toBeLessThan(before);
      // The seat a chair arrival hands sitOn is the same spot.
      expect(seatFor(el, { x: 0, y: 0 })).toEqual(spot);
    }
  });

  it('ignores a rotation stored on it, at any angle', () => {
    for (const facing of ['n', 'e', 's', 'w'] as const)
      for (const rotation of [37, 90, 123.5, 270, -45]) {
        expect(lecternSpot(podium(facing, { rotation })), `${facing} ${rotation}`).toEqual(
          lecternSpot(podium(facing)),
        );
        expect(lecternArea(podium(facing, { rotation }))).toEqual(lecternArea(podium(facing)));
      }
  });

  it('keeps the spot clear of its foot by more than a Tall character’s reach', () => {
    for (const facing of ['n', 'e', 's', 'w'] as const) {
      const el = podium(facing);
      const spot = lecternSpot(el);
      expect(distanceToBox(spot, officeFootprint(el)!), facing).toBeGreaterThan(TALL_REACH);
      // So standing there is never nudged off the spot (useAvatarWalk sitOn clears a seat of every wall).
      const feet = { x: spot.x, y: spot.y };
      expect(clearOfFences(feet, fenceSegments([el]), TALL_REACH), facing).toEqual(feet);
    }
  });

  it('counts feet on the spot as at the podium, even where the spot lies outside its box', () => {
    for (const facing of ['n', 'e', 's', 'w'] as const) {
      const el = podium(facing);
      const spot = lecternSpot(el);
      expect(elementUnderFeet([el], spot), facing).toBe(el.id);
      // A click-walk to the spot is a walk to the podium, so arriving stands you at it.
      expect(sitsOnEntry(catchArea(el), spot), facing).toBe(true);
    }
    // From behind and on its side the spot is outside the box, so only the area takes it in.
    const back = podium('s');
    expect(lecternSpot(back).y).toBeGreaterThan(back.y + back.height);
    expect(elementUnderFeet([back], { x: 128, y: 154 + 40 })).toBeNull();
    // Any other piece's area is its box.
    const chair = { x: 0, y: 0, width: 76, height: 84, shape: 'chair' };
    expect(catchArea(chair)).toBe(chair);
  });

  it('is reached by walking up to it from the audience’s side, never through its foot', () => {
    // Facing up, the speaker's side is nearest the camera: a walk up the canvas ends on the spot, below the foot.
    const back = podium('s');
    const at = walk(back, { x: 128, y: 400 }, lecternSpot(back));
    expect(at.x).toBeCloseTo(128, 3);
    expect(at.y).toBeCloseTo(154, 3);
    // On its side, from the right.
    const side = podium('e');
    const end = walk(side, { x: 400, y: 130 }, lecternSpot(side));
    expect(end.x).toBeCloseTo(158, 3);
  });
});

describe('one speaker at a time', () => {
  it('stands you on the free spot', () => {
    const el = podium('n');
    const arrival = seatOnArrival(el, { x: 128, y: 74 }, []);
    expect('sit' in arrival).toBe(true);
    const sit = 'sit' in arrival ? arrival.sit : null;
    expectNear(sit!, { x: 128, y: 70 });
    expect(sit!.facing).toBe('down');
    expect(sit!.index).toBe(0);
    // Somebody standing near it, not at it, holds nothing.
    expect(seatOnArrival(el, { x: 128, y: 74 }, [{ x: 128, y: 70, seatedOn: null }])).toEqual(
      arrival,
    );
  });

  it('stops you a step to the speaker’s side, along its front line, when somebody stands there', () => {
    const speaker = { x: 128, y: 70, seatedOn: 'podium-1', seat: newSeatClaim(0, 1, 0.5) };
    // From the front: across the canvas, on the side you came from; straight on, to the right.
    const front = podium('n');
    expectNear(stopOf(seatOnArrival(front, { x: 110, y: 72 }, [speaker])), {
      x: 128 - LECTERN_ASIDE,
      y: 70,
    });
    expectNear(stopOf(seatOnArrival(front, { x: 140, y: 72 }, [speaker])), {
      x: 128 + LECTERN_ASIDE,
      y: 70,
    });
    expectNear(stopOf(seatOnArrival(front, { x: 128, y: 72 }, [speaker])), {
      x: 128 + LECTERN_ASIDE,
      y: 70,
    });
    // On its side: down the canvas, beside the speaker at the podium's right.
    const side = podium('e');
    const sideSpeaker = { ...speaker, x: 158, y: 130 };
    expectNear(stopOf(seatOnArrival(side, { x: 160, y: 100 }, [sideSpeaker])), {
      x: 158,
      y: 130 - LECTERN_ASIDE,
    });
    // A presence with no claim (an older client) still holds the spot it stands on.
    expect(
      'stopAt' in
        seatOnArrival(front, { x: 128, y: 72 }, [{ x: 128, y: 70, seatedOn: 'podium-1' }]),
    ).toBe(true);
  });

  it('settles two who arrive at once as a seat does: the later steps aside', () => {
    const el = podium('s');
    const spot = lecternSpot(el);
    const earlier = { x: spot.x, y: spot.y, seatedOn: el.id, seat: newSeatClaim(0, 1000, 0.9) };
    const ours = newSeatClaim(0, 1001, 0.1);
    expect(seatToYield(el, ours, [earlier])).toEqual(lecternAside(spot, spot));
    expect(seatToYield(el, ours, [earlier])).toEqual({ x: spot.x + LECTERN_ASIDE, y: spot.y });
    // The earlier keeps it.
    expect(seatToYield(el, newSeatClaim(0, 999, 0.5), [earlier])).toBeNull();
  });
});
