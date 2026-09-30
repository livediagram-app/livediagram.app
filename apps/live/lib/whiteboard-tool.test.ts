import { describe, expect, it } from 'vitest';
import type { PendingDraw } from './draw-mode';
import {
  WHITEBOARD_SHAPES,
  applyWhiteboardPen,
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
    expect(whiteboardPenIntent({ id: 'second-colour', colour: '#e5484d', width: 8 }, true)).toEqual(
      {
        type: 'freehand',
        variant: 'whiteboard',
        colour: '#e5484d',
        width: 8,
        recognise: true,
      },
    );
  });
});

describe('WHITEBOARD_SHAPES', () => {
  it('offers rectangle, ellipse, triangle, diamond, line and arrow', () => {
    expect(WHITEBOARD_SHAPES.map((s) => s.label)).toEqual([
      'Rectangle',
      'Ellipse',
      'Triangle',
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
  it('draws a shape with the pen in hand', () => {
    const pen = { id: 'second-colour' as const, colour: '#e5484d', width: 8 };
    expect(whiteboardShapeIntent('ellipse', pen)).toEqual({
      type: 'shape',
      kind: 'circle',
      pen: { colour: '#e5484d', width: 8 },
    });
    expect(whiteboardShapeIntent('line', pen)).toEqual({
      type: 'arrow',
      ends: 'none',
      pen: { colour: '#e5484d', width: 8 },
    });
  });
});

describe('applyWhiteboardPen', () => {
  const shape = {
    id: 's',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 9,
    height: 9,
  } as const;
  const arrow = {
    id: 'a',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 9, y: 9 },
  } as const;

  it('gives a shape the pen colour and nearest weight, unfilled', () => {
    expect(applyWhiteboardPen(shape, { colour: '#1d7afc', width: 8 })).toMatchObject({
      strokeColor: '#1d7afc',
      strokeWidth: 'extra-thick',
      fillColor: 'transparent',
    });
  });

  it('leaves a main-pen shape unpainted so it follows the board', () => {
    expect('strokeColor' in applyWhiteboardPen(shape, { colour: null, width: 4 })).toBe(false);
  });

  it('gives a line the pen colour and exact width', () => {
    expect(applyWhiteboardPen(arrow, { colour: '#2f9e44', width: 2 })).toMatchObject({
      strokeColor: '#2f9e44',
      strokeWidth: 2,
    });
  });
});
