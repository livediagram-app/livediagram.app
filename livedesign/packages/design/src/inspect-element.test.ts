import { describe, expect, it } from 'vitest';
import {
  inspectColour,
  inspectCss,
  inspectElement,
  inspectNumber,
  inspectValues,
  inspectValuesText,
  type InspectSpec,
} from './inspect-element';
import type { BoxedElement } from './index';

const origin = { x: 1000, y: 2000 };
const shape = (extra: Record<string, unknown> = {}): BoxedElement =>
  ({
    id: 'a',
    type: 'shape',
    shape: 'square',
    x: 1016,
    y: 2100.04,
    width: 120,
    height: 44,
    ...extra,
  }) as unknown as BoxedElement;

describe('inspectColour', () => {
  it('writes a hex in capitals, widens a short one, and reads none as none', () => {
    expect(inspectColour('#1e293b')).toBe('#1E293B');
    expect(inspectColour('#abc')).toBe('#AABBCC');
    expect(inspectColour('#11223344')).toBe('#11223344');
    expect(inspectColour('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    expect(inspectColour('none')).toBeNull();
    expect(inspectColour('transparent')).toBeNull();
    expect(inspectColour(' ')).toBeNull();
    expect(inspectColour(undefined)).toBeNull();
  });
});

describe('inspectNumber', () => {
  it('rounds to a tenth and never writes minus zero', () => {
    expect(inspectNumber(12.04)).toBe(12);
    expect(inspectNumber(12.05)).toBe(12.1);
    expect(inspectNumber(-0.01)).toBe(0);
  });
});

describe('inspectElement', () => {
  it('measures from the screen origin with the drawn fill, border, corners and text', () => {
    const spec = inspectElement(
      shape({
        label: 'Continue',
        fillColor: '#111827',
        strokeColor: '#111827',
        textColor: '#ffffff',
        textBold: true,
        borderRadius: 'large',
        strokeStyle: 'dashed',
        font: 'inter',
      }),
      { origin },
    );
    expect(spec).toMatchObject({
      x: 16,
      y: 100,
      width: 120,
      height: 44,
      rotation: 0,
      opacity: 1,
      fill: '#111827',
      border: { color: '#111827', style: 'dashed' },
    });
    expect(typeof spec.radius).toBe('number');
    expect(spec.text).toMatchObject({
      font: 'Inter',
      weight: 700,
      color: '#FFFFFF',
      align: 'center',
      italic: false,
    });
    expect(spec.text!.lineHeight).toBe(inspectNumber(spec.text!.size * 1.25));
  });

  it('reads a stadium as a pill, a circle as round, and no label as no text', () => {
    expect(inspectElement(shape({ shape: 'stadium' }), { origin }).radius).toBe(22);
    expect(inspectElement(shape({ shape: 'circle' }), { origin }).radius).toBe('circle');
    expect(inspectElement(shape({ shape: 'diamond' }), { origin }).radius).toBeNull();
    expect(inspectElement(shape(), { origin }).text).toBeNull();
  });

  it('reads a turned, faded element and the UI sans when no face is named', () => {
    const spec = inspectElement(shape({ rotation: 15, opacity: 0.5, label: 'Hi' }), { origin });
    expect(spec.rotation).toBe(15);
    expect(spec.opacity).toBe(0.5);
    expect(spec.text?.font).toBe('System Sans');
  });

  it('reads the tab font, a sticky square, and a text box with its own weight and no box', () => {
    const sticky = inspectElement(
      {
        id: 's',
        type: 'sticky',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        label: 'Note',
      } as unknown as BoxedElement,
      { origin: { x: 0, y: 0 }, tabFont: 'poppins' },
    );
    expect(sticky.radius).toBe(0);
    expect(sticky.border).toBeNull();
    expect(sticky.text?.font).toBe('Poppins');
    const text = inspectElement(
      {
        id: 't',
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        label: 'Title',
        fontWeight: 600,
        textAlignX: 'left',
      } as unknown as BoxedElement,
      { origin: { x: 0, y: 0 } },
    );
    expect(text.fill).toBeNull();
    expect(text.border).toBeNull();
    expect(text.radius).toBeNull();
    expect(text.text).toMatchObject({ weight: 600, align: 'left' });
  });

  it('reads an image placeholder by its corner and a right-aligned label', () => {
    const img = inspectElement(
      {
        id: 'i',
        type: 'image',
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        borderRadius: 'full',
      } as BoxedElement,
      { origin: { x: 0, y: 0 } },
    );
    expect(img.fill).toBeNull();
    expect(img.radius).toBe(40);
    const right = inspectElement(shape({ label: 'Go', textAlignX: 'right' }), { origin });
    expect(right.text?.align).toBe('right');
  });

  it('draws a frame or table with the 1.5 line and 6 corner the export draws', () => {
    const table = inspectElement(
      {
        id: 'tb',
        type: 'table',
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rows: 2,
        cols: 2,
        cells: [],
      } as unknown as BoxedElement,
      { origin: { x: 0, y: 0 } },
    );
    expect(table.radius).toBe(6);
  });
});

const full: InspectSpec = {
  x: 16,
  y: 100,
  width: 120,
  height: 44,
  rotation: 15,
  opacity: 0.5,
  fill: '#111827',
  border: { color: '#E5E7EB', width: 1, style: 'dash-dot' },
  radius: 8,
  text: {
    font: 'Inter',
    fontFamily: "'Inter', sans-serif",
    size: 16,
    weight: 600,
    italic: true,
    lineHeight: 20,
    color: '#FFFFFF',
    align: 'center',
  },
};

describe('inspectCss', () => {
  it('writes every drawn part as CSS in px, an unknown dash as dashed', () => {
    expect(inspectCss(full)).toBe(
      [
        'width: 120px;',
        'height: 44px;',
        'left: 16px;',
        'top: 100px;',
        'transform: rotate(15deg);',
        'opacity: 0.5;',
        'background: #111827;',
        'border: 1px dashed #E5E7EB;',
        'border-radius: 8px;',
        'color: #FFFFFF;',
        "font-family: 'Inter', sans-serif;",
        'font-size: 16px;',
        'font-weight: 600;',
        'font-style: italic;',
        'line-height: 20px;',
        'text-align: center;',
      ].join('\n'),
    );
  });

  it('leaves out what is not drawn, and writes a circle as 50%', () => {
    const css = inspectCss({
      ...full,
      rotation: 0,
      opacity: 1,
      fill: null,
      border: { color: '#000000', width: 2, style: 'solid' },
      radius: 'circle',
      text: { ...full.text!, italic: false },
    });
    expect(css).toContain('border: 2px solid #000000;');
    expect(css).toContain('border-radius: 50%;');
    expect(css).not.toMatch(/transform|opacity|background|font-style/);
    expect(inspectCss({ ...full, border: null, radius: 0, text: null })).not.toMatch(
      /border|color/,
    );
  });
});

describe('inspectValues', () => {
  it('names every value in the panel order, and Copy Values prefixes the repeated names', () => {
    const values = inspectValues(full);
    expect(values.map((v) => v.name)).toEqual([
      'W',
      'H',
      'X',
      'Y',
      'Rotation',
      'Opacity',
      'Fill',
      'Border',
      'Width',
      'Style',
      'Radius',
      'Font',
      'Size',
      'Weight',
      'Line Height',
      'Colour',
      'Align',
    ]);
    const text = inspectValuesText(values);
    expect(text).toContain('Rotation: 15°');
    expect(text).toContain('Opacity: 50%');
    expect(text).toContain('Border Style: Dash Dot');
    expect(text).toContain('Text Font: Inter Italic');
    expect(text).toContain('Text Align: Centre');
  });

  it('reads none for an unpainted part and 50% for a circle, with no text rows', () => {
    const values = inspectValues({
      ...full,
      rotation: 0,
      opacity: 1,
      fill: null,
      border: { color: '#000000', width: 1, style: 'unknown' },
      radius: 'circle',
      text: null,
    });
    expect(values.find((v) => v.name === 'Fill')?.value).toBe('None');
    expect(values.find((v) => v.name === 'Style')?.value).toBe('unknown');
    expect(values.find((v) => v.name === 'Radius')?.value).toBe('50%');
    expect(values.some((v) => v.group === 'text')).toBe(false);
    const bare = inspectValues({ ...full, border: null, radius: null, text: null });
    expect(bare.find((v) => v.name === 'Border')?.value).toBe('None');
    expect(bare.some((v) => v.name === 'Radius')).toBe(false);
  });
});
