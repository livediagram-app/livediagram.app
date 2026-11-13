import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  applyShapeVariant,
  corridorPaths,
  createShape,
  doorArt,
  doorOnRoom,
  doorPoseTransform,
  doorsFollowRooms,
  isPieceVariant,
  isValidElement,
  pieceVariant,
  roomPresetDoorAt,
  rugDrawnToSize,
  rugParts,
  snapDoorToWall,
  storesVariant,
  variantsOf,
  withAttachedDoors,
  withDoorPiece,
  DOOR_VARIANTS,
  ROOM_PRESETS,
  createOutlinedRoom,
  isLongTable,
  longTableArt,
  turnPiece,
  outlineNameAlign,
  pointInPolygon,
  RUG_VARIANTS,
  ROOM_PRESET_LAYOUTS,
  PRESET_SCREEN_TOP,
  type ShapeElement,
} from './index';
import { ROOM_BACK_FACE } from '@livehuddle/avatar/office-geometry';
import { corridorSvg, doorSvg } from './svg-render-doors';
import { svgBehaviourFace } from './svg-render-faces';

// docs/specs/009-elements/room-builder.md "Door types" and "Locked doors", office.md "Room presets" and "Rug types",
// corridor.md (Work Tracker #543, #598, #599).

const at = (el: ShapeElement, x: number, y: number): ShapeElement => ({ ...el, x, y });
const face = (el: ShapeElement) => svgBehaviourFace(el, '', '#000', '#334155') ?? '';

describe('a piece type (variant)', () => {
  it('is stored by a Door, a Rug, a Corridor and a Room (its walls), and nothing else', () => {
    expect(['door', 'rug', 'corridor', 'room'].every(storesVariant)).toBe(true);
    expect(storesVariant('window')).toBe(false);
    expect(variantsOf('window')).toEqual([]);
    expect(variantsOf('room')).toEqual(['solid', 'glass']);
    expect(variantsOf('door')).toEqual(DOOR_VARIANTS);
  });

  it('draws as its kind first type when absent or unknown', () => {
    expect(pieceVariant({ shape: 'door' })).toBe('swing');
    expect(pieceVariant({ shape: 'rug', variant: 'persian' })).toBe('persian');
    expect(pieceVariant({ shape: 'rug', variant: 'tartan' })).toBe('oval');
    // A room preset's name is never its wall style: an Office's walls are Solid.
    expect(pieceVariant({ shape: 'room', variant: 'office' })).toBe('solid');
    expect(pieceVariant({ shape: 'window', variant: 'bay' })).toBe('');
  });

  it('is validated as 1 to 32 lowercase letters and hyphens', () => {
    expect(isPieceVariant('t-junction')).toBe(true);
    expect(isPieceVariant('')).toBe(false);
    expect(isPieceVariant('Sliding')).toBe(false);
    expect(isPieceVariant('a1')).toBe(false);
    expect(isPieceVariant('a'.repeat(33))).toBe(false);
    expect(isPieceVariant(3)).toBe(false);
    const door = createShape('door', 0, 0);
    expect(isValidElement({ ...door, variant: 'sliding' })).toBe(true);
    expect(isValidElement({ ...door, variant: 'NOT OK' })).toBe(false);
  });

  it('is stored with its size by applyShapeVariant, and only a type the kind takes', () => {
    const door = applyShapeVariant(createShape('door', 0, 0), 'double');
    expect(door).toMatchObject({ variant: 'double', width: 144, height: 24 });
    expect(applyShapeVariant(createShape('door', 0, 0), 'revolving')).toMatchObject({
      variant: 'revolving',
      width: 96,
    });
    expect(applyShapeVariant(createShape('door', 0, 0), 'trapdoor').variant).toBeUndefined();
    const round = applyShapeVariant(createShape('rug', 0, 0), 'round');
    expect(round).toMatchObject({ variant: 'round', width: 160, height: 160, aspectLocked: true });
    expect(applyShapeVariant(createShape('rug', 0, 0), 'kilim').aspectLocked).toBeUndefined();
    expect(applyShapeVariant(createShape('corridor', 0, 0), 'cross')).toMatchObject({
      variant: 'cross',
      width: 480,
      height: 480,
    });
  });
});

describe('room presets', () => {
  it('places a rectangle at its size and name, its Door its own in the front wall, then its furnishings', () => {
    const office = applyShapeVariant(createShape('room', 0, 0), 'office');
    expect(office).toMatchObject({ width: 360, height: 240, label: 'Office' });
    expect(office.roomOutline).toBeUndefined();
    expect(office.variant).toBeUndefined();
    const [room, door, ...rest] = withDoorPiece(office, 'office');
    expect(room).toMatchObject({ roomDoor: 'none' });
    expect(door).toMatchObject({ shape: 'door' });
    expect(rest.map((p) => (p as ShapeElement).shape)).toEqual(['desk', 'plant', 'bookshelf']);
    // The plain Room is the empty one.
    expect(withDoorPiece(createShape('room', 0, 0))).toHaveLength(2);
  });

  it('furnishes every preset inside its walls, each piece valid and in the room stroke', () => {
    for (const variant of Object.keys(ROOM_PRESETS)) {
      const placed = at(applyShapeVariant(createShape('room', 0, 0), variant), 100, 50);
      const [room, , ...pieces] = withDoorPiece(
        { ...placed, strokeColor: '#123456' },
        variant,
      ) as ShapeElement[];
      expect(pieces.length, variant).toBeGreaterThan(2);
      for (const p of pieces) {
        expect(isValidElement(p), `${variant} ${p.shape}`).toBe(true);
        expect(p.strokeColor).toBe('#123456');
        const corners = [
          { x: p.x, y: p.y },
          { x: p.x + p.width, y: p.y },
          { x: p.x, y: p.y + p.height },
          { x: p.x + p.width, y: p.y + p.height },
        ].map((c) => ({ x: (c.x - room!.x) / room!.width, y: (c.y - room!.y) / room!.height }));
        for (const c of corners) {
          expect(c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1, `${variant} ${p.shape}`).toBe(true);
          if (room!.roomOutline)
            expect(pointInPolygon(c, room!.roomOutline), `${variant} ${p.shape}`).toBe(true);
        }
      }
    }
    // The Lounge's sofas face in across its round rug, which lies under them.
    const lounge = withDoorPiece(
      applyShapeVariant(createShape('room', 0, 0), 'lounge'),
      'lounge',
    ) as ShapeElement[];
    expect(lounge[2]).toMatchObject({ shape: 'rug', variant: 'bordered' });
    expect(
      lounge
        .filter((p) => p.shape === 'sofa')
        // Turned to the side drawing's proportions (furniture-facing.md "A turn"), so to the pixel.
        .map((p) => [p.chairFacing, Math.round(p.width), Math.round(p.height)]),
    ).toEqual([
      ['w', 85, 152],
      ['e', 85, 152],
    ]);
  });

  it('gives the Boardroom a Long Table for sixteen under a screen, drawn and seated to its width', () => {
    const [, , ...pieces] = withDoorPiece(
      applyShapeVariant(createShape('room', 0, 0), 'boardroom'),
      'boardroom',
    ) as ShapeElement[];
    const table = pieces.find((p) => p.shape === 'meeting-table')!;
    expect(table).toMatchObject({ variant: 'long', width: 560, height: 168 });
    expect(table.aspectLocked).toBeUndefined();
    expect(isLongTable(table)).toBe(true);
    expect(isLongTable(createShape('meeting-table', 0, 0))).toBe(false);
    expect(pieces.find((p) => p.shape === 'screen')).toMatchObject({ width: 128, height: 80 });
    // Under the screen, not behind it.
    const screen = pieces.find((p) => p.shape === 'screen')!;
    expect(screen.y + screen.height).toBeLessThanOrEqual(table.y);
    const art = longTableArt(table.width, table.height).front;
    expect(art.width).toBe(560);
    expect(art.seats).toHaveLength(16);
    // Wider takes more chairs; the drawing is cached by width.
    expect(longTableArt(900, 168).front.seats).toHaveLength(28);
    expect(longTableArt(560, 168)).toBe(longTableArt(560, 168));
    expect(face(table)).toContain('viewBox="0 0 560 168"');
  });

  it("keeps every furnished preset's Screen below its room's name band, clear of the table (Work Tracker 638)", () => {
    expect(PRESET_SCREEN_TOP).toBeGreaterThan(ROOM_BACK_FACE);
    const withScreens = Object.keys(ROOM_PRESET_LAYOUTS).filter((v) =>
      ROOM_PRESET_LAYOUTS[v]!.some((p) => p.kind === 'screen'),
    );
    expect(withScreens.sort()).toEqual(['boardroom', 'meeting-booth']);
    for (const variant of withScreens) {
      const placed = at(applyShapeVariant(createShape('room', 0, 0), variant), 100, 50);
      const [room, , ...pieces] = withDoorPiece(placed, variant) as ShapeElement[];
      const screen = pieces.find((p) => p.shape === 'screen')!;
      const table = pieces.find((p) => p.shape === 'meeting-table')!;
      // The back wall's face carries the name: the Screen starts below it.
      expect(screen.y - room!.y, variant).toBeGreaterThanOrEqual(ROOM_BACK_FACE);
      expect(screen.y + screen.height, variant).toBeLessThanOrEqual(table.y);
      // Centred over its table.
      expect(
        Math.abs(screen.x + screen.width / 2 - (table.x + table.width / 2)),
        variant,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('turns a Long Table like the Meeting Table: a tall table on its side, drawn and seated to its length', () => {
    const table = applyShapeVariant(createShape('meeting-table', 0, 0), 'long');
    const turned = turnPiece(table, 'e');
    expect(turned.chairFacing).toBe('e');
    expect([Math.round(turned.width), Math.round(turned.height)]).toEqual([168, 560]);
    const art = longTableArt(turned.width, turned.height, 'e');
    expect(art.side).toMatchObject({ width: 168, height: 560 });
    expect(art.side.seats).toHaveLength(16);
    expect(art.back.seats).toHaveLength(16);
    expect(face(turned)).toContain('viewBox="0 0 168 560"');
    // Turned back, it is the table it was.
    const back = turnPiece(turned, 'n');
    expect([Math.round(back.width), Math.round(back.height)]).toEqual([560, 168]);
  });

  it("spreads a preset's pieces with a room placed bigger, each keeping its size", () => {
    const board = applyShapeVariant(createShape('room', 0, 0), 'boardroom');
    const [, , first] = withDoorPiece(board, 'boardroom') as ShapeElement[];
    const [, , wide] = withDoorPiece(
      { ...board, width: 1600, height: 800 },
      'boardroom',
    ) as ShapeElement[];
    expect(wide!.x).toBe(first!.x * 2);
    expect(wide!.width).toBe(first!.width);
  });

  it("puts a shaped room's name inside its walls", () => {
    expect(applyShapeVariant(createShape('room', 0, 0), 'kitchen')).toMatchObject({
      textAlignX: 'left',
      textAlignY: 'top',
    });
    expect(applyShapeVariant(createShape('room', 0, 0), 'lounge')).toMatchObject({
      textAlignX: 'center',
      textAlignY: 'top',
    });
    // A diamond, its floor reaching neither the top left nor the top's middle at the name's height.
    expect(
      outlineNameAlign(
        [
          { x: 0.5, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0.5, y: 1 },
          { x: 0, y: 0.5 },
        ],
        200,
        200,
      ),
    ).toEqual({
      textAlignX: 'center',
      textAlignY: 'middle',
    });
    // A Room Builder room whose top left is cut away.
    const drawn = createOutlinedRoom([
      { x: 100, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
      { x: 0, y: 100 },
    ])!;
    expect(drawn).toMatchObject({ textAlignX: 'center', textAlignY: 'top' });
  });

  it('places a shaped one as a custom room with its Door on the wall it names', () => {
    for (const variant of ['open-plan', 'kitchen', 'lounge']) {
      const placed = at(applyShapeVariant(createShape('room', 0, 0), variant), 40, 60);
      expect(placed).toMatchObject({ roomDoor: 'none', aspectLocked: true });
      expect(placed.roomOutline!.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(
        true,
      );
      const [room, door] = withDoorPiece({ ...placed, strokeColor: '#123456' }, variant);
      expect(door).toMatchObject({ shape: 'door', strokeColor: '#123456' });
      expect(doorOnRoom(door as ShapeElement, room as ShapeElement)).toBe(true);
    }
    // The Kitchen's Door stands in its 45-degree cut.
    const kitchen = applyShapeVariant(createShape('room', 0, 0), 'kitchen');
    expect(withDoorPiece(kitchen, 'kitchen')[1]).toMatchObject({ rotation: 135 });
  });

  it('scales a shaped preset door with the room, and names no door for a rectangle or no preset', () => {
    const lounge = {
      ...applyShapeVariant(createShape('room', 0, 0), 'lounge'),
      width: 880,
      height: 880,
    };
    expect(roomPresetDoorAt(lounge, 'lounge')).toEqual({ x: 440, y: 870 });
    expect(roomPresetDoorAt(createShape('room', 0, 0), 'office')).toBeNull();
    expect(roomPresetDoorAt(createShape('room', 0, 0), undefined)).toBeNull();
    expect(roomPresetDoorAt(createShape('rug', 0, 0), 'lounge')).toBeNull();
    expect(Object.keys(ROOM_PRESETS)).toEqual([
      'office',
      'boardroom',
      'open-plan',
      'kitchen',
      'lounge',
      'meeting-booth',
    ]);
  });
});

describe('doors in a corridor', () => {
  const corridor = { ...createShape('corridor', 0, 0), id: 'c' } as ShapeElement;

  it('snap onto its walls, ride its drag and follow its resize', () => {
    const free = { ...createShape('door', 0, 0), id: 'd', x: 150, y: 100 } as ShapeElement;
    const door = snapDoorToWall(free, [corridor]);
    expect(door).toMatchObject({ y: 115 - 12, rotation: 0 });
    expect(doorOnRoom(door, corridor)).toBe(true);
    expect([...withAttachedDoors([corridor, door], new Set(['c']))].sort()).toEqual(['c', 'd']);
    const wider = { ...corridor, width: 960 };
    const [, moved] = doorsFollowRooms([corridor, door], [wider, door]);
    expect((moved as ShapeElement).x).toBeGreaterThan(door.x);
  });

  it('is not a room for a door standing nowhere near', () => {
    const far = { ...createShape('door', 0, 0), x: 900, y: 900 } as ShapeElement;
    expect(doorOnRoom(far, corridor)).toBe(false);
  });
});

describe('doorArt', () => {
  const moving = (variant: string | undefined) =>
    doorArt(96, 24, variant).filter((p) => p.motion).length;

  it('draws each type its own way, every one with a gap and two jambs', () => {
    for (const v of DOOR_VARIANTS) {
      const parts = doorArt(120, 24, v);
      expect(parts[0]).toMatchObject({ paint: 'floor' });
      expect(parts.filter((p) => p.paint === 'jamb' && p.tag === 'rect')).toHaveLength(2);
    }
    expect(moving(undefined)).toBe(1);
    expect(moving('double')).toBe(2);
    expect(moving('sliding')).toBe(2);
    expect(moving('revolving')).toBe(1);
    expect(doorArt(96, 24, 'double').filter((p) => p.openOnly)).toHaveLength(2);
  });

  it('writes a pose as a transform, nothing for the rest pose', () => {
    expect(doorPoseTransform({ rotate: 0, dx: 0 }, { x: 1, y: 2 })).toBe('');
    expect(doorPoseTransform({ rotate: -90, dx: 0 }, { x: 1, y: 2 })).toBe('rotate(-90 1 2)');
    expect(doorPoseTransform({ rotate: 45, dx: -50 }, { x: 1, y: 2 })).toBe(
      'translate(-50 0) rotate(45 1 2)',
    );
  });
});

describe('the export of doors and corridors', () => {
  const door = (extra: Partial<ShapeElement>) =>
    ({ ...createShape('door', 0, 0), ...extra }) as Parameters<typeof doorSvg>[0];

  it('draws a door open with its arc, shut without it', () => {
    expect(doorSvg(door({}), '#fff', '#000')).toContain('stroke-dasharray');
    const shut = doorSvg(door({ doorClosed: true }), '#fff', '#000');
    expect(shut).not.toContain('stroke-dasharray');
    expect(shut).toContain('rotate(-90');
  });

  it('draws each type', () => {
    expect(doorSvg(door({ variant: 'sliding', width: 120 }), '#fff', '#000')).toContain(
      'translate(-50 0)',
    );
    expect(doorSvg(door({ variant: 'revolving' }), '#fff', '#000')).toContain('<circle');
    const double = doorSvg(door({ variant: 'double', width: 144 }), '#fff', '#000');
    expect(double.split('height="66"')).toHaveLength(3);
    expect(doorSvg(door({ variant: 'sliding', width: 120 }), '#fff', '#000')).toContain(
      'fill-opacity',
    );
    // A door saved locked before locking left draws as any other, no padlock and no shade
    // (docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking").
    const old = { ...door({ doorClosed: true }), locked: true } as Parameters<typeof doorSvg>[0];
    expect(doorSvg(old, '#fff', '#000')).toBe(doorSvg(door({ doorClosed: true }), '#fff', '#000'));
  });

  it('draws a corridor floor and walls, and routes both kinds through the face export', () => {
    const corridor = { ...createShape('corridor', 10, 20), variant: 'tee' } as Parameters<
      typeof corridorSvg
    >[0];
    const svg = corridorSvg(corridor, '#fff', '#000');
    expect(svg).toContain('translate(10 20)');
    expect(svg).toContain(' Z');
    expect(face(corridor)).toContain(corridorPaths(480, 120, 'tee').walls);
    expect(face(door({}))).toContain('<rect');
  });
});

describe('rug types', () => {
  it('draws every type but the Oval to its size', () => {
    expect(rugDrawnToSize({ shape: 'rug' })).toBe(false);
    expect(rugDrawnToSize({ shape: 'rug', variant: 'oval' })).toBe(false);
    expect(rugDrawnToSize({ shape: 'rug', variant: 'kilim' })).toBe(true);
    expect(rugDrawnToSize({ shape: 'chair', variant: 'kilim' })).toBe(false);
    expect(rugParts(200, 120, 'oval')).toEqual([]);
    for (const v of RUG_VARIANTS.slice(1)) {
      const parts = rugParts(240, 150, v);
      expect(parts.length).toBeGreaterThan(3);
      expect(parts.some((p) => p.role === 'panel')).toBe(true);
    }
  });

  it('weaves its pattern from tints, sheens and dyes', () => {
    const roles = new Set(RUG_VARIANTS.flatMap((v) => rugParts(260, 170, v).map((p) => p.role)));
    expect(roles).toEqual(new Set(['panel', 'tint', 'floor', 'rail', 'sheen', 'dye']));
  });

  it('repeats its pattern with its size, never past a bound, and survives a tiny box', () => {
    const stripes = (w: number) =>
      (rugParts(w, 150, 'striped')[1] as { d: string }).d.split('Z').length;
    expect(stripes(440)).toBeGreaterThan(stripes(220));
    expect(stripes(1_000_000)).toBeLessThanOrEqual(49);
    expect(rugParts(0, 0, 'persian').length).toBeGreaterThan(0);
  });

  it('draws a patterned rug in the export at its size, the Oval scaled as before', () => {
    const kilim = { ...applyShapeVariant(createShape('rug', 0, 0), 'kilim') } as Parameters<
      typeof svgBehaviourFace
    >[0];
    const svg = face(kilim);
    expect(svg).toContain('opacity="0.55"');
    expect(svg).not.toContain('viewBox');
    expect(face(createShape('rug', 0, 0))).toContain('viewBox');
  });

  it('draws a huge rug of every type within a CPU budget', () => {
    const ms = cpuMsOf(() => {
      for (const v of RUG_VARIANTS) rugParts(100_000, 100_000, v);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});
