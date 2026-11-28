import { describe, expect, it } from 'vitest';
import { createShape, ROOM_WALL, SHAPE_DEFAULT_SIZE, type Element } from '@livehuddle/document';
import { armedRoomSnap, paletteDragSnapAt } from './palette-drag-snap';

// Alignment help BEFORE the drop (docs/specs/008-canvas/canvas-and-palette.md): while a palette tile is dragged
// over the canvas, the ghost snaps to its neighbours' edges / centres and the
// same faint guide lines a move shows appear. The geometry is pure — the
// cursor's canvas point + the footprint that will land, against the tab's
// elements — so it can be reasoned about here rather than through a drag.
describe('paletteDragSnapAt', () => {
  const neighbour = {
    id: 'n1',
    type: 'sticky',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
  } as Element;

  const dragged = { width: 200, height: 200 };

  it('snaps the ghost onto a neighbour’s left edge when it is within reach', () => {
    // Cursor centre at (204, 400) => box x = 104, four px right of the
    // neighbour's left edge (100). Within the threshold, so it pulls left.
    const { dx, dy, guides } = paletteDragSnapAt({
      canvasX: 204,
      canvasY: 400,
      ...dragged,
      elements: [neighbour],
    });
    expect(dx).toBe(-4);
    expect(dy).toBe(0);
    expect(guides.length).toBeGreaterThan(0);
  });

  it('leaves a far-away ghost alone and shows no guides', () => {
    const { dx, dy, guides } = paletteDragSnapAt({
      canvasX: 900,
      canvasY: 900,
      ...dragged,
      elements: [neighbour],
    });
    expect({ dx, dy }).toEqual({ dx: 0, dy: 0 });
    expect(guides).toEqual([]);
  });

  it('snaps both axes at once (a corner latch)', () => {
    // Centre at (203, 203) => box (103, 103): 3px off the neighbour's
    // top-left corner on both axes.
    const { dx, dy } = paletteDragSnapAt({
      canvasX: 203,
      canvasY: 203,
      ...dragged,
      elements: [neighbour],
    });
    expect({ dx, dy }).toEqual({ dx: -3, dy: -3 });
  });

  // Equal-spacing (distribution) helpers ride along exactly as they do for a
  // move: they fill the axes alignment didn't already claim, so a dragged-in
  // note lands evenly spaced in a row rather than merely edge-aligned.
  it('snaps to equal spacing between two neighbours, and reports its guide', () => {
    // Two 200-wide notes at x=0 and x=600 (gap 400 — 200 clear between
    // them). A third dropped between them is evenly spaced when its box
    // sits at x=300. Aim the centre 4px off that.
    const a = { id: 'a', type: 'sticky', x: 0, y: 0, width: 200, height: 200 } as Element;
    const b = { id: 'b', type: 'sticky', x: 600, y: 0, width: 200, height: 200 } as Element;
    const { dx, distGuides } = paletteDragSnapAt({
      canvasX: 300 + 100 + 4,
      canvasY: 100,
      ...dragged,
      elements: [a, b],
    });
    expect(dx).toBe(-4);
    expect(distGuides.length).toBeGreaterThan(0);
  });

  it('lets alignment win the axis when both are in range (the move-drag rule)', () => {
    const a = { id: 'a', type: 'sticky', x: 0, y: 0, width: 200, height: 200 } as Element;
    // Aiming at a's own left edge: alignment claims x, so no distribution
    // guide may be reported for that axis.
    const { dx, distGuides } = paletteDragSnapAt({
      canvasX: 100 + 3,
      canvasY: 400,
      ...dragged,
      elements: [a],
    });
    expect(dx).toBe(-3);
    expect(distGuides.filter((g) => g.axis === 'x')).toEqual([]);
  });

  it('reports guides for the SNAPPED box, not the raw cursor box', () => {
    // A 4px-off box produces no guide of its own; only after the snap do
    // the shared edges line up — so a guide proves the snapped geometry
    // was measured.
    const { guides } = paletteDragSnapAt({
      canvasX: 204,
      canvasY: 400,
      ...dragged,
      elements: [neighbour],
    });
    expect(guides.some((g) => g.axis === 'x')).toBe(true);
  });
});

// docs/specs/009-elements/office.md "Rooms line up": a Room placed beside a room shares its wall.
describe('a Room placed beside a room', () => {
  const left = {
    ...createShape('room', 0, 0),
    id: 'a',
    width: 480,
    height: 320,
    roomDoor: 'none',
  } as Element;
  const { width, height } = SHAPE_DEFAULT_SIZE.room;

  it('lands on the shared wall line, not box edge to box edge, with the wall guide', () => {
    // Its box 4px right of where the two share the right wall (x 470).
    const at = { x: 480 - ROOM_WALL + 4 + width / 2, y: height / 2 };
    const boxed = paletteDragSnapAt({
      canvasX: at.x,
      canvasY: at.y,
      width,
      height,
      elements: [left],
    });
    expect(boxed.dx).toBe(-4 + ROOM_WALL); // the box edge (480) was nearer without the room rule
    const shared = armedRoomSnap(at, [left]);
    expect(shared.dx).toBe(-4);
    expect(shared.guides.some((g) => g.axis === 'x' && g.position === 480 - ROOM_WALL / 2)).toBe(
      true,
    );
  });

  // The owner (2026-11-27): a room added beside another left a double wall, the 6px edge snap pulling it box edge to
  // box edge. The shared wall reaches further and wins its axis.
  it('shares the wall when dropped box edge to box edge, or roughly beside, never a double wall', () => {
    for (const off of [2, 0, 25, -20]) {
      const at = { x: 480 + off + width / 2, y: height / 2 + 7 };
      expect(armedRoomSnap(at, [left]).dx).toBe(-ROOM_WALL - off);
    }
    const dragged = paletteDragSnapAt({
      canvasX: 480 + 30 + width / 2,
      canvasY: height / 2,
      width,
      height,
      elements: [left],
      room: true,
    });
    expect(dragged.dx).toBe(-ROOM_WALL - 30);
  });

  it('leaves a room well apart, or not beside it, to its edge snap', () => {
    expect(armedRoomSnap({ x: 480 + 90 + width / 2, y: height / 2 }, [left]).dx).toBe(0);
    // Far below, its left edge near the other's right wall line: lined up by edges, not pulled onto that wall.
    expect(armedRoomSnap({ x: 480 + 2 + width / 2, y: 900 }, [left]).dx).toBe(-2);
  });

  it("snaps a Room preset at the preset's size, and a shaped preset by its edges only", () => {
    // The 640 by 440 Room preset, its box 12px right of the shared wall line.
    expect(armedRoomSnap({ x: 480 + 2 + 320, y: 220 }, [left], 'medium').dx).toBe(-ROOM_WALL - 2);
    // A hexagon's walls are not on its box: its box edge meets the other's (dx -2), no wall overlap.
    expect(armedRoomSnap({ x: 480 + 2 + 340, y: 280 }, [left], 'hexagon').dx).toBe(-2);
  });
});
