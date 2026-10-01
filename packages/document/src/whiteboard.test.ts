import { describe, expect, it } from 'vitest';
import { DARK_CANVAS_BACKGROUND_COLOR, DARK_CANVAS_PATTERN_COLOR } from './canvas-colors';
import { contrastRatio } from './colors';
import type {
  ArrowElement,
  Element,
  FreehandElement,
  PathElement,
  ShapeElement,
  StickyElement,
  TextElement,
} from './index';
import {
  WHITEBOARD_BACKGROUNDS,
  WHITEBOARD_BOARD,
  WHITEBOARD_DEFAULT_PATTERN,
  WHITEBOARD_INK,
  WHITEBOARD_UNSET_PATTERN,
  WHITEBOARD_PATTERN,
  inkWhiteboardElement,
  isWhiteboardTab,
  projectWhiteboardElement,
  nearestBorderStroke,
  whiteboardBackgroundOf,
} from './whiteboard';
import { createPath } from './path-element';
import { penColourHex } from './pen-colours';
import { encodeStrokePoints } from './stroke-points';

const INK = '#123456';

const freehand = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  packedPoints: encodeStrokePoints([
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ]),
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

  it("is an off-white whiteboard in light and the editor's own dark canvas in dark", () => {
    expect(contrastRatio(WHITEBOARD_BOARD.light, '#ffffff')).toBeLessThan(1.1);
    expect(WHITEBOARD_BOARD.dark).toBe(DARK_CANVAS_BACKGROUND_COLOR);
    expect(WHITEBOARD_PATTERN.dark).toBe(DARK_CANVAS_PATTERN_COLOR);
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

  it('starts a new whiteboard on Grid, and reads a board stored without one as Plain', () => {
    expect(whiteboardBackgroundOf(WHITEBOARD_DEFAULT_PATTERN)).toBe('grid');
    expect(whiteboardBackgroundOf(WHITEBOARD_UNSET_PATTERN)).toBe('plain');
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

  it('draws an unpainted path in ink, unfilled, and leaves a painted one alone', () => {
    const path = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 10, y: 10, mode: 'corner' },
      ],
      false,
    );
    const out = inkWhiteboardElement(path, INK);
    expect(out.strokeColor).toBe(INK);
    expect(out.fillColor).toBe('transparent');
    const painted = { ...path, strokeColor: '#f00', fillColor: '#0f0' };
    expect(inkWhiteboardElement(painted, INK)).toBe(painted);
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

// docs/specs/023-whiteboard/whiteboard.md "The colour picker": a named colour is drawn in the version
// tuned for the viewer's board; an explicit colour wins; anything unpainted takes the ink.
describe('projectWhiteboardElement', () => {
  it('draws a marker stroke, a recognised shape and line in the named colour for the board', () => {
    const line = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 1, y: 1 },
      penColour: 'teal',
    } as ArrowElement;
    for (const board of ['light', 'dark'] as const) {
      const hex = penColourHex('teal', board);
      const stroke = projectWhiteboardElement(freehand({ penColour: 'teal' }), board);
      expect(stroke.strokeColor).toBe(hex);
      expect(stroke.fillColor).toBe('transparent');
      expect(
        projectWhiteboardElement(shape({ shape: 'circle', penColour: 'teal' }), board).strokeColor,
      ).toBe(hex);
      expect(projectWhiteboardElement(line, board).strokeColor).toBe(hex);
    }
  });

  it('draws a named text colour on a text box and a shape label for the board', () => {
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 9,
      height: 9,
      label: 'Hi',
      penTextColour: 'green',
    } as TextElement;
    for (const board of ['light', 'dark'] as const) {
      const hex = penColourHex('green', board);
      expect(projectWhiteboardElement(text, board).textColor).toBe(hex);
      const labelled = projectWhiteboardElement(shape({ penTextColour: 'green' }), board);
      expect(labelled.textColor).toBe(hex);
      expect(labelled.strokeColor).toBe(WHITEBOARD_INK[board]);
    }
  });

  it('keeps an explicit text colour over a named one', () => {
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 9,
      height: 9,
      textColor: '#ff6b00',
      penTextColour: 'green',
    } as TextElement;
    expect(projectWhiteboardElement(text, 'dark').textColor).toBe('#ff6b00');
  });

  it('draws a path in its named colour', () => {
    const path = {
      id: 'p',
      type: 'path',
      x: 0,
      y: 0,
      width: 9,
      height: 9,
      closed: false,
      nodes: [],
      penColour: 'violet',
    } as PathElement;
    expect(projectWhiteboardElement(path, 'light').strokeColor).toBe(
      penColourHex('violet', 'light'),
    );
  });

  it('keeps an explicit colour, and inks an unpainted stroke in the board ink', () => {
    const custom = freehand({ penColour: 'teal', strokeColor: '#ff6b00' });
    expect(projectWhiteboardElement(custom, 'dark').strokeColor).toBe('#ff6b00');
    expect(projectWhiteboardElement(freehand(), 'dark').strokeColor).toBe(WHITEBOARD_INK.dark);
  });

  it('returns the element itself when nothing changes', () => {
    const done = freehand({ strokeColor: '#ff6b00', fillColor: 'transparent' });
    expect(projectWhiteboardElement(done, 'light')).toBe(done);
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
