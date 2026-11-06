// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES, SHAPE_KINDS, type Element as CanvasElement } from '@livehuddle/document';
import {
  AVATAR_CLICK_INTENTS,
  avatarClickIntent,
  ELEMENT_KIND_ATTR,
  elementClickKind,
  isInPlacePress,
  pressPieceMain,
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
];

// Walked to only when arriving is the point: floor, seats, drinks, proximity, scenery, areas and marks.
const WALK = [
  'avatar-pad',
  'stage',
  'room',
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
