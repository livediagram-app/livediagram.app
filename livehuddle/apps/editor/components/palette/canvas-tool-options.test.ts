import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

// docs/specs/008-canvas/avatar-mode.md "Where it lives": Avatar is first-class in livehuddle (D7 (a)), so the
// picker lists it straight after Select and Hand, always.
describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers Avatar straight after Select and Hand, on every viewport', () => {
    expect(ids().slice(0, 3)).toEqual(['select', 'pan', 'avatar']);
    expect(ids({ isMobile: true }).slice(0, 3)).toEqual(['select', 'pan', 'avatar']);
  });

  it('keeps Avatar in the first group, with no key, never disabled, even on an empty canvas', () => {
    const avatar = buildCanvasToolOptions({ isMobile: false, canvasEmpty: true }).find(
      (o) => o.id === 'avatar',
    );
    expect(avatar).toMatchObject({ label: 'Avatar', group: 0 });
    expect(avatar?.shortcut).toBeUndefined();
    expect(avatar?.disabled).toBeFalsy();
  });

  it('still greys the content tools on an empty canvas', () => {
    const options = buildCanvasToolOptions({ isMobile: false, canvasEmpty: true });
    expect(options.find((o) => o.id === 'eraser')?.disabled).toBe(true);
    expect(options.find((o) => o.id === 'laser')?.disabled).toBe(true);
  });
});
