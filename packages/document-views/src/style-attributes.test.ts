import { describe, expect, it } from 'vitest';
import { createSticky, createTable, createText, type Element } from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
import { styleAttributesOf, styleBaselines } from './style-attributes';

const style = (el: Element) =>
  styleAttributesOf(el, styleBaselines())
    .map((a) => a.text)
    .join(' ');

describe('styleAttributesOf', () => {
  it('compares each kind with its own factory', () => {
    expect(style(createText(0, 0))).toBe('');
    expect(style(createSticky(0, 0))).toBe('');
    expect(style(createTable(0, 0))).toBe('');
    expect(style({ ...createText(0, 0), font: 'serif' } as Element)).toBe('font=serif');
  });

  it('prints every present style on a kind without a factory, quoting where needed', () => {
    const image = {
      id: 'i',
      type: 'image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      src: 's',
      strokeColor: 'dark slate',
    } as unknown as Element;
    expect(style(image)).toBe('stroke="dark slate"');
    const blob = {
      ...shapeAt('square', 'b', 0, 0),
      shape: 'blob',
      fillColor: '#fff',
    } as unknown as Element;
    expect(style(blob)).toBe('fill=#fff text=md');
  });

  it('prints numbers and flags, and skips values it cannot print', () => {
    const el = {
      ...shapeAt('square', 'x', 0, 0),
      textSize: 12,
      font: true,
      fillColor: { r: 1 },
    } as unknown as Element;
    expect(style(el)).toBe('text=12 font=true');
  });

  it('builds each factory once per render', () => {
    const baselineOf = styleBaselines();
    const a = shapeAt('square', 'a', 0, 0);
    expect(baselineOf(a)).toBe(baselineOf(shapeAt('square', 'b', 9, 9)));
  });
});
