import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import {
  DEFAULT_STAGE_SPEAKERS,
  isFloorShape,
  isGridOfficeShape,
  isOfficeShape,
  isRoomDoor,
  isStageSpeakers,
  MEETING_TABLE_VIEW,
  OFFICE_ART,
  OFFICE_KINDS,
  ROOM_WALL,
  roomParts,
  STAGE_FRONT,
  STAGE_SPEAKER_LABELS,
  STAGE_SPEAKERS,
  stageParts,
  stageTop,
} from './office';
import { isValidElement } from './validate';
import { MEETING_TABLE_SEATS } from '@liveworkspace/avatar/seats';

// docs/specs/009-elements/office.md
describe('the office pieces', () => {
  it('are eighteen shape kinds, each made at its drawing’s size', () => {
    expect(OFFICE_KINDS).toEqual([
      'room',
      'meeting-table',
      'plant',
      'bookshelf',
      'water-cooler',
      'coffee-machine',
      'rug',
      'stage',
      'office-pod',
      'bar',
      'bar-stool',
      'drinks-cabinet',
      'drinks-fridge',
      'outdoor-plant',
      'tree',
      'garden-path',
      'grass',
      'garden-fence',
      'door',
      'directory',
      'elevator',
      // The social pieces (docs/specs/009-elements/social-pieces.md).
      'notice-board',
      'world-clock',
      'jukebox',
      'ping-pong-table',
      'arcade-machine',
      'fireplace',
      'campfire',
      'bench',
      'picnic-table',
      'hammock',
      'garden-umbrella',
      'fountain',
      'pond',
    ]);
    const sized = ['room', 'stage', 'garden-path', 'grass', 'garden-fence', 'door', 'pond'];
    for (const kind of OFFICE_KINDS) {
      expect(isOfficeShape(kind)).toBe(true);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el)).toBe(true);
      expect(isGridOfficeShape(kind)).toBe(!sized.includes(kind));
      if (isGridOfficeShape(kind)) {
        const view = OFFICE_ART[kind].front;
        expect(el.width / el.height).toBeCloseTo(view.width / view.height, 2);
        expect(el.aspectLocked).toBe(true);
      }
    }
  });

  it('makes a room any rectangle, named Room, its doorway in the front wall', () => {
    const room = createShape('room', 0, 0);
    expect(room).toMatchObject({ label: 'Room', roomDoor: 's' });
    expect(room.aspectLocked).toBeFalsy();
  });

  it('puts the room, the rug, the stage, the garden path and grass on the floor, and nothing else', () => {
    expect(OFFICE_KINDS.filter(isFloorShape)).toEqual([
      'room',
      'rug',
      'stage',
      'garden-path',
      'grass',
    ]);
    expect(isGridOfficeShape('chair')).toBe(false);
  });

  it('accepts only the five doorways', () => {
    for (const d of ['n', 'e', 's', 'w', 'none']) expect(isRoomDoor(d)).toBe(true);
    expect(isRoomDoor('ne')).toBe(false);
    expect(isValidElement({ ...createShape('room', 0, 0), roomDoor: 'up' })).toBe(false);
  });
});

describe('the room', () => {
  it('is drawn at its own size: a floor, walls of a fixed thickness and a mat in the doorway', () => {
    const parts = roomParts(800, 600, 's');
    expect(parts[0]).toMatchObject({ role: 'floor', w: 800 });
    const sideWall = parts.find(
      (p) => p.tag === 'rect' && p.x === 0 && p.role === 'panel' && p.w === ROOM_WALL,
    );
    expect(sideWall).toBeDefined();
    expect(parts.some((p) => p.role === 'rail')).toBe(true);
    expect(roomParts(800, 600, 'none').some((p) => p.role === 'rail')).toBe(false);
  });
});

// docs/specs/009-elements/office.md "Stage"; docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage".
describe('the stage', () => {
  it('is made any width, named Stage on its plate, with neither setting stored', () => {
    const stage = createShape('stage', 0, 0);
    expect(stage).toMatchObject({
      width: 360,
      height: 140,
      label: 'Stage',
      textSize: 'sm',
      textAlignY: 'bottom',
    });
    expect(stage.aspectLocked).toBeFalsy();
    expect(stage.stageSpeakers).toBeUndefined();
    expect(stage.stageCameras).toBeUndefined();
    expect(DEFAULT_STAGE_SPEAKERS).toBe('edit');
  });

  it('takes Editors, or Editors and Participants, and a Show Cameras flag', () => {
    expect(STAGE_SPEAKERS).toEqual(['edit', 'take-part']);
    expect(STAGE_SPEAKERS.map((v) => STAGE_SPEAKER_LABELS[v])).toEqual([
      'Editors',
      'Editors and Participants',
    ]);
    for (const v of STAGE_SPEAKERS) expect(isStageSpeakers(v)).toBe(true);
    expect(isStageSpeakers('participate')).toBe(false);
    const stage = createShape('stage', 0, 0);
    expect(isValidElement({ ...stage, stageSpeakers: 'take-part', stageCameras: true })).toBe(true);
    expect(isValidElement({ ...stage, stageSpeakers: 'everyone' })).toBe(false);
    expect(isValidElement({ ...stage, stageCameras: 'yes' })).toBe(false);
  });

  it('is drawn at its own size: a top with planks, a front face and a plate on it', () => {
    const parts = stageParts(360, 140);
    expect(parts[0]).toMatchObject({ tag: 'rect', role: 'panel', x: 0, y: 0, w: 360 });
    expect(parts.filter((p) => p.role === 'rail')).toHaveLength(2);
    const face = parts.find((p) => p.role === 'face');
    expect(face).toMatchObject({ y: 140 - STAGE_FRONT, h: STAGE_FRONT, w: 360 });
    const plate = parts.at(-1)!;
    expect(plate).toMatchObject({ tag: 'rect', role: 'panel', w: 144 });
    expect(plate.tag === 'rect' && plate.x).toBe(108);
  });

  it('keeps its plate between 64 and 160 px, and inside a narrow stage', () => {
    const width = (w: number) => {
      const plate = stageParts(w, 140).at(-1)!;
      return plate.tag === 'rect' ? plate.w : 0;
    };
    expect(width(1000)).toBe(160);
    expect(width(100)).toBe(64);
    expect(width(60)).toBe(44);
  });

  it('draws no part with a negative or zero size, however small', () => {
    for (const [w, h] of [
      [0, 0],
      [10, 10],
      [16, 24],
      [40, 30],
    ] as const) {
      for (const p of stageParts(w, h)) if (p.tag === 'rect') expect(p.w > 0 && p.h > 0).toBe(true);
    }
    expect(stageParts(10, 140).some((p) => p.role === 'rail')).toBe(false);
  });

  it('is stood on above its front edge', () => {
    expect(stageTop({ x: 10, y: 20, width: 360, height: 140 })).toEqual({
      x: 10,
      y: 20,
      width: 360,
      height: 140 - STAGE_FRONT,
    });
  });
});

describe('the meeting table', () => {
  it('draws its six chairs where @liveworkspace/avatar/seats seats them', () => {
    expect(MEETING_TABLE_VIEW.tableSeats).toHaveLength(6);
    expect(MEETING_TABLE_VIEW.tableSeats).toBe(MEETING_TABLE_SEATS.seats);
    expect([MEETING_TABLE_VIEW.width, MEETING_TABLE_VIEW.height]).toEqual([232, 168]);
  });
});

describe('roomParts at the smallest sizes', () => {
  it('draws no part with a negative or zero size, however small the room', () => {
    for (const door of ['n', 's', 'e', 'w'] as const)
      for (const [w, h] of [
        [36, 200],
        [200, 20],
        [10, 10],
      ] as const)
        for (const p of roomParts(w, h, door))
          if (p.tag === 'rect') {
            expect(p.w, `${door} ${w}x${h} ${p.role}`).toBeGreaterThan(0);
            expect(p.h, `${door} ${w}x${h} ${p.role}`).toBeGreaterThan(0);
          }
  });
});
