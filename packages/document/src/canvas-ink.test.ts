import { describe, expect, it } from 'vitest';
import {
  canvasSurface,
  contrastRatio,
  createAnnotation,
  createArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  defaultArrowLabelColor,
  defaultArrowStrokeColor,
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
} from './index';

// An element that carries no colour of its own is drawn in the canvas's own
// ink. That used to be one fixed set of brand blues, which was fine while
// every unpainted element sat on white paper — and stopped being fine when
// the Default colour scheme gained a dark half (docs/specs/007-editor/live-app.md), because a Default
// tab deliberately stores NO element colours, so the dark canvas had nothing
// but the light ink to fall back on and the whole canvas read as pale cards on
// near-black.
//
// So the ink follows the paper. Dark paper is the blue-slate set of the dark
// palette (docs/specs/008-canvas/canvas-and-palette.md, Default scheme, dark
// half); light paper is unchanged, to the hex.
describe('canvasSurface', () => {
  it('reads the paper from its colour', () => {
    expect(canvasSurface('#ffffff')).toBe('light');
    expect(canvasSurface('#0d121a')).toBe('dark');
    expect(canvasSurface('#0f172a')).toBe('dark'); // Midnight
    expect(canvasSurface('#fdf2f8')).toBe('light'); // Pink
  });

  it('treats an unset or unparseable colour as the default white canvas', () => {
    expect(canvasSurface(undefined)).toBe('light');
    expect(canvasSurface('transparent')).toBe('light');
  });
});

describe('element ink on dark paper', () => {
  const shape = createShape('square', 0, 0);

  it('draws a shape in the blue-slate the dark canvas is built around', () => {
    expect(defaultFillColor(shape, 'dark')).toBe('#141b26');
    expect(defaultStrokeColor(shape, 'dark')).toBe('#64748b');
    expect(defaultTextColor(shape, 'dark')).toBe('#ffffff');
  });

  it('lifts an annotation marker a shade above the shape fill', () => {
    expect(defaultFillColor(createAnnotation(0, 0), 'dark')).toBe('#1c2533');
  });

  it('draws text and arrows so they read against it', () => {
    expect(defaultTextColor(createText(0, 0), 'dark')).toBe('#ffffff');
    expect(defaultArrowStrokeColor('dark')).toBe('#64748b');
  });

  it('keeps a table transparent, with legible rules and text', () => {
    const table = createTable(0, 0);
    expect(defaultFillColor(table, 'dark')).toBe('transparent');
    expect(defaultStrokeColor(table, 'dark')).toBe('#64748b');
    expect(defaultTextColor(table, 'dark')).toBe('#ffffff');
  });

  it('leaves a sticky note its amber', () => {
    // The amber IS the sticky, on any paper — the same exemption it gets from
    // every colour scheme.
    const sticky = createSticky(0, 0);
    expect(defaultFillColor(sticky, 'dark')).toBe(defaultFillColor(sticky));
    expect(defaultStrokeColor(sticky, 'dark')).toBe(defaultStrokeColor(sticky));
    expect(defaultTextColor(sticky, 'dark')).toBe(defaultTextColor(sticky));
  });

  it('leaves a transparent field transparent rather than inking it', () => {
    expect(defaultStrokeColor(createText(0, 0), 'dark')).toBe('transparent');
    expect(defaultFillColor(createText(0, 0), 'dark')).toBe('transparent');
  });
});

describe('element ink on light paper', () => {
  it('is exactly what it always was, with or without the argument', () => {
    const cases = [createShape('square', 0, 0), createSticky(0, 0), createText(0, 0)];
    for (const el of cases) {
      expect(defaultFillColor(el, 'light')).toBe(defaultFillColor(el));
      expect(defaultStrokeColor(el, 'light')).toBe(defaultStrokeColor(el));
      expect(defaultTextColor(el, 'light')).toBe(defaultTextColor(el));
    }
    expect(defaultStrokeColor(cases[0]!)).toBe('#0ea5e9');
    expect(defaultArrowStrokeColor('light')).toBe(defaultArrowStrokeColor());
    expect(defaultArrowStrokeColor()).toBe('rgb(51 65 85)');
  });

  it('is what a caller with no canvas in hand gets', () => {
    // Exports, the MCP worker and every older call site pass nothing.
    expect(createArrow).toBeTypeOf('function');
    expect(defaultArrowStrokeColor()).toBe('rgb(51 65 85)');
  });
});

describe('the dark canvas', () => {
  it('is the blue-slate of the dark chrome', () => {
    expect(DARK_CANVAS_BACKGROUND_COLOR).toBe('#0d121a');
  });

  it('stores its grid as #2e4057 at 45 % over the canvas, as one opaque colour', () => {
    const blend = (fg: number, bg: number) => Math.round(fg * 0.45 + bg * 0.55);
    const hex = [
      [0x2e, 0x0d],
      [0x40, 0x12],
      [0x57, 0x1a],
    ]
      .map(([fg, bg]) => blend(fg!, bg!).toString(16).padStart(2, '0'))
      .join('');
    expect(DARK_CANVAS_PATTERN_COLOR).toBe(`#${hex}`);
    expect(DARK_CANVAS_PATTERN_COLOR).toBe('#1c2735');
  });
});

// WCAG 2.2: 3:1 for the lines that make a shape a shape (1.4.11), 4.5:1 for
// its words (1.4.3).
describe('dark ink contrast', () => {
  const shape = createShape('square', 0, 0);
  const canvas = DARK_CANVAS_BACKGROUND_COLOR;

  it('keeps outlines at 3:1 on the canvas and on the fill', () => {
    expect(contrastRatio(defaultStrokeColor(shape, 'dark'), canvas)).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(defaultStrokeColor(shape, 'dark'), defaultFillColor(shape, 'dark')),
    ).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(defaultArrowStrokeColor('dark'), canvas)).toBeGreaterThanOrEqual(3);
  });

  it('keeps labels at 4.5:1', () => {
    expect(
      contrastRatio(defaultTextColor(shape, 'dark'), defaultFillColor(shape, 'dark')),
    ).toBeGreaterThanOrEqual(4.5);
    const arrow = createArrow(0, 0, 10, 10);
    expect(contrastRatio(defaultArrowLabelColor(arrow, 'dark'), canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe('defaultArrowLabelColor', () => {
  const arrow = createArrow(0, 0, 10, 10);

  it('is slate-400 for an uncoloured arrow on dark paper, a step lighter than its line', () => {
    expect(defaultArrowLabelColor(arrow, 'dark')).toBe('#94a3b8');
  });

  it('follows a stroke the user picked, on either paper', () => {
    const red = { ...arrow, strokeColor: '#dc2626' };
    expect(defaultArrowLabelColor(red, 'dark')).toBe('#dc2626');
    expect(defaultArrowLabelColor(red, 'light')).toBe('#dc2626');
  });

  it('always answers a caption colour the user picked', () => {
    const captioned = { ...arrow, strokeColor: '#dc2626', textColor: '#16a34a' };
    expect(defaultArrowLabelColor(captioned, 'dark')).toBe('#16a34a');
    expect(defaultArrowLabelColor({ ...arrow, textColor: '#16a34a' }, 'dark')).toBe('#16a34a');
  });

  it('on light paper is the stroke the arrow is drawn in, exactly as before', () => {
    expect(defaultArrowLabelColor(arrow, 'light')).toBe(defaultArrowStrokeColor('light'));
    expect(defaultArrowLabelColor(arrow)).toBe(defaultArrowStrokeColor());
  });
});
