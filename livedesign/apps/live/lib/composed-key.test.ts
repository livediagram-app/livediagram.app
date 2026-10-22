import { describe, expect, it } from 'vitest';
import { altGraphHeld, composedWithAlt } from './composed-key';

const altGr = { getModifierState: (m: 'AltGraph') => m === 'AltGraph' };

describe('composedWithAlt', () => {
  it('is a character the keyboard made with Option or AltGr', () => {
    expect(composedWithAlt({ key: '£', code: 'Digit3', altKey: true })).toBe(true);
    expect(composedWithAlt({ key: 'é', altKey: true })).toBe(true);
    expect(composedWithAlt({ key: '€', code: 'KeyE', altKey: true, ...altGr })).toBe(true);
    expect(composedWithAlt({ key: '@', code: 'KeyQ', altKey: true, ...altGr })).toBe(true);
  });

  it('is not a bare Alt chord, or a key without Alt', () => {
    expect(composedWithAlt({ key: 'd', code: 'KeyD', altKey: true })).toBe(false);
    expect(composedWithAlt({ key: '3', code: 'Digit3', altKey: true })).toBe(false);
    expect(composedWithAlt({ key: 'x', altKey: true })).toBe(false);
    expect(composedWithAlt({ key: '£', code: 'Digit3', altKey: false })).toBe(false);
    expect(composedWithAlt({ key: 'ArrowDown', altKey: true })).toBe(false);
  });
});

describe('altGraphHeld', () => {
  it('reads the AltGraph state, and is false where the event has none', () => {
    expect(altGraphHeld({ key: '€', altKey: true, ...altGr })).toBe(true);
    expect(altGraphHeld({ key: 'z', altKey: false })).toBe(false);
  });
});
