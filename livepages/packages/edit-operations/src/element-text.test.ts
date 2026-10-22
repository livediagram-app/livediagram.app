import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { describeElement, endRef, kindOf, labelOf, quoteCut } from './element-text';

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

describe('quoteCut', () => {
  it('quotes a short string whole', () => {
    expect(quoteCut('Sign in', 60)).toBe('"Sign in"');
  });

  it('cuts at the last space in the slice, the ellipsis after the quote', () => {
    expect(quoteCut('Orders service which creates orders', 18)).toBe('"Orders service"…');
  });

  it('keeps a word that ends exactly at the cut', () => {
    expect(quoteCut('Orders service which', 14)).toBe('"Orders service"…');
  });

  it('cuts hard when the slice has no space', () => {
    expect(quoteCut('abcdefghij', 4)).toBe('"abcd"…');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(quoteCut('😀😀😀', 3)).toBe('"😀😀😀"');
  });
});

describe('endRef', () => {
  it('names a pinned end by its element and a free end by its point', () => {
    expect(endRef({ kind: 'pinned', elementId: 'n3', anchor: 's' })).toBe('n3');
    expect(endRef({ kind: 'free', x: 10.4, y: -3.6 })).toBe('@10,-4');
    expect(endRef({ kind: 'on-arrow', arrowId: 'a2', t: 0.5 })).toBe('a2');
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
