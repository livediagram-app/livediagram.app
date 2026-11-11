import { describe, expect, it } from 'vitest';
import type { Element } from './element';
import { dropMalformedStyles } from './malformed-styles';
import { createArrow, createShape } from './testing/elements';

// Style fields have their types: the wrong type is dropped, an unknown value of the right type is kept.
const shape = (fields: Record<string, unknown>) =>
  ({ ...createShape('square', 0, 0), ...fields }) as unknown as Element;

describe('dropMalformedStyles', () => {
  it('hands back the same array when every style has its type', () => {
    const elements = [
      shape({ padding: 'md', rotation: 15, textSize: 18 }),
      shape({ textSize: 'lg', strokeWidth: 'thick' }),
      shape({ shadow: { offsetX: 1, offsetY: 2, blur: 3, opacity: 0.4 } }),
    ];
    expect(dropMalformedStyles(elements)).toBe(elements);
  });

  it('keeps a value this build does not know, as long as it is text', () => {
    const elements = [shape({ padding: 'roomy-from-a-newer-build' })];
    expect(dropMalformedStyles(elements)).toBe(elements);
  });

  it('drops each style of the wrong type and keeps the rest of the element', () => {
    const el = shape({
      padding: 12,
      opacity: '50%',
      rotation: Number.NaN,
      shadow: true,
      label: 'Hi',
    });
    const [out] = dropMalformedStyles([el]) as unknown as Record<string, unknown>[];
    expect(out).not.toHaveProperty('padding');
    expect(out).not.toHaveProperty('opacity');
    expect(out).not.toHaveProperty('rotation');
    expect(out).not.toHaveProperty('shadow');
    expect(out!.label).toBe('Hi');
  });

  it('drops a shadow missing a number', () => {
    const [out] = dropMalformedStyles([
      shape({ shadow: { offsetX: 1, offsetY: 2, blur: 'soft', opacity: 1 } }),
    ]) as unknown as Record<string, unknown>[];
    expect(out).not.toHaveProperty('shadow');
  });

  it('reads a stroke width as a number on an arrow and as text on a box', () => {
    const arrow = { ...createArrow(0, 0, 10, 10), strokeWidth: 2 } as unknown as Element;
    const box = shape({ strokeWidth: 2 });
    const textArrow = { ...createArrow(0, 0, 10, 10), strokeWidth: 'thin' } as unknown as Element;
    const [a, b, c] = dropMalformedStyles([arrow, box, textArrow]) as unknown as Record<
      string,
      unknown
    >[];
    expect(a!.strokeWidth).toBe(2);
    expect(b).not.toHaveProperty('strokeWidth');
    expect(c).not.toHaveProperty('strokeWidth');
  });

  it('copies the array once and leaves the untouched elements as they were', () => {
    const good = shape({ padding: 'md' });
    const elements = [good, shape({ padding: 1 }), shape({ opacity: 'x' })];
    const out = dropMalformedStyles(elements);
    expect(out).not.toBe(elements);
    expect(out[0]).toBe(good);
    expect(elements[1]).toHaveProperty('padding', 1);
  });
});
