import { describe, expect, it } from 'vitest';
import {
  WHITEBOARD_SHAPES,
  boardShape,
  whiteboardTakesTyping,
  whiteboardShapeIntent,
  STROKE_HIT_SCREEN_PX,
  strokeHitWidth,
} from './whiteboard-tool';

describe('WHITEBOARD_SHAPES', () => {
  it('offers rectangle, ellipse, diamond and cylinder', () => {
    expect(WHITEBOARD_SHAPES.map((s) => s.label)).toEqual([
      'Rectangle',
      'Ellipse',
      'Diamond',
      'Cylinder',
    ]);
  });
});

describe('whiteboardShapeIntent', () => {
  // docs/specs/023-draw-mode/draw-mode.md "Shapes": a shape is armed plain.
  it('arms a board shape', () => {
    expect(whiteboardShapeIntent('ellipse')).toEqual({
      type: 'shape',
      kind: 'circle',
      board: true,
    });
  });
});

// docs/specs/007-editor/editor-modes.md "One look": Draw mode writes Ink, unfilled, onto what it
// makes, so it looks the same in Diagram mode and to every collaborator.
describe('boardShape', () => {
  it('writes an Ink outline and label by name, and no fill, on a shape', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 9,
      height: 9,
    } as const;
    const out = boardShape(shape);
    expect(out).toMatchObject({
      fillColor: 'transparent',
      penColour: 'ink',
      penTextColour: 'ink',
    });
    expect('strokeColor' in out).toBe(false);
    expect('strokeWidth' in out).toBe(false);
  });

  it('leaves a sticky and a text box to their own colours', () => {
    const text = { id: 't', type: 'text', x: 0, y: 0, width: 9, height: 9 } as const;
    expect(boardShape(text)).toBe(text);
  });
});

describe('whiteboardTakesTyping', () => {
  // docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts": on a whiteboard only a note or text
  // box turns a keypress into typing; a selected shape leaves the key to the dock.
  it('lets a note or a text box take the keypress', () => {
    expect(whiteboardTakesTyping({ type: 'sticky' })).toBe(true);
    expect(whiteboardTakesTyping({ type: 'text' })).toBe(true);
  });

  it('leaves the key to the tools for a shape', () => {
    expect(whiteboardTakesTyping({ type: 'shape' })).toBe(false);
  });
});

describe('strokeHitWidth', () => {
  it('pads the line by a steady on-screen margin each side, at any zoom', () => {
    expect(STROKE_HIT_SCREEN_PX).toBe(6);
    expect(strokeHitWidth(1.5, 1)).toBe(13.5);
    expect(strokeHitWidth(1.5, 2)).toBe(7.5);
  });
});
