import { describe, expect, it } from 'vitest';
import type { Element } from './element';
import { resetElementColours, type ResetTheme } from './reset-colours';

// "Reset to Theme" (each product's docs/specs/008-canvas/canvas-and-palette.md, the Colours category): every
// colour override goes, including a stock colour stored by name, which would otherwise show again the moment the
// explicit colour is cleared. One suite for every canvas editor's one copy.
const brand: ResetTheme = { elementFill: null, elementStroke: null, elementText: null };
const themed: ResetTheme = {
  elementFill: '#123456',
  elementStroke: '#234567',
  elementText: '#345678',
};
const box = { x: 0, y: 0, width: 10, height: 10 };

// Products store fields the structural model does not name (bindings, named colours): read them back loosely.
type Loose = Record<string, unknown>;
const reset = (el: object, theme: ResetTheme = brand): Loose =>
  resetElementColours(el as Element, theme) as Loose;

describe('resetElementColours', () => {
  it('drops a shape’s colours, bindings and named colours', () => {
    const out = reset({
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
      fillSwatch: 1,
      colorPreset: 'bold',
    });
    for (const field of [
      'fillColor',
      'strokeColor',
      'textColor',
      'penColour',
      'penTextColour',
      'strokeSwatch',
      'fillSwatch',
      'colorPreset',
    ]) {
      expect(out[field], field).toBeUndefined();
    }
  });

  it('writes a theme’s own element colours onto a shape', () => {
    const out = reset(
      { id: 's', type: 'shape', shape: 'square', ...box, fillColor: '#ff0000' },
      themed,
    );
    expect(out).toMatchObject({
      fillColor: '#123456',
      strokeColor: '#234567',
      textColor: '#345678',
    });
  });

  it('hands a chart back to the theme’s palette', () => {
    const out = reset({
      id: 'c',
      type: 'shape',
      shape: 'pie-chart',
      ...box,
      chartPalette: 'sunset',
    });
    expect(out.chartPalette).toBeUndefined();
  });

  it('drops a text box’s named text colour, fill and border', () => {
    const out = reset(
      {
        id: 't',
        type: 'text',
        ...box,
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        penTextColour: 'red',
        textSwatch: 1,
      },
      themed,
    );
    expect(out).toMatchObject({ textColor: '#345678' });
    expect(out.penTextColour).toBeUndefined();
    expect(out.textSwatch).toBeUndefined();
    expect(out.fillColor).toBeUndefined();
    expect(out.strokeColor).toBeUndefined();
  });

  it('drops an arrow’s named colour and its Pointer colour', () => {
    const out = reset(
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 9, y: 9 },
        strokeColor: '#ff0000',
        strokeSwatch: 2,
        penColour: 'teal',
        arrowheadColor: '#ff0000',
      },
      themed,
    );
    expect(out.strokeColor).toBe('#234567');
    expect(out.penColour).toBeUndefined();
    expect(out.strokeSwatch).toBeUndefined();
    // The Pointer colour sits in the same Colours section: its heads follow the line again.
    expect(out.arrowheadColor).toBeUndefined();
  });

  it('keeps a sticky’s own paper, dropping its overrides and its named text colour', () => {
    const sticky = {
      id: 'n',
      type: 'sticky',
      ...box,
      fillColor: '#bae6fd',
      strokeColor: '#000000',
      textColor: '#111111',
      penTextColour: 'red',
    };
    // Never the theme's colours, even on a themed tab.
    expect(reset(sticky, themed)).toEqual({ id: 'n', type: 'sticky', ...box });
  });

  it('gives a table the theme’s grid and text, clearing fills, header colours and its look', () => {
    const out = reset(
      {
        id: 'g',
        type: 'table',
        ...box,
        fillColor: '#ff0000',
        headerFill: '#00ff00',
        headerTextColor: '#0000ff',
        tablePreset: 'banded',
      },
      themed,
    );
    expect(out).toMatchObject({ strokeColor: '#234567', textColor: '#345678' });
    for (const field of ['fillColor', 'headerFill', 'headerTextColor', 'tablePreset']) {
      expect(out[field], field).toBeUndefined();
    }
  });

  it('leaves a kind with no Colours section as it is', () => {
    const image = { id: 'i', type: 'image', ...box, fillColor: '#ff0000' } as unknown as Element;
    expect(resetElementColours(image, themed)).toBe(image);
  });

  // livehuddle docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": a stored element of a deleted
  // kind is kept exactly as stored, so a selection-wide Reset to Theme on a themed tab writes nothing into it.
  it('keeps an element the product keeps as stored', () => {
    const qa = {
      id: 'q',
      type: 'shape',
      shape: 'qa-board',
      ...box,
      fillColor: '#ff0000',
    } as unknown as Element;
    const keep = (el: Element) => el.type === 'shape' && el.shape === 'qa-board';
    expect(resetElementColours(qa, themed, { keep })).toBe(qa);
  });
});
