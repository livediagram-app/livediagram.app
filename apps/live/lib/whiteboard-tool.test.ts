import { describe, expect, it } from 'vitest';
import type { PendingDraw } from './draw-mode';
import {
  WHITEBOARD_SHAPES,
  boardShape,
  whiteboardTakesTyping,
  whiteboardShapeIntent,
  activeWhiteboardTool,
  whiteboardPenIntent,
  whiteboardPointerRoute,
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
    // No highlighter on a whiteboard: a stray one reads as Select.
    ['highlighter', { type: 'freehand', variant: 'highlighter' }, 'select'],
    ['select', pen, 'pen'],
    ['pan', pen, 'pen'],
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
  it('offers rectangle, ellipse, diamond, line and arrow', () => {
    expect(WHITEBOARD_SHAPES.map((s) => s.label)).toEqual([
      'Rectangle',
      'Ellipse',
      'Diamond',
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
  // docs/specs/023-whiteboard/whiteboard.md "Shapes": a pen is a separate tool; pens do not set the
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

describe('boardShape', () => {
  it('leaves a shape unpainted and unfilled', () => {
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
    expect(out).toMatchObject({ fillColor: 'transparent' });
    expect('strokeColor' in out).toBe(false);
    expect('strokeWidth' in out).toBe(false);
  });
});

describe('whiteboardTakesTyping', () => {
  // docs/specs/023-whiteboard/whiteboard.md "Keyboard shortcuts": on a whiteboard only a note or text
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
