// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  createShape,
  ELEMENT_TYPES,
  SHAPE_KINDS,
  type Element as CanvasElement,
} from '@livehuddle/document';
import { FENCE_REACH } from '@liveworkspace/avatar/collision';
import { officeFootprint } from '@liveworkspace/avatar/office-geometry';
import { arcadeAt } from '@/components/canvas/collab/useSocialPieces';
import { receptionAt } from '@/lib/office/useWorkdayPieces';
import {
  AVATAR_CLICK_INTENTS,
  avatarClickIntent,
  avatarPressOutcome,
  NO_READER_KINDS,
  ELEMENT_KIND_ATTR,
  elementClickKind,
  isInPlacePress,
  pressPieceMain,
  walkPointFor,
} from './avatar-click-intent';

// docs/specs/008-canvas/avatar-mode.md "Clicking a piece".

const ALL_KINDS = [...SHAPE_KINDS, ...[...ELEMENT_TYPES].filter((t) => t !== 'shape')];

const IN_PLACE = [
  'directory',
  'elevator',
  'portal',
  'mode-button',
  'focus-button',
  'notice-board',
  'world-clock',
  'screen',
  'room-sign',
  'timer',
  'stopwatch',
  'jukebox',
  'link-card',
  'video',
  'calendar-wall',
  'suggestion-box',
  'signpost',
];

// Walked to only when arriving is the point: floor, seats, drinks, proximity, scenery, areas and marks.
const WALK = [
  'avatar-pad',
  'photo-wall',
  'stage',
  'room',
  'corridor',
  'office-pod',
  'rug',
  'grass',
  'garden-path',
  'door',
  'chair',
  'desk',
  'sofa',
  'meeting-table',
  'bar-stool',
  'bench',
  'picnic-table',
  'hammock',
  'ping-pong-table',
  'bean-bag',
  'reading-nook',
  'water-cooler',
  'coffee-machine',
  'drinks-cabinet',
  'drinks-fridge',
  'arcade-machine',
  'plant',
  'bookshelf',
  'outdoor-plant',
  'tree',
  'fence',
  'garden-fence',
  'bar',
  'fireplace',
  'campfire',
  'fountain',
  'pond',
  'garden-umbrella',
  'pool-table',
  'foosball-table',
  'vending-machine',
  'dartboard',
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
  'pillar',
  'column',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
  'pet-bed',
  'reception-desk',
  'lane',
  'boundary',
  'arrow',
  'freehand',
  'path',
  'sticker',
  'icon',
];

describe('avatarClickIntent', () => {
  it('classifies every element type and shape kind (a new kind must be added to the table)', () => {
    const keys = Object.keys(AVATAR_CLICK_INTENTS);
    expect(ALL_KINDS.filter((k) => !keys.includes(k))).toEqual([]);
    expect(keys.filter((k) => !ALL_KINDS.includes(k))).toEqual([]);
  });

  it('acts in place on the pieces with something to open or press', () => {
    for (const kind of IN_PLACE) expect(avatarClickIntent(kind), kind).toBe('use');
  });

  it('walks only where arriving is the point', () => {
    for (const kind of WALK) expect(avatarClickIntent(kind), kind).toBe('walk');
  });

  it('opens everything else in the reader: content to read', () => {
    for (const kind of ALL_KINDS.filter((k) => !IN_PLACE.includes(k) && !WALK.includes(k)))
      expect(avatarClickIntent(kind), kind).toBe('read');
    for (const kind of [
      'sticky',
      'text',
      'image',
      'table',
      'checklist',
      'code-block',
      'bar-chart',
      'callout',
    ])
      expect(avatarClickIntent(kind), kind).toBe('read');
  });

  it('walks for an unknown, retired or missing kind, and never reads the prototype', () => {
    expect(avatarClickIntent('rectangle')).toBe('walk');
    expect(avatarClickIntent('toString')).toBe('walk');
    expect(avatarClickIntent(null)).toBe('walk');
    expect(avatarClickIntent(undefined)).toBe('walk');
    expect(avatarClickIntent('')).toBe('walk');
  });

  it('reads a shape by its kind and anything else by its type', () => {
    expect(elementClickKind({ type: 'shape', shape: 'directory' } as CanvasElement)).toBe(
      'directory',
    );
    expect(elementClickKind({ type: 'sticky' } as CanvasElement)).toBe('sticky');
  });
});

describe('avatarPressOutcome', () => {
  it('presses any use piece with a main action right now', () => {
    for (const kind of IN_PLACE) expect(avatarPressOutcome(kind, true), kind).toBe('press');
  });

  it('does nothing on a control piece with no press of yours, never the reader', () => {
    expect([...NO_READER_KINDS].sort()).toEqual(
      ['focus-button', 'mode-button', 'signpost', 'stopwatch', 'timer'].sort(),
    );
    for (const kind of NO_READER_KINDS) {
      expect(avatarClickIntent(kind), kind).toBe('use');
      expect(avatarPressOutcome(kind, false), kind).toBe('nothing');
    }
  });

  it('opens every other use piece with no main action in the reader (an idle Screen, a Room Sign)', () => {
    for (const kind of IN_PLACE.filter((k) => !NO_READER_KINDS.has(k as never)))
      expect(avatarPressOutcome(kind, false), kind).toBe('read');
  });

  it('reads a read kind and walks a walk kind, main or not', () => {
    expect(avatarPressOutcome('sticky', false)).toBe('read');
    expect(avatarPressOutcome('table', true)).toBe('read');
    expect(avatarPressOutcome('chair', false)).toBe('walk');
    expect(avatarPressOutcome(null, false)).toBe('walk');
  });
});

describe('isInPlacePress', () => {
  const box = (kind: string) => {
    const el = document.createElement('div');
    el.setAttribute(ELEMENT_KIND_ATTR, kind);
    const face = document.createElement('button');
    el.appendChild(face);
    return face;
  };

  it('is true for a press inside an in-place piece, false inside a walk piece', () => {
    expect(isInPlacePress(box('directory'))).toBe(true);
    expect(isInPlacePress(box('sticky'))).toBe(true);
    expect(isInPlacePress(box('avatar-pad'))).toBe(false);
    expect(isInPlacePress(box('chair'))).toBe(false);
  });

  it('is false for the floor and for non-elements', () => {
    expect(isInPlacePress(document.createElement('main'))).toBe(false);
    expect(isInPlacePress(null)).toBe(false);
    expect(isInPlacePress(window)).toBe(false);
  });
});

describe('pressPieceMain', () => {
  it("presses the piece's main control, and says when it has none", () => {
    const box = document.createElement('div');
    box.setAttribute('data-element-id', 'p1');
    const main = document.createElement('button');
    main.setAttribute('data-piece-main', '');
    let pressed = 0;
    main.addEventListener('click', () => pressed++);
    box.appendChild(main);
    document.body.appendChild(box);
    expect(pressPieceMain('p1')).toBe(true);
    expect(pressed).toBe(1);
    expect(pressPieceMain('nothing')).toBe(false);
    box.remove();
  });
});

describe('walkPointFor', () => {
  const piece = (shape: 'reception-desk' | 'arcade-machine' | 'chair', rotation = 0) =>
    ({ ...createShape(shape, 100, 100), id: shape, rotation }) as CanvasElement & {
      x: number;
      y: number;
      width: number;
      height: number;
      shape: string;
    };

  it('walks a click anywhere on a Reception Desk or an Arcade Machine to its front, where arriving says hello', () => {
    for (const shape of ['reception-desk', 'arcade-machine'] as const) {
      const el = piece(shape);
      const box = { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height };
      const foot = officeFootprint(el)!;
      // The middle of it, its top and its back corner all walk to the floor in front, under the click.
      for (const click of [
        { x: el.x + el.width / 2, y: el.y + el.height / 2 },
        { x: el.x + el.width / 2, y: el.y + 4 },
        { x: el.x + 1, y: el.y + 1 },
      ]) {
        const to = walkPointFor(el, click);
        expect(to.y).toBeGreaterThan(foot.y + foot.height + FENCE_REACH);
        expect(to.x).toBeGreaterThan(el.x);
        expect(to.x).toBeLessThan(el.x + el.width);
        const at = shape === 'reception-desk' ? receptionAt(to, [box]) : arcadeAt(to, [box]);
        expect(at).toBe(el.id);
      }
      expect(walkPointFor(el, { x: el.x + el.width / 2, y: el.y }).x).toBe(el.x + el.width / 2);
      // A turned one has no front below it: the click is the walk.
      expect(walkPointFor(piece(shape, 90), { x: 150, y: 150 })).toEqual({ x: 150, y: 150 });
    }
  });

  it('leaves every other click where it is', () => {
    expect(walkPointFor(piece('chair'), { x: 120, y: 120 })).toEqual({ x: 120, y: 120 });
    expect(walkPointFor(null, { x: 5, y: 6 })).toEqual({ x: 5, y: 6 });
  });
});
