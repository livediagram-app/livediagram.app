import { describe, expect, it } from 'vitest';
import { cardNumber, cardRefFor } from './card-ref';

describe('cardNumber', () => {
  it('shows the prefixed ref a card carries', () => {
    expect(cardNumber({ key: 100, ref: 'WI-100' })).toBe('WI-100');
  });

  it('shows #N for an entry stored before refs', () => {
    expect(cardNumber({ key: 100 })).toBe('#100');
  });

  it('shows nothing for a card with no number', () => {
    expect(cardNumber({ key: null, ref: 'WI-1' })).toBeNull();
  });
});

describe('cardRefFor', () => {
  it('keeps a ref naming the card', () => {
    expect(cardRefFor('WI-100', 100)).toBe('WI-100');
    expect(cardRefFor('S4-7', 7)).toBe('S4-7');
  });

  it('drops a ref of another number, a malformed one, or one with no number to name', () => {
    expect(cardRefFor('WI-101', 100)).toBeUndefined();
    expect(cardRefFor('wi-100', 100)).toBeUndefined();
    expect(cardRefFor('TOOLONG-1', 1)).toBeUndefined();
    expect(cardRefFor('1A-1', 1)).toBeUndefined();
    expect(cardRefFor('#100', 100)).toBeUndefined();
    expect(cardRefFor(100, 100)).toBeUndefined();
    expect(cardRefFor('WI-1', null)).toBeUndefined();
  });
});
