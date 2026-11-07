import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import {
  DEFAULT_STAGE_SPEAKERS,
  isFloorShape,
  isGridOfficeShape,
  isOfficeShape,
  isRoomDoor,
  isStageSpeakers,
  MACHINE_ANSWER_AT,
  MEETING_TABLE_VIEW,
  OFFICE_ART,
  OFFICE_TONES,
  OFFICE_KINDS,
  ROOM_WALL,
  roomParts,
  STAGE_FRONT,
  STAGE_SPEAKER_LABELS,
  STAGE_SPEAKERS,
  stageParts,
  STAGE_TONES,
  stageTop,
} from './office';
import { isValidElement } from './validate';
import { MEETING_TABLE_SEATS, SEAT_VIEWS } from '@liveworkspace/avatar/seats';
import type { FurnitureDrawing } from './seating';

// docs/specs/009-elements/office.md
describe('the office pieces', () => {
  it('are eighteen shape kinds, each made at its drawing’s size', () => {
    expect(OFFICE_KINDS).toEqual([
      'room',
      'corridor',
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
      'window',
      'directory',
      'elevator',
      'stairs',
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
      'pool-table',
      'foosball-table',
      'dartboard',
      'vending-machine',
      'bean-bag',
      'reading-nook',
      // The office amenities (docs/specs/009-elements/office-amenities.md).
      'printer',
      'copier',
      'lockers',
      'coat-rack',
      'umbrella-stand',
      'kitchen-counter',
      'kitchen-sink',
      'fridge',
      'microwave',
      'kettle',
      'toilet-cubicle',
      'washbasin',
      'hand-dryer',
      // The venue pieces (docs/specs/009-elements/venue-pieces.md).
      'pillar',
      'column',
      'car-park',
      'bike-rack',
      'swimming-pool',
      'stage-curtains',
      'podium',
      // The workday pieces (docs/specs/009-elements/workday-pieces.md).
      'nap-pod',
      'treadmill',
      'weight-bench',
      'phone-booth',
      'standing-desk',
      'hot-desk',
      'pet-bed',
      'reception-desk',
      'calendar-wall',
      'suggestion-box',
      'signpost',
      'photo-wall',
    ]);
    const sized = [
      'room',
      'corridor',
      'stage',
      'garden-path',
      'grass',
      'garden-fence',
      'door',
      'window',
      'pond',
      'swimming-pool',
    ];
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

  it('puts the room, the corridor, the rug, the stage, the garden path and grass on the floor, and nothing else', () => {
    expect(OFFICE_KINDS.filter(isFloorShape)).toEqual([
      'room',
      'corridor',
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

  it('is drawn at its own size: a top laid in boards, a nosing, a stained front face and a plate on it', () => {
    const parts = stageParts(360, 140);
    expect(parts[0]).toMatchObject({ tag: 'rect', role: 'panel', x: 0, y: 0, w: 360 });
    // The boards are one path: plank lines across the top and their joints (docs/specs/009-elements/venue-pieces.md
    // "The stronger Stage").
    const boards = parts.filter((p) => p.role === 'rail');
    expect(boards).toHaveLength(1);
    const d = boards[0]!.tag === 'path' ? boards[0]!.d : '';
    expect(d.match(/H/g)!.length).toBeGreaterThanOrEqual(3);
    expect(d.match(/V/g)!.length).toBeGreaterThanOrEqual(6);
    expect(parts).toContainEqual(
      expect.objectContaining({
        role: 'panel',
        fill: STAGE_TONES.nosing,
        y: 140 - STAGE_FRONT - 5,
      }),
    );
    const face = parts.find((p) => p.role === 'face');
    expect(face).toMatchObject({
      y: 140 - STAGE_FRONT,
      h: STAGE_FRONT,
      w: 360,
      fill: STAGE_TONES.skirt,
    });
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

  it('lights its front edge with footlights clear of the plate, and caps its boards however tall', () => {
    const lamps = (w: number) => {
      const p = stageParts(w, 140).find((q) => q.role === 'mark' && q.fill === STAGE_TONES.lamp);
      return p && p.tag === 'path'
        ? [...p.d.matchAll(/M(-?[\d.]+) /g)].map((m) => Number(m[1]) + 3.5)
        : [];
    };
    const xs = lamps(360);
    expect(xs.length).toBeGreaterThanOrEqual(4);
    const plate = stageParts(360, 140).at(-1)!;
    if (plate.tag === 'rect')
      for (const x of xs) expect(x < plate.x || x > plate.x + plate.w).toBe(true);
    // Too narrow for a lamp beside the plate: none.
    expect(lamps(40)).toEqual([]);
    const tall = stageParts(360, 2000).find((p) => p.role === 'rail')!;
    expect(tall.tag === 'path' && tall.d.match(/H/g)!.length).toBeLessThanOrEqual(7);
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

// docs/specs/009-elements/furniture-facing.md "The camera": the office pieces' back and side drawings.
describe('the office pieces turned', () => {
  // Every rect and ellipse inside its drawing's grid (a stroke's width of slack).
  const inGrid = (view: FurnitureDrawing) =>
    view.parts.every((p) =>
      p.tag === 'rect'
        ? p.x >= -1 && p.y >= -1 && p.x + p.w <= view.width + 1 && p.y + p.h <= view.height + 1
        : p.tag === 'ellipse'
          ? p.cx - p.rx >= -1 && p.cx + p.rx <= view.width + 1 && p.cy + p.ry <= view.height + 1
          : true,
    );

  it('draws a back and a side of its own for every piece with a front, each on its grid', () => {
    for (const kind of ['meeting-table', 'bookshelf', 'water-cooler', 'coffee-machine'] as const) {
      const art = OFFICE_ART[kind];
      expect(art.side).not.toBe(art.front);
      for (const view of [art.front, art.back, art.side]) expect(inGrid(view)).toBe(true);
    }
    for (const kind of ['bookshelf', 'water-cooler', 'coffee-machine'] as const)
      expect(OFFICE_ART[kind].back.parts).not.toEqual(OFFICE_ART[kind].front.parts);
  });

  it('turns the bookshelf narrow and long, its books down its left', () => {
    const { front, side } = OFFICE_ART.bookshelf;
    expect(side.width).toBeLessThan(front.width / 2);
    expect(side.height).toBeGreaterThan(front.height);
    const books = side.parts.filter((p) => p.fill && p.tag === 'rect');
    expect(books.length).toBeGreaterThan(12);
    expect(books.every((p) => p.tag === 'rect' && p.x + p.w <= 18)).toBe(true);
  });

  it('lays the rug the same from behind and turned on its side with its grid swapped', () => {
    const { front, back, side } = OFFICE_ART.rug;
    expect(back).toBe(front);
    expect([side.width, side.height]).toEqual([front.height, front.width]);
    expect(side.parts.every((p) => p.tag === 'ellipse' && p.ry > p.rx)).toBe(true);
  });

  it('seats the meeting table on its turned chairs, from @liveworkspace/avatar/seats', () => {
    const art = OFFICE_ART['meeting-table'];
    expect(art.back.parts).toBe(art.front.parts);
    expect(art.back.seats).toEqual(SEAT_VIEWS['meeting-table'].back.seats);
    expect(art.side.seats).toEqual(SEAT_VIEWS['meeting-table'].side.seats);
    expect([art.side.width, art.side.height]).toEqual([168, 232]);
    expect(art.side.seats).toHaveLength(6);
  });

  it('answers a drink where the bottle or the carafe shows, and not from behind the coffee machine', () => {
    for (const view of ['front', 'back', 'side'] as const) {
      const bottle = OFFICE_ART['water-cooler'][view].parts.find(
        (p) => p.fill === OFFICE_TONES.water,
      )!;
      for (const { x, y } of MACHINE_ANSWER_AT['water-cooler'][view]!) {
        expect(bottle.tag === 'rect' && x > bottle.x && x < bottle.x + bottle.w).toBe(true);
        expect(bottle.tag === 'rect' && y > bottle.y && y < bottle.y + bottle.h).toBe(true);
      }
    }
    expect(MACHINE_ANSWER_AT['coffee-machine'].back).toBeNull();
    for (const view of ['front', 'side'] as const) {
      const carafe = OFFICE_ART['coffee-machine'][view].parts.find(
        (p) => p.fill === OFFICE_TONES.glass,
      )!;
      for (const { x } of MACHINE_ANSWER_AT['coffee-machine'][view]!)
        expect(carafe.tag === 'rect' && x > carafe.x && x < carafe.x + carafe.w).toBe(true);
    }
  });
});
