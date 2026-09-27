import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import type { ArrowElement, Element, FreehandElement, ShapeElement, StickyElement } from './index';
import {
  WHITEBOARD_BACKGROUNDS,
  WHITEBOARD_BOARD,
  WHITEBOARD_INK,
  WHITEBOARD_PATTERN,
  inkWhiteboardElement,
  isWhiteboardTab,
  nearestBorderStroke,
  whiteboardBackgroundOf,
} from './whiteboard';

const INK = '#123456';

const freehand = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  points: [
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ],
  closed: false,
  ...over,
});
const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});

describe('isWhiteboardTab', () => {
  it('recognises the whiteboard kind and nothing else', () => {
    expect(isWhiteboardTab({ kind: 'whiteboard' })).toBe(true);
    expect(isWhiteboardTab({ kind: 'event-storming' })).toBe(false);
    expect(isWhiteboardTab({})).toBe(false);
    expect(isWhiteboardTab(undefined)).toBe(false);
  });
});

describe('whiteboard tokens', () => {
  it.each(['light', 'dark'] as const)('ink on board meets WCAG AA text contrast (%s)', (a) => {
    expect(contrastRatio(WHITEBOARD_INK[a], WHITEBOARD_BOARD[a])).toBeGreaterThanOrEqual(4.5);
  });

  it('is a whiteboard in light and a chalkboard in dark', () => {
    expect(contrastRatio(WHITEBOARD_BOARD.light, '#ffffff')).toBeLessThan(1.1);
    expect(contrastRatio(WHITEBOARD_BOARD.dark, '#000000')).toBeLessThan(2);
  });

  it.each(['light', 'dark'] as const)('keeps the pattern faint against the board (%s)', (a) => {
    const ratio = contrastRatio(WHITEBOARD_PATTERN[a], WHITEBOARD_BOARD[a]);
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(2);
  });
});

describe('whiteboard backgrounds', () => {
  it('maps Plain, Dots and Grid onto the canvas patterns', () => {
    expect(WHITEBOARD_BACKGROUNDS.map((b) => [b.id, b.pattern])).toEqual([
      ['plain', 'blank'],
      ['dots', 'grid'],
      ['grid', 'graph'],
    ]);
  });

  it('reads a stored pattern back, defaulting to Plain', () => {
    expect(whiteboardBackgroundOf('graph')).toBe('grid');
    expect(whiteboardBackgroundOf('grid')).toBe('dots');
    expect(whiteboardBackgroundOf(undefined)).toBe('plain');
    expect(whiteboardBackgroundOf('waves')).toBe('plain');
  });
});

describe('inkWhiteboardElement', () => {
  it('draws an unpainted stroke in ink, unfilled', () => {
    const out = inkWhiteboardElement(freehand(), INK) as FreehandElement;
    expect(out.strokeColor).toBe(INK);
    expect(out.fillColor).toBe('transparent');
  });

  it('keeps a pen colour as drawn and returns the same object when nothing changes', () => {
    const red = freehand({ strokeColor: '#e11d48', fillColor: 'transparent' });
    expect(inkWhiteboardElement(red, INK)).toBe(red);
  });

  it('leaves highlighter strokes alone', () => {
    const marker = freehand({ pen: 'highlighter' });
    expect(inkWhiteboardElement(marker, INK)).toBe(marker);
  });

  it('inks unpainted text', () => {
    const text: Element = { id: 't', type: 'text', x: 0, y: 0, width: 1, height: 1 } as Element;
    expect((inkWhiteboardElement(text, INK) as { textColor?: string }).textColor).toBe(INK);
  });

  it('inks the plain shapes without a fill', () => {
    const out = inkWhiteboardElement(shape({ shape: 'circle' }), INK) as ShapeElement;
    expect(out).toMatchObject({ strokeColor: INK, fillColor: 'transparent', textColor: INK });
  });

  it('leaves other shape kinds alone', () => {
    const cyl = shape({ shape: 'cylinder' });
    expect(inkWhiteboardElement(cyl, INK)).toBe(cyl);
  });

  it('inks an unpainted arrow', () => {
    const arrow: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 1, y: 1 },
    };
    expect((inkWhiteboardElement(arrow, INK) as ArrowElement).strokeColor).toBe(INK);
  });

  it('never touches a sticky note', () => {
    const sticky = { id: 'n', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as StickyElement;
    expect(inkWhiteboardElement(sticky, INK)).toBe(sticky);
  });
});

describe('nearestBorderStroke', () => {
  it('maps pen widths onto the nearest border preset, ties to the thicker', () => {
    expect(nearestBorderStroke(1)).toBe('thin');
    expect(nearestBorderStroke(2)).toBe('medium');
    expect(nearestBorderStroke(3)).toBe('thick');
    expect(nearestBorderStroke(4)).toBe('thick');
    expect(nearestBorderStroke(8)).toBe('extra-thick');
  });
});
