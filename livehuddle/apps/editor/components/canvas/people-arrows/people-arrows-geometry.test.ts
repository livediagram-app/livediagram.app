import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  ARROW_SIZE,
  ARROW_SPACING,
  EDGE_GAP,
  OBSTACLE_GAP,
  SEEN_INSET,
  arrowPeopleOf,
  arrowSlot,
  arrowSlots,
  blockedSpans,
  bodyOf,
  emphasisOf,
  isInView,
  nearestClear,
  nearness,
  peopleArrowsOn,
  railCrossing,
  railOf,
  railPoint,
  samePeople,
  screenOf,
  type Box,
} from './people-arrows-geometry';

// docs/specs/008-canvas/people-arrows.md
const AREA: Box = { left: 0, top: 0, right: 1200, bottom: 800 };
const RAIL_INSET = EDGE_GAP + ARROW_SIZE / 2;
const person = (id: string) => ({ id, name: id.toUpperCase(), color: '#2563eb' });
const overlaps = (x: number, y: number, o: Box) =>
  x + ARROW_SIZE / 2 > o.left &&
  x - ARROW_SIZE / 2 < o.right &&
  y + ARROW_SIZE / 2 > o.top &&
  y - ARROW_SIZE / 2 < o.bottom;

describe('who gets an arrow', () => {
  it('shows for 1 to 9 other people and never at 0 or 10 and more', () => {
    expect(peopleArrowsOn(0)).toBe(false);
    expect(peopleArrowsOn(1)).toBe(true);
    expect(peopleArrowsOn(9)).toBe(true);
    expect(peopleArrowsOn(10)).toBe(false);
    expect(peopleArrowsOn(40)).toBe(false);
  });

  it('gives every walking human an arrow while the tab holds fewer than 10', () => {
    const rows = ['a', 'b', 'c'].map(person);
    expect(arrowPeopleOf(rows, ['a', 'b', 'c'], () => false).map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('never gives an agent an arrow, nor counts one', () => {
    const rows = ['a', 'bot'].map(person);
    const agents = new Set(['bot', 'bot2']);
    const many = Array.from({ length: 8 }, (_, i) => `h${i}`);
    expect(arrowPeopleOf(rows, ['a', 'bot'], (id) => agents.has(id)).map((p) => p.id)).toEqual([
      'a',
    ]);
    // Nine humans (a and eight more) and two agents: still under the cap.
    expect(arrowPeopleOf(rows, [...many, 'bot', 'bot2'], (id) => agents.has(id))).toHaveLength(1);
  });

  it('counts people on the tab who are not walking towards the cap of 10', () => {
    const rows = ['a'].map(person);
    const onTab = ['a', ...Array.from({ length: 9 }, (_, i) => `still${i}`)];
    expect(arrowPeopleOf(rows, onTab, () => false)).toEqual([]);
    expect(arrowPeopleOf(rows, onTab.slice(0, 9), () => false)).toHaveLength(1);
  });

  it('caps at 10 walking people too', () => {
    const rows = Array.from({ length: 10 }, (_, i) => person(`p${i}`));
    expect(arrowPeopleOf(rows, [], () => false)).toEqual([]);
    expect(arrowPeopleOf(rows.slice(0, 9), [], () => false)).toHaveLength(9);
  });

  it('knows when nothing the layer shows changed', () => {
    expect(samePeople([person('a')], [person('a')])).toBe(true);
    expect(samePeople([person('a')], [{ ...person('a'), color: '#000000' }])).toBe(false);
    expect(samePeople([person('a')], [{ ...person('a'), name: 'Ada' }])).toBe(false);
    expect(samePeople([person('a')], [person('b')])).toBe(false);
    expect(samePeople([person('a')], [])).toBe(false);
  });
});

describe('screen position', () => {
  it('maps a canvas point through the centred scale and offset', () => {
    const size = { width: 1000, height: 600 };
    expect(screenOf({ x: 500, y: 300 }, { zoom: 2, offset: { x: 0, y: 0 } }, size)).toEqual({
      x: 500,
      y: 300,
    });
    expect(screenOf({ x: 600, y: 300 }, { zoom: 2, offset: { x: 0, y: 0 } }, size)).toEqual({
      x: 700,
      y: 300,
    });
    expect(screenOf({ x: 0, y: 0 }, { zoom: 1, offset: { x: 50, y: -20 } }, size)).toEqual({
      x: 50,
      y: -20,
    });
  });

  it('looks at the middle of the character, above its feet', () => {
    expect(bodyOf({ x: 10, y: 100 }).y).toBeLessThan(100);
  });
});

describe('in view', () => {
  it('is in view well inside the canvas and not past its edge', () => {
    expect(isInView({ x: 600, y: 400 }, AREA, [], false)).toBe(true);
    expect(isInView({ x: -5, y: 400 }, AREA, [], true)).toBe(false);
    expect(isInView({ x: 600, y: 900 }, AREA, [], true)).toBe(false);
  });

  it('is not in view behind a control', () => {
    const map: Box = { left: 16, top: 600, right: 270, bottom: 780 };
    expect(isInView({ x: 100, y: 700 }, AREA, [map], true)).toBe(false);
  });

  it('has a margin so the arrow never flickers on the boundary', () => {
    // An arrow showing: coming just inside the edge keeps it; SEEN_INSET inside loses it.
    expect(isInView({ x: 5, y: 400 }, AREA, [], false)).toBe(false);
    expect(isInView({ x: SEEN_INSET + 1, y: 400 }, AREA, [], false)).toBe(true);
    // In view: drifting back to just inside the edge keeps it in view; crossing the edge does not.
    expect(isInView({ x: 5, y: 400 }, AREA, [], true)).toBe(true);
    expect(isInView({ x: -1, y: 400 }, AREA, [], true)).toBe(false);
    // The same margin round a control.
    const dock: Box = { left: 500, top: 700, right: 800, bottom: 760 };
    expect(isInView({ x: 650, y: 690 }, AREA, [dock], false)).toBe(false);
    expect(isInView({ x: 650, y: 690 }, AREA, [dock], true)).toBe(true);
  });
});

describe('the rail', () => {
  const rail = railOf(AREA);

  it('sits inside the canvas by the gap and half an arrow', () => {
    expect(rail).toEqual({
      left: RAIL_INSET,
      top: RAIL_INSET,
      right: 1200 - RAIL_INSET,
      bottom: 800 - RAIL_INSET,
    });
  });

  it('crosses the rail along the line from the centre to the person', () => {
    const w = rail.right - rail.left;
    const h = rail.bottom - rail.top;
    // Straight right, down, left and up.
    expect(railPoint(rail, railCrossing(rail, { x: 5000, y: 400 }))).toEqual({
      x: rail.right,
      y: 400,
    });
    expect(railPoint(rail, railCrossing(rail, { x: 600, y: 5000 }))).toEqual({
      x: 600,
      y: rail.bottom,
    });
    expect(railPoint(rail, railCrossing(rail, { x: -5000, y: 400 }))).toEqual({
      x: rail.left,
      y: 400,
    });
    expect(railPoint(rail, railCrossing(rail, { x: 600, y: -5000 }))).toEqual({
      x: 600,
      y: rail.top,
    });
    expect(railCrossing(rail, { x: 600, y: 400 })).toBe(0);
    // The loop runs round once.
    expect(railPoint(rail, 2 * w + 2 * h + 5)).toEqual(railPoint(rail, 5));
  });

  it('clamps far corners into the rail corner', () => {
    const p = railPoint(
      rail,
      railCrossing(rail, { x: 600 + 1e4 * (rail.right - 600), y: 400 + 1e4 * (rail.bottom - 400) }),
    );
    expect(p.x).toBeCloseTo(rail.right);
    expect(p.y).toBeCloseTo(rail.bottom);
  });
});

describe('where an arrow sits', () => {
  it('sits on the edge towards the person and points at them', () => {
    const slot = arrowSlot({ x: 2000, y: 400 }, AREA, [])!;
    expect(slot.x).toBe(1200 - RAIL_INSET);
    expect(slot.y).toBe(400);
    expect(slot.angle).toBeCloseTo(0);
    const up = arrowSlot({ x: 600, y: -900 }, AREA, [])!;
    expect(up.angle).toBeCloseTo(-Math.PI / 2);
  });

  it('moves along the edge as the view moves (you walking or panning)', () => {
    const size = { width: 1200, height: 800 };
    const feet = { x: 3000, y: 900 };
    const before = arrowSlot(
      screenOf(bodyOf(feet), { zoom: 1, offset: { x: 0, y: 0 } }, size),
      AREA,
      [],
    )!;
    // You walk right by 1500 canvas px: the camera follows, the person is now up and to the right of less far.
    const after = arrowSlot(
      screenOf(bodyOf(feet), { zoom: 1, offset: { x: -1500, y: -300 } }, size),
      AREA,
      [],
    )!;
    expect(before.x).toBe(1200 - RAIL_INSET);
    expect(after.x).toBe(1200 - RAIL_INSET);
    expect(after.y).not.toBeCloseTo(before.y);
    // Zooming out brings them nearer the middle: the arrow climbs the right edge towards the centre line.
    const zoomed = arrowSlot(
      screenOf(bodyOf(feet), { zoom: 0.25, offset: { x: 0, y: 0 } }, size),
      AREA,
      [],
    );
    expect(zoomed).not.toBeNull();
  });

  it('never covers a control, sliding to the nearest clear spot and still pointing at the person', () => {
    // The Call dock, bottom centre; someone straight below it.
    const dock: Box = { left: 450, top: 740, right: 750, bottom: 790 };
    const target = { x: 600, y: 2000 };
    const slot = arrowSlot(target, AREA, [dock])!;
    expect(overlaps(slot.x, slot.y, dock)).toBe(false);
    expect(slot.y).toBe(800 - RAIL_INSET);
    // Just beside the dock, not somewhere far along the edge.
    const besideLeft = dock.left - ARROW_SIZE / 2 - OBSTACLE_GAP;
    const besideRight = dock.right + ARROW_SIZE / 2 + OBSTACLE_GAP;
    expect([besideLeft, besideRight]).toContain(slot.x);
    // Pointing down (and a little across) at them.
    expect(Math.sin(slot.angle)).toBeGreaterThan(0.9);
  });

  it('slides the shorter way past a control', () => {
    const dock: Box = { left: 450, top: 740, right: 750, bottom: 790 };
    expect(arrowSlot({ x: 480, y: 2000 }, AREA, [dock])!.x).toBe(
      450 - ARROW_SIZE / 2 - OBSTACLE_GAP,
    );
    expect(arrowSlot({ x: 720, y: 2000 }, AREA, [dock])!.x).toBe(
      750 + ARROW_SIZE / 2 + OBSTACLE_GAP,
    );
  });

  it('slides round a corner past the Map and the zoom cluster', () => {
    const map: Box = { left: 16, top: 600, right: 272, bottom: 784 };
    const zoom: Box = { left: 1040, top: 740, right: 1184, bottom: 786 };
    for (const target of [
      { x: -3000, y: 3000 },
      { x: 4000, y: 4000 },
      { x: -500, y: 700 },
    ]) {
      const slot = arrowSlot(target, AREA, [map, zoom])!;
      expect(overlaps(slot.x, slot.y, map)).toBe(false);
      expect(overlaps(slot.x, slot.y, zoom)).toBe(false);
    }
  });

  it('keeps clear of the top toolbar and the menu card', () => {
    const strip: Box = { left: 346, top: 12, right: 1194, bottom: 65 };
    const menu: Box = { left: 12, top: 12, right: 191, bottom: 65 };
    for (let x = -2000; x <= 3000; x += 250) {
      const slot = arrowSlot({ x, y: -3000 }, AREA, [strip, menu])!;
      expect(overlaps(slot.x, slot.y, strip)).toBe(false);
      expect(overlaps(slot.x, slot.y, menu)).toBe(false);
    }
  });

  it('has no spot when controls cover the whole edge', () => {
    expect(
      arrowSlot({ x: 2000, y: 400 }, AREA, [{ left: -10, top: -10, right: 1210, bottom: 810 }]),
    ).toBeNull();
  });

  it('joins a control covering the loop start, so the corner is never a gap', () => {
    const rail = railOf(AREA);
    const corner: Box = { left: 0, top: 0, right: 120, bottom: 120 };
    const spans = blockedSpans(rail, [corner]);
    expect(spans).toHaveLength(1);
    expect(spans[0]![1]).toBeGreaterThan(
      2 * (rail.right - rail.left) + 2 * (rail.bottom - rail.top),
    );
    const slot = arrowSlot({ x: -3000, y: -2000 }, AREA, [corner])!;
    expect(overlaps(slot.x, slot.y, corner)).toBe(false);
  });

  it('finds the nearest clear spot on the loop', () => {
    expect(nearestClear(50, [], 100)).toBe(50);
    expect(nearestClear(50, [[40, 70]], 100)).toBe(40);
    expect(nearestClear(65, [[40, 70]], 100)).toBe(70);
    expect(nearestClear(5, [[90, 115]], 100)).toBe(15);
    expect(nearestClear(5, [[0, 100]], 100)).toBeNull();
    expect(nearestClear(5, [], 0)).toBeNull();
  });
});

describe('several arrows', () => {
  it('spreads two people in the same direction along the edge, each still pointing at its own', () => {
    const a = { x: 3000, y: 400 };
    const b = { x: 3000, y: 410 };
    const [sa, sb] = arrowSlots([a, b], AREA, []);
    expect(Math.abs(sb!.y - sa!.y)).toBeGreaterThanOrEqual(ARROW_SPACING - 0.001);
    expect(sa!.x).toBe(sb!.x);
    expect(sb!.angle).toBeCloseTo(Math.atan2(b.y - sb!.y, b.x - sb!.x));
  });

  it('steps a spread arrow past a control rather than onto it', () => {
    // Two people below the left of the bottom edge, a control just clockwise of them.
    const control: Box = { left: 400, top: 740, right: 520, bottom: 800 };
    const [sa, sb] = arrowSlots(
      [
        { x: 560, y: 3000 },
        { x: 560, y: 3000 },
      ],
      AREA,
      [control],
    );
    expect(overlaps(sa!.x, sa!.y, control)).toBe(false);
    expect(overlaps(sb!.x, sb!.y, control)).toBe(false);
    expect(Math.abs(sa!.x - sb!.x)).toBeGreaterThanOrEqual(ARROW_SPACING - 0.001);
  });

  it('leaves people far apart where they are', () => {
    const slots = arrowSlots(
      [
        { x: 3000, y: 400 },
        { x: -3000, y: 400 },
      ],
      AREA,
      [],
    );
    expect(slots.map((s) => s!.x)).toEqual([1200 - RAIL_INSET, RAIL_INSET]);
  });
});

describe('closer is bolder', () => {
  it('is boldest just past the edge and lightest far away', () => {
    expect(nearness({ x: 1210, y: 400 }, AREA)).toBeGreaterThan(0.99);
    expect(nearness({ x: 1200 + 5000, y: 400 }, AREA)).toBe(0);
    const near = emphasisOf(1);
    const far = emphasisOf(0);
    expect(near).toEqual({ scale: 1, opacity: 1 });
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.opacity).toBeGreaterThan(0.5);
  });
});

describe('cost', () => {
  // One frame places at most 9 arrows; 1000 frames of 9 arrows past 12 controls stay well under a frame's budget.
  const FRAMES = 1000;
  const BUDGET_MS = 60;
  it(`places 9 arrows past 12 controls for ${FRAMES} frames inside ${cpuBudgetMs(BUDGET_MS)} ms`, () => {
    const controls: Box[] = Array.from({ length: 12 }, (_, i) => ({
      left: (i % 6) * 200,
      top: i < 6 ? 0 : 760,
      right: (i % 6) * 200 + 120,
      bottom: i < 6 ? 60 : 800,
    }));
    const run = () => {
      for (let f = 0; f < FRAMES; f++)
        for (let i = 0; i < 9; i++) {
          const p = { x: Math.cos(f / 50 + i) * 3000 + 600, y: Math.sin(f / 50 + i) * 3000 + 400 };
          if (!isInView(p, AREA, controls, false)) arrowSlot(p, AREA, controls);
        }
    };
    run();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(run)));
    expect(best).toBeLessThan(cpuBudgetMs(BUDGET_MS));
  });
});
