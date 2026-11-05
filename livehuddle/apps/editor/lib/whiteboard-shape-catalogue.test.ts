import { describe, expect, it } from 'vitest';
import {
  armedWhiteboardShape,
  isWhiteboardShapeKey,
  WHITEBOARD_SHAPE_CATALOGUE,
  whiteboardShapeEntry,
} from './whiteboard-shape-catalogue';

describe('the whiteboard shape catalogue', () => {
  it('opens with the Shapes flyout kinds under their dock names', () => {
    const shapes = WHITEBOARD_SHAPE_CATALOGUE.filter((e) => e.group === 'shapes').map(
      (e) => e.label,
    );
    expect(shapes.slice(0, 4)).toEqual(['Rectangle', 'Ellipse', 'Diamond', 'Cylinder']);
    expect(shapes).toContain('Parallelogram');
    expect(shapes).toContain('Bubble');
  });

  it('files Line and Arrow under Draw, as the palette files its arrow', () => {
    const draw = WHITEBOARD_SHAPE_CATALOGUE.filter((e) => e.group === 'draw').map((e) => e.key);
    expect(draw).toEqual(['line', 'arrow']);
  });

  // docs/specs/009-elements/mode-button.md "Only Avatar": the one mode button, keyed by its choice, filed in Travel.
  it('keys the Avatar mode button by its choice, under Travel', () => {
    const avatar = whiteboardShapeEntry('mode-button:avatar');
    expect(avatar?.label).toBeTruthy();
    expect(avatar?.group).toBe('collab-travel');
    expect(whiteboardShapeEntry('mode-button:eraser')).toBeUndefined();
  });

  it('holds the sticky note as a shape, armed as a plain note', () => {
    const sticky = whiteboardShapeEntry('sticky')!;
    expect(sticky.label).toBe('Sticky Note');
    expect(sticky.intent).toEqual({ type: 'sticky' });
    expect(isWhiteboardShapeKey('sticky')).toBe(true);
    expect(armedWhiteboardShape({ type: 'sticky' })).toBe('sticky');
  });

  it('has unique keys', () => {
    const keys = WHITEBOARD_SHAPE_CATALOGUE.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('orders its groups as the palette orders its categories', () => {
    const groups = [...new Set(WHITEBOARD_SHAPE_CATALOGUE.map((x) => x.group))];
    expect(groups).toEqual([
      'shapes',
      'write',
      'draw',
      'build',
      'data',
      'collab-rooms',
      'collab-seating',
      'collab-amenities',
      'collab-bar',
      'collab-recreation',
      'collab-garden',
      'collab-meeting',
      'collab-travel',
    ]);
  });

  it('arms every shape entry plain, as a board shape', () => {
    for (const e of WHITEBOARD_SHAPE_CATALOGUE.filter((x) => x.key !== 'sticky')) {
      expect((e.intent as { board?: true }).board, e.key).toBe(true);
    }
    expect(whiteboardShapeEntry('triangle')?.intent).toEqual({
      type: 'shape',
      kind: 'triangle',
      board: true,
    });
    expect(whiteboardShapeEntry('mode-button:avatar')?.intent).toEqual({
      type: 'shape',
      kind: 'mode-button',
      mode: 'avatar',
      board: true,
    });
  });

  it('knows its own keys and nothing else', () => {
    expect(isWhiteboardShapeKey('rectangle')).toBe(true);
    expect(isWhiteboardShapeKey('square')).toBe(false);
    expect(isWhiteboardShapeKey('banner')).toBe(false);
    expect(isWhiteboardShapeKey(42)).toBe(false);
  });

  it('reads back which catalogue shape is armed', () => {
    for (const e of WHITEBOARD_SHAPE_CATALOGUE) {
      expect(armedWhiteboardShape(e.intent), e.key).toBe(e.key);
    }
    expect(armedWhiteboardShape({ type: 'shape', kind: 'triangle' })).toBeNull();
    expect(armedWhiteboardShape({ type: 'sticky' })).toBe('sticky');
    expect(armedWhiteboardShape(null)).toBeNull();
  });
});
