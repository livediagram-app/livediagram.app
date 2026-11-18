// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSpace3DPhase } from './space-3d-phase';
import { isSpace3DKey } from './space-3d-key';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: unknown[]): void => {
    track(...a);
  },
}));

describe('the 3D view phases (docs/specs/008-canvas/3d-view.md "Turning it on and off")', () => {
  it('rises then tilts on, falls then flattens off', () => {
    expect(nextSpace3DPhase('flat', true)).toBe('rising');
    expect(nextSpace3DPhase('rising', true)).toBe('rising');
    expect(nextSpace3DPhase('rising', true, { settled: true })).toBe('tilted');
    expect(nextSpace3DPhase('tilted', true)).toBe('tilted');
    expect(nextSpace3DPhase('tilted', false)).toBe('falling');
    expect(nextSpace3DPhase('falling', false)).toBe('falling');
    expect(nextSpace3DPhase('falling', false, { settled: true })).toBe('flat');
    expect(nextSpace3DPhase('flat', false)).toBe('flat');
  });

  it('turns back mid-way without waiting', () => {
    expect(nextSpace3DPhase('rising', false)).toBe('flat');
    expect(nextSpace3DPhase('falling', true)).toBe('tilted');
  });

  it('skips the animation under reduced motion', () => {
    const reducedMotion = true;
    expect(nextSpace3DPhase('flat', true, { reducedMotion })).toBe('tilted');
    expect(nextSpace3DPhase('rising', true, { reducedMotion })).toBe('tilted');
    expect(nextSpace3DPhase('tilted', false, { reducedMotion })).toBe('flat');
    expect(nextSpace3DPhase('falling', false, { reducedMotion })).toBe('flat');
  });
});

describe('the 3D view key', () => {
  const key = (over: Partial<Parameters<typeof isSpace3DKey>[0]> = {}) => ({
    code: 'Digit3',
    shiftKey: true,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...over,
  });
  it('is Shift+3 on any layout', () => {
    expect(isSpace3DKey(key())).toBe(true);
  });
  it('is not 3 alone, a held key, or 3 with another modifier', () => {
    expect(isSpace3DKey(key({ shiftKey: false }))).toBe(false);
    expect(isSpace3DKey(key({ repeat: true }))).toBe(false);
    expect(isSpace3DKey(key({ metaKey: true }))).toBe(false);
    expect(isSpace3DKey(key({ ctrlKey: true }))).toBe(false);
    expect(isSpace3DKey(key({ altKey: true }))).toBe(false);
    expect(isSpace3DKey(key({ code: 'Digit1' }))).toBe(false);
  });
});

describe('the remembered choice (Browser Storage)', () => {
  beforeEach(() => {
    vi.resetModules();
    track.mockClear();
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('is on until turned off, and 2D is remembered in this browser', async () => {
    const pref = await import('./space-3d-preference');
    expect(pref.space3DPreference.get()).toBe(true);
    pref.toggleSpace3D();
    expect(pref.space3DPreference.get()).toBe(false);
    expect(localStorage.getItem(pref.SPACE_3D_STORAGE_KEY)).toBe('0');
    // Turning it off is not counted.
    expect(track).not.toHaveBeenCalled();
    pref.toggleSpace3D();
    expect(pref.space3DPreference.get()).toBe(true);
    expect(localStorage.getItem(pref.SPACE_3D_STORAGE_KEY)).toBe('1');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Space3DView');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('starts in 2D when this browser chose 2D', async () => {
    localStorage.setItem('livehuddle:v2:space-3d', '0');
    const pref = await import('./space-3d-preference');
    expect(pref.space3DPreference.get()).toBe(false);
  });

  it('holds the tilt a walking press is traced back through', async () => {
    const pref = await import('./space-3d-preference');
    expect(pref.space3DTiltNow()).toBe(0);
    pref.setSpace3DTiltNow(52);
    expect(pref.space3DTiltNow()).toBe(52);
  });
});
