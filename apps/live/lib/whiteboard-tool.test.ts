import { describe, expect, it } from 'vitest';
import type { PendingDraw } from './draw-mode';
import {
  WHITEBOARD_SHAPES,
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
    ['highlighter', { type: 'freehand', variant: 'highlighter' }, 'highlighter'],
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
    expect(whiteboardPenIntent({ id: 'red', colour: '#e5484d', width: 8 }, true)).toEqual({
      type: 'freehand',
      variant: 'whiteboard',
      colour: '#e5484d',
      width: 8,
      recognise: true,
    });
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
