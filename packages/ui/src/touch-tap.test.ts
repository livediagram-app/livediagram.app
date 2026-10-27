import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTouchTap } from './touch-tap';

afterEach(() => vi.unstubAllGlobals());

describe('isTouchTap', () => {
  it('is never a keyboard click', () => {
    expect(isTouchTap({ detail: 0, pointerType: 'touch' })).toBe(false);
  });

  it('follows the pointer the click names', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(isTouchTap({ detail: 1, pointerType: 'touch' })).toBe(true);
    expect(isTouchTap({ detail: 1, pointerType: 'mouse' })).toBe(false);
    expect(isTouchTap({ detail: 1, pointerType: 'pen' })).toBe(false);
  });

  it('asks whether the main pointer is coarse when the click names none', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }),
    });
    expect(isTouchTap({ detail: 1 })).toBe(true);
    expect(isTouchTap({ detail: 1, pointerType: '' })).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(isTouchTap({ detail: 1 })).toBe(false);
  });

  it('is not a tap without a window or matchMedia', () => {
    vi.stubGlobal('window', {});
    expect(isTouchTap({ detail: 1 })).toBe(false);
    vi.stubGlobal('window', undefined);
    expect(isTouchTap({ detail: 1 })).toBe(false);
  });
});
