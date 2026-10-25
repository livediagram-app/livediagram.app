import { describe, expect, it } from 'vitest';
import { endRef, labelOf, quoteCut } from './element-text';

describe('labelOf', () => {
  it('reads the label, or nothing', () => {
    expect(labelOf({ id: 'n2', type: 'shape', label: 'Cart' })).toBe('Cart');
    expect(labelOf({ id: 'n3', type: 'shape', label: '' })).toBeUndefined();
    expect(labelOf({ id: 'a1', type: 'arrow' })).toBeUndefined();
    expect(labelOf({ id: 'x', label: 4 })).toBeUndefined();
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
    expect(endRef({ kind: 'pinned', elementId: 'n3' })).toBe('n3');
    expect(endRef({ kind: 'free', x: 10.4, y: -3.6 })).toBe('@10,-4');
    expect(endRef({ kind: 'on-arrow', arrowId: 'a2' })).toBe('a2');
  });

  it('names an end by the ref a tab gives it', () => {
    expect(endRef({ kind: 'pinned', elementId: 'n3' }, (id) => `#${id}`)).toBe('#n3');
  });
});
