import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { fenceSegments } from '@liveworkspace/avatar/collision';
import {
  applyShapeVariant,
  createOutlinedRoom,
  createShape,
  doorOnRoom,
  doorsFollowRooms,
  facingInside,
  glassRoomArt,
  isGlassRoom,
  isPlacedShape,
  isWallPiece,
  onRoomWall,
  pieceVariant,
  roomWallsOf,
  roomZones,
  snapDoorToWall,
  snapMovedDoors,
  storesVariant,
  withAttachedDoors,
  withDoorPiece,
  windowArt,
  GLASS_WALL,
  ROOM_PRESETS,
  ROOM_WALLS,
  WINDOW_LIGHT,
  type Element,
  type ShapeElement,
} from './index';
import { glassRoomSvg, windowSvg } from './svg-render-doors';
import { svgBehaviourFace } from './svg-render-faces';

// docs/specs/009-elements/room-builder.md "Window", office.md "Glass walls", meeting-rooms-and-stage.md "A glass-walled
// room is a room" (Work Tracker #538, #539).

const room = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('room', 0, 0),
  id: 'r',
  roomDoor: 'none',
  ...over,
});

// A window centred on a point.
const windowAt = (x: number, y: number, id = 'w'): ShapeElement => {
  const w = createShape('window', 0, 0);
  return { ...w, id, x: x - w.width / 2, y: y - w.height / 2 };
};

const centre = (el: ShapeElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

describe('the Window', () => {
  it('is a placed wall piece, 120 x 24, with no words', () => {
    const w = createShape('window', 0, 0);
    expect([w.width, w.height, w.label]).toEqual([120, 24, '']);
    expect(isPlacedShape('window')).toBe(true);
    expect(isWallPiece(w)).toBe(true);
    expect(isWallPiece(createShape('door', 0, 0))).toBe(true);
    expect(isWallPiece(room())).toBe(false);
  });

  it('snaps onto each wall of a rectangle turned to face in', () => {
    const r = room();
    // Front wall (y = 315): inside is up, so the window turns half round.
    const front = snapDoorToWall(windowAt(240, 300), [r]);
    expect(centre(front)).toEqual({ x: 240, y: 315 });
    expect(front.rotation).toBe(180);
    // Back wall line (y = 31): inside is below, its own +y.
    expect(snapDoorToWall(windowAt(240, 40), [r]).rotation).toBe(0);
    // Left wall (x = 5): the wall runs down, so its +y points left, outside: half round.
    expect(snapDoorToWall(windowAt(20, 160), [r]).rotation).toBe(270);
    // Right wall (x = 475): its +y points left, inside.
    expect(snapDoorToWall(windowAt(460, 160), [r]).rotation).toBe(90);
  });

  it("takes its room's floor colour, and stays put away from every wall", () => {
    const r = room({ fillColor: '#123456' });
    expect(snapDoorToWall(windowAt(240, 300), [r]).fillColor).toBe('#123456');
    const free = windowAt(240, 160);
    expect(snapDoorToWall(free, [r])).toBe(free);
    // Already where the snap puts it: the same element back.
    const placed = snapDoorToWall(windowAt(240, 300), [r]);
    expect(snapDoorToWall(placed, [r])).toBe(placed);
  });

  it('faces into a custom room and a turned corridor', () => {
    // An L whose bottom wall is at y = 200 (box px): inside is above.
    const l = {
      ...createOutlinedRoom([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 100 },
        { x: 150, y: 100 },
        { x: 150, y: 200 },
        { x: 0, y: 200 },
      ])!,
      id: 'l',
    };
    const snapped = snapDoorToWall(windowAt(75, 190), [l]);
    expect(snapped.rotation).toBe(180);
    // A straight corridor turned a quarter: its walls run up and down, the floor between them.
    const corridor: ShapeElement = {
      ...createShape('corridor', 0, 0),
      id: 'c',
      rotation: 90,
    };
    const c = centre(corridor);
    // Its walls sit half a wall in from each long side, now the left and right: x = c.x -/+ (60 - 5).
    const left = snapDoorToWall(windowAt(c.x - 50, c.y), [corridor]);
    const right = snapDoorToWall(windowAt(c.x + 50, c.y), [corridor]);
    for (const w of [left, right]) {
      const r = ((w.rotation ?? 0) * Math.PI) / 180;
      const probe = { x: centre(w).x - Math.sin(r) * 9, y: centre(w).y + Math.cos(r) * 9 };
      // The light falls towards the corridor's middle.
      expect(Math.abs(probe.x - c.x)).toBeLessThan(Math.abs(centre(w).x - c.x));
    }
  });

  it('faces into a straight corridor that is not turned, from either wall', () => {
    const corridor: ShapeElement = { ...createShape('corridor', 0, 0), id: 'c' };
    // Its walls along y = 5 and y = 115: the floor between them.
    expect(snapDoorToWall(windowAt(240, 10), [corridor]).rotation).toBe(0);
    expect(snapDoorToWall(windowAt(240, 110), [corridor]).rotation).toBe(180);
  });

  it('facingInside keeps the angle when the inside is its +y, else turns half round', () => {
    const r = room();
    expect(facingInside(r, { x: 240, y: 31 }, 0)).toBe(0);
    expect(facingInside(r, { x: 240, y: 315 }, 0)).toBe(180);
    expect(facingInside(r, { x: 240, y: 315 }, 180)).toBe(180);
  });

  it('rides its room, follows a resize and snaps when dragged, but is never a Door', () => {
    const r = room();
    const w = { ...snapDoorToWall(windowAt(240, 300), [r]), id: 'w' };
    expect(onRoomWall(w, r)).toBe(true);
    expect(doorOnRoom(w, r)).toBe(false);
    // Only a wall piece stands on walls, and only a room or a corridor has them.
    expect(onRoomWall(r, r)).toBe(false);
    expect(onRoomWall(w, { ...createShape('plant', 0, 0), id: 'p' })).toBe(false);
    expect([...withAttachedDoors([r, w], new Set(['r']))]).toEqual(['r', 'w']);
    // The room twice as wide: the window keeps its place along the front wall, in the middle.
    const wide = { ...r, width: 960 };
    const after = doorsFollowRooms([r, w], [wide, w]);
    const moved = after[1] as ShapeElement;
    expect(centre(moved).x).toBe(480);
    expect(moved.rotation).toBe(180);
    // A drag that leaves it near a wall lands it on the wall.
    const dragged = { ...w, y: w.y - 20 };
    const els: Element[] = [r, dragged];
    const snapped = snapMovedDoors(els, new Set(['w']));
    expect(centre(snapped[1] as ShapeElement).y).toBe(315);
    expect(snapMovedDoors(els, new Set(['r']))).toBe(els);
  });

  it('never cuts its wall: walking and pathing see the same walls as without it', () => {
    const r = room();
    const w = snapDoorToWall(windowAt(240, 300), [r]);
    const door = snapDoorToWall({ ...createShape('door', 0, 0), id: 'd', x: 192, y: 288 }, [r]);
    const plain = fenceSegments([r]);
    expect(fenceSegments([r, w])).toEqual(plain);
    // A Door on the same wall does cut it.
    expect(fenceSegments([r, door]).length).toBe(plain.length + 1);
    // A free window blocks nothing.
    expect(fenceSegments([windowAt(900, 900)])).toEqual([]);
  });

  it('draws a frame, pane, mullion, sill and a light patch below its box', () => {
    const art = windowArt(120, 24);
    expect(art.frame).toEqual({ x: 0, y: 7, w: 120, h: 10 });
    expect(art.pane).toEqual({ x: 6, y: 9.5, w: 108, h: 5 });
    expect(art.mullion).toBe('M60 7V17');
    expect(art.fade).toEqual({ from: 19.5, to: 115.5 });
    expect(art.light).toBe('M6 19.5L114 19.5L138 115.5L-18 115.5Z');
  });

  it('exports with sunlight on light paper and moonlight on dark', () => {
    const w = { ...windowAt(100, 100), id: 'w "1"' };
    const light = windowSvg(w, '#f5f0e6', '#334155');
    expect(light).toContain(`stop-color="${WINDOW_LIGHT.light.colour}"`);
    expect(light).toContain('id="window-light-w &quot;1&quot;"');
    const dark = windowSvg(w, '#292524', '#cbd5e1', 'dark');
    expect(dark).toContain(`stop-color="${WINDOW_LIGHT.dark.colour}"`);
    expect(dark).toContain(`stop-opacity="${WINDOW_LIGHT.dark.opacity}"`);
    // Routed from the export's faces, in the paper it lands on.
    expect(svgBehaviourFace(w, '', '#000', '#334155', undefined, 'dark')).toContain(
      WINDOW_LIGHT.dark.colour,
    );
  });
});

describe('glass walls', () => {
  it('are a room variant: Solid absent, Glass stored, an unknown value Solid', () => {
    expect(storesVariant('room')).toBe(true);
    expect(ROOM_WALLS).toEqual(['solid', 'glass']);
    const glass = applyShapeVariant(room(), 'glass');
    expect(glass.variant).toBe('glass');
    expect(isGlassRoom(glass)).toBe(true);
    expect(roomWallsOf(glass)).toBe('glass');
    expect(roomWallsOf(room())).toBe('solid');
    expect(pieceVariant({ shape: 'room', variant: 'stained' })).toBe('solid');
    expect(isGlassRoom({ shape: 'corridor', variant: 'glass' })).toBe(false);
  });

  it('the Meeting Booth arrives glass with its Door, a table and a plant, in one change', () => {
    expect(ROOM_PRESETS['meeting-booth']).toMatchObject({ width: 360, height: 300 });
    const booth = applyShapeVariant(createShape('room', 100, 100), 'meeting-booth');
    expect(booth).toMatchObject({ label: 'Meeting Booth', variant: 'glass', width: 360 });
    const placed = withDoorPiece(booth, 'meeting-booth') as ShapeElement[];
    expect(placed.map((e) => e.shape)).toEqual([
      'room',
      'door',
      'screen',
      'meeting-table',
      'plant',
    ]);
    expect(isGlassRoom(placed[0]!)).toBe(true);
    // Every piece inside the walls.
    for (const p of placed.slice(2)) {
      expect(p.x).toBeGreaterThanOrEqual(110);
      expect(p.x + p.width).toBeLessThanOrEqual(450);
      expect(p.y + p.height).toBeLessThanOrEqual(390);
    }
  });

  it('block walking and keep their call exactly as solid walls do', () => {
    const solid = room({ roomDoor: 's' });
    const glass = { ...solid, variant: 'glass' };
    expect(fenceSegments([glass])).toEqual(fenceSegments([solid]));
    expect(roomZones([glass])).toEqual(roomZones([solid]));
    const outlined = {
      ...createOutlinedRoom([
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 0, y: 200 },
      ])!,
      id: 't',
    };
    expect(roomZones([{ ...outlined, variant: 'glass' }])).toEqual(roomZones([outlined]));
  });

  it("draw a rectangle's walls as panes with mullions and a glinting back face", () => {
    const art = glassRoomArt({ width: 480, height: 320, roomDoor: 'none' });
    expect(art.floor).toBe('M0 26H480V320H0Z');
    expect(art.walls.split('M').filter(Boolean)).toHaveLength(4);
    expect(art.faces).toEqual([{ x: 0, y: 0, w: 480, h: 31 }]);
    expect(art.glints).toBe('M96 5L84 26M105 5L99 15.5');
    // 480 / 64 rounds to 8 panes: 7 mullions along each long wall, 4 down each 320 side.
    expect(art.mullions.split('M').filter(Boolean)).toHaveLength(7 * 2 + 4 * 2);
  });

  it("leave an older room's top doorway open, and draw a custom room along its outline", () => {
    const top = glassRoomArt({ width: 480, height: 320, roomDoor: 'n' });
    expect(top.faces).toHaveLength(2);
    expect(top.faces.every((f) => f.w > 0)).toBe(true);
    const custom = glassRoomArt({
      width: 100,
      height: 100,
      roomOutline: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.05 },
        { x: 0.05, y: 0.95 },
      ],
    });
    expect(custom.walls).toBe('M5 5 L95 5 L5 95 Z');
    expect(custom.floor).toBe(custom.walls);
    expect(custom.faces).toEqual([]);
    expect(custom.glints).toBe('');
    // The 90 px walls are too short for two panes; the 127 px slant takes one mullion, across it at its middle.
    expect(custom.mullions).toBe('M45.76 45.76L54.24 54.24');
  });

  it('cap the mullions on a huge room, in budget', () => {
    let art = glassRoomArt({ width: 10, height: 10 });
    const ms = cpuMsOf(() => {
      art = glassRoomArt({ width: 1_000_000, height: 1_000_000, roomDoor: 'none' });
    });
    expect(art.mullions.split('M').filter(Boolean).length).toBeLessThanOrEqual(
      4 * (GLASS_WALL.mullionsMax - 1),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('export as panes, glints fainter on dark paper', () => {
    const glass = { ...room({ label: 'Booth' }), variant: 'glass' };
    const light = glassRoomSvg(glass, '#f5f0e6', '#334155');
    expect(light).toContain(`stroke-opacity="${GLASS_WALL.band}"`);
    expect(light).toContain(`stroke-opacity="${GLASS_WALL.glint}"`);
    expect(glassRoomSvg(glass, '#292524', '#cbd5e1', 'dark')).toContain(
      `stroke-opacity="${GLASS_WALL.glintDark}"`,
    );
    // A custom glass room has no face and no glints.
    const outlined = {
      ...createOutlinedRoom([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 0, y: 40 },
      ])!,
      variant: 'glass',
    };
    expect(glassRoomSvg(outlined, '#fff', '#000')).not.toContain('#ffffff');
    // The export's faces route a glass room to it, and a solid one to the room's own drawing.
    expect(svgBehaviourFace(glass, '', '#000', '#334155')).toContain(
      `stroke-opacity="${GLASS_WALL.band}"`,
    );
    expect(svgBehaviourFace(room(), '', '#000', '#334155')).not.toContain(
      `stroke-opacity="${GLASS_WALL.band}"`,
    );
  });
});
