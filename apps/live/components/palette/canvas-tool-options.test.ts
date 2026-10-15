import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

// docs/specs/008-canvas/avatar-mode.md "Where it is offered": Avatar is in the dropdown in Facilitate only.
describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('leaves Avatar out outside Facilitate', () => {
    expect(ids()).not.toContain('avatar');
    expect(ids({ isMobile: false, planMode: true })).not.toContain('avatar');
    expect(ids()).toEqual(expect.arrayContaining(['select', 'pan', 'laser', 'spotlight']));
  });

  it('offers Avatar in Facilitate', () => {
    expect(ids({ isMobile: false, facilitateMode: true })).toContain('avatar');
    expect(ids({ isMobile: true, facilitateMode: true })).toContain('avatar');
  });
});
