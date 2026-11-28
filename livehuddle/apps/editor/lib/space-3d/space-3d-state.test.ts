import { describe, expect, it } from 'vitest';
import { space3DTurnKey } from './space-3d-key';
import { setSpace3DTiltNow, space3DTiltNow } from './space-3d-preference';

describe('the 3D view key (docs/specs/008-canvas/3d-view.md "Turning the camera")', () => {
  const key = (over: Partial<Parameters<typeof space3DTurnKey>[0]> = {}) => ({
    code: 'BracketLeft',
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...over,
  });

  it('turns left on [ and right on ]', () => {
    expect(space3DTurnKey(key())).toBe(-1);
    expect(space3DTurnKey(key({ code: 'BracketRight' }))).toBe(1);
  });

  it('is never Shift+3, nor a bracket with a modifier', () => {
    expect(space3DTurnKey(key({ code: 'Digit3', shiftKey: true }))).toBeNull();
    expect(space3DTurnKey(key({ metaKey: true }))).toBeNull();
    expect(space3DTurnKey(key({ shiftKey: true }))).toBeNull();
  });
});

describe('the tilt now', () => {
  it('holds the tilt a walking press is traced back through', () => {
    setSpace3DTiltNow(52);
    expect(space3DTiltNow()).toBe(52);
    setSpace3DTiltNow(0);
  });
});
