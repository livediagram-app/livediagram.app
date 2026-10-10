import { describe, expect, it } from 'vitest';
import type { ArrowElement, ShapeElement, StickyElement, TextElement } from '@livediagram/document';
import { getTheme } from './themes';
import { resetElementColours } from './reset-colours';

// "Reset to Theme" (docs/specs/008-canvas/canvas-and-palette.md, the Colours category): every
// colour override goes, including a whiteboard stock colour stored by name
// (docs/specs/023-draw-mode/draw-mode.md "Imported and pasted content"), which would otherwise
// show again the moment the explicit colour is cleared.
const theme = getTheme(undefined);
const box = { x: 0, y: 0, width: 10, height: 10 };

describe('resetElementColours', () => {
  it('drops a shape’s colours, bindings and named colours', () => {
    const shape: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      ...box,
      fillColor: '#ff0000',
      strokeColor: '#00ff00',
      textColor: '#0000ff',
      penColour: 'blue',
      penTextColour: 'green',
      strokeSwatch: 2,
      colorPreset: 'bold',
    };
    const out = resetElementColours(shape, theme) as ShapeElement;
    expect(out.penColour).toBeUndefined();
    expect(out.penTextColour).toBeUndefined();
    expect(out.strokeColor).toBe(theme.elementStroke ?? undefined);
    expect(out.colorPreset).toBeUndefined();
    expect(out.strokeSwatch).toBeUndefined();
  });

  it('drops a text box’s named text colour', () => {
    const text: TextElement = {
      id: 't',
      type: 'text',
      ...box,
      penTextColour: 'red',
      textSwatch: 1,
    };
    const out = resetElementColours(text, theme) as TextElement;
    expect(out.penTextColour).toBeUndefined();
    expect(out.textSwatch).toBeUndefined();
  });

  it('drops an arrow’s named colour', () => {
    const arrow: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 9, y: 9 },
      penColour: 'teal',
    };
    expect((resetElementColours(arrow, theme) as ArrowElement).penColour).toBeUndefined();
  });

  it('keeps a sticky’s own paper, dropping only its overrides', () => {
    const sticky: StickyElement = { id: 'n', type: 'sticky', ...box, fillColor: '#bae6fd' };
    expect(resetElementColours(sticky, theme)).toEqual({ id: 'n', type: 'sticky', ...box });
  });
});
