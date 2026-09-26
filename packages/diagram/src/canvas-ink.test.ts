import { describe, expect, it } from 'vitest';
import {
  canvasSurface,
  createArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
} from './index';

// An element that carries no colour of its own is drawn in the canvas's own
// ink. That used to be one fixed set of brand blues, which was fine while
// every unpainted element sat on white paper — and stopped being fine when
// the Default colour scheme gained a dark half (docs/specs/007-editor/live-app.md), because a Default
// tab deliberately stores NO element colours, so the dark canvas had nothing
// but the light ink to fall back on and the whole board read as pale cards on
// near-black.
//
// So the ink follows the paper. Dark paper is the Charcoal set the Default
// scheme's dark half inherited; light paper is unchanged, to the hex.
describe('canvasSurface', () => {
  it('reads the paper from its colour', () => {
    expect(canvasSurface('#ffffff')).toBe('light');
    expect(canvasSurface('#2b2b33')).toBe('dark');
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

  it('draws a shape in the neutral greys the dark canvas was built around', () => {
    expect(defaultFillColor(shape, 'dark')).toBe('#2c2c33');
    expect(defaultStrokeColor(shape, 'dark')).toBe('#a1a1aa');
    expect(defaultTextColor(shape, 'dark')).toBe('#e4e4e7');
  });

  it('draws text and arrows so they read against it', () => {
    expect(defaultTextColor(createText(0, 0), 'dark')).toBe('#e4e4e7');
    expect(defaultArrowStrokeColor('dark')).toBe('#a1a1aa');
  });

  it('keeps a table transparent, with legible rules and text', () => {
    const table = createTable(0, 0);
    expect(defaultFillColor(table, 'dark')).toBe('transparent');
    expect(defaultStrokeColor(table, 'dark')).toBe('#a1a1aa');
    expect(defaultTextColor(table, 'dark')).toBe('#e4e4e7');
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
