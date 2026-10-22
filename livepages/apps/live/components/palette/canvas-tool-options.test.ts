import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers the editing and presenter tools', () => {
    expect(ids()).toEqual(expect.arrayContaining(['select', 'pan', 'laser', 'spotlight']));
  });

  // docs/specs/026-plan/plan-mode.md: Plan mode leaves Eraser and Format out.
  it('leaves Eraser and Format out in Plan mode', () => {
    expect(ids()).toEqual(expect.arrayContaining(['eraser', 'format']));
    const plan = ids({ isMobile: false, planMode: true });
    expect(plan).not.toContain('eraser');
    expect(plan).not.toContain('format');
  });
});
