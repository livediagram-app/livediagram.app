import { describe, expect, it } from 'vitest';
import { createPath } from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import {
  WHITEBOARD_SHAPES,
  boardShape,
  whiteboardTakesTyping,
  whiteboardShapeIntent,
  activeWhiteboardTool,
  whiteboardPenIntent,
  whiteboardPointerRoute,
  STROKE_HIT_SCREEN_PX,
  strokeHitWidth,
} from './whiteboard-tool';

const pen: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 4,
  recognise: false,
};

describe('activeWhiteboardTool', () => {
  it.each([
    ['eraser', null, 'eraser'],
    // No highlighter on a whiteboard: a stray marker arm reads as Select.
    ['select', { type: 'freehand', variant: 'highlighter' }, 'select'],
    ['select', pen, 'pen'],
    ['pan', pen, 'pen'],
    ['select', { type: 'path' }, 'path'],
    ['select', { type: 'sticky' }, 'sticky'],
    ['select', { type: 'text' }, 'text'],
    ['select', { type: 'shape', kind: 'circle' }, 'shape'],
    ['select', { type: 'arrow', ends: 'none' }, 'shape'],
    ['select', null, 'select'],
    ['pan', null, 'select'],
    ['select', { type: 'freehand' }, 'select'],
  ] as const)('reads %s with %j as %s', (tool, draw, expected) => {
    expect(activeWhiteboardTool(tool, draw as PendingDraw | null)).toBe(expected);
  });
});

describe('whiteboardPenIntent', () => {
  it('carries the pen colour, width and recognition', () => {
    expect(whiteboardPenIntent({ id: 'third', colour: '#e5484d', width: 8 }, true)).toEqual({
      type: 'freehand',
      variant: 'whiteboard',
      colour: '#e5484d',
      width: 8,
      recognise: true,
    });
  });
});

describe('WHITEBOARD_SHAPES', () => {
  it('offers rectangle, ellipse, diamond, cylinder, line and arrow', () => {
    expect(WHITEBOARD_SHAPES.map((s) => s.label)).toEqual([
      'Rectangle',
      'Ellipse',
      'Diamond',
      'Cylinder',
      'Line',
      'Arrow',
    ]);
    expect(WHITEBOARD_SHAPES.find((s) => s.id === 'line')!.intent).toEqual({
      type: 'arrow',
      ends: 'none',
    });
    expect(WHITEBOARD_SHAPES.find((s) => s.id === 'arrow')!.intent).toEqual({
      type: 'arrow',
      ends: 'to',
    });
  });
});

describe('whiteboardPointerRoute', () => {
  it('lets a pen and a mouse always ink', () => {
    expect(whiteboardPointerRoute({ pointerType: 'pen', penSeen: true, inking: true })).toBe('ink');
    expect(whiteboardPointerRoute({ pointerType: 'mouse', penSeen: true, inking: true })).toBe(
      'ink',
    );
  });

  it('lets touch ink until a pen has been seen', () => {
    expect(whiteboardPointerRoute({ pointerType: 'touch', penSeen: false, inking: true })).toBe(
      'ink',
    );
  });

  it('pans a finger once a pen has been seen, so a resting palm never draws', () => {
    expect(whiteboardPointerRoute({ pointerType: 'touch', penSeen: true, inking: true })).toBe(
      'pan',
    );
  });

  it('leaves touch alone when no inking tool is in hand', () => {
    expect(whiteboardPointerRoute({ pointerType: 'touch', penSeen: true, inking: false })).toBe(
      'ink',
    );
  });
});

describe('whiteboardShapeIntent', () => {
  // docs/specs/023-draw-mode/draw-mode.md "Shapes": a pen is a separate tool; pens do not set the
  // colour of the other tools.
  it('arms a board shape: ink, unfilled, default width, whatever pen was in hand', () => {
    expect(whiteboardShapeIntent('ellipse')).toEqual({
      type: 'shape',
      kind: 'circle',
      board: true,
    });
    expect(whiteboardShapeIntent('line')).toEqual({ type: 'arrow', ends: 'none', board: true });
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

  it('writes an Ink line on a line, an arrow and a path', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 9, y: 9 },
    } as const;
    expect(boardShape(arrow)).toMatchObject({ penColour: 'ink' });
    expect('fillColor' in boardShape(arrow)).toBe(false);
    const path = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 9, y: 9, mode: 'corner' },
      ],
      false,
    );
    expect(boardShape(path)).toMatchObject({ penColour: 'ink', fillColor: 'transparent' });
  });

  it('leaves a sticky and a text box to their own colours', () => {
    const text = { id: 't', type: 'text', x: 0, y: 0, width: 9, height: 9 } as const;
    expect(boardShape(text)).toBe(text);
  });
});

describe('whiteboardTakesTyping', () => {
  // docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts": on a whiteboard only a note or text
  // box turns a keypress into typing; a selected shape or stroke leaves the key to the dock.
  it('lets a note or a text box take the keypress', () => {
    expect(whiteboardTakesTyping({ type: 'sticky' })).toBe(true);
    expect(whiteboardTakesTyping({ type: 'text' })).toBe(true);
  });

  it('leaves the key to the tools for a shape, a line or a stroke', () => {
    expect(whiteboardTakesTyping({ type: 'shape' })).toBe(false);
    expect(whiteboardTakesTyping({ type: 'arrow' })).toBe(false);
    expect(whiteboardTakesTyping({ type: 'freehand' })).toBe(false);
  });
});

describe('strokeHitWidth', () => {
  it('pads the line by a steady on-screen margin each side, at any zoom', () => {
    expect(STROKE_HIT_SCREEN_PX).toBe(6);
    expect(strokeHitWidth(1.5, 1)).toBe(13.5);
    expect(strokeHitWidth(1.5, 2)).toBe(7.5);
  });
});
