import { describe, expect, it } from 'vitest';
import {
  FLOOR_TILES,
  isRoomFloor,
  rectPath,
  ROOM_FLOOR_COLOURS,
  ROOM_FLOOR_LABELS,
  ROOM_FLOORS,
  roomFloorOf,
  roomFloorSvg,
} from './room-floors';
import { createShape } from './shape-factory';
import { shapeValidationIssue } from './validate-shape';
import { roomBackParts, roomParts, roomSideParts } from './office';
import { roomSvg } from './svg-render-office-art';

describe('room floors (docs/specs/009-elements/office.md "Floors")', () => {
  it('names five types, Floorboards when absent or unknown', () => {
    expect(ROOM_FLOORS).toEqual(['boards', 'tiles', 'carpet', 'stone', 'concrete']);
    expect(ROOM_FLOORS.map((f) => ROOM_FLOOR_LABELS[f])).toEqual([
      'Floorboards',
      'Tiles',
      'Carpet',
      'Stone',
      'Concrete',
    ]);
    expect(roomFloorOf({})).toBe('boards');
    expect(roomFloorOf({ floor: 'marble' })).toBe('boards');
    expect(roomFloorOf({ floor: 'carpet' })).toBe('carpet');
    expect(isRoomFloor(3)).toBe(false);
    expect(ROOM_FLOOR_COLOURS.length).toBe(9);
  });

  it('validates a room floor', () => {
    const room = createShape('room', 0, 0) as unknown as Record<string, unknown>;
    expect(shapeValidationIssue({ ...room, floor: 'tiles' })).toBeNull();
    expect(shapeValidationIssue({ ...room, floor: 'lava' })?.field).toBe('floor');
  });

  it('exports a pattern for every type but Floorboards, fixed in canvas px', () => {
    expect(roomFloorSvg('r', 'boards', 'M0 0h10v10h-10Z')).toBe('');
    for (const f of ['tiles', 'carpet', 'stone', 'concrete'] as const) {
      const svg = roomFloorSvg('r"1', f, 'M0 0h10v10h-10Z');
      expect(svg).toContain(`width="${FLOOR_TILES[f].w}"`);
      expect(svg).toContain('patternUnits="userSpaceOnUse"');
      expect(svg).toContain('floor-r&quot;1');
    }
    expect(rectPath(1, 2, 3, 4)).toBe('M1 2h3v4h-3Z');
    expect(rectPath(0, 0, 0, 4)).toBe('');
  });

  it('draws boards only for Floorboards, and its walls apart when asked', () => {
    const boards = roomParts(300, 200, 's');
    const tiled = roomParts(300, 200, 's', [], false);
    expect(tiled.length).toBeLessThan(boards.length);
    const bare = roomParts(300, 200, 's', [], true, false);
    expect(bare.length + roomBackParts(300, 's').length + roomSideParts(300, 200, 's').length).toBe(
      boards.length,
    );
  });

  it('exports a patterned room, a glass one and a drawn one', () => {
    const room = { ...createShape('room', 0, 0), id: 'r1', floor: 'stone' as const };
    expect(roomSvg(room as never, '#ccc', '#333')).toContain('url(#floor-r1)');
    expect(roomSvg({ ...room, floor: undefined } as never, '#ccc', '#333')).not.toContain(
      'floor-r1',
    );
    const drawn = {
      ...room,
      roomOutline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    };
    expect(roomSvg(drawn as never, '#ccc', '#333')).toContain('url(#floor-r1)');
  });
});
