import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { describeElement, kindOf, labelOf } from './element-text';

const byId = (id: string) => checkoutFlow().elements.find((el) => el.id === id)!;

describe('kindOf', () => {
  it('reads a shape by its kind and anything else by its type', () => {
    expect(kindOf(byId('n6'))).toBe('diamond');
    expect(kindOf(byId('t1'))).toBe('text');
    expect(kindOf(byId('a1'))).toBe('arrow');
  });
});

describe('labelOf', () => {
  it('reads the label, or nothing', () => {
    expect(labelOf(byId('n2'))).toBe('Cart');
    expect(labelOf(byId('a1'))).toBeUndefined();
  });
});

describe('describeElement', () => {
  it('prints a box as its id, kind and label', () => {
    expect(describeElement(byId('n7'))).toBe('n7  square "Charge card"');
  });

  it('prints an arrow with its ends and label', () => {
    expect(describeElement(byId('a6'))).toBe('a6  arrow n6→n7 "yes"');
  });

  it('prints an unlabelled element without a label', () => {
    expect(describeElement({ id: 'x', type: 'sticky' } as Element)).toBe('x  sticky');
  });
});
