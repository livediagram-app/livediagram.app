import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  applyShapeVariant,
  corridorPaths,
  createShape,
  doorArt,
  doorOnRoom,
  doorOverhang,
  doorParts,
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
  RUG_VARIANTS,
  ROOM_PRESET_LAYOUTS,
  PRESET_SCREEN_TOP,
  type ShapeElement,
} from './index';
import { ROOM_BACK_FACE } from '@livehuddle/avatar/office-geometry';
import { corridorSvg, doorSvg } from './svg-render-doors';
import { RESTROOM_VARIANT } from './shape-variants';
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
  it('places a rectangle at its size and name, empty, its Door its own in the front wall', () => {
    const large = applyShapeVariant(createShape('room', 0, 0), 'large');
    expect(large).toMatchObject({ width: 960, height: 640, label: 'Large Room' });
    expect(large.roomOutline).toBeUndefined();
    expect(large.variant).toBeUndefined();
    const placed = withDoorPiece(large, 'large');
    expect(placed.map((p) => (p as ShapeElement).shape)).toEqual(['room', 'door']);
    expect(placed[0]).toMatchObject({ roomDoor: 'none' });
    // The plain Room is the small one.
    expect(withDoorPiece(createShape('room', 0, 0))).toHaveLength(2);
  });

  it('furnishes no preset but the Restroom: rooms of shapes and sizes, empty (office.md "Room presets")', () => {
    for (const variant of Object.keys(ROOM_PRESETS)) {
      const room = applyShapeVariant(createShape('room', 0, 0), variant);
      expect(withDoorPiece(room, variant), variant).toHaveLength(2);
      // Roomier than the plain Room.
      expect(room.width * room.height, variant).toBeGreaterThan(480 * 320);
    }
    expect(Object.keys(ROOM_PRESET_LAYOUTS)).toEqual([RESTROOM_VARIANT]);
    expect(PRESET_SCREEN_TOP).toBeGreaterThan(ROOM_BACK_FACE);
  });

  it('draws the Long Table for sixteen to its width', () => {
    const table = applyShapeVariant(createShape('meeting-table', 0, 0), 'long');
    expect(table).toMatchObject({ variant: 'long', width: 560, height: 168 });
    expect(table.aspectLocked).toBeUndefined();
    expect(isLongTable(table)).toBe(true);
    expect(isLongTable(createShape('meeting-table', 0, 0))).toBe(false);
    const art = longTableArt(table.width, table.height).front;
    expect(art.width).toBe(560);
    expect(art.seats).toHaveLength(16);
    expect(longTableArt(900, 168).front.seats).toHaveLength(28);
    expect(longTableArt(560, 168)).toBe(longTableArt(560, 168));
    expect(face(table)).toContain('viewBox="0 0 560 168"');
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

  it("puts a shaped room's name inside its walls", () => {
    expect(applyShapeVariant(createShape('room', 0, 0), 'cut-corner')).toMatchObject({
      textAlignX: 'left',
      textAlignY: 'top',
    });
    expect(applyShapeVariant(createShape('room', 0, 0), 'octagon')).toMatchObject({
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
    for (const variant of ['l-shape', 'hexagon', 'octagon', 'cut-corner']) {
      const placed = at(applyShapeVariant(createShape('room', 0, 0), variant), 40, 60);
      expect(placed, variant).toMatchObject({ roomDoor: 'none', aspectLocked: true });
      expect(placed.roomOutline!.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(
        true,
      );
      const [room, door] = withDoorPiece({ ...placed, strokeColor: '#123456' }, variant);
      expect(door).toMatchObject({ shape: 'door', strokeColor: '#123456' });
      expect(doorOnRoom(door as ShapeElement, room as ShapeElement), variant).toBe(true);
    }
    // The hexagon has six walls, the octagon eight of one length.
    const hex = applyShapeVariant(createShape('room', 0, 0), 'hexagon');
    expect(hex.roomOutline).toHaveLength(6);
    const oct = applyShapeVariant(createShape('room', 0, 0), 'octagon');
    const pts = oct.roomOutline!.map((p) => ({ x: p.x * oct.width, y: p.y * oct.height }));
    const sides = pts.map((p, k) =>
      Math.hypot(pts[(k + 1) % 8]!.x - p.x, pts[(k + 1) % 8]!.y - p.y),
    );
    expect(Math.max(...sides) - Math.min(...sides)).toBeLessThan(1);
    // The Cut Corner's Door stands in its 45-degree cut.
    const cut = applyShapeVariant(createShape('room', 0, 0), 'cut-corner');
    expect(withDoorPiece(cut, 'cut-corner')[1]).toMatchObject({ rotation: 135 });
  });

  it('scales a shaped preset door with the room, and names no door for a rectangle or no preset', () => {
    const octagon = {
      ...applyShapeVariant(createShape('room', 0, 0), 'octagon'),
      width: 900,
      height: 900,
    };
    expect(roomPresetDoorAt(octagon, 'octagon')).toEqual({ x: 450, y: 892.5 });
    expect(roomPresetDoorAt(createShape('room', 0, 0), 'large')).toBeNull();
    expect(roomPresetDoorAt(createShape('room', 0, 0), undefined)).toBeNull();
    expect(roomPresetDoorAt(createShape('rug', 0, 0), 'octagon')).toBeNull();
    expect(Object.keys(ROOM_PRESETS)).toEqual([
      'medium',
      'large',
      'long',
      'l-shape',
      'hexagon',
      'octagon',
      'cut-corner',
      'glass',
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

  it('names how far an open door reaches past its box, enough for its swing', () => {
    // The swing's far end sits at the wall's centre line plus the opening: past a 96 x 24 box by doorOverhang or less.
    const { swing } = doorParts(96, 24);
    const endY = Number(swing.split(' ').at(-1));
    expect(endY - 24).toBeLessThanOrEqual(doorOverhang(96, 24));
    expect(endY - 24).toBeGreaterThan(0);
    // A door deeper than twice its width stays inside its box.
    expect(doorOverhang(10, 40)).toBe(0);
  });

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
    const svg = corridorSvg(corridor, '#fff');
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
