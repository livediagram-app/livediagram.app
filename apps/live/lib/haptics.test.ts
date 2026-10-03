// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic } from './haptics';

const setPointer = (coarse: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q === '(pointer: coarse)' }));

describe('haptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('vibrates on a touch screen', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    setPointer(true);
    haptic('press');
    haptic('delete');
    expect(vibrate).toHaveBeenNthCalledWith(1, 15);
    expect(vibrate).toHaveBeenNthCalledWith(2, [12, 40, 12]);
  });

  it('stays quiet with a mouse', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    setPointer(false);
    haptic('snap');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op where the Vibration API is missing (Safari)', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    setPointer(true);
    expect(() => haptic('press')).not.toThrow();
  });
});
