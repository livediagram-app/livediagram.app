import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

// docs/specs/008-canvas/avatar-mode.md "Where it lives": a Selection Mode button on the board is Avatar's one way in,
// so the dropdown lists it only while it is the mode in force.
describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('never offers Avatar as a way in, in any mode', () => {
    expect(ids()).not.toContain('avatar');
    expect(ids({ isMobile: false, planMode: true })).not.toContain('avatar');
    expect(ids({ isMobile: true, currentTool: 'laser' })).not.toContain('avatar');
    expect(ids()).toEqual(expect.arrayContaining(['select', 'pan', 'laser', 'spotlight']));
  });

  it('names Avatar while you are in it, so the picker reads true and any other pick leaves it', () => {
    const options = buildCanvasToolOptions({ isMobile: false, currentTool: 'avatar' });
    const avatar = options.find((o) => o.id === 'avatar');
    expect(avatar).toMatchObject({ label: 'Avatar' });
    expect(avatar?.shortcut).toBeUndefined();
    expect(avatar?.disabled).toBeFalsy();
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(['select', 'pan']));
    expect(ids({ isMobile: true, currentTool: 'avatar' })).toContain('avatar');
  });
});
